# Calendar Integration

Calendar integration allows users to connect their Google Calendar and Microsoft Outlook calendars so that maintenance events created in the app automatically sync to their external calendars.

## Features

- **Connect/Disconnect**: Users can connect Google Calendar and/or Outlook Calendar via OAuth from Profile → Preferences → Calendar Integrations.
- **Automatic Sync**: When a calendar is connected:
  - New events sync to the connected calendar(s)
  - Updates to events sync to the external calendar
  - Deleting an event removes it from the external calendar
- **Sync Indicator**: Event creation modals show "✓ Syncing with Google Calendar" (or Outlook) when calendars are connected.

## Setup

### 1. Database schema

The `calendar_integrations` and `event_calendar_syncs` tables are defined in `opsy-schema.sql`. Apply that file for a fresh database, or ensure your existing database matches it.

### 2. Google Calendar

1. Create or use an existing project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the **Google Calendar API**
3. Create OAuth 2.0 credentials (Web application)
4. Add authorized redirect URI: `https://your-backend-domain/calendar-integrations/oauth/google/callback`  
   (Local: `http://localhost:3000/calendar-integrations/oauth/google/callback`)
5. Use the same Client ID and Client Secret as your existing Google Sign-In (or create new credentials).

**Environment variables:**

```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
BACKEND_URL=http://localhost:3000
```

Optional overrides:

```env
GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:3000/calendar-integrations/oauth/google/callback
```

### 3. Microsoft Outlook

1. Register an app in [Azure Portal](https://portal.azure.com/) → Azure Active Directory → App registrations
2. Create a Web platform with Redirect URI: `https://your-backend-domain/calendar-integrations/oauth/outlook/callback`  
   (Local: `http://localhost:3000/calendar-integrations/oauth/outlook/callback`)
3. Add API permissions: **Calendars.ReadWrite**, **User.Read**, **offline_access**
4. Create a client secret under Certificates & secrets

**Environment variables:**

```env
MICROSOFT_CLIENT_ID=your-azure-app-client-id
MICROSOFT_CLIENT_SECRET=your-azure-app-client-secret
MICROSOFT_REDIRECT_URI=http://localhost:3000/calendar-integrations/oauth/outlook/callback
```

### 4. Token Encryption

Calendar OAuth tokens are encrypted at rest using the same key as MFA:

```env
MFA_ENCRYPTION_KEY=your-32-byte-hex-key
```

Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /calendar-integrations | List user's connected calendars |
| GET | /calendar-integrations/oauth/:provider/url | Get OAuth URL as JSON (requires JWT; used by frontend before redirect) |
| GET | /calendar-integrations/oauth/google/connect | Start Google OAuth (redirect; legacy—frontend uses /url + redirect) |
| GET | /calendar-integrations/oauth/google/callback | Google OAuth callback |
| GET | /calendar-integrations/oauth/outlook/connect | Start Outlook OAuth (redirect) |
| GET | /calendar-integrations/oauth/outlook/callback | Outlook OAuth callback |
| DELETE | /calendar-integrations/:id | Disconnect a calendar |

## Architecture

- **Models**: `CalendarIntegration`, `event_calendar_syncs` (links maintenance events to external event IDs)
- **Services**: `calendarSyncService` — syncs events to Google/Outlook, handles token refresh
- **Helpers**: `googleCalendarOAuth`, `outlookCalendarOAuth` — OAuth flows
- Sync is triggered from maintenance event routes (create/update/delete)

## Optional: Import External Events

To show external calendar events inside the app calendar, you would need to:

- Add an import job or webhook to fetch events from connected calendars
- Store them in a new table (e.g. `external_calendar_events`) with `calendar_integration_id`
- Merge with maintenance events in `getCalendarEventsForUser`

This is not implemented in the initial release.
