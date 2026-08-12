# Invitation `email_sent_at`

Tracks whether an invitation email was successfully sent. `NULL` means the invite was created but never emailed (e.g. bulk onboard with emails off, copy-link, or a failed send).

Fresh databases pick this up via `opsy-schema.sql`.

## Existing databases

```sql
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;

-- Assume historical invites already emailed so the pending-send modal only shows true never-sent rows
UPDATE invitations SET email_sent_at = created_at WHERE email_sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_invitations_account_never_sent
  ON invitations (account_id)
  WHERE status = 'pending' AND email_sent_at IS NULL;
```
