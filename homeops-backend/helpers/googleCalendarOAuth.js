"use strict";

/**
 * Google Calendar OAuth Helper
 *
 * Builds auth URL with calendar scopes and exchanges code for tokens.
 * Uses same google-auth-library as sign-in OAuth.
 */

const { OAuth2Client } = require("google-auth-library");
const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_CALENDAR_REDIRECT_URI,
} = require("../config");

const GOOGLE_AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
];

/**
 * Build Google Calendar OAuth authorization URL.
 * @param {Object} opts
 * @param {string} [opts.redirectUri] - Override (default from config)
 * @param {string} opts.state - CSRF state (e.g. JWT or nonce)
 * @returns {string} Full authorization URL
 */
function buildCalendarAuthUrl({ redirectUri, state }) {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error("Google Calendar OAuth is not configured");
  }
  const uri = redirectUri || GOOGLE_CALENDAR_REDIRECT_URI;
  if (!uri) {
    throw new Error("GOOGLE_CALENDAR_REDIRECT_URI or redirectUri is required");
  }
  const params = new URLSearchParams({
    response_type: "code",
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: uri,
    scope: CALENDAR_SCOPES.join(" "),
    state: state,
    access_type: "offline", // needed for refresh_token
    prompt: "consent", // force consent to get refresh token
  });
  return `${GOOGLE_AUTH_BASE}?${params.toString()}`;
}

/**
 * Exchange authorization code for calendar tokens.
 * @param {string} code - Authorization code from Google
 * @param {string} [redirectUri] - Must match the redirect_uri used in auth request
 * @returns {Promise<{access_token, refresh_token?, expiry_date?}>}
 */
async function exchangeCalendarCodeForTokens(code, redirectUri) {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("Google Calendar OAuth is not configured");
  }
  const uri = redirectUri || GOOGLE_CALENDAR_REDIRECT_URI;
  const client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, uri);
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token) {
    throw new Error("Google did not return an access token");
  }
  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || null,
    expiry_date: tokens.expiry_date || null,
  };
}

/**
 * Refresh access token using refresh token.
 * @param {string} refreshToken - Stored refresh token
 * @returns {Promise<{access_token, expiry_date?}>}
 */
async function refreshCalendarToken(refreshToken) {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("Google Calendar OAuth is not configured");
  }
  const client = new OAuth2Client(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_CALENDAR_REDIRECT_URI
  );
  client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await client.refreshAccessToken();
  return {
    access_token: credentials.access_token,
    expiry_date: credentials.expiry_date || null,
  };
}

module.exports = {
  buildCalendarAuthUrl,
  exchangeCalendarCodeForTokens,
  refreshCalendarToken,
};
