# Customer.io email integration

Opsy can send switchable outbound emails through **AWS SES** (default) or **Customer.io**. Super admins configure routing under **Admin → Email Delivery**.

Password reset, email verification, and internal ops alerts always use SES.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `CUSTOMER_IO_SITE_ID` | Workspace site ID |
| `CUSTOMER_IO_APP_API_KEY` | App API key (transactional sends) |
| `CUSTOMER_IO_TRACK_API_KEY` | Track API key (identify + events) |
| `CUSTOMER_IO_REGION` | `us` (default) or `eu` |
| `EMAIL_FALLBACK_TO_SES` | `true` (default) — fall back to SES if Customer.io fails |

## How Customer.io knows what to send

When an email type uses Customer.io, Opsy does **not** send HTML. It calls Customer.io with:

1. **Identify** — upsert the recipient by email
2. **Track event** and/or **Transactional send** — depending on mode configured in Email Delivery admin

### Event names (default)

Create journeys/campaigns in Customer.io triggered by these events:

| Email type | Default event name |
|------------|---------------------|
| Account invitation | `account_invitation_sent` |
| Property invitation | `property_invitation_sent` |
| Bulk property invitation | `bulk_property_invitation_sent` |
| Contractor report | `contractor_report_requested` |
| Schedule notification | `service_scheduled` |
| Professional contact | `professional_contact_sent` |
| Communication notify | `communication_notify_sent` |
| Support ticket received | `support_ticket_received` |
| Support ticket reply | `support_ticket_reply` |

### Example: property invitation journey

1. In Customer.io, create a campaign triggered by `property_invitation_sent`
2. Use liquid variables from event data, e.g. `{{ event.inviteUrl }}`, `{{ event.inviterName }}`, `{{ event.propertyAddress }}`, `{{ event.personalNote }}`
3. Add follow-up steps (wait 3 days → send reminder if invitation not accepted)

### Example: account invitation journey (agent onboarding)

1. Create a campaign triggered by `account_invitation_sent`
2. **Always prefix event payload fields with `event.`** — bare `{{ inviteUrl }}` will fail at send time with “undefined variable”
3. Common merge fields from Opsy:

| Opsy field | Customer.io liquid |
|------------|-------------------|
| Accept link | `{{ event.inviteUrl }}` |
| Inviter first name | `{{ event.senderFirstName \| default: "HomeOps Team" }}` |
| Inviter avatar | `{{ event.avatarUrl \| default: 'https://heyopsy.com/email/opsy-mark.png' }}` |
| Invitee first name | `{{ event.inviteeName \| default: event.recipientFirstName \| default: "there" }}` |
| Inviter full name | `{{ event.inviterName }}` |
| Brand | `{{ event.brandName }}` |

### Admin: test a journey from Email Delivery

In **Email Delivery**, each email type can use **Test Customer.io event** (next to **Send test email**) when Customer.io is configured.

- Saves the configured **event name** (and merges) using the Track API (`identify` + `track`) with **sample merge data**, same shaping as previews.
- The active provider can still be **SES**; this path only exercises Customer.io for journey debugging.
- You must **save** an event name on the template first; unsaved edits in the form are not used until saved.

### Transactional mode

Alternatively, set mode to **Transactional** and paste the Customer.io transactional message ID into Email Delivery admin. Opsy sends immediately via the Transactional API with `message_data` merge fields.

## Merge variables

Each email type documents its merge variables in the Email Delivery admin UI. Common fields include `brandName`, `inviteUrl`, and type-specific payload from the app.

## Migration

Run once against your database:

```bash
node homeops-backend/scripts/run_migrate_email_delivery.js
```
