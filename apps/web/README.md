# Hotly web

Next.js (App Router) UI for the single-creator product. Production image is Bun serving the standalone build. In Compose, Caddy proxies `/` here and `/api` to the Go server. The browser always talks same-origin `/api` with `credentials: "include"`; session JWTs are not stored in `localStorage`.

## Routes

| Path | Page |
| --- | --- |
| `/` | Redirects to `/penpal` |
| `/penpal` | Landing, compose, Checkout |
| `/chat` | Guest conversation (cookie after payment or recovery) |
| `/dome`, `/dome/[promptSlug]` | Community |
| `/creator` | Creator home (configured email only) |
| `/creator/inbox` | Threads, reply, attachments, block |
| `/creator/dome` | Next prompt, read-only notes, members |
| `/creator/settings` | Identity, description, USD prices, support item |
| `/auth/firebase` | Google sign-in |
| `/auth/chat-recovery` | Request and consume recovery |

Firebase web config comes from `GET /api/auth/config`, not from committed client keys. Empty Firebase shows an explicit not-configured state. Empty Stripe disables Checkout copy on `/penpal`. Empty SendGrid explains itself on `/auth/chat-recovery`.

## Commands

From the monorepo root:

```bash
bun run dev:web          # next dev on :3001; rewrites /api to SERVER_ORIGIN (default :8080)
bun run check-types
bun run knip:web        # unused files/exports in apps/web
bun run emails:render   # writes apps/server/pkg/mailer/templates from emails/
bun run build
```

There is **no frontend test suite**. Typecheck, production build, and using the running app are the checks.

## Notes

- Client fetches use relative `/api/…` with cookies. `NEXT_PUBLIC_SERVER_URL` is Compose wiring for the public `/api` origin; do not point the UI at `:8080`.
- Canonical, Open Graph, Twitter cards, `/robots.txt`, and `/sitemap.xml` use `PUBLIC_APP_URL` at **runtime**. Compose sets `SERVER_ORIGIN=http://server:8080` so Next can load creator name/bio/avatar and Dome prompt slugs for those documents. Local `bun run dev` fetches `http://localhost:8080`.
- Media URLs are rewritten to `/api/media/…` only. Do not point the UI at raw S3/Garage URLs.
- Manual reload is required; there is no polling, WebSockets, or SSE.
