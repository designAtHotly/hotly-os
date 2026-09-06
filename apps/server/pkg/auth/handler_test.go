package auth

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"hotly-opensource/server/pkg/config"
)

func testRouter(svc *Service, cfg *config.Config) http.Handler {
	r := chi.NewRouter()
	Mount(r, svc, cfg)
	return r
}

func TestAuthConfigWhenFirebaseMissing(t *testing.T) {
	svc := NewService(newMemStore(), nil, testCreator(), false)
	rec := httptest.NewRecorder()
	testRouter(svc, &config.Config{}).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/auth/config", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d", rec.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["configured"] != false {
		t.Fatalf("expected configured=false, got %#v", body["configured"])
	}
}

func TestFirebaseExchangeRequiresConfiguration(t *testing.T) {
	svc := NewService(newMemStore(), nil, testCreator(), false)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/auth/firebase", strings.NewReader(`{"id_token":"x"}`))
	req.Header.Set("Content-Type", "application/json")
	testRouter(svc, &config.Config{}).ServeHTTP(rec, req)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "firebase_not_configured") {
		t.Fatalf("body %s", rec.Body.String())
	}
}

func TestFirebaseExchangeSetsHttpOnlyCookieWithoutJWT(t *testing.T) {
	store := newMemStore()
	svc := NewService(store, stubVerifier{ident: Identity{UID: "fb-1", Email: "creator@example.com", Name: "C"}}, testCreator(), false)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/auth/firebase", strings.NewReader(`{"id_token":"id-token"}`))
	req.Header.Set("Content-Type", "application/json")
	testRouter(svc, &config.Config{}).ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{"token", "jwt", "access_token", "id_token"} {
		if _, ok := body[key]; ok {
			t.Fatalf("response must not include %s: %#v", key, body)
		}
	}
	if body["is_creator"] != true {
		t.Fatalf("expected creator, got %#v", body)
	}
	cookies := rec.Result().Cookies()
	var session *http.Cookie
	for _, c := range cookies {
		if c.Name == SessionCookieName {
			session = c
			break
		}
	}
	if session == nil || session.Value == "" || !session.HttpOnly {
		t.Fatalf("expected httpOnly session cookie, got %#v", cookies)
	}

	me := httptest.NewRecorder()
	meReq := httptest.NewRequest(http.MethodGet, "/auth/me", nil)
	meReq.AddCookie(session)
	testRouter(svc, &config.Config{}).ServeHTTP(me, meReq)
	if me.Code != http.StatusOK {
		t.Fatalf("me status %d", me.Code)
	}
}

func TestCreatorRouteRejectsNonCreator(t *testing.T) {
	store := newMemStore()
	creatorSvc := NewService(store, stubVerifier{ident: Identity{UID: "c", Email: "creator@example.com"}}, testCreator(), false)
	_, _, _, err := creatorSvc.Exchange(t.Context(), "t")
	if err != nil {
		t.Fatal(err)
	}
	fanSvc := NewService(store, stubVerifier{ident: Identity{UID: "f", Email: "fan@example.com"}}, testCreator(), false)
	token, principal, _, err := fanSvc.Exchange(t.Context(), "t")
	if err != nil {
		t.Fatal(err)
	}
	if principal.IsCreator {
		t.Fatal("fan must not be creator")
	}

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/creator", nil)
	req.AddCookie(&http.Cookie{Name: SessionCookieName, Value: token})
	testRouter(fanSvc, &config.Config{}).ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
}

func TestCreatorRouteAllowsConfiguredCreator(t *testing.T) {
	svc := NewService(newMemStore(), stubVerifier{ident: Identity{UID: "c", Email: "creator@example.com", Name: "C"}}, testCreator(), false)
	token, _, _, err := svc.Exchange(t.Context(), "t")
	if err != nil {
		t.Fatal(err)
	}
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/creator", nil)
	req.AddCookie(&http.Cookie{Name: SessionCookieName, Value: token})
	testRouter(svc, &config.Config{}).ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
}

func TestCreatorRouteUnauthorizedWithoutCookie(t *testing.T) {
	svc := NewService(newMemStore(), stubVerifier{ident: Identity{UID: "c", Email: "creator@example.com"}}, testCreator(), false)
	rec := httptest.NewRecorder()
	testRouter(svc, &config.Config{}).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/creator", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status %d", rec.Code)
	}
}

func TestLogoutClearsCookie(t *testing.T) {
	svc := NewService(newMemStore(), stubVerifier{ident: Identity{UID: "c", Email: "creator@example.com"}}, testCreator(), false)
	token, _, _, err := svc.Exchange(t.Context(), "t")
	if err != nil {
		t.Fatal(err)
	}
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/auth/logout", nil)
	req.AddCookie(&http.Cookie{Name: SessionCookieName, Value: token})
	testRouter(svc, &config.Config{}).ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status %d", rec.Code)
	}
	body, _ := io.ReadAll(rec.Body)
	if len(body) != 0 {
		t.Fatalf("logout must not return a body, got %q", body)
	}
	me := httptest.NewRecorder()
	meReq := httptest.NewRequest(http.MethodGet, "/auth/me", nil)
	meReq.AddCookie(&http.Cookie{Name: SessionCookieName, Value: token})
	testRouter(svc, &config.Config{}).ServeHTTP(me, meReq)
	if me.Code != http.StatusUnauthorized {
		t.Fatalf("revoked session still accepted: %d", me.Code)
	}
}
