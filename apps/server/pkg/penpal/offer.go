package penpal

import (
	"strings"

	"hotly-opensource/server/pkg/config"
	"hotly-opensource/server/pkg/db"
)

const (
	Tier250    = "250"
	Tier500    = "500"
	Tier1000   = "1000"
	TierCustom = "custom"

	defaultPrice500Cents  = int64(1000)
	defaultPrice1000Cents = int64(1500)
	customFloorExtraCents = int64(100)

	limit250  = 250
	limit500  = 500
	limit1000 = 1000
)

type OfferTier struct {
	ID             string `json:"id"`
	PriceCents     int64  `json:"price_cents"`
	CharacterLimit int    `json:"character_limit,omitempty"`
	Custom         bool   `json:"custom,omitempty"`
	MinPriceCents  int64  `json:"min_price_cents,omitempty"`
}

type Offer struct {
	DisplayName           string      `json:"display_name"`
	Description           string      `json:"description"`
	SupportItem           string      `json:"support_item"`
	OneTimePriceCents     int64       `json:"one_time_price_cents"`
	OneTimeCharacterLimit int         `json:"one_time_character_limit"`
	Price250Cents         int64       `json:"price_250_cents"`
	Price500Cents         int64       `json:"price_500_cents"`
	Price1000Cents        int64       `json:"price_1000_cents"`
	Tiers                 []OfferTier `json:"tiers"`
	WeeklyPriceCents      int64       `json:"weekly_price_cents"`
	WeeklyAllowanceChars  int         `json:"weekly_allowance_chars"`
	Currency              string      `json:"currency"`
	StripeConfigured      bool        `json:"stripe_configured"`
	AvatarURL             string      `json:"avatar_url,omitempty"`
	CreatorUserID         int64       `json:"creator_user_id,omitempty"`
}

func defaultLadder(cfg *config.Config) (p250, p500, p1000 int64) {
	p250 = cfg.OneTimePriceCents
	p500 = cfg.Price500Cents
	p1000 = cfg.Price1000Cents
	if p500 <= 0 {
		p500 = defaultPrice500Cents
	}
	if p1000 <= 0 {
		p1000 = defaultPrice1000Cents
	}
	return p250, p500, p1000
}

func BuildOffer(cfg *config.Config, creator *db.Creator) Offer {
	p250, p500, p1000 := defaultLadder(cfg)
	offer := Offer{
		DisplayName:           cfg.CreatorDisplayName,
		SupportItem:           cfg.SupportItem,
		OneTimePriceCents:     p250,
		OneTimeCharacterLimit: limit250,
		Price250Cents:         p250,
		Price500Cents:         p500,
		Price1000Cents:        p1000,
		WeeklyPriceCents:      cfg.WeeklyPriceCents,
		WeeklyAllowanceChars:  cfg.WeeklyAllowanceChars,
		Currency:              "usd",
		StripeConfigured:      cfg.Stripe.Configured(),
	}
	if offer.DisplayName == "" {
		offer.DisplayName = "Creator"
	}
	if creator != nil {
		if creator.DisplayName != "" {
			offer.DisplayName = creator.DisplayName
		}
		offer.Description = creator.Description
		if creator.SupportItem != "" {
			offer.SupportItem = creator.SupportItem
		}
		if creator.OneTimePriceCents > 0 {
			offer.OneTimePriceCents = creator.OneTimePriceCents
			offer.Price250Cents = creator.OneTimePriceCents
		}
		if creator.Price500Cents > 0 {
			offer.Price500Cents = creator.Price500Cents
		}
		if creator.Price1000Cents > 0 {
			offer.Price1000Cents = creator.Price1000Cents
		}
		if creator.WeeklyPriceCents > 0 {
			offer.WeeklyPriceCents = creator.WeeklyPriceCents
		}
		if creator.WeeklyAllowanceChars > 0 {
			offer.WeeklyAllowanceChars = int(creator.WeeklyAllowanceChars)
		}
		if creator.AvatarObjectKey.Valid {
			offer.AvatarURL = "/api/penpal/avatar"
		}
		if creator.UserID.Valid {
			offer.CreatorUserID = creator.UserID.Int64
		}
	}
	offer.Tiers = offerTiers(offer.Price250Cents, offer.Price500Cents, offer.Price1000Cents)
	return offer
}

func offerTiers(p250, p500, p1000 int64) []OfferTier {
	minCustom := p1000 + customFloorExtraCents
	return []OfferTier{
		{ID: Tier250, PriceCents: p250, CharacterLimit: limit250},
		{ID: Tier500, PriceCents: p500, CharacterLimit: limit500},
		{ID: Tier1000, PriceCents: p1000, CharacterLimit: limit1000},
		{ID: TierCustom, Custom: true, MinPriceCents: minCustom},
	}
}

func (o Offer) CustomMinCents() int64 {
	return o.Price1000Cents + customFloorExtraCents
}

func (o Offer) ResolveOneTime(tier string, customCents int64) (amount int64, limit int, err error) {
	switch strings.ToLower(strings.TrimSpace(tier)) {
	case "", Tier250:
		return o.Price250Cents, limit250, nil
	case Tier500:
		return o.Price500Cents, limit500, nil
	case Tier1000:
		return o.Price1000Cents, limit1000, nil
	case TierCustom:
		min := o.CustomMinCents()
		if customCents < min {
			return 0, 0, ErrInvalidTier
		}
		return customCents, 0, nil
	default:
		return 0, 0, ErrInvalidTier
	}
}
