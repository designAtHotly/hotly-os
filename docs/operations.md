# Operations

Self-hosted Hotly for exactly one creator. Operators build images from source. The project does not publish prebuilt images, register DNS, or provision certificates.

This file is the runbook for this repository. Operators pin GitHub Release tag `v0.1.4`, not a drifting `main`.

## What you supply

- A Linux VPS (or local Linux/macOS Docker). **Docker Engine and Compose v2** both. Windows is not supported. See the product README Prerequisites.
- A public URL (`PUBLIC_APP_URL`) that browsers will use. The same value is the canonical origin for Open Graph, `/robots.txt`, and `/sitemap.xml` (web container, runtime — not baked at image build).
- A singleton creator email (`CREATOR_EMAIL`) and display name (`CREATOR_DISPLAY_NAME`).
- Operator-owned Firebase (Google sign-in), Stripe, and SendGrid accounts. Paste those values at the [installer](#install-curl) prompts ([Stripe, Firebase, SendGrid](#stripe-firebase-sendgrid)).
- `.env` is never committed. `scripts/install.sh` writes `SESSION_SECRET`, `RECOVERY_TOKEN_SECRET`, `GARAGE_RPC_SECRET`, `S3_ACCESS_KEY`, and `S3_SECRET_KEY` on the box. It does not rotate `POSTGRES_PASSWORD` (Compose default unless you change it).

The application does not create a second creator, Connect/wallets, or a Hotly-owned provider account.

## Host size

Bare minimum if you **build images on the VPS**: **2 vCPU and 4 GB RAM**. Do not use 1 GB. 2 GB is likely to OOM during `docker compose up --build`. Typical cloud images have **no swap**. `scripts/install.sh` gates **Docker** CPU/RAM (not the Mac host RAM: OrbStack/Desktop builds run in the engine). `--skip-spec` overrides for `.env`-only tests on a tiny box.

Figures below are from an amd64 Ubuntu 24.04 host with 2 vCPU / 4 GiB / ~80 GiB and no swap. Compose built from source with the prod overlay (only 22/80/443 published).

| State | Typical |
| --- | --- |
| Idle containers (`docker stats`) | ~280 MiB total (web, Postgres, Go API, Caddy, Garage) |
| Idle host (`MemAvailable`) | ~0.8 GiB used (OS + Docker Engine + containers) |
| Peak during `docker compose up --build` | ~2.7 GiB used, ~1.2 GiB still free |
| CPU at idle | Negligible; bursts on image build, Checkout, and uploads |

Local OrbStack idle (same Compose project): web ~85–105 MiB, Postgres ~60 MiB, server ~13–50 MiB, Caddy ~13–17 MiB, Garage ~12–16 MiB (~200–250 MiB together).

Image layers on that class of host are on the order of Postgres ~480 MB, web ~240 MB, other services tens of MB each. 80 GiB is comfortable for OS, images, Postgres, Garage, and a local backup. Watch media and database growth, not RAM.

amd64 Linux is the documented VPS architecture. The same Compose file also runs on Docker Desktop / OrbStack (including Apple Silicon). Resize down to 2 GB only if images are built elsewhere and you have measured a rebuild-free idle.

## Install (curl)

Do **not** copy `.env`, `.secrets/`, or `.backup/` onto the host. Do **not** start by hand-editing `.env` or running `docker compose` yourself. The installer writes `.env` (origin, creator, provider keys, session and Garage/S3 secrets) and starts Compose. It does not install Docker, create DNS, or provision certificates.

On the VPS first: Docker Engine and Compose v2, TCP 80 and 443 open, hostname pointing at this box (**DNS only** / grey cloud on Cloudflare until Let’s Encrypt succeeds). Size at least **2 vCPU / 4 GB** if you build images on the host. The application does not install Docker for you.

Then:

```bash
curl -fsSL https://raw.githubusercontent.com/designAtHotly/hotly-os/v0.1.4/scripts/install.sh | bash -s -- --tag v0.1.4 --github designAtHotly/hotly-os
```

That unpacks to **`~/hotly-os`** (prompt, or `--dir` / `HOTLY_ROOT`). `.env` is `$HOME/hotly-os/.env`. Answer the prompts: public URL (`https://your.domain.example`, not a raw IP), creator email/name, then Firebase / Stripe / SendGrid or skip. For a public hostname it adds `docker-compose.prod.yml` (only 80/443 published) and does not `down -v`. Confirm `GET https://your.domain.example/api/health`.

Re-run to fill a skipped provider or rotate a key:

```bash
cd ~/hotly-os
./scripts/install.sh --local
```

From a git checkout of the same tag instead of curl: `./scripts/install.sh --local`.

It refuses a missing Docker daemon (with install URLs) and Docker with fewer than 2 CPUs / ~4 GB RAM. `--skip-spec` is only for `.env`-only tests on a tiny box. Paste the "System (paste this in a GitHub issue)" block when reporting install failures.

Local OrbStack may stay `http://localhost` and skip DNS.

Do **not** treat a raw public IP as the production origin. Firebase authorized domains, Stripe webhooks, recovery links, and Caddy certificates all want the hostname you will keep.

After a public install, still do these in the provider consoles (the installer cannot): add the hostname under Firebase Authentication → authorized domains; register the Stripe webhook at `https://your.domain.example/api/webhooks/stripe` (events under [Stripe](#stripe-when-you-have-keys)) and paste the `whsec_` at the installer prompt (create the endpoint first, or skip Stripe and re-run `--local` after); SendGrid verified sender plus an `SG.` key.

Compose starts PostgreSQL 18, runs `db/migrations` before the API, then the Go API, Next.js, Garage (private S3), and Caddy. Browsers should use Caddy (`PUBLIC_APP_URL`), not `:3000` or `:8080`.

Hand-edit `.env` and `docker compose up` only if you are not using the installer. On a public VPS that fallback must include `docker-compose.prod.yml`. Only name `docker-compose.override.yml` in `COMPOSE_FILE` if that file exists (Firebase JSON mount). The installer writes the override when you paste the service-account JSON.

Health:

- `GET /api/health` through Caddy
- `GET /api/auth/config` reports whether Firebase is configured
- `/penpal` shows a payments-unavailable state when Stripe keys are empty
- `/auth/chat-recovery` explains when SendGrid is empty

After adding a migration file:

```bash
docker compose up --force-recreate migrate
```

## Domain, DNS, firewall, HTTPS

The project does not claim automatic DNS or certificate provisioning.

1. Point the domain’s A/AAAA records at the VPS.
2. Open TCP 80 and 443. If the zone is on Cloudflare, keep the record **DNS only** (grey cloud) until Caddy has a certificate; orange-cloud proxy hides the origin from Let's Encrypt.
3. Run the [curl installer](#install-curl). It asks for the public URL (`https://your.domain.example`, no trailing slash) and sets `CADDY_SITE` to that hostname. Official `caddy:2-alpine` will attempt ACME once DNS hits this machine. If that fails, terminate TLS in your own reverse proxy and keep same-origin `/` + `/api`.
4. Register a Stripe webhook at `https://your.domain.example/api/webhooks/stripe` (raw body, signed). Enable the Checkout, subscription, and invoice events listed under [Stripe](#stripe-when-you-have-keys). Paste the Dashboard `whsec_` at the installer prompt. Do not reuse a `stripe listen` secret.

Web and API must share that public origin. Cross-origin browser writes are rejected.

## Backup

This is **required** for a real instance, not a nice-to-have. The app does not replicate PostgreSQL or Garage. A `docker compose down -v`, disk failure, or destroyed VPS without an off-box copy is permanent data loss. Host snapshots (DigitalOcean, etc.) are a complement, not a substitute for the app backup if you also need a portable restore.

PostgreSQL and Garage (media blobs) must be backed up together. Scripts live in `deploy/backup/`.

```bash
./deploy/backup/backup.sh
# writes .backup/<utc-stamp>/{postgres.dump,garage_data.tar.gz,garage_meta.tar.gz}
```

Keep copies off the VPS. `.backup/` is gitignored.

## Restore

Restore is destructive. Stop the stack, replace volumes, start, then confirm health.

```bash
./deploy/backup/restore.sh .backup/<utc-stamp>
```

The script:

1. Stops application containers.
2. Restores PostgreSQL with `pg_restore --clean --if-exists` into the Compose database.
3. Replaces Garage data/meta from the tarballs.
4. Starts the stack and waits for `/api/health`.

It does not replay Stripe events or SendGrid mail. Checkout sessions that completed after the backup are not in the restored database.

## Upgrade

Check out a **GitHub Release tag** (`v0.1.4`, not a drifting `main`) and rebuild. There are no published images to pull. Tags are cut manually; the `release` workflow creates the GitHub Release after CI on that tag passes.

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

Migrations run before the new API serves traffic. Confirm `GET /api/health` and a manual reload of `/penpal`, `/creator/inbox`, and `/dome`.

Rollback: keep the previous copy of the tree and rebuild it. Down migrations exist under `db/migrations/*.down.sql` but payment, media, and Dome rows are not automatically rewound. Do not `migrate down` on a live database unless you understand that data loss.

## Persistence

Named volumes `postgres_data`, `garage_data`, `garage_meta`, and `media_data` survive container replacement. Recreating the Compose project without volumes, or `docker compose down -v`, destroys them.

To prove a **fresh empty-volume install** without wiping a running instance, use a second Compose project name and unused host ports:

```bash
cp .env /tmp/hotly-empty-probe.env
# Override PUBLIC_APP_URL, NEXT_PUBLIC_SERVER_URL, PROXY_HTTP_PORT, WEB_PORT, SERVER_PORT, POSTGRES_PORT.
docker compose -p hotly-empty-probe --env-file /tmp/hotly-empty-probe.env up -d
# GET that PUBLIC_APP_URL /api/health; Postgres should have migrations and zero product rows.
docker compose -p hotly-empty-probe --env-file /tmp/hotly-empty-probe.env down -v
rm /tmp/hotly-empty-probe.env
```

Do not `down -v` the live project.

## Clean checkout (local)

Prove the distributed tree boots without a live `.env` or live volumes. Copy this checkout (no `.env`, `.secrets/`, or `.backup/`) to a throwaway directory, `cp .env.example .env`, point `PUBLIC_APP_URL` / `NEXT_PUBLIC_SERVER_URL` / host ports at unused values, then:

```bash
docker compose -p hotly-clean-release --env-file .env up --build -d
curl -fsS "$PUBLIC_APP_URL/api/health"
# Postgres should have applied migrations and zero product rows.
docker compose -p hotly-clean-release --env-file .env down -v
```

That is the local clean-machine check. A public host still needs a real `CADDY_SITE` and a public Stripe webhook. SendGrid is outbound to `api.sendgrid.com`. Recovery links in those emails use `PUBLIC_APP_URL` (localhost in this check). Use a SendGrid Mail Send key that starts with `SG.` (not a Twilio `SK` SID / client secret) and a verified single sender.

## Stripe, Firebase, SendGrid

Leave a provider empty to boot the stack (answer `n` at the installer `[y/N]`). User-facing pages then report that the provider is not configured (503 from the API, copy on `/auth/firebase`, `/auth/chat-recovery`, and `/penpal`). Re-run `./scripts/install.sh --local` to fill keys. Changing `CREATOR_EMAIL` revokes creator sessions and never creates a second creator.

Installer prompts that look like `[y/N]` need `y` or `n` first. Do not paste an API key at that question. Names below are what those prompts write into `.env`, not a separate edit step.

### Firebase (when you have a project)

```bash
FIREBASE_PROJECT_ID=
FIREBASE_WEB_API_KEY=
FIREBASE_AUTH_DOMAIN=   # usually project.firebaseapp.com
FIREBASE_CREDENTIALS_JSON=/run/secrets/firebase.json
CREATOR_EMAIL=          # the one Google account that may open /creator
CREATOR_DISPLAY_NAME=
```

After the hostname is live, add it under Authentication → authorized domains. A second Google account must not open `/creator`.

Firebase admin JSON must be readable **inside** the API container (user `hotly`). If you bind-mount `.secrets/firebase.json` as root-owned `600`, startup fails with invalid credentials. Use `chmod 644` on the host file, or an override like `docker-compose.override.yml`:

```yaml
services:
  server:
    volumes:
      - ./.secrets/firebase.json:/run/secrets/firebase.json:ro
```

Then set `FIREBASE_CREDENTIALS_JSON=/run/secrets/firebase.json`.

### Stripe (when you have keys)

Test mode is enough for a first install. Card `4242` is fine.

```bash
STRIPE_SECRET_KEY=        # sk_test_… / sk_live_… / rkcs_…
STRIPE_PUBLISHABLE_KEY=   # pk_…
STRIPE_WEBHOOK_SECRET=    # whsec_… from the Dashboard endpoint for this hostname
```

Webhook URL: `https://your.domain.example/api/webhooks/stripe` (raw body, signed). Dashboard → Developers → Webhooks → Add endpoint. Do not reuse a `stripe listen` secret. Put each value in the matching installer prompt — do not swap `STRIPE_PUBLISHABLE_KEY` and `STRIPE_WEBHOOK_SECRET`.

Enable **only** these events (the API ignores others):

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_succeeded`

Do not turn on “listen to all events.” One-time notes and paid unlocks need the Checkout session events; weekly Penpal needs the subscription and invoice events.

### SendGrid (when you have a key)

Operator-owned account only. Check mail **locally**; a public VPS is not required. Use a **SendGrid** API key from [app.sendgrid.com/settings/api_keys](https://app.sendgrid.com/settings/api_keys) (it starts with `SG.`). Do not use a Twilio Account SID, Auth Token, or API key SID (`SK…` + client secret). Do not paste `SENDGRID_API_KEY` at a `[y/N]` installer prompt. The three env vars must all be set or mail stays off:

```bash
SENDGRID_API_KEY=SG. …
SENDGRID_FROM_EMAIL=you@your-verified-domain.example
SENDGRID_FROM_NAME=Your creator name
```

`FROM_EMAIL` must be a SendGrid **verified single sender** ([Sender Authentication](https://app.sendgrid.com/settings/sender_auth)) or a mailbox on a domain-authenticated domain. A Twilio org `_twilio` TXT record is not sender auth. After the installer writes the three values it recreates `server`. If you edited `.env` by hand:

```bash
docker compose up -d --force-recreate server
```

Startup logs `sendgrid=true` when configured. Stripe webhooks still apply if SendGrid later fails; only recovery request returns that error to the guest.

Prove the three checked-in templates (no extra mail types):

1. Recovery: on `/auth/chat-recovery`, request a link for a guest email that already has a conversation. Open the 24-hour single-use link. A second use must fail.
2. Creator notice: complete a test-mode one-time note or weekly Checkout; the configured `CREATOR_EMAIL` gets “New Penpal note/subscription.”
3. Guest notice: reply from `/creator/inbox`; the guest email gets “You have a new Penpal reply.”

Templates live in `apps/server/pkg/mailer/templates/` (generated from [`emails/`](../emails/README.md); do not hand-edit the HTML).

To change copy or layout:

```bash
bun run emails:render
docker compose up -d --build server
```

Go embeds the files at compile time. Recreate without `--build` leaves the old bodies in the binary.

Recovery CTAs use `PUBLIC_APP_URL`. Header mark/wordmark load from `hotly.com` (Gmail hides them while the message is in spam; that is expected). The yellow button opens this instance. Footer “Powered by Hotly” goes to `https://hotly.com`.

Opt-in SendGrid preview of all three templates (skips in normal `go test`):

```bash
cd apps/server
set -a && . ../../.env && set +a
HOTLY_MAIL_PREVIEW=1 go test ./pkg/mailer -run TestLivePreviewSend -count=1
```
