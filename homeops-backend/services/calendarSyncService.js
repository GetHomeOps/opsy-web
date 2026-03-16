"use strict";

/**
 * Calendar Sync Service
 *
 * Syncs maintenance events to external calendars (Google, Outlook).
 * Handles create, update, delete with token refresh and error recovery.
 */

const { google } = require("googleapis");
const { Client } = require("@microsoft/microsoft-graph-client");
const CalendarIntegration = require("../models/calendarIntegration");
const { refreshCalendarToken } = require("../helpers/googleCalendarOAuth");
const { refreshOutlookToken } = require("../helpers/outlookCalendarOAuth");

/** Check if token is expired or expires within 5 minutes */
function isTokenExpired(expiresAt) {
  if (!expiresAt) return false;
  const expires = new Date(expiresAt).getTime();
  const buffer = 5 * 60 * 1000;
  return expires <= Date.now() + buffer;
}

/** Ensure we have a valid access token, refreshing if needed */
async function ensureValidTokens(integration) {
  const row = await CalendarIntegration.getWithTokens(integration.id);
  let accessToken = row.access_token;
  let refreshToken = row.refresh_token;

  if (isTokenExpired(row.token_expires_at) && refreshToken) {
    try {
      if (row.provider === "google") {
        const refreshed = await refreshCalendarToken(refreshToken);
        accessToken = refreshed.access_token;
        await CalendarIntegration.updateTokens(row.id, {
          accessToken,
          refreshToken,
          tokenExpiresAt: refreshed.expiry_date
            ? new Date(refreshed.expiry_date).toISOString()
            : null,
        });
      } else if (row.provider === "outlook") {
        const refreshed = await refreshOutlookToken(refreshToken);
        accessToken = refreshed.access_token;
        await CalendarIntegration.updateTokens(row.id, {
          accessToken,
          refreshToken: refreshed.refresh_token || refreshToken,
          tokenExpiresAt: refreshed.expires_at,
        });
      }
    } catch (err) {
      console.error(`[calendarSync] Token refresh failed for ${row.provider}:`, err.message);
      throw new Error(`Calendar token expired. Please reconnect ${row.provider} in settings.`);
    }
  }
  return { ...row, access_token: accessToken };
}

/** Convert maintenance event to calendar event format */
function maintenanceToCalendarEvent(event, propertyName = "", propertyAddress = "") {
  const title = event.system_name || event.system_key || "Maintenance";
  const dateStr = event.scheduled_date;
  const timeStr = event.scheduled_time;
  const tz = event.timezone || "UTC";

  const startDate = timeStr
    ? `${dateStr}T${timeStr}:00`
    : `${dateStr}T09:00:00`;
  const [h, m] = (timeStr || "09:00").split(":");
  const endHour = (parseInt(h, 10) + 1) % 24;
  const endDate = timeStr
    ? `${dateStr}T${String(endHour).padStart(2, "0")}:${m}:00`
    : `${dateStr}T10:00:00`;

  const description = [
    propertyName && `Property: ${propertyName}`,
    propertyAddress && `Address: ${propertyAddress}`,
    event.contractor_name && `Contractor: ${event.contractor_name}`,
    event.message_body && `Notes: ${event.message_body}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    summary: title,
    description: description || "HomeOps maintenance event",
    location: propertyAddress || undefined,
    start: { dateTime: startDate, timeZone: tz },
    end: { dateTime: endDate, timeZone: tz },
  };
}

/** Sync event to Google Calendar */
async function syncToGoogle(integration, maintenanceEvent, propertyInfo = {}) {
  const calEvent = maintenanceToCalendarEvent(
    maintenanceEvent,
    propertyInfo.propertyName,
    propertyInfo.address
  );

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: integration.access_token });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  const calendarId = integration.calendar_id || "primary";

  const externalId = await CalendarIntegration.getExternalEventId(
    maintenanceEvent.id,
    integration.id
  );

  try {
    let result;
    if (externalId) {
      result = await calendar.events.update({
        calendarId,
        eventId: externalId,
        requestBody: calEvent,
      });
    } else {
      result = await calendar.events.insert({
        calendarId,
        requestBody: calEvent,
      });
    }
    const eventId = result.data.id;
    await CalendarIntegration.recordEventSync(
      maintenanceEvent.id,
      integration.id,
      eventId,
      "google"
    );
    await CalendarIntegration.touchLastSynced(integration.id);
    return { success: true, externalId: eventId };
  } catch (err) {
    console.error("[calendarSync] Google sync failed:", err.message);
    return { success: false, error: err.message };
  }
}

/** Sync event to Microsoft Outlook */
async function syncToOutlook(integration, maintenanceEvent, propertyInfo = {}) {
  const calEvent = maintenanceToCalendarEvent(
    maintenanceEvent,
    propertyInfo.propertyName,
    propertyInfo.address
  );

  const client = Client.init({
    authProvider: (done) => done(null, integration.access_token),
  });

  const eventPayload = {
    subject: calEvent.summary,
    body: { contentType: "text", content: calEvent.description || "" },
    location: { displayName: calEvent.location || "" },
    start: {
      dateTime: calEvent.start.dateTime,
      timeZone: calEvent.start.timeZone || "UTC",
    },
    end: {
      dateTime: calEvent.end.dateTime,
      timeZone: calEvent.end.timeZone || "UTC",
    },
  };

  const externalId = await CalendarIntegration.getExternalEventId(
    maintenanceEvent.id,
    integration.id
  );

  try {
    let eventId;
    if (externalId) {
      await client.api(`/me/events/${externalId}`).update(eventPayload);
      eventId = externalId;
    } else {
      const created = await client.api("/me/events").post(eventPayload);
      eventId = created.id;
    }
    await CalendarIntegration.recordEventSync(
      maintenanceEvent.id,
      integration.id,
      eventId,
      "outlook"
    );
    await CalendarIntegration.touchLastSynced(integration.id);
    return { success: true, externalId: eventId };
  } catch (err) {
    console.error("[calendarSync] Outlook sync failed:", err.message);
    return { success: false, error: err.message };
  }
}

/** Delete event from Google Calendar */
async function deleteFromGoogle(integration, externalEventId) {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: integration.access_token });
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  const calendarId = integration.calendar_id || "primary";
  try {
    await calendar.events.delete({ calendarId, eventId: externalEventId });
    return { success: true };
  } catch (err) {
    if (err.code === 404) return { success: true }; // already deleted
    console.error("[calendarSync] Google delete failed:", err.message);
    return { success: false, error: err.message };
  }
}

/** Delete event from Outlook */
async function deleteFromOutlook(integration, externalEventId) {
  const client = Client.init({
    authProvider: (done) => done(null, integration.access_token),
  });
  try {
    await client.api(`/me/events/${externalEventId}`).delete();
    return { success: true };
  } catch (err) {
    if (err.statusCode === 404) return { success: true };
    console.error("[calendarSync] Outlook delete failed:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Sync a maintenance event to all connected calendars for the given user.
 * @param {number} userId - User ID (event creator)
 * @param {Object} maintenanceEvent - Full event from DB
 * @param {Object} [propertyInfo] - { propertyName, address }
 * @returns {Promise<{synced: string[], failed: {provider: string, error: string}[]}>}
 */
async function syncEventToCalendars(userId, maintenanceEvent, propertyInfo = {}) {
  const integrations = await CalendarIntegration.getByUserId(userId);
  const synced = [];
  const failed = [];

  for (const row of integrations) {
    if (!row.sync_enabled) continue;
    try {
      const integration = await ensureValidTokens(row);
      let result;
      if (row.provider === "google") {
        result = await syncToGoogle(integration, maintenanceEvent, propertyInfo);
      } else if (row.provider === "outlook") {
        result = await syncToOutlook(integration, maintenanceEvent, propertyInfo);
      } else {
        continue;
      }
      if (result.success) {
        synced.push(row.provider);
      } else {
        failed.push({ provider: row.provider, error: result.error });
      }
    } catch (err) {
      failed.push({ provider: row.provider, error: err.message });
    }
  }
  return { synced, failed };
}

/**
 * Update an existing maintenance event in connected calendars.
 */
async function updateEventInCalendars(userId, maintenanceEvent, propertyInfo = {}) {
  return syncEventToCalendars(userId, maintenanceEvent, propertyInfo);
}

/**
 * Delete a maintenance event from connected calendars.
 * @param {number} userId - User who owns the integrations
 * @param {number} maintenanceEventId - Event ID
 */
async function deleteEventFromCalendars(userId, maintenanceEventId) {
  const integrations = await CalendarIntegration.getByUserId(userId);

  for (const row of integrations) {
    try {
      const extId = await CalendarIntegration.getExternalEventId(maintenanceEventId, row.id);
      if (!extId) continue;

      const integration = await ensureValidTokens(row);
      if (row.provider === "google") {
        await deleteFromGoogle(integration, extId);
      } else if (row.provider === "outlook") {
        await deleteFromOutlook(integration, extId);
      }
    } catch (err) {
      console.error(`[calendarSync] Delete failed for ${row.provider}:`, err.message);
    }
  }
  await CalendarIntegration.deleteEventSyncs(maintenanceEventId);
}

module.exports = {
  syncEventToCalendars,
  updateEventInCalendars,
  deleteEventFromCalendars,
  ensureValidTokens,
};
