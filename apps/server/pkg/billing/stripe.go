package billing

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/stripe/stripe-go/v82"
)

type Stripe struct {
	client        *stripe.Client
	webhookSecret string
}

func NewStripe(secretKey, webhookSecret string) *Stripe {
	return &Stripe{
		client:        stripe.NewClient(secretKey),
		webhookSecret: webhookSecret,
	}
}

func (s *Stripe) CreateSession(ctx context.Context, p SessionParams) (*Session, error) {
	mode := stripe.CheckoutSessionModePayment
	price := &stripe.CheckoutSessionCreateLineItemPriceDataParams{
		Currency:   stripe.String("usd"),
		UnitAmount: stripe.Int64(p.AmountCents),
		ProductData: &stripe.CheckoutSessionCreateLineItemPriceDataProductDataParams{
			Name: stripe.String(p.ProductName),
		},
	}
	if p.Recurring {
		mode = stripe.CheckoutSessionModeSubscription
		price.Recurring = &stripe.CheckoutSessionCreateLineItemPriceDataRecurringParams{
			Interval: stripe.String("week"),
		}
	}
	params := &stripe.CheckoutSessionCreateParams{
		Mode:              stripe.String(string(mode)),
		SuccessURL:        stripe.String(p.SuccessURL),
		CancelURL:         stripe.String(p.CancelURL),
		CustomerEmail:     stripe.String(p.GuestEmail),
		ClientReferenceID: stripe.String(p.CheckoutPublicID),
		Metadata: map[string]string{
			"hotly_checkout_public_id": p.CheckoutPublicID,
		},
		LineItems: []*stripe.CheckoutSessionCreateLineItemParams{
			{Quantity: stripe.Int64(1), PriceData: price},
		},
	}
	sess, err := s.client.V1CheckoutSessions.Create(ctx, params)
	if err != nil {
		return nil, err
	}
	return &Session{ID: sess.ID, URL: sess.URL}, nil
}

func (s *Stripe) ParseWebhook(payload []byte, signature string) (Event, error) {
	raw, err := stripe.ConstructEvent(payload, signature, s.webhookSecret, stripe.WithIgnoreAPIVersionMismatch())
	if err != nil {
		return Event{}, err
	}
	ev := Event{ID: raw.ID, Type: string(raw.Type)}
	if raw.Data == nil {
		return ev, nil
	}
	switch {
	case strings.HasPrefix(ev.Type, "checkout.session."):
		fillCheckoutEvent(&ev, raw.Data.Raw)
	case strings.HasPrefix(ev.Type, "customer.subscription."):
		fillSubscriptionEvent(&ev, raw.Data.Raw)
	case ev.Type == "invoice.paid" || ev.Type == "invoice.payment_succeeded":
		fillInvoiceEvent(&ev, raw.Data.Raw)
	}
	return ev, nil
}

func fillCheckoutEvent(ev *Event, raw json.RawMessage) {
	var sess stripe.CheckoutSession
	if err := json.Unmarshal(raw, &sess); err != nil {
		return
	}
	ev.SessionID = sess.ID
	ev.Mode = string(sess.Mode)
	ev.PublicID = sess.ClientReferenceID
	if ev.PublicID == "" && sess.Metadata != nil {
		ev.PublicID = sess.Metadata["hotly_checkout_public_id"]
	}
	if sess.PaymentIntent != nil {
		ev.PaymentIntentID = sess.PaymentIntent.ID
	}
	if sess.Customer != nil {
		ev.CustomerID = sess.Customer.ID
	}
	var extra struct {
		Subscription json.RawMessage `json:"subscription"`
	}
	if json.Unmarshal(raw, &extra) == nil && len(extra.Subscription) > 0 && string(extra.Subscription) != "null" {
		if ev.SubscriptionID == "" {
			ev.SubscriptionID = expandableID(extra.Subscription)
		}
		fillSubscriptionLoose(ev, extra.Subscription)
	}
	ev.AmountCents = sess.AmountTotal
	ev.Currency = strings.ToLower(string(sess.Currency))
	ev.PaymentStatus = string(sess.PaymentStatus)
}

func fillSubscriptionEvent(ev *Event, raw json.RawMessage) {
	var sub stripe.Subscription
	if err := json.Unmarshal(raw, &sub); err != nil {
		fillSubscriptionLoose(ev, raw)
		return
	}
	fillSubscriptionObject(ev, &sub)
}

func fillInvoiceEvent(ev *Event, raw json.RawMessage) {
	var inv struct {
		Subscription json.RawMessage `json:"subscription"`
		Customer     json.RawMessage `json:"customer"`
		PeriodStart  int64           `json:"period_start"`
		PeriodEnd    int64           `json:"period_end"`
		Lines        struct {
			Data []struct {
				Period struct {
					Start int64 `json:"start"`
					End   int64 `json:"end"`
				} `json:"period"`
			} `json:"data"`
		} `json:"lines"`
	}
	if err := json.Unmarshal(raw, &inv); err != nil {
		return
	}
	ev.SubscriptionID = expandableID(inv.Subscription)
	ev.CustomerID = expandableID(inv.Customer)
	ev.PeriodStart = inv.PeriodStart
	ev.PeriodEnd = inv.PeriodEnd
	if ev.PeriodStart == 0 && len(inv.Lines.Data) > 0 {
		ev.PeriodStart = inv.Lines.Data[0].Period.Start
		ev.PeriodEnd = inv.Lines.Data[0].Period.End
	}
}

func fillSubscriptionObject(ev *Event, sub *stripe.Subscription) {
	if sub == nil {
		return
	}
	ev.SubscriptionID = sub.ID
	ev.SubscriptionStatus = string(sub.Status)
	if sub.Customer != nil && ev.CustomerID == "" {
		ev.CustomerID = sub.Customer.ID
	}
	fillSubscriptionLoose(ev, mustJSON(sub))
}

func fillSubscriptionLoose(ev *Event, raw json.RawMessage) {
	var obj struct {
		ID                   string          `json:"id"`
		Status               string          `json:"status"`
		Customer             json.RawMessage `json:"customer"`
		CurrentPeriodStart   int64           `json:"current_period_start"`
		CurrentPeriodEnd     int64           `json:"current_period_end"`
		Items                struct {
			Data []struct {
				CurrentPeriodStart int64 `json:"current_period_start"`
				CurrentPeriodEnd   int64 `json:"current_period_end"`
			} `json:"data"`
		} `json:"items"`
	}
	if err := json.Unmarshal(raw, &obj); err != nil {
		return
	}
	if ev.SubscriptionID == "" {
		ev.SubscriptionID = obj.ID
	}
	if ev.SubscriptionStatus == "" {
		ev.SubscriptionStatus = obj.Status
	}
	if ev.CustomerID == "" {
		ev.CustomerID = expandableID(obj.Customer)
	}
	start, end := obj.CurrentPeriodStart, obj.CurrentPeriodEnd
	if start == 0 && len(obj.Items.Data) > 0 {
		start = obj.Items.Data[0].CurrentPeriodStart
		end = obj.Items.Data[0].CurrentPeriodEnd
	}
	if ev.PeriodStart == 0 {
		ev.PeriodStart = start
	}
	if ev.PeriodEnd == 0 {
		ev.PeriodEnd = end
	}
}

func expandableID(raw json.RawMessage) string {
	if len(raw) == 0 || string(raw) == "null" {
		return ""
	}
	var s string
	if json.Unmarshal(raw, &s) == nil {
		return s
	}
	var obj struct {
		ID string `json:"id"`
	}
	_ = json.Unmarshal(raw, &obj)
	return obj.ID
}

func mustJSON(v any) json.RawMessage {
	b, _ := json.Marshal(v)
	return b
}
