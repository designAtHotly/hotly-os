# Hotly open-source

Self-hosted Hotly for **exactly one creator**. Apache License 2.0. Guests buy a one-time note or a weekly Penpal subscription; the creator replies from an inbox, including optional image/video (free or paid unlock). `/dome` is the retained community. Payments go to the operator’s Stripe account.

Browsers land on `/penpal`. The public origin is Caddy (`/` + `/api`), not `:3000` or `:8080`.

## Prerequisites

You supply the machine, DNS, and accounts. This project does not create a VPS, a domain, Docker, or Firebase / Stripe / SendGrid. Operators **build images from source**. There are no published prebuilt images.

### Linux VPS

Production is a Linux virtual machine you can SSH into. **Windows is not supported** (not as a server, and local Docker Desktop on Windows is not a supported host). Try the stack locally on Linux or macOS.

If you build images on the box (the documented path): **2 vCPU and at least 4 GB RAM**. Typical cloud images have no swap. A 2 GB machine is too tight for `docker compose up --build`. Put the VM in a region close to the creator and the guests you expect — every page and upload is a round trip to this host.

Enable the provider’s automatic backups or disk snapshots. That is not enough by itself: PostgreSQL and media live in Docker volumes on that disk. Still run [`docs/operations.md`](docs/operations.md#backup) on a schedule and copy `.backup/` off the VPS. Losing the machine without an off-box copy means losing conversations and uploads.

Any generic Docker-capable Linux VPS works. A DigitalOcean Basic 2 vCPU / 4 GB class machine is enough. Similar: [Hetzner Cloud](https://www.hetzner.com/cloud), [Linode](https://www.linode.com/), [Vultr](https://www.vultr.com/), OVHcloud, AWS Lightsail, Google Compute Engine. You need a VM. [Render](https://render.com/), Railway, Fly, and other single-service PaaS are **not** this Compose stack.

### Docker Engine and Compose v2

On that machine you need **both**:

- Docker Engine (`docker info` reaches a running daemon)
- the Compose **v2 plugin** (`docker compose version`, with a space)

The old `docker-compose` (hyphen) binary is not enough. The installer will not install Docker or Compose for you.

Linux: [Install Docker Engine](https://docs.docker.com/engine/install/) (current packages include the Compose plugin). macOS local: [OrbStack](https://orbstack.dev/) or Docker Desktop.

### Domain and DNS

A hostname at any registrar, with access to create A/AAAA records. A raw public IP is a smoke host, not the origin guests, Google, Stripe, or recovery mail should use.

Moving the zone to [Cloudflare](https://www.cloudflare.com/) is recommended. Keep the record **DNS only** (grey cloud) until Caddy has a Let’s Encrypt certificate; orange-cloud proxy hides the origin from Let’s Encrypt.

### Accounts

Operator-owned [Firebase](https://firebase.google.com/) (Google sign-in), [Stripe](https://stripe.com/), and [SendGrid](https://sendgrid.com/). The stack boots if those keys are empty; the matching pages then say the provider is not configured.

## Host size

Bare minimum for a public VPS that builds images on the box: **2 vCPU and 4 GB RAM**. Typical cloud images have no swap.

Idle Compose is a few hundred MiB. On a 4 GB Ubuntu host, `docker compose up --build` can peak around **2.7 GB** used. A 2 GB machine is too tight for on-box Next.js + Go builds.

Disk needs room for the OS, images, PostgreSQL, and media. Media growth is the long-term limit, not RAM. Measured breakdown: [`docs/operations.md`](docs/operations.md#host-size).

## Run it locally

Linux or macOS with Docker Engine and Compose v2. Installer (fail-fast if Docker is missing; does not install Docker or Bun):

```bash
./scripts/install.sh --local
```

Skip providers or Compose while testing: `--skip-firebase --skip-stripe --skip-sendgrid --skip-up --yes`. Below 2 vCPU / 4 GB Docker RAM the installer stops; `--skip-spec` overrides that. The "System (paste this in a GitHub issue)" block is for bug reports.

Or by hand:

```bash
cp .env.example .env
# Set CREATOR_EMAIL. Replace SESSION_SECRET, RECOVERY_TOKEN_SECRET, and Garage keys.
# Leave Firebase, Stripe, and SendGrid empty until you have those credentials.
docker compose up --build
```

Open [http://localhost](http://localhost). Health: `GET /api/health`.

Compose starts PostgreSQL 18, runs `db/migrations` before the API, then the Go API, Next.js, Garage (private S3), and Caddy.

## Routes

| Path | Who |
| --- | --- |
| `/` | Redirects to `/penpal` |
| `/penpal` | Public landing: creator, USD prices, Checkout, “Powered by Hotly.” |
| `/chat` | Paid guest conversation (HTTP-only cookie after Checkout or recovery) |
| `/dome`, `/dome/:promptSlug` | Community; `#note-<id>` is a stable note fragment |
| `/creator`, `/creator/inbox`, `/creator/dome`, `/creator/settings` | Configured Firebase email only |
| `/auth/firebase` | Google sign-in |
| `/auth/chat-recovery` | Guest recovery request and consume |

USD only. Defaults: one-time note **$5** / 250 characters (`ONE_TIME_PRICE_CENTS=500`); weekly Penpal **$15** / 2,000 characters (`WEEKLY_PRICE_CENTS=1500`). The browser cannot set amount or currency.

## Apps

- [`apps/web`](apps/web) — Next.js UI (Bun). Same-origin `/api` fetches with cookies. Favicon, apple-touch, android-chrome, wordmarks, and `site.webmanifest` are in `apps/web/public`.
- [`apps/server`](apps/server) — Go API (Chi, pgx, sqlc). Automated tests live here only.
- [`emails`](emails) — React Email sources for the three SendGrid bodies. `bun run emails:render`, then rebuild `server`. Details: [`emails/README.md`](emails/README.md).

There is no frontend test suite. UI is checked with `bun run check-types` / `bun run build` and by using the app.

On GitHub, pull requests, `main`, and `v*.*.*` tags run Go tests, `bun run check-types`, and `docker compose config`. Cutting a version tag publishes a GitHub Release after those checks pass.

Local apps without Compose (API still needs Postgres and the env):

```bash
bun run dev
```

## Production

Bring **DNS up before** the first public Compose. A raw droplet IP is a smoke host, not the origin guests, Google, Stripe, or recovery mail should use.

Pin a **Release tag** (`v0.1.2`), not a drifting `main`:

```bash
curl -fsSL https://raw.githubusercontent.com/designAtHotly/hotly-os/v0.1.2/scripts/install.sh | bash -s -- --tag v0.1.2 --github designAtHotly/hotly-os
```

From a checkout of that tag: `./scripts/install.sh --local`.

1. Hostname + A/AAAA (Cloudflare: **DNS only** until the certificate exists). 2 vCPU / 4 GB if you build on the box. TCP 80 and 443.
2. Set `PUBLIC_APP_URL=https://your.domain.example` and `CADDY_SITE=your.domain.example`. That origin is also canonical, Open Graph, `/robots.txt`, and `/sitemap.xml`.
3. Do not publish Postgres, the API, or Next.js:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build
```

4. Then attach providers to that HTTPS origin: Firebase authorized domain, Stripe webhook `https://your.domain.example/api/webhooks/stripe`, SendGrid API key starting `SG.` plus a verified sender ([app.sendgrid.com](https://app.sendgrid.com/settings/api_keys)).

Full sequence, backup/restore, upgrades, SendGrid vs Twilio keys: [`docs/operations.md`](docs/operations.md).

## License

Apache License 2.0. See [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE).

## Community

- [`CONTRIBUTING.md`](CONTRIBUTING.md) — how to run checks and open a PR
- [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) — Contributor Covenant 2.1
- [`SECURITY.md`](SECURITY.md) — private vulnerability reports, not public issues
- [`SUPPORT.md`](SUPPORT.md) — operations vs GitHub vs provider consoles
- [`docs/github.md`](docs/github.md) — enable Private vulnerability reporting and Dependabot on this GitHub repository
