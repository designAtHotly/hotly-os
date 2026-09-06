package billing

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

const TestSignature = "t=1,v1=ok"

type Fake struct {
	Last   SessionParams
	LastID string
	n      int
}

func NewFake() *Fake {
	return &Fake{}
}

func (f *Fake) CreateSession(_ context.Context, p SessionParams) (*Session, error) {
	f.Last = p
	f.n++
	f.LastID = fmt.Sprintf("cs_test_%d", f.n)
	return &Session{ID: f.LastID, URL: "https://checkout.stripe.test/" + f.LastID}, nil
}

func (f *Fake) ParseWebhook(payload []byte, signature string) (Event, error) {
	if signature != TestSignature {
		return Event{}, errors.New("invalid signature")
	}
	var ev Event
	if err := json.Unmarshal(payload, &ev); err != nil {
		return Event{}, err
	}
	if ev.ID == "" || ev.Type == "" {
		return Event{}, errors.New("invalid event")
	}
	ev.Currency = strings.ToLower(ev.Currency)
	if ev.Currency == "" {
		ev.Currency = "usd"
	}
	if ev.PaymentStatus == "" {
		ev.PaymentStatus = "paid"
	}
	return ev, nil
}
