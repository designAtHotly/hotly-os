package config

import (
	"os"
	"strings"
	"testing"
)

func TestLoadMissingRequiredDoesNotLeakSecrets(t *testing.T) {
	t.Setenv("PUBLIC_APP_URL", "")
	t.Setenv("DATABASE_URL", "postgres://hotly:super-secret-password@postgres:5432/hotly")
	t.Setenv("CREATOR_EMAIL", "")
	t.Setenv("SESSION_SECRET", "this-secret-must-never-appear-in-errors!!")
	t.Setenv("RECOVERY_TOKEN_SECRET", "another-secret-that-must-never-appear!!!!")

	_, err := Load()
	if err == nil {
		t.Fatal("expected missing required configuration")
	}
	msg := err.Error()
	if !strings.Contains(msg, "PUBLIC_APP_URL") || !strings.Contains(msg, "CREATOR_EMAIL") {
		t.Fatalf("expected named keys, got %q", msg)
	}
	if strings.Contains(msg, "super-secret-password") || strings.Contains(msg, "this-secret-must-never") {
		t.Fatalf("error leaked a secret: %q", msg)
	}
}

func TestLoadRejectsShortSecretsWithoutEchoingThem(t *testing.T) {
	t.Setenv("PUBLIC_APP_URL", "http://localhost")
	t.Setenv("DATABASE_URL", "postgres://hotly:changeme@postgres:5432/hotly")
	t.Setenv("CREATOR_EMAIL", "creator@example.com")
	t.Setenv("SESSION_SECRET", "short")
	t.Setenv("RECOVERY_TOKEN_SECRET", "abcdefghijklmnopqrstuvwxyz123456")
	t.Setenv("SUPPORT_ITEM", "coffee")

	_, err := Load()
	if err == nil {
		t.Fatal("expected short SESSION_SECRET to fail")
	}
	if strings.Contains(err.Error(), "short") && !strings.Contains(err.Error(), "SESSION_SECRET") {
		t.Fatalf("error should name the key, got %q", err.Error())
	}
	if strings.Contains(err.Error(), "short") {
		t.Fatalf("error leaked secret value: %q", err.Error())
	}
}

func TestLoadAcceptsLocalPlaceholders(t *testing.T) {
	t.Setenv("PUBLIC_APP_URL", "http://localhost")
	t.Setenv("DATABASE_URL", "postgres://hotly:changeme@postgres:5432/hotly")
	t.Setenv("CREATOR_EMAIL", "creator@example.com")
	t.Setenv("SESSION_SECRET", "local-dev-session-secret-32bytes")
	t.Setenv("RECOVERY_TOKEN_SECRET", "local-dev-recovery-secret-32byte")
	t.Setenv("SUPPORT_ITEM", "coffee")
	t.Setenv("ONE_TIME_PRICE_CENTS", "500")
	t.Setenv("WEEKLY_PRICE_CENTS", "1500")
	t.Setenv("ONE_TIME_CHARACTER_LIMIT", "250")
	t.Setenv("WEEKLY_ALLOWANCE_CHARS", "2000")
	os.Unsetenv("FIREBASE_PROJECT_ID")
	os.Unsetenv("STRIPE_SECRET_KEY")
	os.Unsetenv("SENDGRID_API_KEY")

	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Firebase.Configured() || cfg.Stripe.Configured() || cfg.SendGrid.Configured() {
		t.Fatal("placeholders should not mark providers configured")
	}
	if cfg.CreatorEmail != "creator@example.com" || cfg.SupportItem != "coffee" {
		t.Fatalf("unexpected creator defaults: %+v", cfg)
	}
}
