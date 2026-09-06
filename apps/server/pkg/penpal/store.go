package penpal

import (
	"context"
	"errors"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"hotly-opensource/server/pkg/billing"
	"hotly-opensource/server/pkg/db"
	"hotly-opensource/server/pkg/media"
)

type pgRepo struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

func NewPG(pool *pgxpool.Pool, q *db.Queries) Repository {
	return &pgRepo{pool: pool, q: q}
}

func (p *pgRepo) GetCreator(ctx context.Context) (*db.Creator, error) {
	row, err := p.q.GetCreator(ctx)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return row, err
}

func (p *pgRepo) CreateCheckout(ctx context.Context, kind, email, message string, amountCents int64, charLimit int32) (*db.Checkout, error) {
	if kind == "" {
		kind = "one_time_message"
	}
	return p.q.CreateCheckout(ctx, db.CreateCheckoutParams{
		Kind:           kind,
		GuestEmail:     email,
		InitialMessage: text(message),
		AmountCents:    amountCents,
		CharacterLimit: int4(charLimit),
	})
}

func (p *pgRepo) SetCheckoutStripeSession(ctx context.Context, id int64, sessionID string) error {
	return p.q.SetCheckoutStripeSession(ctx, db.SetCheckoutStripeSessionParams{
		ID:                      id,
		StripeCheckoutSessionID: text(sessionID),
	})
}

func (p *pgRepo) GetCheckoutByStripeSession(ctx context.Context, sessionID string) (*db.Checkout, error) {
	row, err := p.q.GetCheckoutByStripeSessionID(ctx, text(sessionID))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return row, err
}

func (p *pgRepo) GetCheckoutByPublicID(ctx context.Context, publicID string) (*db.Checkout, error) {
	uid, err := parsePublicID(publicID)
	if err != nil {
		return nil, err
	}
	row, err := p.q.GetCheckoutByPublicID(ctx, uid)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return row, err
}

func (p *pgRepo) ApplyEvent(ctx context.Context, ev billing.Event) (paidNotice, error) {
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return paidNotice{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	notice, err := applyEvent(ctx, &pgEventStore{q: p.q.WithTx(tx)}, ev)
	if err != nil {
		return paidNotice{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return paidNotice{}, err
	}
	return notice, nil
}

func (p *pgRepo) GuestChat(ctx context.Context, userID int64) (*GuestChat, error) {
	convo, err := p.q.GetConversationByGuestUserID(ctx, userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	user, err := p.q.GetUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	msgs, err := p.q.ListMessagesByConversation(ctx, convo.ID)
	if err != nil {
		return nil, err
	}
	sub, err := p.q.GetActiveSubscriptionByGuest(ctx, userID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	if errors.Is(err, pgx.ErrNoRows) {
		sub = nil
	}
	mediaRows, unlocks, err := p.conversationMedia(ctx, msgs, userID)
	if err != nil {
		return nil, err
	}
	return &GuestChat{Conversation: convo, GuestEmail: user.Email, Messages: msgs, Subscription: sub, Media: mediaRows, Unlocks: unlocks}, nil
}

func (p *pgRepo) ListInbox(ctx context.Context) ([]InboxItem, error) {
	rows, err := p.q.ListConversations(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]InboxItem, 0, len(rows))
	for _, row := range rows {
		msgs, err := p.q.ListMessagesByConversation(ctx, row.ID)
		if err != nil {
			return nil, err
		}
		item := InboxItem{
			Conversation: &db.Conversation{
				ID:             row.ID,
				GuestUserID:    row.GuestUserID,
				LastActivityAt: row.LastActivityAt,
				BlockedAt:      row.BlockedAt,
				CreatedAt:      row.CreatedAt,
			},
			GuestEmail:  row.GuestEmail,
			GuestUserID: row.GuestUserID,
		}
		if len(msgs) > 0 {
			item.LastMessage = msgs[len(msgs)-1]
		}
		item.TotalPaidCents = row.TotalPaidCents
		item.IsSubscriber = row.IsSubscriber
		if item.LastMessage != nil {
			if mediaRows, _, err := p.conversationMedia(ctx, []*db.Message{item.LastMessage}, 0); err == nil {
				item.Media = mediaRows
			} else {
				return nil, err
			}
		}
		out = append(out, item)
	}
	return out, nil
}

func (p *pgRepo) InboxThread(ctx context.Context, conversationID int64) (*InboxItem, error) {
	convo, err := p.q.GetConversationByID(ctx, conversationID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	user, err := p.q.GetUserByID(ctx, convo.GuestUserID)
	if err != nil {
		return nil, err
	}
	msgs, err := p.q.ListMessagesByConversation(ctx, convo.ID)
	if err != nil {
		return nil, err
	}
	total, err := p.q.SumCompletedPaymentsByGuest(ctx, int8(convo.GuestUserID))
	if err != nil {
		return nil, err
	}
	sub, err := p.q.GetActiveSubscriptionByGuest(ctx, convo.GuestUserID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	item := &InboxItem{
		Conversation:   convo,
		GuestEmail:     user.Email,
		GuestUserID:    convo.GuestUserID,
		Messages:       msgs,
		TotalPaidCents: total,
		IsSubscriber:   sub != nil,
	}
	mediaRows, _, err := p.conversationMedia(ctx, msgs, 0)
	if err != nil {
		return nil, err
	}
	item.Media = mediaRows
	if len(msgs) > 0 {
		item.LastMessage = msgs[len(msgs)-1]
	}
	return item, nil
}

func (p *pgRepo) AddCreatorReply(ctx context.Context, in CreatorReply) (*db.Message, error) {
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	q := p.q.WithTx(tx)
	_, err = q.GetConversationByID(ctx, in.ConversationID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if len(in.ObjectKeys) > media.MaxAttachments {
		return nil, ErrTooManyAttachments
	}
	msg, err := q.CreateMessage(ctx, db.CreateMessageParams{
		ConversationID:   in.ConversationID,
		AuthorUserID:     in.AuthorUserID,
		Body:             in.Body,
		CharacterCount:   int32(utf8.RuneCountInString(in.Body)),
		UnlockPriceCents: optionalInt8(in.UnlockPriceCents),
	})
	if err != nil {
		return nil, err
	}
	for _, key := range in.ObjectKeys {
		n, err := q.AttachMediaToMessage(ctx, db.AttachMediaToMessageParams{
			ObjectKey:        key,
			MessageID:        int8(msg.ID),
			UploadedByUserID: in.AuthorUserID,
		})
		if err != nil {
			return nil, err
		}
		if n == 0 {
			return nil, ErrNotFound
		}
	}
	if err := q.TouchConversation(ctx, in.ConversationID); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return msg, nil
}

func (p *pgRepo) SetConversationBlocked(ctx context.Context, conversationID int64, blocked bool) error {
	_, err := p.q.GetConversationByID(ctx, conversationID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if blocked {
		_, err = p.q.SetConversationBlocked(ctx, conversationID)
		return err
	}
	_, err = p.q.SetConversationUnblocked(ctx, conversationID)
	return err
}

func (p *pgRepo) UpdateCreatorSettings(ctx context.Context, in CreatorSettingsInput) (*db.Creator, error) {
	row, err := p.q.UpdateCreatorSettings(ctx, db.UpdateCreatorSettingsParams{
		DisplayName:           in.DisplayName,
		Description:           in.Description,
		SupportItem:           in.SupportItem,
		OneTimePriceCents:     in.OneTimePriceCents,
		OneTimeCharacterLimit: int32(in.OneTimeCharacterLimit),
		WeeklyPriceCents:      in.WeeklyPriceCents,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return row, err
}

type pgEventStore struct {
	q *db.Queries
}

func (p *pgEventStore) TryInsertEvent(ctx context.Context, id, typ string) (bool, error) {
	n, err := p.q.TryInsertStripeEvent(ctx, db.TryInsertStripeEventParams{StripeEventID: id, EventType: typ})
	return n > 0, err
}

func (p *pgEventStore) LookupCheckout(ctx context.Context, sessionID, publicID string) (*db.Checkout, error) {
	if sessionID != "" {
		row, err := p.q.GetCheckoutByStripeSessionID(ctx, text(sessionID))
		if err == nil {
			return row, nil
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
	}
	if publicID == "" {
		return nil, nil
	}
	uid, err := parsePublicID(publicID)
	if err != nil {
		return nil, nil
	}
	row, err := p.q.GetCheckoutByPublicID(ctx, uid)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return row, err
}

func (p *pgEventStore) FindUserByEmail(ctx context.Context, email string) (*db.User, error) {
	row, err := p.q.GetUserByEmail(ctx, email)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return row, err
}

func (p *pgEventStore) CreateGuestUser(ctx context.Context, email, name string) (*db.User, error) {
	return p.q.CreateGuestUser(ctx, db.CreateGuestUserParams{Email: email, DisplayName: name})
}

func (p *pgEventStore) CompleteCheckout(ctx context.Context, checkoutID, userID int64) (bool, error) {
	n, err := p.q.CompleteCheckout(ctx, db.CompleteCheckoutParams{ID: checkoutID, GuestUserID: int8(userID)})
	return n > 0, err
}

func (p *pgEventStore) SetPendingStatus(ctx context.Context, checkoutID int64, status string) error {
	_, err := p.q.SetCheckoutStatus(ctx, db.SetCheckoutStatusParams{ID: checkoutID, Status: status})
	return err
}

func (p *pgEventStore) InsertPayment(ctx context.Context, checkoutID int64, paymentIntent string, amountCents int64) error {
	_, err := p.q.InsertPayment(ctx, db.InsertPaymentParams{
		CheckoutID:            checkoutID,
		StripePaymentIntentID: text(paymentIntent),
		AmountCents:           amountCents,
	})
	return err
}

func (p *pgEventStore) MessageForCheckout(ctx context.Context, checkoutID int64) (*db.Message, error) {
	row, err := p.q.GetMessageByCheckoutID(ctx, int8(checkoutID))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return row, err
}

func (p *pgEventStore) EnsureConversation(ctx context.Context, userID int64) (*db.Conversation, error) {
	row, err := p.q.GetConversationByGuestUserID(ctx, userID)
	if err == nil {
		return row, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	row, err = p.q.CreateConversation(ctx, userID)
	if err == nil {
		return row, nil
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return p.q.GetConversationByGuestUserID(ctx, userID)
	}
	return nil, err
}

func (p *pgEventStore) CreatePaidMessage(ctx context.Context, conversationID, authorUserID, checkoutID int64, body string) error {
	_, err := p.q.CreateMessage(ctx, db.CreateMessageParams{
		ConversationID: conversationID,
		AuthorUserID:   authorUserID,
		Body:           body,
		CharacterCount: int32(utf8.RuneCountInString(body)),
		CheckoutID:     int8(checkoutID),
	})
	return err
}

func (p *pgEventStore) TouchConversation(ctx context.Context, id int64) error {
	return p.q.TouchConversation(ctx, id)
}

func (p *pgRepo) AddGuestMessage(ctx context.Context, userID int64, body string, allowance int32) (*db.Message, error) {
	convo, err := p.q.GetConversationByGuestUserID(ctx, userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if convo.BlockedAt.Valid {
		return nil, ErrBlocked
	}
	sub, err := p.q.GetActiveSubscriptionByGuest(ctx, userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNoAllowance
	}
	if err != nil {
		return nil, err
	}
	n := int32(utf8.RuneCountInString(body))
	if _, err := p.q.AddSubscriptionChars(ctx, db.AddSubscriptionCharsParams{ID: sub.ID, Delta: n, Allowance: allowance}); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrAllowanceExceeded
		}
		return nil, err
	}
	msg, err := p.q.CreateMessage(ctx, db.CreateMessageParams{
		ConversationID: convo.ID,
		AuthorUserID:   userID,
		Body:           body,
		CharacterCount: n,
	})
	if err != nil {
		return nil, err
	}
	if err := p.q.TouchConversation(ctx, convo.ID); err != nil {
		return nil, err
	}
	return msg, nil
}

func (p *pgEventStore) UpsertSubscription(ctx context.Context, guestUserID int64, stripeSubID, customerID, status string, periodStart, periodEnd time.Time, charsUsed int32) error {
	_, err := p.q.UpsertSubscription(ctx, db.UpsertSubscriptionParams{
		GuestUserID:          guestUserID,
		StripeSubscriptionID: stripeSubID,
		StripeCustomerID:     text(customerID),
		Status:               status,
		CurrentPeriodStart:   pgtype.Timestamptz{Time: periodStart.UTC(), Valid: true},
		CurrentPeriodEnd:     pgtype.Timestamptz{Time: periodEnd.UTC(), Valid: true},
		CharsUsed:            charsUsed,
	})
	return err
}

func (p *pgEventStore) GetSubscriptionByStripeID(ctx context.Context, stripeSubID string) (*db.Subscription, error) {
	row, err := p.q.GetSubscriptionByStripeID(ctx, stripeSubID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return row, err
}

func (p *pgRepo) FindUserByEmail(ctx context.Context, email string) (*db.User, error) {
	row, err := p.q.GetUserByEmail(ctx, email)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return row, err
}

func (p *pgRepo) CreateRecoveryToken(ctx context.Context, conversationID, guestUserID int64, tokenHash string, expiresAt time.Time) error {
	_, err := p.q.CreateRecoveryToken(ctx, db.CreateRecoveryTokenParams{
		ConversationID: conversationID,
		GuestUserID:    guestUserID,
		TokenHash:      tokenHash,
		ExpiresAt:      pgtype.Timestamptz{Time: expiresAt.UTC(), Valid: true},
	})
	return err
}

func (p *pgRepo) LookupRecoveryToken(ctx context.Context, tokenHash string) (*db.ChatRecoveryToken, error) {
	row, err := p.q.GetValidRecoveryToken(ctx, tokenHash)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return row, err
}

func (p *pgRepo) ConsumeRecoveryToken(ctx context.Context, id int64) (bool, error) {
	n, err := p.q.ConsumeRecoveryToken(ctx, id)
	return n > 0, err
}
