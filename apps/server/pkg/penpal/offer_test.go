package penpal

import (
	"encoding/json"
	"testing"

	"hotly-opensource/server/pkg/config"
	"hotly-opensource/server/pkg/db"
)

func TestBuildOfferUsesServerUSDAndIgnoresMissingCreator(t *testing.T) {
	cfg := &config.Config{
		CreatorDisplayName:    "Ada",
		SupportItem:           "coffee",
		OneTimePriceCents:     500,
		OneTimeCharacterLimit: 250,
	}
	offer := BuildOffer(cfg, nil)
	if offer.Currency != "usd" || offer.OneTimePriceCents != 500 || offer.OneTimeCharacterLimit != 250 {
		t.Fatalf("server must own USD price and limit, got %+v", offer)
	}
	if offer.DisplayName != "Ada" || offer.SupportItem != "coffee" {
		t.Fatalf("expected config identity, got %+v", offer)
	}
	if offer.StripeConfigured {
		t.Fatal("empty Stripe config must not look configured")
	}
}

func TestBuildOfferPrefersPersistedCreatorRow(t *testing.T) {
	cfg := &config.Config{
		CreatorDisplayName:    "Fallback",
		SupportItem:           "coffee",
		OneTimePriceCents:     500,
		OneTimeCharacterLimit: 250,
	}
	offer := BuildOffer(cfg, &db.Creator{
		DisplayName:           "Live Creator",
		Description:           "Notes from the desk.",
		SupportItem:           "lemonade",
		OneTimePriceCents:     900,
		OneTimeCharacterLimit: 180,
	})
	raw, _ := json.Marshal(offer)
	if offer.DisplayName != "Live Creator" || offer.SupportItem != "lemonade" || offer.OneTimePriceCents != 900 {
		t.Fatalf("persisted creator should win: %s", raw)
	}
	if offer.Currency != "usd" {
		t.Fatalf("currency must stay usd, got %s", offer.Currency)
	}
}
