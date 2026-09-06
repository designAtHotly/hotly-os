package auth

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"time"

	"github.com/go-chi/chi/v5"
	"hotly-opensource/server/pkg/config"
)

type ctxKey int

const principalKey ctxKey = 1

func withPrincipal(ctx context.Context, p Principal) context.Context {
	return context.WithValue(ctx, principalKey, p)
}

func PrincipalFrom(ctx context.Context) (Principal, bool) {
	p, ok := ctx.Value(principalKey).(Principal)
	return p, ok
}

type firebaseRequest struct {
	IDToken string `json:"id_token"`
}

type sessionResponse struct {
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
	IsCreator   bool   `json:"is_creator"`
	UserID      int64  `json:"user_id"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeAuthError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrNotConfigured):
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "firebase_not_configured"})
	case errors.Is(err, ErrInvalidToken), errors.Is(err, ErrUnauthorized):
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
	default:
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
	}
}

func Mount(r chi.Router, svc *Service, cfg *config.Config) {
	r.Get("/auth/config", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"configured": svc.Configured() && cfg.Firebase.Configured(),
			"projectId":  cfg.Firebase.ProjectID,
			"apiKey":     cfg.Firebase.WebAPIKey,
			"authDomain": cfg.Firebase.AuthDomain,
		})
	})
	r.Post("/auth/firebase", func(w http.ResponseWriter, req *http.Request) {
		var body firebaseRequest
		if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_json"})
			return
		}
		token, principal, expires, err := svc.Exchange(req.Context(), body.IDToken)
		if err != nil {
			writeAuthError(w, err)
			return
		}
		http.SetCookie(w, sessionCookie(token, svc.CookieSecure(), expires))
		writeJSON(w, http.StatusOK, sessionResponse{
			Email:       principal.User.Email,
			DisplayName: principal.User.DisplayName,
			IsCreator:   principal.IsCreator,
			UserID:      principal.User.ID,
		})
	})
	r.Get("/auth/me", func(w http.ResponseWriter, req *http.Request) {
		c, err := req.Cookie(SessionCookieName)
		if err != nil {
			writeAuthError(w, ErrUnauthorized)
			return
		}
		principal, err := svc.Current(req.Context(), c.Value)
		if err != nil {
			writeAuthError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, sessionResponse{
			Email:       principal.User.Email,
			DisplayName: principal.User.DisplayName,
			IsCreator:   principal.IsCreator,
			UserID:      principal.User.ID,
		})
	})
	r.Post("/auth/logout", func(w http.ResponseWriter, req *http.Request) {
		c, err := req.Cookie(SessionCookieName)
		if err == nil {
			_ = svc.Logout(req.Context(), c.Value)
		}
		http.SetCookie(w, clearSessionCookie(svc.CookieSecure()))
		w.WriteHeader(http.StatusNoContent)
	})
	r.Group(func(g chi.Router) {
		g.Use(RequireCreator(svc))
		g.Get("/creator", func(w http.ResponseWriter, req *http.Request) {
			principal, ok := PrincipalFrom(req.Context())
			if !ok {
				writeAuthError(w, ErrUnauthorized)
				return
			}
			writeJSON(w, http.StatusOK, sessionResponse{
				Email:       principal.User.Email,
				DisplayName: principal.User.DisplayName,
				IsCreator:   principal.IsCreator,
				UserID:      principal.User.ID,
			})
		})
	})
}

func OptionalUser(svc *Service) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			principal, err := principalFromRequest(svc, req)
			if err == nil {
				req = req.WithContext(withPrincipal(req.Context(), principal))
			}
			next.ServeHTTP(w, req)
		})
	}
}

func RequireUser(svc *Service) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			principal, err := principalFromRequest(svc, req)
			if err != nil {
				writeAuthError(w, err)
				return
			}
			next.ServeHTTP(w, req.WithContext(withPrincipal(req.Context(), principal)))
		})
	}
}

func RequireCreator(svc *Service) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			principal, err := principalFromRequest(svc, req)
			if err != nil {
				writeAuthError(w, err)
				return
			}
			if !principal.IsCreator {
				writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
				return
			}
			next.ServeHTTP(w, req.WithContext(withPrincipal(req.Context(), principal)))
		})
	}
}

func principalFromRequest(svc *Service, req *http.Request) (Principal, error) {
	c, err := req.Cookie(SessionCookieName)
	if err != nil {
		return Principal{}, ErrUnauthorized
	}
	return svc.Current(req.Context(), c.Value)
}

func WriteSessionCookie(w http.ResponseWriter, token string, secure bool, expires time.Time) {
	http.SetCookie(w, sessionCookie(token, secure, expires))
}

func SecureCookies(publicAppURL string) bool {
	u, err := url.Parse(publicAppURL)
	return err == nil && u.Scheme == "https"
}
