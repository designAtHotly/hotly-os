package penpal

import (
	"context"
	"errors"
	"net/mail"
	"strings"
	"time"
	"unicode/utf8"

	"hotly-opensource/server/pkg/billing"
	"hotly-opensource/server/pkg/config"
	"hotly-opensource/server/pkg/db"
	"hotly-opensource/server/pkg/mailer"
	"hotly-opensource/server/pkg/media"
)

var (
	ErrStripeNotConfigured   = errors.New("stripe_not_configured")
	ErrWeeklyUnavailable     = errors.New("weekly_unavailable")
	ErrInvalidEmail          = errors.New("invalid_email")
	ErrMessageRequired       = errors.New("message_required")
	ErrMessageTooLong        = errors.New("message_too_long")
	ErrCreatorEmail          = errors.New("creator_email")
	ErrPaymentPending        = errors.New("payment_pending")
	ErrPaymentIncomplete     = errors.New("payment_incomplete")
	ErrNotFound              = errors.New("not_found")
	ErrBlocked               = errors.New("blocked")
	ErrNoAllowance           = errors.New("no_allowance")
	ErrAllowanceExceeded     = errors.New("allowance_exceeded")
	ErrSendGridNotConfigured = errors.New("sendgrid_not_configured")
	ErrInvalidSettings       = errors.New("invalid_settings")
	ErrMediaNotConfigured    = errors.New("media_not_configured")
	ErrLocked                = errors.New("locked")
	ErrAlreadyUnlocked       = errors.New("already_unlocked")
	ErrInvalidUnlockPrice    = errors.New("invalid_unlock_price")
	ErrTooManyAttachments    = errors.New("too_many_attachments")
)

type Repository interface {
	GetCreator(ctx context.Context) (*db.Creator, error)
	CreateCheckout(ctx context.Context, kind, email, message string, amountCents int64, charLimit int32) (*db.Checkout, error)
	CreateUnlockCheckout(ctx context.Context, email string, guestUserID, messageID, amountCents int64) (*db.Checkout, error)
	SetCheckoutStripeSession(ctx context.Context, id int64, sessionID string) error
	GetCheckoutByStripeSession(ctx context.Context, sessionID string) (*db.Checkout, error)
	GetCheckoutByPublicID(ctx context.Context, publicID string) (*db.Checkout, error)
	ApplyEvent(ctx context.Context, ev billing.Event) (paidNotice, error)
	GuestChat(ctx context.Context, userID int64) (*GuestChat, error)
	ListInbox(ctx context.Context) ([]InboxItem, error)
	InboxThread(ctx context.Context, conversationID int64) (*InboxItem, error)
	AddCreatorReply(ctx context.Context, in CreatorReply) (*db.Message, error)
	AddGuestMessage(ctx context.Context, userID int64, body string, allowance int32) (*db.Message, error)
	SetConversationBlocked(ctx context.Context, conversationID int64, blocked bool) error
	FindUserByEmail(ctx context.Context, email string) (*db.User, error)
	CreateRecoveryToken(ctx context.Context, conversationID, guestUserID int64, tokenHash string, expiresAt time.Time) error
	LookupRecoveryToken(ctx context.Context, tokenHash string) (*db.ChatRecoveryToken, error)
	ConsumeRecoveryToken(ctx context.Context, id int64) (bool, error)
	UpdateCreatorSettings(ctx context.Context, in CreatorSettingsInput) (*db.Creator, error)
	InsertMediaObject(ctx context.Context, obj *db.MediaObject) (*db.MediaObject, error)
	GetMediaObject(ctx context.Context, id int64) (*db.MediaObject, error)
	GetMediaObjectByKey(ctx context.Context, key string) (*db.MediaObject, error)
	DeleteUnattachedMedia(ctx context.Context, id int64) error
	SetCreatorAvatarKey(ctx context.Context, key string) (*db.Creator, error)
	GetMessage(ctx context.Context, id int64) (*db.Message, error)
	GuestHasUnlock(ctx context.Context, messageID, guestUserID int64) (bool, error)
}

type GuestChat struct {
	Conversation *db.Conversation
	GuestEmail   string
	Messages     []*db.Message
	Subscription *db.Subscription
	Media        []*db.MediaObject
	Unlocks      map[int64]bool
}

type InboxItem struct {
	Conversation   *db.Conversation `json:"conversation"`
	GuestEmail     string           `json:"guest_email"`
	GuestUserID    int64            `json:"guest_user_id"`
	LastMessage    *db.Message      `json:"last_message,omitempty"`
	Messages       []*db.Message    `json:"messages,omitempty"`
	TotalPaidCents int64            `json:"total_paid_cents"`
	IsSubscriber   bool             `json:"is_subscriber"`
	Media          []*db.MediaObject
}

type CreatorReply struct {
	ConversationID   int64
	AuthorUserID     int64
	Body             string
	ObjectKeys       []string
	UnlockPriceCents int64
}

type Service struct {
	cfg    *config.Config
	repo   Repository
	stripe billing.Gateway
	mail   mailer.Sender
	blobs  media.BlobStore
}

func NewService(cfg *config.Config, repo Repository, stripe billing.Gateway, mail mailer.Sender, blobs media.BlobStore) *Service {
	return &Service{cfg: cfg, repo: repo, stripe: stripe, mail: mail, blobs: blobs}
}

type CheckoutInput struct {
	Email     string
	Message   string
	Recurring bool
}

func (s *Service) StartCheckout(ctx context.Context, in CheckoutInput) (string, error) {
	if s.stripe == nil {
		return "", ErrStripeNotConfigured
	}
	email := strings.TrimSpace(in.Email)
	if _, err := mail.ParseAddress(email); err != nil {
		return "", ErrInvalidEmail
	}
	if strings.EqualFold(email, s.cfg.CreatorEmail) {
		return "", ErrCreatorEmail
	}
	message := strings.TrimSpace(in.Message)
	if message == "" {
		return "", ErrMessageRequired
	}

	offer := BuildOffer(s.cfg, nil)
	if creator, err := s.repo.GetCreator(ctx); err != nil {
		return "", err
	} else if creator != nil {
		offer = BuildOffer(s.cfg, creator)
	}
	kind := "one_time_message"
	amount := offer.OneTimePriceCents
	limit := offer.OneTimeCharacterLimit
	product := offer.DisplayName + " Penpal note"
	if in.Recurring {
		kind = "weekly_subscription"
		amount = offer.WeeklyPriceCents
		limit = offer.WeeklyAllowanceChars
		product = offer.DisplayName + " weekly Penpal"
	}
	if utf8.RuneCountInString(message) > limit {
		return "", ErrMessageTooLong
	}

	row, err := s.repo.CreateCheckout(ctx, kind, email, message, amount, int32(limit))
	if err != nil {
		return "", err
	}
	publicID := publicIDString(row.PublicID)
	origin := strings.TrimRight(s.cfg.PublicAppURL, "/")
	success := origin + "/penpal?success=true&session_id={CHECKOUT_SESSION_ID}"
	if in.Recurring {
		success = origin + "/penpal?success=true&recurring=true&session_id={CHECKOUT_SESSION_ID}"
	}
	sess, err := s.stripe.CreateSession(ctx, billing.SessionParams{
		CheckoutPublicID: publicID,
		GuestEmail:       email,
		AmountCents:      amount,
		ProductName:      product,
		SuccessURL:       success,
		CancelURL:        origin + "/penpal?canceled=true",
		Recurring:        in.Recurring,
	})
	if err != nil {
		return "", err
	}
	if err := s.repo.SetCheckoutStripeSession(ctx, row.ID, sess.ID); err != nil {
		return "", err
	}
	return sess.URL, nil
}

func (s *Service) HandleWebhook(ctx context.Context, payload []byte, signature string) error {
	if s.stripe == nil {
		return ErrStripeNotConfigured
	}
	ev, err := s.stripe.ParseWebhook(payload, signature)
	if err != nil {
		return err
	}
	notice, err := s.repo.ApplyEvent(ctx, ev)
	if err != nil {
		return err
	}
	s.notifyCreatorPaid(ctx, notice)
	return nil
}

func (s *Service) Claim(ctx context.Context, sessionID string) (*db.Checkout, error) {
	sessionID = strings.TrimSpace(sessionID)
	if sessionID == "" {
		return nil, ErrNotFound
	}
	row, err := s.repo.GetCheckoutByStripeSession(ctx, sessionID)
	if err != nil {
		return nil, err
	}
	if row == nil {
		return nil, ErrNotFound
	}
	switch row.Status {
	case "completed":
		if !row.GuestUserID.Valid {
			return nil, ErrPaymentIncomplete
		}
		chat, err := s.repo.GuestChat(ctx, row.GuestUserID.Int64)
		if err != nil {
			return nil, err
		}
		if chat != nil && chat.Conversation != nil && chat.Conversation.BlockedAt.Valid {
			return nil, ErrBlocked
		}
		return row, nil
	case "pending":
		return nil, ErrPaymentPending
	default:
		return nil, ErrPaymentIncomplete
	}
}

func (s *Service) SendGuestMessage(ctx context.Context, userID int64, body string) (*db.Message, error) {
	body = strings.TrimSpace(body)
	if body == "" {
		return nil, ErrMessageRequired
	}
	allowance := int32(s.cfg.WeeklyAllowanceChars)
	if allowance <= 0 {
		allowance = 2000
	}
	if utf8.RuneCountInString(body) > int(allowance) {
		return nil, ErrAllowanceExceeded
	}
	return s.repo.AddGuestMessage(ctx, userID, body, allowance)
}

func (s *Service) SetBlocked(ctx context.Context, conversationID int64, blocked bool) error {
	return s.repo.SetConversationBlocked(ctx, conversationID, blocked)
}
