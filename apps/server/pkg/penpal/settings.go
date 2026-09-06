package penpal

import (
	"context"
	"strings"
	"unicode/utf8"
)

const (
	maxDisplayName  = 80
	maxDescription  = 2000
	maxOneTimeChars = 2000
	minOneTimeChars = 1
	minPriceCents   = int64(1)
)

type CreatorSettingsInput struct {
	DisplayName           string
	Description           string
	SupportItem           string
	OneTimePriceCents     int64
	OneTimeCharacterLimit int
	WeeklyPriceCents      int64
}

func (s *Service) UpdateSettings(ctx context.Context, in CreatorSettingsInput) (Offer, error) {
	cleaned, err := normalizeCreatorSettings(in)
	if err != nil {
		return Offer{}, err
	}
	row, err := s.repo.UpdateCreatorSettings(ctx, cleaned)
	if err != nil {
		return Offer{}, err
	}
	return BuildOffer(s.cfg, row), nil
}

func normalizeCreatorSettings(in CreatorSettingsInput) (CreatorSettingsInput, error) {
	name := strings.TrimSpace(in.DisplayName)
	if name == "" || utf8.RuneCountInString(name) > maxDisplayName {
		return CreatorSettingsInput{}, ErrInvalidSettings
	}
	desc := strings.TrimSpace(in.Description)
	if utf8.RuneCountInString(desc) > maxDescription {
		return CreatorSettingsInput{}, ErrInvalidSettings
	}
	item := strings.ToLower(strings.TrimSpace(in.SupportItem))
	switch item {
	case "coffee", "cocktail", "lemonade":
	default:
		return CreatorSettingsInput{}, ErrInvalidSettings
	}
	if in.OneTimePriceCents < minPriceCents || in.WeeklyPriceCents < minPriceCents {
		return CreatorSettingsInput{}, ErrInvalidSettings
	}
	limit := in.OneTimeCharacterLimit
	if limit < minOneTimeChars || limit > maxOneTimeChars {
		return CreatorSettingsInput{}, ErrInvalidSettings
	}
	return CreatorSettingsInput{
		DisplayName:           name,
		Description:           desc,
		SupportItem:           item,
		OneTimePriceCents:     in.OneTimePriceCents,
		OneTimeCharacterLimit: limit,
		WeeklyPriceCents:      in.WeeklyPriceCents,
	}, nil
}

func mapSettings(offer Offer) map[string]any {
	return map[string]any{
		"display_name":             offer.DisplayName,
		"description":              offer.Description,
		"support_item":             offer.SupportItem,
		"one_time_price_cents":     offer.OneTimePriceCents,
		"one_time_character_limit": offer.OneTimeCharacterLimit,
		"weekly_price_cents":       offer.WeeklyPriceCents,
		"weekly_allowance_chars":   offer.WeeklyAllowanceChars,
		"currency":                 "usd",
		"avatar_url":               offer.AvatarURL,
	}
}
