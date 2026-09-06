# Contributing

Thanks for wanting to help. This is a **single-creator, self-hosted** Hotly. Scope is the frozen MVP: Penpal, Dome, operator-owned Stripe / Firebase / SendGrid, Apache License 2.0.

Please read [`README.md`](README.md) and [`docs/operations.md`](docs/operations.md) first. Operators install with [`scripts/install.sh`](scripts/install.sh), not `bun run setup`. Security reports go to [`SECURITY.md`](SECURITY.md), not a public issue. After this tree is its own GitHub repo, maintainers enable the toggles in [`docs/github.md`](docs/github.md). Install or runtime bugs: paste the installer’s "System (paste this in a GitHub issue)" block (or a screenshot of it).

## Before you start

- One creator per deployment. Do not add multi-creator, Connect, wallets, analytics, or a second mail vendor.
- Do not commit `.env`, `.secrets/`, Firebase JSON, Stripe keys, or SendGrid keys.
- Do not invent a default Open Graph share image; live Hotly.com does not ship one.
- UI has no automated test suite. Change behavior, then typecheck and click through the route you touched.

## Dev loop

```bash
cp .env.example .env
# Set CREATOR_EMAIL. Leave Stripe / Firebase / SendGrid empty if you are not testing those paths.
docker compose up --build
```

Open [http://localhost](http://localhost). Health: `GET /api/health`.

Without Compose (API still needs Postgres and `.env`):

```bash
bun install
bun run dev
```

## Checks we run on every PR

Same as CI (see `.github/workflows/ci.yml`):

```bash
go test ./...          # from apps/server
bun run check-types
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.prod.yml config --quiet
```

If you change React Email sources under `emails/`:

```bash
bun run emails:render
```

Then rebuild `server` so the Go embed picks up the HTML. Do not hand-edit `apps/server/pkg/mailer/templates/`.

## Pull requests

1. Branch from `main`. Keep the PR small and about one change.
2. Describe **why**. Link an issue if there is one.
3. CI must be green. Maintainers will not debug secrets pasted into the PR.
4. Inbound license is Apache License 2.0 (same as the repo). Do not contribute code you cannot license that way.

Releases are **manual Git tags** (`v0.1.0`). Do not bump versions in a random PR.

## Conduct

Participation is covered by [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).
