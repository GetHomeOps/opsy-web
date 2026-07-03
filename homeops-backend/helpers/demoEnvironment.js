"use strict";

/**
 * Demo environment detection and guards for demo.heyopsy.com deployment.
 */

const { ForbiddenError, UnauthorizedError, BadRequestError } = require("../expressError");

const DEMO_HOSTNAME = "demo.heyopsy.com";

function hostnameFromUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  try {
    return new URL(rawUrl).hostname?.toLowerCase() || null;
  } catch {
    return null;
  }
}

function hostnameFromHostHeader(rawHost) {
  if (!rawHost || typeof rawHost !== "string") return null;
  return rawHost.split(",")[0].trim().split(":")[0].toLowerCase();
}

function getRequestHostname(req) {
  const originHost = hostnameFromUrl(req.get("origin"));
  if (originHost) return originHost;
  const refererHost = hostnameFromUrl(req.get("referer"));
  if (refererHost) return refererHost;
  const forwardedHost = hostnameFromHostHeader(req.get("x-forwarded-host"));
  if (forwardedHost) return forwardedHost;
  return hostnameFromHostHeader(req.get("host"));
}

function isDemoHostname(hostname) {
  return hostname === DEMO_HOSTNAME;
}

/** True when this backend deployment serves the public demo site. */
function isDemoEnvironment() {
  if (process.env.DISABLE_PUBLIC_SIGNUP === "true") return true;
  const webOriginHost = hostnameFromUrl(process.env.APP_WEB_ORIGIN);
  if (isDemoHostname(webOriginHost)) return true;
  const appBaseHost = hostnameFromUrl(process.env.APP_BASE_URL);
  return isDemoHostname(appBaseHost);
}

function assertPublicSignupAllowed() {
  if (isDemoEnvironment()) {
    throw new ForbiddenError("Account registration is disabled on the demo site.");
  }
}

/** True when outbound email and Customer.io lifecycle calls should be suppressed. */
function shouldSuppressOutboundEmail() {
  if (process.env.SUPPRESS_OUTBOUND_EMAIL === "true") return true;
  return isDemoEnvironment();
}

function assertDemoResetAllowed(req) {
  const appOriginHost = hostnameFromUrl(process.env.APP_WEB_ORIGIN);
  const requestHost = getRequestHostname(req);
  if (appOriginHost !== DEMO_HOSTNAME) {
    throw new ForbiddenError("Demo reset is only available in the demo environment.");
  }
  if (requestHost !== DEMO_HOSTNAME) {
    throw new ForbiddenError("Demo reset can only be triggered from demo.heyopsy.com.");
  }
}

const DEFAULT_DEMO_ACCOUNT_EXPIRY_HOURS = Number(process.env.DEMO_ACCOUNT_EXPIRY_HOURS) || 72;

const DEMO_ACCOUNT_EXPIRED_MESSAGE =
  "This demo account has expired. Contact your HeyOpsy representative for an extension.";

/** Default expiry for ready-to-use demo accounts (creation time + TTL). */
function getDefaultDemoAccountExpiryAt(fromDate = new Date()) {
  const base = fromDate instanceof Date ? fromDate : new Date(fromDate);
  return new Date(base.getTime() + DEFAULT_DEMO_ACCOUNT_EXPIRY_HOURS * 60 * 60 * 1000);
}

/** True when a provisioned demo account (demo_login_password set) is past demo_expires_at. */
function isProvisionedDemoAccountExpired(user) {
  if (!user?.demoLoginPassword || !user?.demoExpiresAt) return false;
  const expiresAt = user.demoExpiresAt instanceof Date
    ? user.demoExpiresAt
    : new Date(user.demoExpiresAt);
  if (Number.isNaN(expiresAt.getTime())) return false;
  return expiresAt.getTime() <= Date.now();
}

/** Block login/API access for expired ready-to-use demo accounts. */
function assertDemoAccountAccessAllowed(user) {
  if (!isDemoEnvironment()) return;
  if (!user?.demoLoginPassword) return;
  if (isProvisionedDemoAccountExpired(user)) {
    throw new UnauthorizedError(DEMO_ACCOUNT_EXPIRED_MESSAGE);
  }
}

/** Parse demo expiry from API input; defaults to now + TTL when omitted. */
function parseDemoExpiresAtInput(raw, { requireFuture = true } = {}) {
  if (raw === undefined || raw === null || raw === "") {
    return getDefaultDemoAccountExpiryAt();
  }
  const parsed = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestError("demoExpiresAt must be a valid ISO timestamp.");
  }
  if (requireFuture && parsed.getTime() <= Date.now()) {
    throw new BadRequestError("demoExpiresAt must be in the future.");
  }
  return parsed;
}

/** Next scheduled full demo DB reset (daily 06:00 UTC). */
function getNextDemoResetAt() {
  const now = new Date();
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 6, 0, 0, 0)
  );
  if (now.getTime() >= next.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

function assertDemoIntegrationsAllowed() {
  if (isDemoEnvironment()) {
    throw new ForbiddenError("Third-party integrations are disabled on the demo site.");
  }
}

function assertDemoUploadAllowed() {
  if (isDemoEnvironment()) {
    throw new ForbiddenError(
      "Document upload is not available on the demo site. A full HeyOpsy account includes document upload and secure file storage for your property."
    );
  }
}

function assertDemoAiAllowed() {
  if (isDemoEnvironment()) {
    throw new ForbiddenError(
      "AI features are not available on the demo site. A full HeyOpsy account includes the Opsy assistant, AI inspection analysis, and AI-powered maintenance insights."
    );
  }
}

module.exports = {
  DEMO_HOSTNAME,
  hostnameFromUrl,
  hostnameFromHostHeader,
  getRequestHostname,
  isDemoEnvironment,
  shouldSuppressOutboundEmail,
  assertPublicSignupAllowed,
  assertDemoResetAllowed,
  assertDemoIntegrationsAllowed,
  assertDemoUploadAllowed,
  assertDemoAiAllowed,
  getNextDemoResetAt,
  DEFAULT_DEMO_ACCOUNT_EXPIRY_HOURS,
  DEMO_ACCOUNT_EXPIRED_MESSAGE,
  getDefaultDemoAccountExpiryAt,
  parseDemoExpiresAtInput,
  isProvisionedDemoAccountExpired,
  assertDemoAccountAccessAllowed,
};
