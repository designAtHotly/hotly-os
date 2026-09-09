package penpal

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"hotly-opensource/server/pkg/auth"
	"hotly-opensource/server/pkg/config"
	"hotly-opensource/server/pkg/db"
)

type Handler struct {
	cfg  *config.Config
	svc  *Service
	auth *auth.Service
}

func NewHandler(cfg *config.Config, svc *Service, authSvc *auth.Service) *Handler {
	return &Handler{cfg: cfg, svc: svc, auth: authSvc}
}

func Mount(r chi.Router, h *Handler) {
	r.Get("/penpal", h.offer)
	r.Post("/penpal/checkout", h.checkout)
	r.Post("/penpal/claim", h.claim)
	r.Post("/penpal/recovery", h.recoveryRequest)
	r.Post("/penpal/recovery/consume", h.recoveryConsume)
	r.Post("/webhooks/stripe", h.webhook)
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireUser(h.auth))
		g.Get("/chat", h.guestChat)
		g.Post("/chat/messages", h.guestSend)
		g.Post("/chat/unlock", h.unlockCheckout)
		g.Get("/media/{id}", h.mediaGet)
	})
	r.Get("/penpal/avatar", h.avatar)
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireCreator(h.auth))
		g.Get("/creator/inbox", h.inbox)
		g.Get("/creator/inbox/{id}", h.inboxThread)
		g.Post("/creator/inbox/{id}/reply", h.inboxReply)
		g.Post("/creator/inbox/{id}/block", h.inboxBlock)
		g.Post("/creator/inbox/{id}/unblock", h.inboxUnblock)
		g.Get("/creator/settings", h.creatorSettings)
		g.Patch("/creator/settings", h.patchCreatorSettings)
		g.Post("/creator/media", h.creatorUpload)
		g.Post("/creator/avatar", h.creatorAvatar)
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func (h *Handler) offer(w http.ResponseWriter, req *http.Request) {
	creator, err := h.svc.repo.GetCreator(req.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
		return
	}
	writeJSON(w, http.StatusOK, BuildOffer(h.cfg, creator))
}

func (h *Handler) creatorSettings(w http.ResponseWriter, req *http.Request) {
	creator, err := h.svc.repo.GetCreator(req.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
		return
	}
	writeJSON(w, http.StatusOK, mapSettings(BuildOffer(h.cfg, creator)))
}

type patchSettingsRequest struct {
	DisplayName       string `json:"display_name"`
	Description       string `json:"description"`
	SupportItem       string `json:"support_item"`
	OneTimePriceCents int64  `json:"one_time_price_cents"`
	Price250Cents     int64  `json:"price_250_cents"`
	Price500Cents     int64  `json:"price_500_cents"`
	Price1000Cents    int64  `json:"price_1000_cents"`
	WeeklyPriceCents  int64  `json:"weekly_price_cents"`
	Currency          string `json:"currency"`
}

func (h *Handler) patchCreatorSettings(w http.ResponseWriter, req *http.Request) {
	var body patchSettingsRequest
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_json"})
		return
	}
	if body.Currency != "" && !strings.EqualFold(body.Currency, "usd") {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "usd_only", "message": "Prices are USD only."})
		return
	}
	price250 := body.Price250Cents
	if price250 <= 0 {
		price250 = body.OneTimePriceCents
	}
	offer, err := h.svc.UpdateSettings(req.Context(), CreatorSettingsInput{
		DisplayName:       body.DisplayName,
		Description:       body.Description,
		SupportItem:       body.SupportItem,
		OneTimePriceCents: price250,
		Price500Cents:     body.Price500Cents,
		Price1000Cents:    body.Price1000Cents,
		WeeklyPriceCents:  body.WeeklyPriceCents,
	})
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidSettings):
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_settings", "message": "Check the name, support item, and USD prices."})
		case errors.Is(err, ErrNotFound):
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not_found"})
		default:
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
		}
		return
	}
	writeJSON(w, http.StatusOK, mapSettings(offer))
}

type checkoutRequest struct {
	Email             string `json:"email"`
	Message           string `json:"message"`
	Recurring         bool   `json:"recurring"`
	Amount            int64  `json:"amount"`
	Currency          string `json:"currency"`
	Tier              string `json:"tier"`
	CustomAmountCents int64  `json:"custom_amount_cents"`
}

func (h *Handler) checkout(w http.ResponseWriter, req *http.Request) {
	var body checkoutRequest
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_json"})
		return
	}
	url, err := h.svc.StartCheckout(req.Context(), CheckoutInput{
		Email:             body.Email,
		Message:           body.Message,
		Recurring:         body.Recurring,
		Tier:              body.Tier,
		CustomAmountCents: body.CustomAmountCents,
	})
	if err != nil {
		writeCheckoutError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"url": url})
}

func writeCheckoutError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrStripeNotConfigured):
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "stripe_not_configured"})
	case errors.Is(err, ErrInvalidEmail):
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_email", "message": "Enter a valid email address."})
	case errors.Is(err, ErrMessageRequired):
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "message_required", "message": "Write a note first."})
	case errors.Is(err, ErrMessageTooLong):
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "message_too_long", "message": "That note is over the character limit."})
	case errors.Is(err, ErrCreatorEmail):
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "creator_email", "message": "Use a guest email for Checkout."})
	case errors.Is(err, ErrInvalidTier):
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_tier", "message": "Choose a valid note size or a custom amount above the top tier."})
	default:
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
	}
}

func (h *Handler) webhook(w http.ResponseWriter, req *http.Request) {
	req.Body = http.MaxBytesReader(w, req.Body, 1<<20)
	payload, err := io.ReadAll(req.Body)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_body"})
		return
	}
	if err := h.svc.HandleWebhook(req.Context(), payload, req.Header.Get("Stripe-Signature")); err != nil {
		if errors.Is(err, ErrStripeNotConfigured) {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "stripe_not_configured"})
			return
		}
		if errors.Is(err, ErrNotFound) {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		if strings.Contains(strings.ToLower(err.Error()), "signature") || strings.Contains(strings.ToLower(err.Error()), "timestamp") || strings.Contains(strings.ToLower(err.Error()), "invalid event") {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_signature"})
			return
		}
		slog.Error("stripe webhook failed")
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

type claimRequest struct {
	SessionID string `json:"session_id"`
}

func (h *Handler) claim(w http.ResponseWriter, req *http.Request) {
	var body claimRequest
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_json"})
		return
	}
	row, err := h.svc.Claim(req.Context(), body.SessionID)
	if err != nil {
		switch {
		case errors.Is(err, ErrPaymentPending):
			writeJSON(w, http.StatusConflict, map[string]string{"error": "payment_pending"})
		case errors.Is(err, ErrBlocked):
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "blocked"})
		case errors.Is(err, ErrPaymentIncomplete), errors.Is(err, ErrNotFound):
			writeJSON(w, http.StatusConflict, map[string]string{"error": "payment_incomplete"})
		default:
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
		}
		return
	}
	token, expires, err := h.auth.IssueSession(req.Context(), row.GuestUserID.Int64)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
		return
	}
	auth.WriteSessionCookie(w, token, h.auth.CookieSecure(), expires)
	writeJSON(w, http.StatusOK, map[string]string{"email": row.GuestEmail, "token": "cookie"})
}

type recoveryRequest struct {
	Email string `json:"email"`
}

func (h *Handler) recoveryRequest(w http.ResponseWriter, req *http.Request) {
	var body recoveryRequest
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_json"})
		return
	}
	if err := h.svc.RequestRecovery(req.Context(), body.Email); err != nil {
		switch {
		case errors.Is(err, ErrSendGridNotConfigured):
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "sendgrid_not_configured", "message": "Recovery email is not configured."})
		case errors.Is(err, ErrInvalidEmail):
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_email", "message": "Enter a valid email address."})
		default:
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
		}
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "If we have a conversation for that email, a recovery link is on the way."})
}

type recoveryConsumeRequest struct {
	Token string `json:"token"`
}

func (h *Handler) recoveryConsume(w http.ResponseWriter, req *http.Request) {
	var body recoveryConsumeRequest
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_json"})
		return
	}
	userID, err := h.svc.ConsumeRecovery(req.Context(), body.Token)
	if err != nil {
		switch {
		case errors.Is(err, ErrBlocked):
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "blocked"})
		case errors.Is(err, ErrNotFound):
			writeJSON(w, http.StatusConflict, map[string]string{"error": "invalid_token", "message": "That recovery link is invalid or already used."})
		default:
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
		}
		return
	}
	token, expires, err := h.auth.IssueSession(req.Context(), userID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
		return
	}
	auth.WriteSessionCookie(w, token, h.auth.CookieSecure(), expires)
	writeJSON(w, http.StatusOK, map[string]string{"token": "cookie"})
}

func (h *Handler) guestChat(w http.ResponseWriter, req *http.Request) {
	principal, ok := auth.PrincipalFrom(req.Context())
	if !ok || principal.IsCreator {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not_found"})
		return
	}
	chat, err := h.svc.repo.GuestChat(req.Context(), principal.User.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
		return
	}
	if chat == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not_found"})
		return
	}
	if chat.Conversation.BlockedAt.Valid {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "blocked"})
		return
	}
	writeJSON(w, http.StatusOK, mapGuestChat(h.cfg, chat, principal.User.ID))
}

func (h *Handler) guestSend(w http.ResponseWriter, req *http.Request) {
	principal, ok := auth.PrincipalFrom(req.Context())
	if !ok || principal.IsCreator {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not_found"})
		return
	}
	var body replyRequest
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_json"})
		return
	}
	msg, err := h.svc.SendGuestMessage(req.Context(), principal.User.ID, body.Body)
	if err != nil {
		switch {
		case errors.Is(err, ErrMessageRequired):
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "message_required", "message": "Write a note first."})
		case errors.Is(err, ErrBlocked):
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "blocked"})
		case errors.Is(err, ErrNoAllowance):
			writeJSON(w, http.StatusPaymentRequired, map[string]string{"error": "no_allowance", "message": "Buy another note or start weekly Penpal to send more."})
		case errors.Is(err, ErrAllowanceExceeded):
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "allowance_exceeded", "message": "That would go over this week's 2,000 characters."})
		case errors.Is(err, ErrNotFound):
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not_found"})
		default:
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
		}
		return
	}
	writeJSON(w, http.StatusOK, mapInboxMessage(msg, nil, false))
}

func (h *Handler) inbox(w http.ResponseWriter, req *http.Request) {
	items, err := h.svc.repo.ListInbox(req.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
		return
	}
	out := make([]map[string]any, 0, len(items))
	for _, item := range items {
		out = append(out, mapInboxItem(item, false, h.cfg))
	}
	writeJSON(w, http.StatusOK, map[string]any{"conversations": out})
}

func (h *Handler) inboxThread(w http.ResponseWriter, req *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(req, "id"), 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_id"})
		return
	}
	item, err := h.svc.repo.InboxThread(req.Context(), id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
		return
	}
	if item == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not_found"})
		return
	}
	writeJSON(w, http.StatusOK, mapInboxItem(*item, true, h.cfg))
}

type replyRequest struct {
	Body             string   `json:"body"`
	ObjectKeys       []string `json:"object_keys"`
	UnlockPriceCents int64    `json:"unlock_price_cents"`
}

func (h *Handler) inboxReply(w http.ResponseWriter, req *http.Request) {
	principal, ok := auth.PrincipalFrom(req.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	id, err := strconv.ParseInt(chi.URLParam(req, "id"), 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_id"})
		return
	}
	var body replyRequest
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_json"})
		return
	}
	msg, err := h.svc.Reply(req.Context(), CreatorReply{
		ConversationID:   id,
		AuthorUserID:     principal.User.ID,
		Body:             body.Body,
		ObjectKeys:       body.ObjectKeys,
		UnlockPriceCents: body.UnlockPriceCents,
	})
	if err != nil {
		switch {
		case errors.Is(err, ErrMessageRequired):
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "message_required", "message": "Write a reply or attach a photo."})
		case errors.Is(err, ErrTooManyAttachments):
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "too_many_attachments", "message": "Up to 10 photos or videos per reply."})
		case errors.Is(err, ErrInvalidUnlockPrice):
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_unlock_price"})
		case errors.Is(err, ErrNotFound):
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not_found"})
		default:
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
		}
		return
	}
	item, err := h.svc.repo.InboxThread(req.Context(), id)
	if err != nil || item == nil {
		writeJSON(w, http.StatusOK, mapInboxMessage(msg, nil, false))
		return
	}
	writeJSON(w, http.StatusOK, mapInboxMessage(msg, item.Media, false))
}

func (h *Handler) inboxBlock(w http.ResponseWriter, req *http.Request) {
	h.setInboxBlocked(w, req, true)
}

func (h *Handler) inboxUnblock(w http.ResponseWriter, req *http.Request) {
	h.setInboxBlocked(w, req, false)
}

func (h *Handler) setInboxBlocked(w http.ResponseWriter, req *http.Request, blocked bool) {
	id, err := strconv.ParseInt(chi.URLParam(req, "id"), 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_id"})
		return
	}
	if err := h.svc.SetBlocked(req.Context(), id, blocked); err != nil {
		if errors.Is(err, ErrNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not_found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
		return
	}
	item, err := h.svc.repo.InboxThread(req.Context(), id)
	if err != nil || item == nil {
		writeJSON(w, http.StatusOK, map[string]any{"blocked": blocked})
		return
	}
	writeJSON(w, http.StatusOK, mapInboxItem(*item, false, h.cfg))
}

func mapGuestChat(cfg *config.Config, chat *GuestChat, guestUserID int64) map[string]any {
	msgs := make([]map[string]any, 0, len(chat.Messages))
	for _, m := range chat.Messages {
		msgs = append(msgs, mapGuestMessage(m, guestUserID, chat.Media, locked(chat, m)))
	}
	created := ""
	if chat.Conversation.CreatedAt.Valid {
		created = chat.Conversation.CreatedAt.Time.UTC().Format(time.RFC3339)
	}
	name := cfg.CreatorDisplayName
	if name == "" {
		name = "Creator"
	}
	avatar := any(nil)
	if creatorAvatarURL(cfg) != "" {
		avatar = creatorAvatarURL(cfg)
	}
	return map[string]any{
		"chat": map[string]any{
			"id":         strconv.FormatInt(chat.Conversation.ID, 10),
			"uuid":       strconv.FormatInt(chat.Conversation.ID, 10),
			"created_at": created,
		},
		"artist": map[string]any{
			"id":                     "creator",
			"name":                   name,
			"slug":                   "creator",
			"avatar_url":             avatar,
			"response_promise":       "",
			"chat_attachment_policy": "creator",
		},
		"fan":          map[string]any{"email": chat.GuestEmail, "name": nil},
		"messages":     msgs,
		"subscription": mapSubscription(chat.Subscription, cfg),
	}
}

func locked(chat *GuestChat, m *db.Message) bool {
	if m == nil || !m.UnlockPriceCents.Valid {
		return false
	}
	return chat == nil || !chat.Unlocks[m.ID]
}

func mapGuestMessage(m *db.Message, guestUserID int64, mediaRows []*db.MediaObject, isLocked bool) map[string]any {
	created := ""
	if m.CreatedAt.Valid {
		created = m.CreatedAt.Time.UTC().Format(time.RFC3339)
	}
	sender := "fan"
	if m.AuthorUserID != guestUserID {
		sender = "artist"
	}
	out := map[string]any{
		"id":                  strconv.FormatInt(m.ID, 10),
		"sender_type":         sender,
		"content":             m.Body,
		"created_at":          created,
		"tier":                nil,
		"amount_cents":        nil,
		"is_unlocked":         !isLocked,
		"price_in_cents":      nil,
		"price_currency_code": nil,
		"attachments":         attachmentsForMessage(mediaRows, m.ID, isLocked),
	}
	if m.UnlockPriceCents.Valid {
		out["price_in_cents"] = m.UnlockPriceCents.Int64
		out["price_currency_code"] = "usd"
	}
	return out
}

func creatorAvatarURL(cfg *config.Config) string {
	if cfg == nil {
		return ""
	}
	return "/api/penpal/avatar"
}

func ts(t pgtype.Timestamptz) any {
	if !t.Valid {
		return nil
	}
	return t.Time.UTC().Format(time.RFC3339)
}

func mapInboxMessage(m *db.Message, mediaRows []*db.MediaObject, isLocked bool) map[string]any {
	out := map[string]any{
		"id":             m.ID,
		"body":           m.Body,
		"author_user_id": m.AuthorUserID,
		"created_at":     ts(m.CreatedAt),
		"attachments":    attachmentsForMessage(mediaRows, m.ID, isLocked),
	}
	if m.UnlockPriceCents.Valid {
		out["unlock_price_cents"] = m.UnlockPriceCents.Int64
		out["is_unlocked"] = !isLocked
	}
	return out
}

func mapInboxItem(item InboxItem, withMessages bool, cfg *config.Config) map[string]any {
	c := item.Conversation
	unreplied := false
	if item.LastMessage != nil {
		unreplied = item.LastMessage.AuthorUserID == item.GuestUserID
	} else if len(item.Messages) > 0 {
		last := item.Messages[len(item.Messages)-1]
		unreplied = last.AuthorUserID == item.GuestUserID
	}
	var weekly any
	if cfg != nil && cfg.WeeklyPriceCents > 0 && item.IsSubscriber {
		weekly = cfg.WeeklyPriceCents
	}
	out := map[string]any{
		"conversation": map[string]any{
			"id":               c.ID,
			"guest_user_id":    c.GuestUserID,
			"last_activity_at": ts(c.LastActivityAt),
			"created_at":       ts(c.CreatedAt),
			"blocked_at":       ts(c.BlockedAt),
		},
		"guest_email":               item.GuestEmail,
		"guest_user_id":             item.GuestUserID,
		"unreplied":                 unreplied,
		"total_paid_cents":          item.TotalPaidCents,
		"is_subscriber":             item.IsSubscriber,
		"subscription_amount_cents": weekly,
	}
	if item.LastMessage != nil {
		out["last_message"] = mapInboxMessage(item.LastMessage, item.Media, false)
	}
	if withMessages {
		msgs := make([]map[string]any, 0, len(item.Messages))
		for _, m := range item.Messages {
			msgs = append(msgs, mapInboxMessage(m, item.Media, false))
		}
		out["messages"] = msgs
	}
	return out
}

func mapSubscription(sub *db.Subscription, cfg *config.Config) map[string]any {
	out := map[string]any{
		"status":               "none",
		"tier":                 nil,
		"amount_in_cents":      nil,
		"currency_code":        "usd",
		"current_period_start": nil,
		"current_period_end":   nil,
		"paused_until":         nil,
		"subscription_uuid":    nil,
		"chars_used":           0,
	}
	if sub == nil {
		return out
	}
	status := sub.Status
	switch status {
	case "active", "trialing", "past_due":
		status = "active"
	case "canceled":
		status = "cancelled"
	}
	out["status"] = status
	out["subscription_uuid"] = sub.StripeSubscriptionID
	out["chars_used"] = sub.CharsUsed
	if cfg != nil && cfg.WeeklyPriceCents > 0 {
		out["amount_in_cents"] = cfg.WeeklyPriceCents
	}
	if sub.CurrentPeriodStart.Valid {
		out["current_period_start"] = sub.CurrentPeriodStart.Time.UTC().Format(time.RFC3339)
	}
	if sub.CurrentPeriodEnd.Valid {
		out["current_period_end"] = sub.CurrentPeriodEnd.Time.UTC().Format(time.RFC3339)
	}
	return out
}
