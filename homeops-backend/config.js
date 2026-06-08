"use strict";

/**
 * Application Configuration
 *
 * Central config for the backend. Loads from environment variables.
 * Exports: SECRET_KEY, PORT, BCRYPT_WORK_FACTOR, getDatabaseUri, redactDatabaseUri,
 *          AWS_REGION, AWS_S3_BUCKET
 */

require("dotenv").config();
require("colors");

const SECRET_KEY = process.env.SECRET_KEY || process.env.JWT_SECRET || (process.env.NODE_ENV === "production" ? (() => { throw new Error("SECRET_KEY is required in production"); })() : "secret-dev");
const MFA_ENCRYPTION_KEY = process.env.MFA_ENCRYPTION_KEY;
const MFA_ENCRYPTION_KEY_ID = process.env.MFA_ENCRYPTION_KEY_ID || "default";
const rawAppName = process.env.APP_NAME;
const APP_NAME = rawAppName || "Opsy";
/** Product name in transactional email subjects, bodies, and default From display name. Legacy APP_NAME=HomeOps maps to Opsy. */
const EMAIL_BRAND_NAME =
  process.env.EMAIL_BRAND_NAME ||
  (rawAppName === "HomeOps" ? "Opsy" : APP_NAME);

const PORT = +process.env.PORT || 3000;

// Google OAuth (optional; validated when used)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
// Google sign-in/up OAuth callbacks hit the backend. When the explicit redirect
// URIs aren't set, derive them from the public origin so they can't silently fall
// back to an internal host (e.g. *.up.railway.app). Prefer BACKEND_URL, then the
// same-origin web origin, then localhost for dev.
const OAUTH_CALLBACK_BASE = (
  process.env.BACKEND_URL ||
  process.env.APP_WEB_ORIGIN ||
  `http://localhost:${PORT}`
).replace(/\/$/, "");
const GOOGLE_REDIRECT_URI_SIGNIN =
  process.env.GOOGLE_REDIRECT_URI_SIGNIN ||
  `${OAUTH_CALLBACK_BASE}/auth/google/callback/signin`;
const GOOGLE_REDIRECT_URI_SIGNUP =
  process.env.GOOGLE_REDIRECT_URI_SIGNUP ||
  `${OAUTH_CALLBACK_BASE}/auth/google/callback/signup`;
const APP_WEB_ORIGIN = process.env.APP_WEB_ORIGIN;
// BrowserRouter uses path-based URLs; redirect to origin + /auth/callback (no hash)
const AUTH_SUCCESS_REDIRECT = process.env.AUTH_SUCCESS_REDIRECT || (process.env.APP_WEB_ORIGIN ? `${process.env.APP_WEB_ORIGIN}/auth/callback` : null);

// Use dev database, testing database, or via env var, production database
function getDatabaseUri() {
  return (process.env.NODE_ENV === "test")
    ? "postgresql:///opsy_test"
    : process.env.DATABASE_URL || "postgresql:///opsy";
}

/** Same URI with credentials stripped — safe for console / log aggregation. */
function redactDatabaseUri(uri) {
  if (!uri || typeof uri !== "string") return String(uri);
  try {
    const u = new URL(uri);
    if (u.password) u.password = "***";
    return u.toString();
  } catch {
    return uri.replace(/\/\/([^:@/]+):([^@/]+)@/, "//$1:***@");
  }
}
// Speed up bcrypt during tests, since the algorithm safety isn't being tested
//
// WJB: Evaluate in 2021 if this should be increased to 13 for non-test use
const BCRYPT_WORK_FACTOR = process.env.NODE_ENV === "test" ? 1 : 12;

if (process.env.NODE_ENV !== "test") {
  console.log(`
${"Opsy Config:".green}
${"NODE_ENV:".yellow}           ${process.env.NODE_ENV}
${"SECRET_KEY:".yellow}         ${SECRET_KEY === "secret-dev" ? "[DEFAULT - NOT FOR PRODUCTION]".red : "[SET]".green}
${"PORT:".yellow}               ${PORT}
${"BCRYPT_WORK_FACTOR:".yellow} ${BCRYPT_WORK_FACTOR}
${"Database:".yellow}           ${redactDatabaseUri(getDatabaseUri())}
---`);
}

/** Validate Google OAuth config at server start. Skips if not configured. */
function validateGoogleOAuthConfig() {
  if (!GOOGLE_CLIENT_ID) return; // Google auth disabled
  const missing = [];
  if (!GOOGLE_CLIENT_SECRET) missing.push("GOOGLE_CLIENT_SECRET");
  if (!APP_WEB_ORIGIN) missing.push("APP_WEB_ORIGIN");
  if (missing.length > 0) {
    throw new Error(`Google OAuth enabled but missing env: ${missing.join(", ")}`);
  }
  // Redirect URIs are derived from BACKEND_URL/APP_WEB_ORIGIN when not set explicitly.
  // In production they must be HTTPS and must not point at localhost, or Google will
  // reject the callback (redirect_uri_mismatch) and the flow will silently break.
  if (process.env.NODE_ENV === "production") {
    for (const [name, uri] of [
      ["GOOGLE_REDIRECT_URI_SIGNIN", GOOGLE_REDIRECT_URI_SIGNIN],
      ["GOOGLE_REDIRECT_URI_SIGNUP", GOOGLE_REDIRECT_URI_SIGNUP],
    ]) {
      if (!/^https:\/\//.test(uri) || /localhost|127\.0\.0\.1/.test(uri)) {
        throw new Error(
          `Google OAuth enabled but ${name} resolved to an invalid production value: ${uri}. ` +
            `Set BACKEND_URL/APP_WEB_ORIGIN (or ${name}) to your public HTTPS origin.`
        );
      }
    }
  }
}

module.exports = {
  SECRET_KEY,
  MFA_ENCRYPTION_KEY,
  MFA_ENCRYPTION_KEY_ID,
  APP_NAME,
  EMAIL_BRAND_NAME,
  PORT,
  BCRYPT_WORK_FACTOR,
  getDatabaseUri,
  redactDatabaseUri,
  validateGoogleOAuthConfig,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI_SIGNIN,
  GOOGLE_REDIRECT_URI_SIGNUP,
  APP_WEB_ORIGIN,
  AUTH_SUCCESS_REDIRECT,
  // S3 config;
  AWS_REGION: process.env.AWS_REGION || "us-east-2",
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,

  // Inbound email (SES → S3 → SNS → /webhooks/ses-inbound). The receiving
  // domain has its own MX (e.g. `inbox.heyopsy.com → inbound-smtp.us-east-1.amazonaws.com`)
  // so it doesn't collide with outbound mail at the apex. The S3 bucket
  // SES writes raw MIME to may live in a different region than AWS_S3_BUCKET
  // because SES inbound is only available in us-east-1 / us-west-2 / eu-west-1.
  SES_INBOUND_BUCKET: process.env.SES_INBOUND_BUCKET,
  /** Object key prefix in SES “Deliver to S3” (e.g. raw/). Used when the SNS notification’s receipt.action is SNS (last rule action) rather than S3. */
  SES_INBOUND_S3_PREFIX: process.env.SES_INBOUND_S3_PREFIX || "raw/",
  SES_INBOUND_BUCKET_REGION:
    process.env.SES_INBOUND_BUCKET_REGION || process.env.AWS_SES_REGION || "us-east-1",
  SES_INBOUND_SNS_TOPIC_ARN: process.env.SES_INBOUND_SNS_TOPIC_ARN,
  INBOUND_EMAIL_DOMAIN: process.env.INBOUND_EMAIL_DOMAIN || "inbox.heyopsy.com",
  INBOUND_EMAIL_LOCAL_PART: process.env.INBOUND_EMAIL_LOCAL_PART || "documents",

  // Stripe billing (env-only setup)
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
  STRIPE_SUCCESS_URL: process.env.STRIPE_SUCCESS_URL || (process.env.APP_BASE_URL ? `${process.env.APP_BASE_URL}/#/billing/success` : null),
  STRIPE_CANCEL_URL: process.env.STRIPE_CANCEL_URL || (process.env.APP_BASE_URL ? `${process.env.APP_BASE_URL}/#/onboarding` : null),
  APP_BASE_URL: process.env.APP_BASE_URL || process.env.APP_WEB_ORIGIN || "http://localhost:5173",
  BILLING_MOCK_MODE: process.env.BILLING_MOCK_MODE === "true",

  // AI token cost (USD per token) - used when ai_token_monthly_value_usd is set to compute quota
  AI_TOKEN_COST_USD: Number(process.env.AI_TOKEN_COST_USD) || 0.00002,

  // Calendar integrations (Google Calendar, Microsoft Outlook)
  // OAuth callbacks must hit the backend. BACKEND_URL = API base (e.g. http://localhost:3000)
  BACKEND_URL: process.env.BACKEND_URL || `http://localhost:${PORT}`,
  GOOGLE_CALENDAR_REDIRECT_URI: process.env.GOOGLE_CALENDAR_REDIRECT_URI ||
    (process.env.BACKEND_URL ? `${process.env.BACKEND_URL.replace(/\/$/, "")}/calendar-integrations/oauth/google/callback` : null) ||
    `http://localhost:${PORT}/calendar-integrations/oauth/google/callback`,
  MICROSOFT_CLIENT_ID: process.env.MICROSOFT_CLIENT_ID,
  MICROSOFT_CLIENT_SECRET: process.env.MICROSOFT_CLIENT_SECRET,
  MICROSOFT_REDIRECT_URI: process.env.MICROSOFT_REDIRECT_URI ||
    (process.env.BACKEND_URL ? `${process.env.BACKEND_URL.replace(/\/$/, "")}/calendar-integrations/oauth/outlook/callback` : null) ||
    `http://localhost:${PORT}/calendar-integrations/oauth/outlook/callback`,
};