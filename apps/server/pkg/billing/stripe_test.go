package billing

import (
	"testing"

	"github.com/stripe/stripe-go/v82"
)

func TestParseWebhookAcceptsNewerCheckoutAPIVersion(t *testing.T) {
	secret := "whsec_test"
	payload := []byte(`{
		"id": "evt_test",
		"object": "event",
		"api_version": "2026-08-26.dahlia",
		"type": "checkout.session.completed",
		"data": {
			"object": {
				"id": "cs_test_1",
				"object": "checkout.session",
				"client_reference_id": "11111111-1111-1111-1111-111111111111",
				"amount_total": 500,
				"currency": "usd",
				"payment_status": "paid",
				"payment_intent": "pi_1"
			}
		}
	}`)
	signed := stripe.GenerateTestSignedPayload(&stripe.UnsignedPayload{Payload: payload, Secret: secret})
	ev, err := NewStripe("sk_test_x", secret).ParseWebhook(payload, signed.Header)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if ev.ID != "evt_test" || ev.Type != "checkout.session.completed" {
		t.Fatalf("event %+v", ev)
	}
	if ev.SessionID != "cs_test_1" || ev.AmountCents != 500 || ev.PaymentStatus != "paid" || ev.PaymentIntentID != "pi_1" {
		t.Fatalf("session fields %+v", ev)
	}
}

func TestParseWebhookSkipsNonCheckoutObjects(t *testing.T) {
	secret := "whsec_test"
	payload := []byte(`{
		"id": "evt_charge",
		"object": "event",
		"api_version": "2026-08-26.dahlia",
		"type": "charge.succeeded",
		"data": {"object": {"id": "ch_1", "object": "charge", "amount": 500}}
	}`)
	signed := stripe.GenerateTestSignedPayload(&stripe.UnsignedPayload{Payload: payload, Secret: secret})
	ev, err := NewStripe("sk_test_x", secret).ParseWebhook(payload, signed.Header)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if ev.SessionID != "" || ev.Type != "charge.succeeded" {
		t.Fatalf("non-checkout event must not be parsed as a session %+v", ev)
	}
}
