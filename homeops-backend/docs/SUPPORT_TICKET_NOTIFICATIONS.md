# Support Ticket Notifications

Adds two behaviors to support/feedback ticket creation and reply flows:

1. **Automated in-thread acknowledgment reply** posted as the first message on
   every new `support` or `feedback` ticket (not on `data_adjustment`).
2. **Transactional emails** to the ticket creator:
   - On create: confirmation email mirroring the in-thread acknowledgment.
   - On new admin reply: email summarizing the reply with a link back to the ticket.

`data_adjustment` tickets are intentionally excluded — they have their own admin review flow.

## Database migration

The automated reply is stored as a row in `support_ticket_replies` with
`author_id = NULL` and `is_automated = TRUE`. Existing production databases must
be migrated before deploying this change.

```sql
-- 1) Allow NULL author_id for system-generated replies
ALTER TABLE support_ticket_replies
    ALTER COLUMN author_id DROP NOT NULL;

-- 2) Flag column for automated replies
ALTER TABLE support_ticket_replies
    ADD COLUMN IF NOT EXISTS is_automated BOOLEAN NOT NULL DEFAULT FALSE;
```

Fresh databases pick these up automatically via `opsy-schema.sql`.

## Environment

Emails use AWS SES and rely on the existing transactional email configuration
(see `services/emailService.js`):

- `SES_FROM_EMAIL` — required (verified SES address).
- `AWS_SES_REGION` / `AWS_REGION` — SES region.
- `AWS_SES_ACCESS_KEY_ID` + `AWS_SES_SECRET_ACCESS_KEY` or the default AWS
  credential chain (IAM role, `~/.aws/credentials`).
- `APP_BASE_URL` — used to build the CTA link back into the app.
- `EMAIL_BRAND_NAME` — defaults to "Opsy".

When SES is not configured (e.g. local development without credentials), the
emails are skipped with a warning log and the automated in-thread reply still
posts normally.

## Behavior details

- The automated reply is posted with `role = "admin"` and `is_automated = TRUE`
  so it renders as a support reply with an "Auto-reply" badge in the UI.
- `notifyUserAdminReply` skips automated replies and user-authored replies,
  preventing duplicate or self-notifications.
- All notification side effects are best-effort: failures are logged and never
  block ticket creation or reply success.
- Ops team internal alerts (`notifyNewSupportOrFeedbackTicket`) are unchanged.

## Files

- `services/ticketNotifyService.js` — auto-reply copy + user email dispatch.
- `services/emailService.js` — `sendSupportTicketReceivedEmail`,
  `sendSupportTicketReplyEmail`.
- `models/supportTicket.js` — `addReply` accepts `isAutomated` and a nullable
  `authorId`; `get()` / `buildActivityFromReplies` return `isAutomated`.
- `routes/supportTickets.js` — wires the auto-reply and emails on
  `POST /` and `POST /:id/replies`.
- `opsy-schema.sql` — updated `support_ticket_replies` DDL.
