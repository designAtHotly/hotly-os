## Pull request

- [ ] `go test ./...` (from `apps/server`) and `bun run check-types` pass locally, or I expect CI to catch this
- [ ] No `.env`, `.secrets/`, or provider keys in the diff
- [ ] If I changed `emails/*.tsx`, I ran `bun run emails:render` and did not hand-edit the Go templates

### Why

<!-- What problem does this solve? Link an issue if there is one. -->

### Notes for reviewers

<!-- Operator-facing docs, migrations, or “this release needs a new env var”. -->
