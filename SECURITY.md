# Security

## Supported versions

Only the latest **GitHub Release** (`v*.*.*`) is supported. `main` moves; operators should pin a tag.

## Reporting a vulnerability

**Do not open a public issue** for secrets, RCE, auth bypass, or anything that could take money or data from an instance.

1. Use **GitHub Private Vulnerability Reporting** on this repository (Security → Advisories → New draft advisory), or
2. If that setting is not enabled yet, open a draft security advisory anyway and wait; do not paste secrets into the description.

Maintainers: turning that setting on is a one-time GitHub UI step after extract. Checklist: [`docs/github.md`](docs/github.md).

We will acknowledge the report, say whether we think it is valid, and say when a fix is expected. There is no bug bounty.

Please include: affected tag or commit, a short reproduction, and impact (who can do what). Do not attach production `.env` files.

## Operator incidents

If you leaked API keys in a log or chat, rotate them at the provider (Stripe, Firebase, SendGrid) and re-run the setup CLI or edit `.env` — do not open a GitHub issue with the old values.
