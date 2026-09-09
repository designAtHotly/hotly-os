package config

import (
	"fmt"
	"net/mail"
	"net/url"
	"os"
	"strconv"
	"strings"
)

const minSecretLen = 32

// Config is deployment configuration from the environment. Secrets must never be logged.
type Config struct {
	PublicAppURL          string
	DatabaseURL           string
	MediaPath             string
	CreatorEmail          string
	CreatorDisplayName    string
	SupportItem           string
	OneTimePriceCents     int64
	OneTimeCharacterLimit int
	Price500Cents         int64
	Price1000Cents        int64
	WeeklyPriceCents      int64
	WeeklyAllowanceChars  int
	SessionSecret         string
	RecoveryTokenSecret   string
	Firebase              FirebaseConfig
	Stripe                StripeConfig
	SendGrid              SendGridConfig
	S3                    S3Config
}

type FirebaseConfig struct {
	ProjectID   string
	WebAPIKey   string
	AuthDomain  string
	Credentials string // path or JSON; never log
}

func (f FirebaseConfig) Configured() bool {
	return f.ProjectID != "" && f.WebAPIKey != "" && f.AuthDomain != "" && f.Credentials != ""
}

type StripeConfig struct {
	SecretKey      string
	PublishableKey string
	WebhookSecret  string
}

func (s StripeConfig) Configured() bool {
	return s.SecretKey != "" && s.PublishableKey != "" && s.WebhookSecret != ""
}

type SendGridConfig struct {
	APIKey    string
	FromEmail string
	FromName  string
}

func (s SendGridConfig) Configured() bool {
	return s.APIKey != "" && s.FromEmail != "" && s.FromName != ""
}

type S3Config struct {
	Endpoint  string
	Region    string
	Bucket    string
	AccessKey string
	SecretKey string
}

func (s S3Config) Configured() bool {
	return s.Endpoint != "" && s.Bucket != "" && s.AccessKey != "" && s.SecretKey != ""
}

// Load reads and validates environment configuration. Error text names keys, never values.
func Load() (*Config, error) {
	cfg := &Config{
		PublicAppURL:          strings.TrimSpace(os.Getenv("PUBLIC_APP_URL")),
		DatabaseURL:           strings.TrimSpace(os.Getenv("DATABASE_URL")),
		MediaPath:             strings.TrimSpace(firstNonEmpty(os.Getenv("MEDIA_PATH"), "/var/lib/hotly/media")),
		CreatorEmail:          strings.TrimSpace(os.Getenv("CREATOR_EMAIL")),
		CreatorDisplayName:    strings.TrimSpace(os.Getenv("CREATOR_DISPLAY_NAME")),
		SupportItem:           strings.TrimSpace(firstNonEmpty(os.Getenv("SUPPORT_ITEM"), "coffee")),
		SessionSecret:         os.Getenv("SESSION_SECRET"),
		RecoveryTokenSecret:   os.Getenv("RECOVERY_TOKEN_SECRET"),
		OneTimePriceCents:     int64(intEnv("ONE_TIME_PRICE_CENTS", 500)),
		OneTimeCharacterLimit: intEnv("ONE_TIME_CHARACTER_LIMIT", 250),
		Price500Cents:         int64(intEnv("ONE_TIME_PRICE_500_CENTS", 1000)),
		Price1000Cents:        int64(intEnv("ONE_TIME_PRICE_1000_CENTS", 1500)),
		WeeklyPriceCents:      int64(intEnv("WEEKLY_PRICE_CENTS", 1500)),
		WeeklyAllowanceChars:  intEnv("WEEKLY_ALLOWANCE_CHARS", 2000),
		Firebase: FirebaseConfig{
			ProjectID:   strings.TrimSpace(os.Getenv("FIREBASE_PROJECT_ID")),
			WebAPIKey:   strings.TrimSpace(os.Getenv("FIREBASE_WEB_API_KEY")),
			AuthDomain:  strings.TrimSpace(os.Getenv("FIREBASE_AUTH_DOMAIN")),
			Credentials: firstNonEmpty(os.Getenv("FIREBASE_CREDENTIALS_JSON"), os.Getenv("GOOGLE_APPLICATION_CREDENTIALS")),
		},
		Stripe: StripeConfig{
			SecretKey:      os.Getenv("STRIPE_SECRET_KEY"),
			PublishableKey: strings.TrimSpace(os.Getenv("STRIPE_PUBLISHABLE_KEY")),
			WebhookSecret:  os.Getenv("STRIPE_WEBHOOK_SECRET"),
		},
		S3: S3Config{
			Endpoint:  strings.TrimSpace(os.Getenv("S3_ENDPOINT")),
			Region:    strings.TrimSpace(firstNonEmpty(os.Getenv("S3_REGION"), "garage")),
			Bucket:    strings.TrimSpace(firstNonEmpty(os.Getenv("S3_BUCKET"), "hotly")),
			AccessKey: os.Getenv("S3_ACCESS_KEY"),
			SecretKey: os.Getenv("S3_SECRET_KEY"),
		},
		SendGrid: SendGridConfig{
			APIKey:    os.Getenv("SENDGRID_API_KEY"),
			FromEmail: strings.TrimSpace(os.Getenv("SENDGRID_FROM_EMAIL")),
			FromName:  strings.TrimSpace(os.Getenv("SENDGRID_FROM_NAME")),
		},
	}

	var missing []string
	if cfg.PublicAppURL == "" {
		missing = append(missing, "PUBLIC_APP_URL")
	}
	if cfg.DatabaseURL == "" {
		missing = append(missing, "DATABASE_URL")
	}
	if cfg.CreatorEmail == "" {
		missing = append(missing, "CREATOR_EMAIL")
	}
	if cfg.SessionSecret == "" {
		missing = append(missing, "SESSION_SECRET")
	}
	if cfg.RecoveryTokenSecret == "" {
		missing = append(missing, "RECOVERY_TOKEN_SECRET")
	}
	if len(missing) > 0 {
		return nil, fmt.Errorf("missing required configuration: %s", strings.Join(missing, ", "))
	}

	if _, err := url.ParseRequestURI(cfg.PublicAppURL); err != nil {
		return nil, fmt.Errorf("PUBLIC_APP_URL must be an absolute URL")
	}
	parsed, err := url.Parse(cfg.PublicAppURL)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
		return nil, fmt.Errorf("PUBLIC_APP_URL must be an absolute http(s) URL")
	}
	if _, err := mail.ParseAddress(cfg.CreatorEmail); err != nil {
		return nil, fmt.Errorf("CREATOR_EMAIL must be a valid email address")
	}
	if len(cfg.SessionSecret) < minSecretLen {
		return nil, fmt.Errorf("SESSION_SECRET must be at least %d characters", minSecretLen)
	}
	if len(cfg.RecoveryTokenSecret) < minSecretLen {
		return nil, fmt.Errorf("RECOVERY_TOKEN_SECRET must be at least %d characters", minSecretLen)
	}
	switch cfg.SupportItem {
	case "coffee", "cocktail", "lemonade":
	default:
		return nil, fmt.Errorf("SUPPORT_ITEM must be coffee, cocktail, or lemonade")
	}
	if cfg.OneTimePriceCents <= 0 || cfg.Price500Cents <= 0 || cfg.Price1000Cents <= 0 || cfg.WeeklyPriceCents <= 0 {
		return nil, fmt.Errorf("ONE_TIME_PRICE_CENTS, ONE_TIME_PRICE_500_CENTS, ONE_TIME_PRICE_1000_CENTS, and WEEKLY_PRICE_CENTS must be positive integer USD cents")
	}
	if cfg.OneTimeCharacterLimit <= 0 {
		return nil, fmt.Errorf("ONE_TIME_CHARACTER_LIMIT must be a positive integer")
	}
	if cfg.WeeklyAllowanceChars != 2000 {
		return nil, fmt.Errorf("WEEKLY_ALLOWANCE_CHARS must be 2000")
	}

	return cfg, nil
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

func intEnv(key string, fallback int) int {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	n, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return n
}
