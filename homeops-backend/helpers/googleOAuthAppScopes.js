"use strict";

/**
 * OAuth scopes this app requests from Google (single OAuth client).
 *
 * For Google Cloud verification: the OAuth consent screen and any scope list in
 * your submission must match what the app actually requests — use exactly the
 * scopes below (no extras).
 *
 * - Sign-in / sign-up: openid, email, profile (see googleOAuth.js).
 * - Optional Google Calendar sync: calendar + calendar.events (see googleCalendarOAuth.js).
 */

const GOOGLE_SIGN_IN_SCOPES = ["openid", "email", "profile"];

const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
];

module.exports = {
  GOOGLE_SIGN_IN_SCOPES,
  GOOGLE_CALENDAR_SCOPES,
};
