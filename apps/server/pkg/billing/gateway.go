package billing

import "context"

type SessionParams struct {
	CheckoutPublicID string
	GuestEmail       string
	AmountCents      int64
	ProductName      string
	SuccessURL       string
	CancelURL        string
	Recurring        bool
}

type Session struct {
	ID  string
	URL string
}

type Event struct {
	ID                 string `json:"id"`
	Type               string `json:"type"`
	SessionID          string `json:"session_id"`
	PublicID           string `json:"public_id"`
	PaymentIntentID    string `json:"payment_intent_id"`
	AmountCents        int64  `json:"amount_cents"`
	Currency           string `json:"currency"`
	PaymentStatus      string `json:"payment_status"`
	Mode               string `json:"mode"`
	SubscriptionID     string `json:"subscription_id"`
	CustomerID         string `json:"customer_id"`
	SubscriptionStatus string `json:"subscription_status"`
	PeriodStart        int64  `json:"period_start"`
	PeriodEnd          int64  `json:"period_end"`
}

type Gateway interface {
	CreateSession(ctx context.Context, p SessionParams) (*Session, error)
	ParseWebhook(payload []byte, signature string) (Event, error)
}
