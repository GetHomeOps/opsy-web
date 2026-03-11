# Incomplete Signup Cleanup

This document describes how to manage users who sign up but never complete onboarding (abandoned payment or never selected a plan).

## Overview

When users register (email or Google) they are created immediately with `onboarding_completed = false`. If they:
- Choose a **free plan** → `completeOnboarding` runs → `onboarding_completed = true`
- Choose a **paid plan** → Redirected to Stripe → On success, webhook sets subscription; `completeOnboarding` runs
- **Abandon** (close tab, go back, etc.) → Account remains in DB with `onboarding_completed = false`

The system distinguishes:
- **Active users**: `onboarding_completed = true AND is_active = true` (completed signup)
- **Pending signups**: `onboarding_completed = false` (registered but never finished)

## Periodic Cleanup Script

Run the cleanup script to deactivate users who never completed onboarding after a grace period:

```bash
# Default: deactivate users inactive for 14+ days
npm run cleanup:incomplete-signups

# Custom retention (e.g. 7 days)
INCOMPLETE_SIGNUP_RETENTION_DAYS=7 npm run cleanup:incomplete-signups

# Dry run: see what would be done without making changes
DRY_RUN=true npm run cleanup:incomplete-signups
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `INCOMPLETE_SIGNUP_RETENTION_DAYS` | 14 | Days before deactivating incomplete signups |
| `DRY_RUN` | false | If `true` or `1`, only report; no changes |

### Scheduling with Cron

Add to crontab for daily cleanup at 2 AM:

```cron
0 2 * * * cd /path/to/homeops-backend && npm run cleanup:incomplete-signups >> /var/log/cleanup-incomplete-signups.log 2>&1
```

## Platform Metrics

`getPlatformSummary` now returns:
- `activeUsers`: Users who completed onboarding (excludes abandoned signups)
- `pendingSignups`: Users who registered but never finished onboarding
- `newActiveUsersLast30d`: New users who completed onboarding in last 30 days

Use `activeUsers` for business metrics rather than raw `totalUsers`.

## Stripe `checkout.session.expired` Webhook

When a user abandons Stripe Checkout (session expires without payment), the event is:
1. Processed idempotently (logged, not duplicated)
2. Recorded in `platform_engagement_events` with `event_type = 'checkout_session_expired'` for analytics
3. Logged to stdout for monitoring

Ensure `checkout.session.expired` is included in your Stripe webhook endpoint configuration (see `docs/BILLING_SETUP.md`).
