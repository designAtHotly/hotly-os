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
		Price500Cents:         1000,
		Price1000Cents:        1500,
	}
	offer := BuildOffer(cfg, nil)
	if offer.Currency != "usd" || offer.OneTimePriceCents != 500 || offer.Price250Cents != 500 || offer.Price500Cents != 1000 || offer.Price1000Cents != 1500 {
		t.Fatalf("server must own USD prices, got %+v", offer)
	}
	if offer.OneTimeCharacterLimit != 250 {
		t.Fatalf("250-char rung must stay 250, got %d", offer.OneTimeCharacterLimit)
	}
	if len(offer.Tiers) != 4 || !offer.Tiers[3].Custom || offer.Tiers[3].MinPriceCents != 1600 {
		t.Fatalf("expected four rungs with custom floor $16, got %+v", offer.Tiers)
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
		Price500Cents:         1000,
		Price1000Cents:        1500,
	}
	offer := BuildOffer(cfg, &db.Creator{
		DisplayName:           "Live Creator",
		Description:           "Notes from the desk.",
		SupportItem:           "lemonade",
		OneTimePriceCents:     900,
		OneTimeCharacterLimit: 180,
		Price500Cents:         1200,
		Price1000Cents:        2000,
	})
	raw, _ := json.Marshal(offer)
	if offer.DisplayName != "Live Creator" || offer.SupportItem != "lemonade" || offer.OneTimePriceCents != 900 {
		t.Fatalf("persisted creator should win: %s", raw)
	}
	if offer.Price500Cents != 1200 || offer.Price1000Cents != 2000 || offer.OneTimeCharacterLimit != 250 {
		t.Fatalf("named tier prices persist and char limits stay fixed: %s", raw)
	}
	if offer.Currency != "usd" {
		t.Fatalf("currency must stay usd, got %s", offer.Currency)
	}
}

func TestResolveOneTimeIgnoresClientAmountOnNamedTiers(t *testing.T) {
	offer := Offer{Price250Cents: 500, Price500Cents: 1000, Price1000Cents: 1500}
	amount, limit, err := offer.ResolveOneTime("1000", 1)
	if err != nil || amount != 1500 || limit != 1000 {
		t.Fatalf("named tier must ignore client amount, got amount=%d limit=%d err=%v", amount, limit, err)
	}
	amount, limit, err = offer.ResolveOneTime("custom", 1600)
	if err != nil || amount != 1600 || limit != 0 {
		t.Fatalf("custom should charge guest amount with no limit, got amount=%d limit=%d err=%v", amount, limit, err)
	}
	if _, _, err := offer.ResolveOneTime("custom", 1599); err == nil {
		t.Fatal("custom below floor must fail")
	}
}
