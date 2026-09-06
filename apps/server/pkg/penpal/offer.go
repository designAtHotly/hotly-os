package penpal

import (
	"hotly-opensource/server/pkg/config"
	"hotly-opensource/server/pkg/db"
)

type Offer struct {
	DisplayName           string `json:"display_name"`
	Description           string `json:"description"`
	SupportItem           string `json:"support_item"`
	OneTimePriceCents     int64  `json:"one_time_price_cents"`
	OneTimeCharacterLimit int    `json:"one_time_character_limit"`
	WeeklyPriceCents      int64  `json:"weekly_price_cents"`
	WeeklyAllowanceChars  int    `json:"weekly_allowance_chars"`
	Currency              string `json:"currency"`
	StripeConfigured      bool   `json:"stripe_configured"`
	AvatarURL             string `json:"avatar_url,omitempty"`
	CreatorUserID         int64  `json:"creator_user_id,omitempty"`
}

func BuildOffer(cfg *config.Config, creator *db.Creator) Offer {
	offer := Offer{
		DisplayName:           cfg.CreatorDisplayName,
		SupportItem:           cfg.SupportItem,
		OneTimePriceCents:     cfg.OneTimePriceCents,
		OneTimeCharacterLimit: cfg.OneTimeCharacterLimit,
		WeeklyPriceCents:      cfg.WeeklyPriceCents,
		WeeklyAllowanceChars:  cfg.WeeklyAllowanceChars,
		Currency:              "usd",
		StripeConfigured:      cfg.Stripe.Configured(),
	}
	if offer.DisplayName == "" {
		offer.DisplayName = "Creator"
	}
	if creator == nil {
		return offer
	}
	if creator.DisplayName != "" {
		offer.DisplayName = creator.DisplayName
	}
	offer.Description = creator.Description
	if creator.SupportItem != "" {
		offer.SupportItem = creator.SupportItem
	}
	if creator.OneTimePriceCents > 0 {
		offer.OneTimePriceCents = creator.OneTimePriceCents
	}
	if creator.OneTimeCharacterLimit > 0 {
		offer.OneTimeCharacterLimit = int(creator.OneTimeCharacterLimit)
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
	return offer
}
