# Inbound Email Setup (Property Documents via Email)

This guide provisions the AWS-side infrastructure for the email-to-property
document ingestion pipeline. Once configured, members of a property can email
attachments to a per-property address (e.g. `documents+12345678@inbox.heyopsy.com`)
and have those files appear in the Documents-tab inbox automatically.

## Architecture

```
Sender → SES (inbound receipt rule) → S3 (raw MIME) ─┬─→ /webhooks/ses-inbound (this app)
                                                     └─→ SNS (notification)
```

The Express endpoint is `POST /webhooks/ses-inbound` (defined in
`homeops-backend/routes/webhooks.js`); business logic lives in
`homeops-backend/services/inboundEmailService.js`.

## Region constraint

SES inbound is currently only available in **us-east-1, us-west-2, eu-west-1**.
The application's primary `AWS_S3_BUCKET` may live in a different region (e.g.
`us-east-2`); that's fine. Pick `us-east-1` for the inbound stack — it matches
the existing SES-outbound default in `services/emailService.js`.

## Prerequisites

- Access to DNS for `heyopsy.com` (Route 53, Cloudflare, etc.).
- AWS credentials with permission to manage SES, S3, SNS, and IAM in
  `us-east-1`.
- Application backend reachable over HTTPS at a stable URL (the SNS
  subscription requires this).

## 1. DNS — MX record for `inbox.heyopsy.com`

We dedicate a subdomain to inbound mail so it doesn't clash with outbound
`SES_FROM_EMAIL` at the apex (e.g. `noreply@heyopsy.com`).

```
inbox.heyopsy.com.  10 inbound-smtp.us-east-1.amazonaws.com.
```

Also recommended: an SPF record on the inbound subdomain to limit who can
spoof addresses there (purely cosmetic for inbound; SES will still receive
mail without it):

```
inbox.heyopsy.com.  TXT  "v=spf1 -all"
```

## 2. SES — verify the receiving domain

In the SES console (us-east-1):

1. **Configuration → Identities → Create identity → Domain**
2. Enter `inbox.heyopsy.com`, enable **Easy DKIM** with RSA-2048.
3. Add the three DKIM CNAMEs and the `_amazonses` TXT record SES gives you to
   DNS for `inbox.heyopsy.com`.
4. Wait for "Verified" status (usually < 15 minutes).

## 3. S3 — bucket for raw inbound MIME

Create a dedicated bucket (e.g. `opsy-inbound-mail`) in `us-east-1`:

- Block all public access: ON
- Versioning: optional
- Lifecycle rule: expire `raw/` objects after 30 days (the staged copy that
  matters lives in the main `AWS_S3_BUCKET` under `property_documents/`).

Attach a bucket policy allowing SES to write under `raw/`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowSESPuts",
      "Effect": "Allow",
      "Principal": { "Service": "ses.amazonaws.com" },
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::opsy-inbound-mail/raw/*",
      "Condition": {
        "StringEquals": { "AWS:SourceAccount": "<AWS_ACCOUNT_ID>" },
        "StringLike": {
          "AWS:SourceArn": "arn:aws:ses:us-east-1:<AWS_ACCOUNT_ID>:receipt-rule-set/*"
        }
      }
    }
  ]
}
```

## 4. SNS — notification topic

Create an SNS topic in `us-east-1`:

- Name: `opsy-inbound-mail`
- Type: Standard
- Encryption: enable AWS-managed key for transit

Attach a topic-access policy allowing SES to publish:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowSESPublish",
      "Effect": "Allow",
      "Principal": { "Service": "ses.amazonaws.com" },
      "Action": "sns:Publish",
      "Resource": "arn:aws:sns:us-east-1:<AWS_ACCOUNT_ID>:opsy-inbound-mail",
      "Condition": {
        "StringEquals": { "AWS:SourceAccount": "<AWS_ACCOUNT_ID>" }
      }
    }
  ]
}
```

Record the topic ARN — you'll set `SES_INBOUND_SNS_TOPIC_ARN` to this value
in the backend environment.

## 5. SES — receipt rule

Still in the SES console (us-east-1):

1. **Email receiving → Rule sets** → create or pick the active rule set.
2. **Create rule** named `opsy-property-documents-inbound`.
3. **Recipients**: `inbox.heyopsy.com` (no specific local-part — domain-wide,
   so any `documents+*@inbox.heyopsy.com` is captured).
4. **Actions** (in this order):
   1. **Deliver to S3 bucket** → `opsy-inbound-mail`, object key prefix `raw/`,
      no SSE-KMS (SES uses bucket SSE if configured).
   2. **Publish to Amazon SNS topic** → `opsy-inbound-mail`, encoding **UTF-8**.
5. **TLS Required**: yes.
6. **Spam and virus scan**: enable. Filtered messages still reach the rule
   actions, but SES populates `X-SES-Spam-Verdict` / `X-SES-Virus-Verdict`
   headers; the backend rejects any message whose verdict is `FAIL`.

## 6. SNS — HTTPS subscription

In the SNS console for `opsy-inbound-mail`:

- **Create subscription**:
  - Protocol: HTTPS
  - Endpoint: `https://app.heyopsy.com/webhooks/ses-inbound`
- The backend handler auto-confirms `SubscriptionConfirmation` messages
  (signature-verified). If confirmation doesn't appear, check application
  logs for `[webhooks/ses-inbound]`.

## 7. IAM — backend read access to the inbound bucket

The backend's running identity (env credentials, profile, or IAM role) needs
to GET objects from the inbound bucket:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowReadInboundMail",
      "Effect": "Allow",
      "Action": ["s3:GetObject"],
      "Resource": "arn:aws:s3:::opsy-inbound-mail/raw/*"
    }
  ]
}
```

If the backend role already has full access to the primary `AWS_S3_BUCKET`,
you only need to add this resource — keep the policy narrowly scoped to
`raw/*`.

## 8. Backend environment variables

Set these in the deployment environment (Railway, ECS, etc.):

| Variable | Example | Required | Notes |
|---|---|---|---|
| `SES_INBOUND_BUCKET` | `opsy-inbound-mail` | ✓ | Bucket from step 3 |
| `SES_INBOUND_BUCKET_REGION` | `us-east-1` | recommended | Defaults to `AWS_SES_REGION` then `us-east-1` |
| `SES_INBOUND_SNS_TOPIC_ARN` | `arn:aws:sns:us-east-1:123:opsy-inbound-mail` | ✓ | Topic ARN from step 4 |
| `INBOUND_EMAIL_DOMAIN` | `inbox.heyopsy.com` | optional | Default already matches step 1 |
| `INBOUND_EMAIL_LOCAL_PART` | `documents` | optional | Default `documents` |

## 9. Frontend environment variable (optional)

If staging uses a different inbound subdomain, set at build time:

```
VITE_INBOUND_EMAIL_DOMAIN=inbox-staging.heyopsy.com
```

The local-part is fixed to `documents` in the UI to mirror the backend.

## 10. Smoke test

1. Send an email with one PDF attached to
   `documents+<some-real-property-uid>@inbox.heyopsy.com` from a member's
   verified email.
2. Within ~30 seconds the file should appear as a new card in the property's
   Documents tab inbox, with a "via email" badge.
3. Drag the card into a folder to file it (same flow as a manual upload).

Common rejection reasons (visible in app logs):

| Reason | Meaning |
|---|---|
| `no_property_uid` | Recipient address didn't match `documents+{8-digit uid}@<INBOUND_EMAIL_DOMAIN>` |
| `property_not_found` | The uid in the address has no matching property |
| `unknown_sender` | The `From:` address doesn't match any user record |
| `sender_not_authorized` | User exists but isn't a property member or pending invitee |
| `ses_verdict` | SES marked the message as spam / virus / SPF failure |
| `no_attachments` | Message had no attachments meeting the MIME / size rules |

## 11. Database migration

Run once per environment:

```bash
psql "$DATABASE_URL" -f homeops-backend/migrations/20260505_add_source_to_staged_documents.sql
```

This adds the `source` and `source_metadata` columns used by the inbound
pipeline and the "via email" badge in the inbox UI. The migration is
idempotent (`ADD COLUMN IF NOT EXISTS`).
