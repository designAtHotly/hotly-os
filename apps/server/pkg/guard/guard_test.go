package guard

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestOriginRejectsCrossSiteWrites(t *testing.T) {
	h := Origin("http://localhost", SkipStripeWebhook)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	req := httptest.NewRequest(http.MethodPost, "/penpal/checkout", nil)
	req.Header.Set("Origin", "https://evil.example")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("csrf %d", rec.Code)
	}
	okReq := httptest.NewRequest(http.MethodPost, "/penpal/checkout", nil)
	okReq.Header.Set("Origin", "http://localhost")
	okRec := httptest.NewRecorder()
	h.ServeHTTP(okRec, okReq)
	if okRec.Code != http.StatusOK {
		t.Fatalf("same origin %d", okRec.Code)
	}
	hook := httptest.NewRequest(http.MethodPost, "/api/webhooks/stripe", nil)
	hook.Header.Set("Origin", "https://evil.example")
	hookRec := httptest.NewRecorder()
	h.ServeHTTP(hookRec, hook)
	if hookRec.Code != http.StatusOK {
		t.Fatalf("stripe webhook must skip csrf %d", hookRec.Code)
	}
}

func TestCORSAllowsOnlyConfiguredOrigin(t *testing.T) {
	h := CORS("http://localhost")(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	req := httptest.NewRequest(http.MethodGet, "/penpal", nil)
	req.Header.Set("Origin", "http://localhost")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Header().Get("Access-Control-Allow-Origin") != "http://localhost" {
		t.Fatalf("cors %v", rec.Header())
	}
	bad := httptest.NewRequest(http.MethodGet, "/penpal", nil)
	bad.Header.Set("Origin", "https://evil.example")
	badRec := httptest.NewRecorder()
	h.ServeHTTP(badRec, bad)
	if badRec.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatal("exact-origin CORS must not reflect a foreign origin")
	}
}

func TestRateLimitAndTrustedProxyIP(t *testing.T) {
	h := RateLimit(2, time.Minute, SensitiveWrite)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	hit := func(ip string) int {
		req := httptest.NewRequest(http.MethodPost, "/penpal/checkout", nil)
		req.RemoteAddr = "127.0.0.1:1234"
		req.Header.Set("X-Forwarded-For", ip)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec.Code
	}
	if hit("203.0.113.9") != http.StatusOK || hit("203.0.113.9") != http.StatusOK {
		t.Fatal("first two should pass")
	}
	if hit("203.0.113.9") != http.StatusTooManyRequests {
		t.Fatal("third should rate limit")
	}
	if hit("203.0.113.10") != http.StatusOK {
		t.Fatal("other IP should have its own budget")
	}
}

func TestClientIPIgnoresForwardedHeaderFromPublicPeers(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = "203.0.113.5:80"
	req.Header.Set("X-Forwarded-For", "1.2.3.4")
	if got := ClientIP(req); got != "203.0.113.5" {
		t.Fatalf("untrusted peer ip %s", got)
	}
}
