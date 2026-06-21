"use strict";

/**
 * Demo environment detection and guards for demo.heyopsy.com deployment.
 */

const { ForbiddenError } = require("../expressError");

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

module.exports = {
  DEMO_HOSTNAME,
  hostnameFromUrl,
  hostnameFromHostHeader,
  getRequestHostname,
  isDemoEnvironment,
  assertPublicSignupAllowed,
  assertDemoResetAllowed,
};
