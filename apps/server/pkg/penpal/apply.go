package penpal

import (
	"context"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"hotly-opensource/server/pkg/billing"
	"hotly-opensource/server/pkg/db"
)

type eventStore interface {
	TryInsertEvent(ctx context.Context, id, typ string) (inserted bool, err error)
	LookupCheckout(ctx context.Context, sessionID, publicID string) (*db.Checkout, error)
	FindUserByEmail(ctx context.Context, email string) (*db.User, error)
	CreateGuestUser(ctx context.Context, email, name string) (*db.User, error)
	CompleteCheckout(ctx context.Context, checkoutID, userID int64) (bool, error)
	SetPendingStatus(ctx context.Context, checkoutID int64, status string) error
	InsertPayment(ctx context.Context, checkoutID int64, paymentIntent string, amountCents int64) error
	MessageForCheckout(ctx context.Context, checkoutID int64) (*db.Message, error)
	EnsureConversation(ctx context.Context, userID int64) (*db.Conversation, error)
	CreatePaidMessage(ctx context.Context, conversationID, authorUserID, checkoutID int64, body string) error
	TouchConversation(ctx context.Context, id int64) error
	UpsertSubscription(ctx context.Context, guestUserID int64, stripeSubID, customerID, status string, periodStart, periodEnd time.Time, charsUsed int32) error
	GetSubscriptionByStripeID(ctx context.Context, stripeSubID string) (*db.Subscription, error)
	InsertUnlock(ctx context.Context, messageID, guestUserID, checkoutID int64) error
}

type paidNotice struct {
	kind string
}

func applyEvent(ctx context.Context, store eventStore, ev billing.Event) (paidNotice, error) {
	inserted, err := store.TryInsertEvent(ctx, ev.ID, ev.Type)
	if err != nil {
		return paidNotice{}, err
	}
	if !inserted {
		return paidNotice{}, nil
	}

	switch ev.Type {
	case "checkout.session.expired", "checkout.session.async_payment_failed", "checkout.session.completed", "checkout.session.async_payment_succeeded":
		checkout, err := store.LookupCheckout(ctx, ev.SessionID, ev.PublicID)
		if err != nil {
			return paidNotice{}, err
		}
		if checkout == nil {
			return paidNotice{}, ErrNotFound
		}
		switch ev.Type {
		case "checkout.session.expired":
			return paidNotice{}, store.SetPendingStatus(ctx, checkout.ID, "expired")
		case "checkout.session.async_payment_failed":
			return paidNotice{}, store.SetPendingStatus(ctx, checkout.ID, "failed")
		default:
			if ev.Type == "checkout.session.completed" && ev.PaymentStatus != "" && ev.PaymentStatus != "paid" {
				return paidNotice{}, nil
			}
			return completeCheckout(ctx, store, checkout, ev)
		}
	case "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted":
		return paidNotice{}, applySubscriptionChange(ctx, store, ev)
	case "invoice.paid", "invoice.payment_succeeded":
		return paidNotice{}, applyInvoicePaid(ctx, store, ev)
	default:
		return paidNotice{}, nil
	}
}

func completeCheckout(ctx context.Context, store eventStore, checkout *db.Checkout, ev billing.Event) (paidNotice, error) {
	if ev.AmountCents > 0 && ev.AmountCents != checkout.AmountCents {
		return paidNotice{}, store.SetPendingStatus(ctx, checkout.ID, "failed")
	}
	if checkout.Kind == "paid_content" {
		return paidNotice{}, completePaidUnlock(ctx, store, checkout, ev)
	}
	notice, err := completeOneTime(ctx, store, checkout, ev)
	if err != nil {
		return paidNotice{}, err
	}
	if checkout.Kind != "weekly_subscription" {
		return notice, nil
	}
	return notice, activateSubscription(ctx, store, checkout, ev)
}

func completePaidUnlock(ctx context.Context, store eventStore, checkout *db.Checkout, ev billing.Event) error {
	if ev.Currency != "" && !strings.EqualFold(ev.Currency, "usd") {
		return store.SetPendingStatus(ctx, checkout.ID, "failed")
	}
	if !checkout.TargetMessageID.Valid || !checkout.GuestUserID.Valid {
		return store.SetPendingStatus(ctx, checkout.ID, "failed")
	}
	user, err := store.FindUserByEmail(ctx, checkout.GuestEmail)
	if err != nil {
		return err
	}
	if user == nil {
		return ErrNotFound
	}
	completed, err := store.CompleteCheckout(ctx, checkout.ID, user.ID)
	if err != nil {
		return err
	}
	if completed {
		if err := store.InsertPayment(ctx, checkout.ID, ev.PaymentIntentID, checkout.AmountCents); err != nil {
			return err
		}
	}
	return store.InsertUnlock(ctx, checkout.TargetMessageID.Int64, user.ID, checkout.ID)
}

func completeOneTime(ctx context.Context, store eventStore, checkout *db.Checkout, ev billing.Event) (paidNotice, error) {
	if ev.AmountCents > 0 && ev.AmountCents != checkout.AmountCents {
		return paidNotice{}, store.SetPendingStatus(ctx, checkout.ID, "failed")
	}
	if ev.Currency != "" && !strings.EqualFold(ev.Currency, "usd") {
		return paidNotice{}, store.SetPendingStatus(ctx, checkout.ID, "failed")
	}

	user, err := store.FindUserByEmail(ctx, checkout.GuestEmail)
	if err != nil {
		return paidNotice{}, err
	}
	if user == nil {
		name := checkout.GuestEmail
		if i := strings.IndexByte(checkout.GuestEmail, '@'); i > 0 {
			name = checkout.GuestEmail[:i]
		}
		user, err = store.CreateGuestUser(ctx, checkout.GuestEmail, name)
		if err != nil {
			return paidNotice{}, err
		}
	}

	completed, err := store.CompleteCheckout(ctx, checkout.ID, user.ID)
	if err != nil {
		return paidNotice{}, err
	}
	if completed {
		if err := store.InsertPayment(ctx, checkout.ID, ev.PaymentIntentID, checkout.AmountCents); err != nil {
			return paidNotice{}, err
		}
	}

	existing, err := store.MessageForCheckout(ctx, checkout.ID)
	if err != nil {
		return paidNotice{}, err
	}
	if existing != nil {
		return paidNotice{}, nil
	}
	convo, err := store.EnsureConversation(ctx, user.ID)
	if err != nil {
		return paidNotice{}, err
	}
	body := ""
	if checkout.InitialMessage.Valid {
		body = checkout.InitialMessage.String
	}
	if err := store.CreatePaidMessage(ctx, convo.ID, user.ID, checkout.ID, body); err != nil {
		return paidNotice{}, err
	}
	if err := store.TouchConversation(ctx, convo.ID); err != nil {
		return paidNotice{}, err
	}
	kind := "note"
	if checkout.Kind == "weekly_subscription" {
		kind = "weekly subscription"
	}
	return paidNotice{kind: kind}, nil
}

func activateSubscription(ctx context.Context, store eventStore, checkout *db.Checkout, ev billing.Event) error {
	if strings.TrimSpace(ev.SubscriptionID) == "" {
		return fmt.Errorf("missing subscription id")
	}
	user, err := store.FindUserByEmail(ctx, checkout.GuestEmail)
	if err != nil {
		return err
	}
	if user == nil {
		return ErrNotFound
	}
	body := ""
	if checkout.InitialMessage.Valid {
		body = checkout.InitialMessage.String
	}
	start, end := periodFromEvent(ev)
	status := normalizeSubStatus(ev.SubscriptionStatus)
	if status == "" {
		status = "active"
	}
	return store.UpsertSubscription(ctx, user.ID, ev.SubscriptionID, ev.CustomerID, status, start, end, int32(utf8.RuneCountInString(body)))
}

func applySubscriptionChange(ctx context.Context, store eventStore, ev billing.Event) error {
	if strings.TrimSpace(ev.SubscriptionID) == "" {
		return nil
	}
	existing, err := store.GetSubscriptionByStripeID(ctx, ev.SubscriptionID)
	if err != nil {
		return err
	}
	if existing == nil {
		return ErrNotFound
	}
	status := normalizeSubStatus(ev.SubscriptionStatus)
	if ev.Type == "customer.subscription.deleted" {
		status = "canceled"
	}
	if status == "" {
		status = existing.Status
	}
	start, end := existing.CurrentPeriodStart.Time, existing.CurrentPeriodEnd.Time
	if ev.PeriodStart > 0 && ev.PeriodEnd > 0 {
		start, end = periodFromEvent(ev)
	}
	return store.UpsertSubscription(ctx, existing.GuestUserID, ev.SubscriptionID, ev.CustomerID, status, start, end, existing.CharsUsed)
}

func applyInvoicePaid(ctx context.Context, store eventStore, ev billing.Event) error {
	if strings.TrimSpace(ev.SubscriptionID) == "" {
		return nil
	}
	existing, err := store.GetSubscriptionByStripeID(ctx, ev.SubscriptionID)
	if err != nil {
		return err
	}
	if existing == nil {
		return ErrNotFound
	}
	start, end := periodFromEvent(ev)
	status := existing.Status
	if s := normalizeSubStatus(ev.SubscriptionStatus); s != "" {
		status = s
	}
	return store.UpsertSubscription(ctx, existing.GuestUserID, ev.SubscriptionID, ev.CustomerID, status, start, end, 0)
}

func periodFromEvent(ev billing.Event) (time.Time, time.Time) {
	start := time.Now().UTC()
	end := start.Add(7 * 24 * time.Hour)
	if ev.PeriodStart > 0 {
		start = time.Unix(ev.PeriodStart, 0).UTC()
	}
	if ev.PeriodEnd > 0 {
		end = time.Unix(ev.PeriodEnd, 0).UTC()
	}
	return start, end
}

func normalizeSubStatus(status string) string {
	status = strings.ToLower(strings.TrimSpace(status))
	if status == "cancelled" {
		return "canceled"
	}
	return status
}
