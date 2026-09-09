package penpal

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"hotly-opensource/server/pkg/auth"
	"hotly-opensource/server/pkg/billing"
	"hotly-opensource/server/pkg/config"
	"hotly-opensource/server/pkg/mailer"
	"hotly-opensource/server/pkg/media"
)

func testCfg() *config.Config {
	return &config.Config{
		PublicAppURL:          "http://localhost",
		CreatorEmail:          "creator@example.com",
		CreatorDisplayName:    "Ada",
		SupportItem:           "coffee",
		OneTimePriceCents:     500,
		OneTimeCharacterLimit: 250,
		Price500Cents:         1000,
		Price1000Cents:        1500,
		WeeklyPriceCents:      1500,
		WeeklyAllowanceChars:  2000,
		RecoveryTokenSecret:   "test-recovery-token-secret-32b!!",
		Stripe: config.StripeConfig{
			SecretKey:      "sk_test_x",
			PublishableKey: "pk_test_x",
			WebhookSecret:  "whsec_test",
		},
	}
}

func testAPI() (http.Handler, *billing.Fake, *Mem, *auth.Service) {
	handler, fake, mem, authSvc, _ := testStack()
	return handler, fake, mem, authSvc
}

func testStack() (http.Handler, *billing.Fake, *Mem, *auth.Service, *mailer.Fake) {
	mem := NewMem()
	fake := billing.NewFake()
	mail := mailer.NewFake()
	cfg := testCfg()
	authSvc := auth.NewService(mem, nil, auth.CreatorSettings{
		Email:                 cfg.CreatorEmail,
		DisplayName:           cfg.CreatorDisplayName,
		SupportItem:           cfg.SupportItem,
		OneTimePriceCents:     cfg.OneTimePriceCents,
		OneTimeCharacterLimit: int32(cfg.OneTimeCharacterLimit),
		WeeklyPriceCents:      1500,
	}, false)
	h := NewHandler(cfg, NewService(cfg, mem, fake, mail, media.NewMemory()), authSvc)
	r := chi.NewRouter()
	Mount(r, h)
	return r, fake, mem, authSvc, mail
}

func doJSON(handler http.Handler, method, path string, body any, cookies ...*http.Cookie) *httptest.ResponseRecorder {
	var rdr io.Reader
	if body != nil {
		raw, _ := json.Marshal(body)
		rdr = bytes.NewReader(raw)
	}
	req := httptest.NewRequest(method, path, rdr)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	for _, c := range cookies {
		req.AddCookie(c)
	}
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func startPaidCheckout(t *testing.T, handler http.Handler, fake *billing.Fake) string {
	t.Helper()
	rec := doJSON(handler, http.MethodPost, "/penpal/checkout", map[string]any{
		"email":    "guest@example.com",
		"message":  "Hello from the cheap seats.",
		"amount":   1,
		"currency": "ngn",
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("checkout status %d body %s", rec.Code, rec.Body.String())
	}
	if fake.Last.AmountCents != 500 {
		t.Fatalf("server must charge 500 cents, got %d", fake.Last.AmountCents)
	}
	if fake.Last.GuestEmail != "guest@example.com" {
		t.Fatalf("email %s", fake.Last.GuestEmail)
	}
	return fake.LastID
}

func TestCheckoutIgnoresBrowserAmountAndCurrency(t *testing.T) {
	handler, fake, _, _ := testAPI()
	startPaidCheckout(t, handler, fake)
}

func TestCheckoutCreatesWeeklySession(t *testing.T) {
	handler, fake, _, _ := testAPI()
	rec := doJSON(handler, http.MethodPost, "/penpal/checkout", map[string]any{
		"email":     "guest@example.com",
		"message":   "Starting a weekly note.",
		"recurring": true,
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("weekly checkout %d %s", rec.Code, rec.Body.String())
	}
	if !fake.Last.Recurring || fake.Last.AmountCents != 1500 {
		t.Fatalf("server must charge weekly USD, got recurring=%t cents=%d", fake.Last.Recurring, fake.Last.AmountCents)
	}
}

func TestCheckoutRejectsOverlongMessages(t *testing.T) {
	handler, _, _, _ := testAPI()
	rec := doJSON(handler, http.MethodPost, "/penpal/checkout", map[string]any{
		"email":   "guest@example.com",
		"message": strings.Repeat("x", 251),
	})
	if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "message_too_long") {
		t.Fatalf("limit: %d %s", rec.Code, rec.Body.String())
	}
}

func TestCheckoutChargesNamedTiersAndIgnoresClientAmount(t *testing.T) {
	handler, fake, _, _ := testAPI()
	rec := doJSON(handler, http.MethodPost, "/penpal/checkout", map[string]any{
		"email":    "guest@example.com",
		"message":  strings.Repeat("x", 251),
		"tier":     "500",
		"amount":   1,
		"currency": "ngn",
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("500-char tier %d %s", rec.Code, rec.Body.String())
	}
	if fake.Last.AmountCents != 1000 {
		t.Fatalf("500-char tier must charge $10, got %d", fake.Last.AmountCents)
	}
	rec = doJSON(handler, http.MethodPost, "/penpal/checkout", map[string]any{
		"email":   "guest@example.com",
		"message": "A longer note.",
		"tier":    "1000",
		"amount":  1,
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("1000-char tier %d %s", rec.Code, rec.Body.String())
	}
	if fake.Last.AmountCents != 1500 {
		t.Fatalf("1000-char tier must charge $15, got %d", fake.Last.AmountCents)
	}
}

func TestCheckoutCustomAmountMustBeatTopTier(t *testing.T) {
	handler, fake, _, _ := testAPI()
	tooLow := doJSON(handler, http.MethodPost, "/penpal/checkout", map[string]any{
		"email":               "guest@example.com",
		"message":             "Custom note.",
		"tier":                "custom",
		"custom_amount_cents": 1500,
	})
	if tooLow.Code != http.StatusBadRequest || !strings.Contains(tooLow.Body.String(), "invalid_tier") {
		t.Fatalf("custom floor: %d %s", tooLow.Code, tooLow.Body.String())
	}
	ok := doJSON(handler, http.MethodPost, "/penpal/checkout", map[string]any{
		"email":               "guest@example.com",
		"message":             strings.Repeat("x", 1200),
		"tier":                "custom",
		"custom_amount_cents": 1600,
	})
	if ok.Code != http.StatusOK {
		t.Fatalf("custom checkout %d %s", ok.Code, ok.Body.String())
	}
	if fake.Last.AmountCents != 1600 {
		t.Fatalf("custom must charge guest amount, got %d", fake.Last.AmountCents)
	}
	unknown := doJSON(handler, http.MethodPost, "/penpal/checkout", map[string]any{
		"email":   "guest@example.com",
		"message": "hi",
		"tier":    "espresso",
	})
	if unknown.Code != http.StatusBadRequest || !strings.Contains(unknown.Body.String(), "invalid_tier") {
		t.Fatalf("unknown tier: %d %s", unknown.Code, unknown.Body.String())
	}
}

func TestCheckoutRequiresStripe(t *testing.T) {
	mem := NewMem()
	cfg := testCfg()
	authSvc := auth.NewService(mem, nil, auth.CreatorSettings{Email: cfg.CreatorEmail}, false)
	h := NewHandler(cfg, NewService(cfg, mem, nil, nil, nil), authSvc)
	r := chi.NewRouter()
	Mount(r, h)
	rec := doJSON(r, http.MethodPost, "/penpal/checkout", map[string]any{
		"email":   "guest@example.com",
		"message": "hi",
	})
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status %d", rec.Code)
	}
}

func TestWebhookRejectsInvalidSignature(t *testing.T) {
	handler, fake, mem, _ := testAPI()
	sessionID := startPaidCheckout(t, handler, fake)
	req := httptest.NewRequest(http.MethodPost, "/webhooks/stripe", strings.NewReader(`{"id":"evt_bad","type":"checkout.session.completed","session_id":"`+sessionID+`","amount_cents":500}`))
	req.Header.Set("Stripe-Signature", "nope")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	if mem.MessageCount() != 0 {
		t.Fatal("invalid signature must not create a message")
	}
}

func postWebhook(handler http.Handler, payload string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/webhooks/stripe", strings.NewReader(payload))
	req.Header.Set("Stripe-Signature", billing.TestSignature)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func TestWebhookCompletedCreatesOneMessageAndIsIdempotent(t *testing.T) {
	handler, fake, mem, _ := testAPI()
	sessionID := startPaidCheckout(t, handler, fake)
	payload := `{"id":"evt_1","type":"checkout.session.completed","session_id":"` + sessionID + `","amount_cents":500,"payment_status":"paid","payment_intent_id":"pi_1"}`
	rec := postWebhook(handler, payload)
	if rec.Code != http.StatusOK {
		t.Fatalf("webhook %d %s", rec.Code, rec.Body.String())
	}
	if mem.MessageCount() != 1 || mem.PaymentCount() != 1 {
		t.Fatalf("messages=%d payments=%d", mem.MessageCount(), mem.PaymentCount())
	}
	rec = postWebhook(handler, payload)
	if rec.Code != http.StatusOK {
		t.Fatalf("replay %d", rec.Code)
	}
	if mem.MessageCount() != 1 || mem.PaymentCount() != 1 {
		t.Fatalf("replay duplicated work messages=%d payments=%d", mem.MessageCount(), mem.PaymentCount())
	}
	rec = postWebhook(handler, `{"id":"evt_2","type":"checkout.session.completed","session_id":"`+sessionID+`","amount_cents":500,"payment_status":"paid"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("second event %d", rec.Code)
	}
	if mem.MessageCount() != 1 || mem.PaymentCount() != 1 {
		t.Fatal("out-of-order completed replay must not duplicate the message")
	}
}

func TestWebhookExpiredDoesNotUncompleteAndFailureIsRetryable(t *testing.T) {
	handler, fake, mem, _ := testAPI()
	sessionID := startPaidCheckout(t, handler, fake)
	mem.FailNextApply()
	rec := postWebhook(handler, `{"id":"evt_fail","type":"checkout.session.completed","session_id":"`+sessionID+`","amount_cents":500,"payment_status":"paid"}`)
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("failed process %d", rec.Code)
	}
	if mem.EventCount() != 0 || mem.MessageCount() != 0 {
		t.Fatal("failed processing must remain retryable")
	}
	rec = postWebhook(handler, `{"id":"evt_fail","type":"checkout.session.completed","session_id":"`+sessionID+`","amount_cents":500,"payment_status":"paid"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("retry %d %s", rec.Code, rec.Body.String())
	}
	if mem.MessageCount() != 1 {
		t.Fatal("retry should create the message once")
	}
	rec = postWebhook(handler, `{"id":"evt_exp","type":"checkout.session.expired","session_id":"`+sessionID+`"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("expired %d", rec.Code)
	}
	row, err := mem.GetCheckoutByStripeSession(context.Background(), sessionID)
	if err != nil || row.Status != "completed" {
		t.Fatalf("expired must not overwrite completed, status=%s err=%v", row.Status, err)
	}
}

func TestWebhookIgnoresUnrelatedEvents(t *testing.T) {
	handler, fake, mem, _ := testAPI()
	_ = startPaidCheckout(t, handler, fake)
	rec := postWebhook(handler, `{"id":"evt_charge","type":"charge.succeeded"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("unrelated event %d %s", rec.Code, rec.Body.String())
	}
	if mem.MessageCount() != 0 || mem.PaymentCount() != 0 {
		t.Fatal("charge.succeeded must not complete checkout")
	}
}

func TestClaimIssuesCookieAfterServerConfirmation(t *testing.T) {
	handler, fake, _, _ := testAPI()
	sessionID := startPaidCheckout(t, handler, fake)
	rec := doJSON(handler, http.MethodPost, "/penpal/claim", map[string]string{"session_id": sessionID})
	if rec.Code != http.StatusConflict {
		t.Fatalf("pending claim %d %s", rec.Code, rec.Body.String())
	}
	postWebhook(handler, `{"id":"evt_1","type":"checkout.session.completed","session_id":"`+sessionID+`","amount_cents":500,"payment_status":"paid"}`)
	rec = doJSON(handler, http.MethodPost, "/penpal/claim", map[string]string{"session_id": sessionID})
	if rec.Code != http.StatusOK {
		t.Fatalf("claim %d %s", rec.Code, rec.Body.String())
	}
	var cookie *http.Cookie
	for _, c := range rec.Result().Cookies() {
		if c.Name == auth.SessionCookieName {
			cookie = c
		}
	}
	if cookie == nil || cookie.HttpOnly == false {
		t.Fatal("claim must set an HTTP-only session cookie")
	}
	chat := doJSON(handler, http.MethodGet, "/chat", nil, cookie)
	if chat.Code != http.StatusOK {
		t.Fatalf("chat %d %s", chat.Code, chat.Body.String())
	}
	if !strings.Contains(chat.Body.String(), "Hello from the cheap seats.") {
		t.Fatalf("chat missing paid message: %s", chat.Body.String())
	}
}

func TestCreatorCanReplyToPaidConversation(t *testing.T) {
	handler, fake, mem, authSvc := testAPI()
	sessionID := startPaidCheckout(t, handler, fake)
	postWebhook(handler, `{"id":"evt_1","type":"checkout.session.completed","session_id":"`+sessionID+`","amount_cents":500,"payment_status":"paid"}`)

	creator, err := mem.CreateUser(context.Background(), "fb-creator", "creator@example.com", "Ada")
	if err != nil {
		t.Fatal(err)
	}
	if err := mem.UpsertCreatorUser(context.Background(), "creator@example.com", "Ada", "coffee", 500, 250, 1500, creator.ID); err != nil {
		t.Fatal(err)
	}
	token, expires, err := authSvc.IssueSession(context.Background(), creator.ID)
	if err != nil {
		t.Fatal(err)
	}
	cookie := &http.Cookie{Name: auth.SessionCookieName, Value: token, Expires: expires}

	inbox := doJSON(handler, http.MethodGet, "/creator/inbox", nil, cookie)
	if inbox.Code != http.StatusOK {
		t.Fatalf("inbox %d %s", inbox.Code, inbox.Body.String())
	}
	var body struct {
		Conversations []struct {
			Conversation struct {
				ID int64 `json:"id"`
			} `json:"conversation"`
		} `json:"conversations"`
	}
	if err := json.Unmarshal(inbox.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if len(body.Conversations) != 1 {
		t.Fatalf("expected 1 conversation, got %s", inbox.Body.String())
	}
	id := body.Conversations[0].Conversation.ID
	if id == 0 {
		t.Fatalf("conversation id missing: %s", inbox.Body.String())
	}
	reply := doJSON(handler, http.MethodPost, "/creator/inbox/"+strconv.FormatInt(id, 10)+"/reply", map[string]string{"body": "Thanks for writing."}, cookie)
	if reply.Code != http.StatusOK {
		t.Fatalf("reply %d %s", reply.Code, reply.Body.String())
	}
	if mem.MessageCount() != 2 {
		t.Fatalf("expected guest message + creator reply, got %d", mem.MessageCount())
	}
}

func TestWeeklyWebhookAllowsFollowUpAndCancelRemovesAccess(t *testing.T) {
	handler, fake, _, _ := testAPI()
	rec := doJSON(handler, http.MethodPost, "/penpal/checkout", map[string]any{
		"email":     "guest@example.com",
		"message":   "First weekly letter.",
		"recurring": true,
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("checkout %d %s", rec.Code, rec.Body.String())
	}
	sessionID := fake.LastID
	now := int(time.Now().Unix())
	payload := `{"id":"evt_sub_1","type":"checkout.session.completed","session_id":"` + sessionID + `","amount_cents":1500,"payment_status":"paid","subscription_id":"sub_1","subscription_status":"active","period_start":` + strconv.Itoa(now) + `,"period_end":` + strconv.Itoa(now+7*24*3600) + `}`
	wh := postWebhook(handler, payload)
	if wh.Code != http.StatusOK {
		t.Fatalf("webhook %d %s", wh.Code, wh.Body.String())
	}
	claim := doJSON(handler, http.MethodPost, "/penpal/claim", map[string]string{"session_id": sessionID})
	if claim.Code != http.StatusOK {
		t.Fatalf("claim %d %s", claim.Code, claim.Body.String())
	}
	var cookie *http.Cookie
	for _, c := range claim.Result().Cookies() {
		if c.Name == auth.SessionCookieName {
			cookie = c
		}
	}
	if cookie == nil {
		t.Fatal("missing session cookie")
	}
	chat := doJSON(handler, http.MethodGet, "/chat", nil, cookie)
	if chat.Code != http.StatusOK || !strings.Contains(chat.Body.String(), `"status":"active"`) {
		t.Fatalf("chat %d %s", chat.Code, chat.Body.String())
	}
	send := doJSON(handler, http.MethodPost, "/chat/messages", map[string]string{"body": "Another note this week."}, cookie)
	if send.Code != http.StatusOK {
		t.Fatalf("follow-up %d %s", send.Code, send.Body.String())
	}
	over := doJSON(handler, http.MethodPost, "/chat/messages", map[string]string{"body": strings.Repeat("x", 2000)}, cookie)
	if over.Code != http.StatusBadRequest || !strings.Contains(over.Body.String(), "allowance_exceeded") {
		t.Fatalf("over budget %d %s", over.Code, over.Body.String())
	}
	cancel := postWebhook(handler, `{"id":"evt_sub_cancel","type":"customer.subscription.deleted","subscription_id":"sub_1","subscription_status":"canceled"}`)
	if cancel.Code != http.StatusOK {
		t.Fatalf("cancel %d %s", cancel.Code, cancel.Body.String())
	}
	denied := doJSON(handler, http.MethodPost, "/chat/messages", map[string]string{"body": "after cancel"}, cookie)
	if denied.Code != http.StatusPaymentRequired {
		t.Fatalf("canceled send %d %s", denied.Code, denied.Body.String())
	}
}

func claimCookie(t *testing.T, handler http.Handler, sessionID string) *http.Cookie {
	t.Helper()
	rec := doJSON(handler, http.MethodPost, "/penpal/claim", map[string]string{"session_id": sessionID})
	if rec.Code != http.StatusOK {
		t.Fatalf("claim %d %s", rec.Code, rec.Body.String())
	}
	for _, c := range rec.Result().Cookies() {
		if c.Name == auth.SessionCookieName {
			return c
		}
	}
	t.Fatal("missing session cookie")
	return nil
}

func creatorSession(t *testing.T, mem *Mem, authSvc *auth.Service) *http.Cookie {
	t.Helper()
	creator, err := mem.CreateUser(context.Background(), "fb-creator", "creator@example.com", "Ada")
	if err != nil {
		t.Fatal(err)
	}
	if err := mem.UpsertCreatorUser(context.Background(), "creator@example.com", "Ada", "coffee", 500, 250, 1500, creator.ID); err != nil {
		t.Fatal(err)
	}
	token, expires, err := authSvc.IssueSession(context.Background(), creator.ID)
	if err != nil {
		t.Fatal(err)
	}
	return &http.Cookie{Name: auth.SessionCookieName, Value: token, Expires: expires}
}

func inboxConversationID(t *testing.T, handler http.Handler, cookie *http.Cookie) int64 {
	t.Helper()
	inbox := doJSON(handler, http.MethodGet, "/creator/inbox", nil, cookie)
	if inbox.Code != http.StatusOK {
		t.Fatalf("inbox %d %s", inbox.Code, inbox.Body.String())
	}
	var body struct {
		Conversations []struct {
			Conversation struct {
				ID int64 `json:"id"`
			} `json:"conversation"`
		} `json:"conversations"`
	}
	if err := json.Unmarshal(inbox.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if len(body.Conversations) != 1 || body.Conversations[0].Conversation.ID == 0 {
		t.Fatalf("expected 1 conversation, got %s", inbox.Body.String())
	}
	return body.Conversations[0].Conversation.ID
}

func TestInboxShowsUnrepliedPaymentAndSubscriberContext(t *testing.T) {
	handler, fake, mem, authSvc := testAPI()
	rec := doJSON(handler, http.MethodPost, "/penpal/checkout", map[string]any{
		"email":     "guest@example.com",
		"message":   "Starting a weekly note.",
		"recurring": true,
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("checkout %d %s", rec.Code, rec.Body.String())
	}
	now := int(time.Now().Unix())
	wh := postWebhook(handler, `{"id":"evt_sub_ctx","type":"checkout.session.completed","session_id":"`+fake.LastID+`","amount_cents":1500,"payment_status":"paid","subscription_id":"sub_ctx","subscription_status":"active","period_start":`+strconv.Itoa(now)+`,"period_end":`+strconv.Itoa(now+7*24*3600)+`}`)
	if wh.Code != http.StatusOK {
		t.Fatalf("webhook %d %s", wh.Code, wh.Body.String())
	}
	cookie := creatorSession(t, mem, authSvc)
	inbox := doJSON(handler, http.MethodGet, "/creator/inbox", nil, cookie)
	if inbox.Code != http.StatusOK {
		t.Fatalf("inbox %d %s", inbox.Code, inbox.Body.String())
	}
	if !strings.Contains(inbox.Body.String(), `"unreplied":true`) {
		t.Fatalf("expected unreplied conversation: %s", inbox.Body.String())
	}
	if !strings.Contains(inbox.Body.String(), `"total_paid_cents":1500`) {
		t.Fatalf("expected paid total: %s", inbox.Body.String())
	}
	if !strings.Contains(inbox.Body.String(), `"is_subscriber":true`) {
		t.Fatalf("expected subscriber flag: %s", inbox.Body.String())
	}
}

func TestBlockUnblockRemovesAndRestoresGuestAccess(t *testing.T) {
	handler, fake, mem, authSvc := testAPI()
	sessionID := startPaidCheckout(t, handler, fake)
	postWebhook(handler, `{"id":"evt_block","type":"checkout.session.completed","session_id":"`+sessionID+`","amount_cents":500,"payment_status":"paid"}`)
	guest := claimCookie(t, handler, sessionID)
	if rec := doJSON(handler, http.MethodGet, "/chat", nil, guest); rec.Code != http.StatusOK {
		t.Fatalf("chat before block %d %s", rec.Code, rec.Body.String())
	}

	creator := creatorSession(t, mem, authSvc)
	id := inboxConversationID(t, handler, creator)
	path := "/creator/inbox/" + strconv.FormatInt(id, 10)
	block := doJSON(handler, http.MethodPost, path+"/block", nil, creator)
	if block.Code != http.StatusOK || !strings.Contains(block.Body.String(), `"blocked_at"`) {
		t.Fatalf("block %d %s", block.Code, block.Body.String())
	}
	if rec := doJSON(handler, http.MethodGet, "/chat", nil, guest); rec.Code != http.StatusForbidden {
		t.Fatalf("blocked chat %d %s", rec.Code, rec.Body.String())
	}
	if rec := doJSON(handler, http.MethodPost, "/chat/messages", map[string]string{"body": "still here?"}, guest); rec.Code != http.StatusForbidden {
		t.Fatalf("blocked send %d %s", rec.Code, rec.Body.String())
	}
	if rec := doJSON(handler, http.MethodPost, "/penpal/claim", map[string]string{"session_id": sessionID}); rec.Code != http.StatusForbidden {
		t.Fatalf("blocked claim %d %s", rec.Code, rec.Body.String())
	}

	unblock := doJSON(handler, http.MethodPost, path+"/unblock", nil, creator)
	if unblock.Code != http.StatusOK {
		t.Fatalf("unblock %d %s", unblock.Code, unblock.Body.String())
	}
	if rec := doJSON(handler, http.MethodGet, "/chat", nil, guest); rec.Code != http.StatusOK {
		t.Fatalf("chat after unblock %d %s", rec.Code, rec.Body.String())
	}
	if rec := doJSON(handler, http.MethodPost, "/penpal/claim", map[string]string{"session_id": sessionID}); rec.Code != http.StatusOK {
		t.Fatalf("claim after unblock %d %s", rec.Code, rec.Body.String())
	}
}

func TestRecoveryEmailOpensChatAndTokenIsSingleUse(t *testing.T) {
	handler, fake, _, _, mail := testStack()
	sessionID := startPaidCheckout(t, handler, fake)
	postWebhook(handler, `{"id":"evt_rec","type":"checkout.session.completed","session_id":"`+sessionID+`","amount_cents":500,"payment_status":"paid"}`)
	beforeUnknown := mail.Count()

	unknown := doJSON(handler, http.MethodPost, "/penpal/recovery", map[string]string{"email": "nobody@example.com"})
	if unknown.Code != http.StatusOK {
		t.Fatalf("unknown email %d %s", unknown.Code, unknown.Body.String())
	}
	if mail.Count() != beforeUnknown {
		t.Fatal("unknown email must not send mail")
	}

	req := doJSON(handler, http.MethodPost, "/penpal/recovery", map[string]string{"email": "guest@example.com"})
	if req.Code != http.StatusOK {
		t.Fatalf("recovery request %d %s", req.Code, req.Body.String())
	}
	msg := mail.Last()
	if msg == nil || msg.To != "guest@example.com" {
		t.Fatal("expected recovery email")
	}
	if strings.Contains(msg.Text, "token_hash") {
		t.Fatal("email must not include stored hash")
	}
	idx := strings.Index(msg.Text, "http://localhost/auth/chat-recovery?token=")
	if idx < 0 {
		t.Fatalf("missing recovery link in %q", msg.Text)
	}
	token := strings.TrimSpace(msg.Text[idx+len("http://localhost/auth/chat-recovery?token="):])
	if i := strings.IndexAny(token, " \n"); i >= 0 {
		token = token[:i]
	}
	if token == "" {
		t.Fatal("empty token")
	}

	consume := doJSON(handler, http.MethodPost, "/penpal/recovery/consume", map[string]string{"token": token})
	if consume.Code != http.StatusOK {
		t.Fatalf("consume %d %s", consume.Code, consume.Body.String())
	}
	var cookie *http.Cookie
	for _, c := range consume.Result().Cookies() {
		if c.Name == auth.SessionCookieName {
			cookie = c
		}
	}
	if cookie == nil {
		t.Fatal("consume must set session cookie")
	}
	chat := doJSON(handler, http.MethodGet, "/chat", nil, cookie)
	if chat.Code != http.StatusOK || !strings.Contains(chat.Body.String(), "Hello from the cheap seats.") {
		t.Fatalf("chat after recovery %d %s", chat.Code, chat.Body.String())
	}
	replay := doJSON(handler, http.MethodPost, "/penpal/recovery/consume", map[string]string{"token": token})
	if replay.Code != http.StatusConflict {
		t.Fatalf("replay %d %s", replay.Code, replay.Body.String())
	}
}

func TestRecoveryRequiresSendGrid(t *testing.T) {
	mem := NewMem()
	cfg := testCfg()
	authSvc := auth.NewService(mem, nil, auth.CreatorSettings{Email: cfg.CreatorEmail}, false)
	h := NewHandler(cfg, NewService(cfg, mem, billing.NewFake(), nil, nil), authSvc)
	r := chi.NewRouter()
	Mount(r, h)
	rec := doJSON(r, http.MethodPost, "/penpal/recovery", map[string]string{"email": "guest@example.com"})
	if rec.Code != http.StatusServiceUnavailable || !strings.Contains(rec.Body.String(), "sendgrid_not_configured") {
		t.Fatalf("status %d %s", rec.Code, rec.Body.String())
	}
}

func TestCreatorSettingsUpdateChangesPublicOffer(t *testing.T) {
	handler, _, mem, authSvc := testAPI()
	cookie := creatorSession(t, mem, authSvc)
	before := doJSON(handler, http.MethodGet, "/creator/settings", nil, cookie)
	if before.Code != http.StatusOK || !strings.Contains(before.Body.String(), `"one_time_price_cents":500`) {
		t.Fatalf("settings get %d %s", before.Code, before.Body.String())
	}
	patch := doJSON(handler, http.MethodPatch, "/creator/settings", map[string]any{
		"display_name":         "Ada Lovelace",
		"description":          "Notes from the desk.",
		"support_item":         "lemonade",
		"one_time_price_cents": 700,
		"price_500_cents":      1100,
		"price_1000_cents":     1800,
		"weekly_price_cents":   2200,
		"currency":             "usd",
	}, cookie)
	if patch.Code != http.StatusOK {
		t.Fatalf("patch %d %s", patch.Code, patch.Body.String())
	}
	offer := doJSON(handler, http.MethodGet, "/penpal", nil)
	if offer.Code != http.StatusOK {
		t.Fatalf("offer %d %s", offer.Code, offer.Body.String())
	}
	body := offer.Body.String()
	for _, want := range []string{
		`"display_name":"Ada Lovelace"`,
		`"support_item":"lemonade"`,
		`"one_time_price_cents":700`,
		`"price_250_cents":700`,
		`"price_500_cents":1100`,
		`"price_1000_cents":1800`,
		`"weekly_price_cents":2200`,
		`"one_time_character_limit":250`,
		`"currency":"usd"`,
	} {
		if !strings.Contains(body, want) {
			t.Fatalf("public offer missing %s in %s", want, body)
		}
	}
	ngn := doJSON(handler, http.MethodPatch, "/creator/settings", map[string]any{
		"display_name":         "Ada",
		"support_item":         "coffee",
		"one_time_price_cents": 500,
		"price_500_cents":      1000,
		"price_1000_cents":     1500,
		"weekly_price_cents":   1500,
		"currency":             "ngn",
	}, cookie)
	if ngn.Code != http.StatusBadRequest || !strings.Contains(ngn.Body.String(), "usd_only") {
		t.Fatalf("ngn %d %s", ngn.Code, ngn.Body.String())
	}
	bad := doJSON(handler, http.MethodPatch, "/creator/settings", map[string]any{
		"display_name":         "",
		"support_item":         "coffee",
		"one_time_price_cents": 500,
		"price_500_cents":      1000,
		"price_1000_cents":     1500,
		"weekly_price_cents":   1500,
	}, cookie)
	if bad.Code != http.StatusBadRequest {
		t.Fatalf("empty name %d %s", bad.Code, bad.Body.String())
	}
	inverted := doJSON(handler, http.MethodPatch, "/creator/settings", map[string]any{
		"display_name":         "Ada",
		"support_item":         "coffee",
		"one_time_price_cents": 1500,
		"price_500_cents":      1000,
		"price_1000_cents":     500,
		"weekly_price_cents":   1500,
	}, cookie)
	if inverted.Code != http.StatusBadRequest {
		t.Fatalf("inverted ladder %d %s", inverted.Code, inverted.Body.String())
	}
}
