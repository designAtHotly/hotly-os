package guard

import (
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

func CORS(publicAppURL string) func(http.Handler) http.Handler {
	allowed := originOf(publicAppURL)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := strings.TrimSpace(r.Header.Get("Origin"))
			if allowed != "" && origin == allowed {
				w.Header().Set("Access-Control-Allow-Origin", allowed)
				w.Header().Set("Access-Control-Allow-Credentials", "true")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Stripe-Signature")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
				w.Header().Add("Vary", "Origin")
			}
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func Origin(publicAppURL string, skip func(*http.Request) bool) func(http.Handler) http.Handler {
	allowed := originOf(publicAppURL)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if skip != nil && skip(r) {
				next.ServeHTTP(w, r)
				return
			}
			if r.Method == http.MethodGet || r.Method == http.MethodHead || r.Method == http.MethodOptions {
				next.ServeHTTP(w, r)
				return
			}
			got := requestOrigin(r)
			if got == "" {
				next.ServeHTTP(w, r)
				return
			}
			if allowed == "" || got != allowed {
				http.Error(w, `{"error":"csrf"}`, http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func SkipStripeWebhook(r *http.Request) bool {
	return r.URL.Path == "/webhooks/stripe" || r.URL.Path == "/api/webhooks/stripe"
}

func RateLimit(n int, window time.Duration, match func(*http.Request) bool) func(http.Handler) http.Handler {
	lim := newLimiter(n, window)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if match != nil && !match(r) {
				next.ServeHTTP(w, r)
				return
			}
			if !lim.allow(ClientIP(r) + " " + r.Method + " " + r.URL.Path) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusTooManyRequests)
				_, _ = w.Write([]byte(`{"error":"rate_limited"}`))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func SensitiveWrite(r *http.Request) bool {
	if r.Method != http.MethodPost && r.Method != http.MethodPatch {
		return false
	}
	p := r.URL.Path
	return strings.HasSuffix(p, "/auth/firebase") ||
		strings.HasSuffix(p, "/penpal/checkout") ||
		strings.HasSuffix(p, "/penpal/recovery") ||
		strings.HasSuffix(p, "/chat/messages") ||
		strings.HasSuffix(p, "/dome/notes")
}

func ClientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	ip := net.ParseIP(host)
	if ip != nil && (ip.IsLoopback() || ip.IsPrivate()) {
		if xff := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); xff != "" {
			first := strings.TrimSpace(strings.Split(xff, ",")[0])
			if net.ParseIP(first) != nil {
				return first
			}
		}
	}
	if host == "" {
		return "unknown"
	}
	return host
}

func originOf(publicAppURL string) string {
	u, err := url.Parse(strings.TrimSpace(publicAppURL))
	if err != nil || u.Scheme == "" || u.Host == "" {
		return ""
	}
	return u.Scheme + "://" + u.Host
}

func requestOrigin(r *http.Request) string {
	if o := strings.TrimSpace(r.Header.Get("Origin")); o != "" {
		return strings.TrimRight(o, "/")
	}
	ref := strings.TrimSpace(r.Header.Get("Referer"))
	if ref == "" {
		return ""
	}
	u, err := url.Parse(ref)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return ""
	}
	return u.Scheme + "://" + u.Host
}

type limiter struct {
	mu      sync.Mutex
	n       int
	window  time.Duration
	buckets map[string][]time.Time
}

func newLimiter(n int, window time.Duration) *limiter {
	return &limiter{n: n, window: window, buckets: map[string][]time.Time{}}
}

func (l *limiter) allow(key string) bool {
	now := time.Now()
	l.mu.Lock()
	defer l.mu.Unlock()
	hits := l.buckets[key]
	cut := now.Add(-l.window)
	kept := hits[:0]
	for _, t := range hits {
		if t.After(cut) {
			kept = append(kept, t)
		}
	}
	if len(kept) >= l.n {
		l.buckets[key] = kept
		return false
	}
	l.buckets[key] = append(kept, now)
	return true
}
