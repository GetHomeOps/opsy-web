"use strict";

/**
 * Microsoft Outlook Calendar OAuth Helper
 *
 * Builds auth URL and exchanges code for tokens using Microsoft Identity Platform.
 * Uses @azure/msal-node for authentication.
 */

const { ConfidentialClientApplication } = require("@azure/msal-node");
const {
  MICROSOFT_CLIENT_ID,
  MICROSOFT_CLIENT_SECRET,
  MICROSOFT_REDIRECT_URI,
} = require("../config");

const SCOPES = [
  "Calendars.ReadWrite",
  "User.Read",
  "offline_access",
];

/**
 * Build Microsoft OAuth authorization URL for calendar access.
 * @param {Object} opts
 * @param {string} [opts.redirectUri] - Override (default from config)
 * @param {string} opts.state - CSRF state
 * @returns {Promise<string>} Full authorization URL
 */
async function buildOutlookAuthUrl({ redirectUri, state }) {
  if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
    throw new Error("Microsoft Outlook OAuth is not configured");
  }
  const uri = redirectUri || MICROSOFT_REDIRECT_URI;
  if (!uri) {
    throw new Error("MICROSOFT_REDIRECT_URI or redirectUri is required");
  }
  const msalConfig = {
    auth: {
      clientId: MICROSOFT_CLIENT_ID,
      clientSecret: MICROSOFT_CLIENT_SECRET,
      authority: "https://login.microsoftonline.com/common",
    },
  };
  const cca = new ConfidentialClientApplication(msalConfig);
  const authCodeUrlParams = {
    scopes: SCOPES,
    redirectUri: uri,
    state,
  };
  const url = await cca.getAuthCodeUrl(authCodeUrlParams);
  if (!url) {
    throw new Error("Failed to build Microsoft auth URL");
  }
  return url;
}

/**
 * Exchange authorization code for tokens.
 * @param {string} code - Authorization code from Microsoft
 * @param {string} [redirectUri] - Must match redirect_uri used in auth request
 * @returns {Promise<{access_token, refresh_token?, expires_in?}>}
 */
async function exchangeOutlookCodeForTokens(code, redirectUri) {
  if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
    throw new Error("Microsoft Outlook OAuth is not configured");
  }
  const uri = redirectUri || MICROSOFT_REDIRECT_URI;
  const msalConfig = {
    auth: {
      clientId: MICROSOFT_CLIENT_ID,
      clientSecret: MICROSOFT_CLIENT_SECRET,
      authority: "https://login.microsoftonline.com/common",
    },
  };
  const cca = new ConfidentialClientApplication(msalConfig);
  const result = await cca.acquireTokenByCode({
    scopes: SCOPES,
    code,
    redirectUri: uri,
  });
  if (!result || !result.accessToken) {
    throw new Error("Microsoft did not return an access token");
  }
  const expiresAt = result.expiresOn
    ? new Date(result.expiresOn).toISOString()
    : null;
  return {
    access_token: result.accessToken,
    refresh_token: result.refreshToken || null,
    expires_at: expiresAt,
  };
}

/**
 * Refresh access token using refresh token.
 * @param {string} refreshToken - Stored refresh token
 * @returns {Promise<{access_token, expires_at?}>}
 */
async function refreshOutlookToken(refreshToken) {
  if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
    throw new Error("Microsoft Outlook OAuth is not configured");
  }
  const msalConfig = {
    auth: {
      clientId: MICROSOFT_CLIENT_ID,
      clientSecret: MICROSOFT_CLIENT_SECRET,
      authority: "https://login.microsoftonline.com/common",
    },
  };
  const cca = new ConfidentialClientApplication(msalConfig);
  const result = await cca.acquireTokenByRefreshToken({
    scopes: SCOPES,
    refreshToken,
  });
  if (!result || !result.accessToken) {
    throw new Error("Failed to refresh Microsoft token");
  }
  const expiresAt = result.expiresOn
    ? new Date(result.expiresOn).toISOString()
    : null;
  return {
    access_token: result.accessToken,
    refresh_token: result.refreshToken || refreshToken,
    expires_at: expiresAt,
  };
}

module.exports = {
  buildOutlookAuthUrl,
  exchangeOutlookCodeForTokens,
  refreshOutlookToken,
};
