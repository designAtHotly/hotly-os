package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"hotly-opensource/server/pkg/applog"
	"hotly-opensource/server/pkg/auth"
	"hotly-opensource/server/pkg/billing"
	"hotly-opensource/server/pkg/config"
	"hotly-opensource/server/pkg/db"
	"hotly-opensource/server/pkg/dome"
	"hotly-opensource/server/pkg/guard"
	"hotly-opensource/server/pkg/mailer"
	"hotly-opensource/server/pkg/media"
	"hotly-opensource/server/pkg/penpal"
)

func listenAddr() string {
	if port := os.Getenv("PORT"); port != "" {
		return ":" + port
	}
	return ":8080"
}

func writeOK(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("Ok!"))
}

func writeHealth(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if err := pool.Ping(ctx); err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = w.Write([]byte(`{"status":"unhealthy"}`))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	}
}

func main() {
	applog.Setup()
	cfg, err := config.Load()
	if err != nil {
		slog.Error("config invalid", "err", err.Error())
		os.Exit(1)
	}
	slog.Info("config loaded",
		"public_app_url", cfg.PublicAppURL,
		"firebase", cfg.Firebase.Configured(),
		"stripe", cfg.Stripe.Configured(),
		"sendgrid", cfg.SendGrid.Configured(),
		"s3", cfg.S3.Configured(),
	)

	ctx := context.Background()
	pool, err := config.OpenPool(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("database unavailable")
		os.Exit(1)
	}
	defer pool.Close()
	queries := db.New(pool)

	var stripeGW billing.Gateway
	if cfg.Stripe.Configured() {
		stripeGW = billing.NewStripe(cfg.Stripe.SecretKey, cfg.Stripe.WebhookSecret)
	}

	var mailSender mailer.Sender
	if cfg.SendGrid.Configured() {
		mailSender = mailer.NewSendGrid(cfg.SendGrid)
	}

	var verifier auth.Verifier
	if cfg.Firebase.Configured() {
		v, ferr := auth.NewFirebaseVerifier(ctx, cfg.Firebase.Credentials)
		if ferr != nil {
			slog.Error("firebase credentials are invalid", "err", ferr.Error())
			os.Exit(1)
		}
		verifier = v
	}

	var blobs media.BlobStore
	if cfg.S3.Configured() {
		blobs = media.NewS3(media.S3Config{
			Endpoint:  cfg.S3.Endpoint,
			Region:    cfg.S3.Region,
			Bucket:    cfg.S3.Bucket,
			AccessKey: cfg.S3.AccessKey,
			SecretKey: cfg.S3.SecretKey,
		})
	}

	authSvc := auth.NewService(
		auth.NewPGStore(queries),
		verifier,
		auth.CreatorSettings{
			Email:                 cfg.CreatorEmail,
			DisplayName:           cfg.CreatorDisplayName,
			SupportItem:           cfg.SupportItem,
			OneTimePriceCents:     cfg.OneTimePriceCents,
			OneTimeCharacterLimit: int32(cfg.OneTimeCharacterLimit),
			WeeklyPriceCents:      cfg.WeeklyPriceCents,
		},
		auth.SecureCookies(cfg.PublicAppURL),
	)

	r := chi.NewRouter()
	r.Use(guard.CORS(cfg.PublicAppURL))
	r.Use(guard.Origin(cfg.PublicAppURL, guard.SkipStripeWebhook))
	r.Use(guard.RateLimit(20, time.Minute, guard.SensitiveWrite))
	health := writeHealth(pool)
	r.Get("/", writeOK)
	r.Get("/health", health)
	r.Route("/api", func(api chi.Router) {
		api.Get("/", writeOK)
		api.Get("/health", health)
		auth.Mount(api, authSvc, cfg)
		penpal.Mount(api, penpal.NewHandler(cfg, penpal.NewService(cfg, penpal.NewPG(pool, queries), stripeGW, mailSender, blobs), authSvc))
		dome.Mount(api, dome.NewHandler(dome.NewService(dome.NewPG(queries), authSvc), authSvc))
	})

	addr := listenAddr()
	slog.Info("server listening", "addr", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		slog.Error("server stopped")
		os.Exit(1)
	}
}
