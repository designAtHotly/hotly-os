# Email templates

React Email sources for the three SendGrid bodies. The Go API does **not** run Node; it embeds the generated HTML/text.

## Edit and regenerate

From the repository root:

```bash
bun run emails:render
```

That writes `apps/server/pkg/mailer/templates/{recovery,creator_paid,guest_reply}.{html,txt}`. Do not hand-edit those files; change `emails/*.tsx` (shared chrome in `emails/layout.tsx`) and render again.

Then rebuild the API so the new files are compiled into the binary:

```bash
docker compose up -d --build server
```

`docker compose up --force-recreate` without `--build` is not enough.

## Placeholders Go fills in

| Token | Used by | Becomes |
| --- | --- | --- |
| `{{LINK}}` | recovery | `PUBLIC_APP_URL/auth/chat-recovery?token=…` |
| `{{INBOX}}` | creator_paid | `PUBLIC_APP_URL/creator/inbox` |
| `{{CHAT}}` | guest_reply | `PUBLIC_APP_URL/chat` |
| `{{KIND}}` | creator_paid | `note` or `weekly subscription` |

Keep these spellings; they are substituted after render.

## Preview send (optional)

With a configured `.env` (SendGrid `SG.` key + verified sender + `CREATOR_EMAIL`):

```bash
set -a && . ./.env && set +a
HOTLY_MAIL_PREVIEW=1 go test ./pkg/mailer -run TestLivePreviewSend -count=1
```

Run that from `apps/server/`. It sends all three templates to `CREATOR_EMAIL`. Default `go test ./...` skips this. CTA links use `PUBLIC_APP_URL` (localhost when that is the origin).

## Images and spam

Header mark and wordmark are hotlinked from `https://hotly.com/…` so mail clients can fetch them. Gmail **does not load remote images while the message is in spam**. Moving the mail out of spam is enough; there is no default OG/Twitter card and we do not inline a homemade share image.

Inbox vs spam is SendGrid domain authentication (SPF/DKIM), not the React markup. Single-sender Gmail often lands in spam.

Transport stays SendGrid (`api.sendgrid.com/v3/mail/send`). Do not switch to Resend or SendGrid dynamic template IDs.
