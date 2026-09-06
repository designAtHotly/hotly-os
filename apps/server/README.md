# Hotly API

Go service for identity, Penpal, media, Stripe webhooks, SendGrid, and Dome. Browsers reach it as `/api` through Caddy. The process itself listens on `PORT` (Compose: `8080`).

## Layout

| Package | Role |
| --- | --- |
| `pkg/config` | Env load and validation (names keys, never secret values) |
| `pkg/auth` | Firebase verify, HTTP-only cookie sessions, singleton creator |
| `pkg/penpal` | Checkout, webhooks, chat, inbox, recovery, media unlocks |
| `pkg/billing` | Stripe Checkout and webhook signature |
| `pkg/mailer` | Checked-in templates + SendGrid mail/send. Edit `emails/*.tsx`, then `bun run emails:render` from the monorepo root, then rebuild the API.
| `pkg/media` | Private S3-compatible blobs (Garage by default) |
| `pkg/dome` | Prompts, notes, replies, members |
| `pkg/guard` | CORS, exact-origin CSRF, rate limits (no Redis) |
| `pkg/db` | sqlc against `db/migrations` |

Firebase, Stripe, and SendGrid may be empty. Startup still requires `PUBLIC_APP_URL`, `DATABASE_URL`, `CREATOR_EMAIL`, `SESSION_SECRET`, and `RECOVERY_TOKEN_SECRET`. Empty providers return 503 / user-facing copy instead of crashing.

Stripe webhooks still succeed when SendGrid is unset. Recovery, creator “new paid note/subscription,” and guest “creator replied” emails no-op until `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, and `SENDGRID_FROM_NAME` are all set.

## Commands

From this directory:

```bash
go test ./...
go run .
bun run sqlc   # regenerate pkg/db after SQL or migration changes
```

From the monorepo root, Compose is the supported way to run the API with Postgres, Garage, and Caddy. `GET /health` and `GET /api/health` report database ping.

## Public API (under `/api`)

Auth: `GET /auth/config`, `POST /auth/firebase`, `GET /auth/me`, `POST /auth/logout`.

Penpal: offer, Checkout, claim, guest chat send, unlock Checkout, Stripe webhook, inbox, settings, avatar, creator media upload.

Dome: current prompt, historical prompts, notes, member list (creator), create prompt (creator).

Media downloads are authorized (`GET /media/{id}`); there are no public object URLs.

## Tests

Automated coverage is Go only. Tests use fakes for Stripe and SendGrid and do not call production providers. `HOTLY_MAIL_PREVIEW=1 go test ./pkg/mailer -run TestLivePreviewSend` is the opt-in live send (see [`emails/README.md`](../../emails/README.md)).
