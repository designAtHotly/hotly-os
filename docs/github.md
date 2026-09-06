# Public GitHub repository settings

YAML in this tree does **not** turn these on. They are repository settings on **this** GitHub remote (`designAtHotly/hotly-os`). Do this once, before the first public Release.

Official docs: [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/working-with-repository-security-advisories/configuring-private-vulnerability-reporting-for-a-repository), [Dependabot alerts](https://docs.github.com/en/code-security/dependabot/dependabot-alerts/configuring-dependabot-alerts).

## Checklist (Settings → Advanced Security)

1. **Private vulnerability reporting** — Enable. Reporters use Security → Advisories instead of public issues. [`SECURITY.md`](../SECURITY.md) and the code of conduct assume this is on.
2. **Dependabot alerts** — Enable. GitHub will warn on known-bad Actions, Go modules, and npm.
3. **Dependabot security updates** — Enable. GitHub may open PRs that bump a vulnerable lockfile.
4. **Dependabot version updates** — Enable. Weekly PRs come from [`.github/dependabot.yml`](../.github/dependabot.yml) (Actions, `apps/server` Go modules, root npm/Bun). Without this toggle, that file does nothing.

Also confirm **Actions** are allowed for this repository (Settings → Actions → General) so `ci.yml` and `release.yml` can run. Cut tags and Releases only on the product remote.
