package auth

import (
	"context"
	"errors"
	"testing"
)

func testCreator() CreatorSettings {
	return CreatorSettings{
		Email:                 "creator@example.com",
		DisplayName:           "Creator",
		SupportItem:           "coffee",
		OneTimePriceCents:     500,
		OneTimeCharacterLimit: 250,
		WeeklyPriceCents:      1500,
	}
}

func TestExchangeGrantsCreatorOnlyToConfiguredEmail(t *testing.T) {
	store := newMemStore()
	svc := NewService(store, stubVerifier{ident: Identity{UID: "fb-1", Email: "creator@example.com", Name: "C"}}, testCreator(), false)

	token, principal, _, err := svc.Exchange(context.Background(), "id-token")
	if err != nil {
		t.Fatal(err)
	}
	if token == "" || !principal.IsCreator || principal.User.Email != "creator@example.com" {
		t.Fatalf("expected creator session, got %+v token empty=%t", principal, token == "")
	}

	other := NewService(store, stubVerifier{ident: Identity{UID: "fb-2", Email: "fan@example.com", Name: "Fan"}}, testCreator(), false)
	_, fan, _, err := other.Exchange(context.Background(), "id-token")
	if err != nil {
		t.Fatal(err)
	}
	if fan.IsCreator {
		t.Fatal("non-configured email must not receive the creator role")
	}

	got, err := svc.Current(context.Background(), token)
	if err != nil || !got.IsCreator {
		t.Fatalf("creator cookie should still work: %+v %v", got, err)
	}
}

func TestLogoutRevokesSession(t *testing.T) {
	store := newMemStore()
	svc := NewService(store, stubVerifier{ident: Identity{UID: "fb-1", Email: "fan@example.com"}}, testCreator(), false)
	token, _, _, err := svc.Exchange(context.Background(), "id-token")
	if err != nil {
		t.Fatal(err)
	}
	if err := svc.Logout(context.Background(), token); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Current(context.Background(), token); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("expected unauthorized after logout, got %v", err)
	}
}

func TestChangingCreatorIdentityRevokesPreviousCreatorSessions(t *testing.T) {
	store := newMemStore()
	first := NewService(store, stubVerifier{ident: Identity{UID: "old", Email: "creator@example.com"}}, testCreator(), false)
	oldToken, _, _, err := first.Exchange(context.Background(), "t")
	if err != nil {
		t.Fatal(err)
	}

	settings := testCreator()
	settings.Email = "new-creator@example.com"
	second := NewService(store, stubVerifier{ident: Identity{UID: "new", Email: "new-creator@example.com"}}, settings, false)
	_, principal, _, err := second.Exchange(context.Background(), "t")
	if err != nil {
		t.Fatal(err)
	}
	if !principal.IsCreator {
		t.Fatal("new configured email should be creator")
	}
	if _, err := first.Current(context.Background(), oldToken); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("old creator session should be revoked, got %v", err)
	}
}

func TestCurrentRevokesWhenCreatorEmailConfigChanges(t *testing.T) {
	store := newMemStore()
	first := NewService(store, stubVerifier{ident: Identity{UID: "old", Email: "creator@example.com"}}, testCreator(), false)
	token, _, _, err := first.Exchange(context.Background(), "t")
	if err != nil {
		t.Fatal(err)
	}

	settings := testCreator()
	settings.Email = "new-creator@example.com"
	restarted := NewService(store, nil, settings, false)
	if _, err := restarted.Current(context.Background(), token); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("old creator session should be revoked after config change, got %v", err)
	}
}

func TestExpiredSessionIsUnauthorized(t *testing.T) {
	store := newMemStore()
	svc := NewService(store, stubVerifier{ident: Identity{UID: "fb-1", Email: "fan@example.com"}}, testCreator(), false)
	token, _, _, err := svc.Exchange(context.Background(), "id-token")
	if err != nil {
		t.Fatal(err)
	}
	store.expireAll()
	if _, err := svc.Current(context.Background(), token); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("expected unauthorized after expiry, got %v", err)
	}
}

func TestRejectsMissingToken(t *testing.T) {
	svc := NewService(newMemStore(), stubVerifier{ident: Identity{UID: "x", Email: "a@b.c"}}, testCreator(), false)
	if _, _, _, err := svc.Exchange(context.Background(), ""); !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("got %v", err)
	}
}

func TestNotConfigured(t *testing.T) {
	svc := NewService(newMemStore(), nil, testCreator(), false)
	if _, _, _, err := svc.Exchange(context.Background(), "t"); !errors.Is(err, ErrNotConfigured) {
		t.Fatalf("got %v", err)
	}
}
