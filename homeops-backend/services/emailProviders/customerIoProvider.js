"use strict";

/**
 * Customer.io email provider — identify, track events, and transactional sends.
 *
 * Env: CUSTOMER_IO_SITE_ID, CUSTOMER_IO_APP_API_KEY, CUSTOMER_IO_TRACK_API_KEY,
 *      CUSTOMER_IO_REGION (us|eu, default us)
 */

const { EMAIL_BRAND_NAME } = require("../../config");

function getRegion() {
  const r = (process.env.CUSTOMER_IO_REGION || "us").trim().toLowerCase();
  return r === "eu" ? "eu" : "us";
}

function getTrackBaseUrl() {
  return getRegion() === "eu"
    ? "https://track-eu.customer.io"
    : "https://track.customer.io";
}

function getApiBaseUrl() {
  return getRegion() === "eu"
    ? "https://api-eu.customer.io"
    : "https://api.customer.io";
}

function isCustomerIoConfigured() {
  return !!(
    process.env.CUSTOMER_IO_SITE_ID &&
    process.env.CUSTOMER_IO_TRACK_API_KEY &&
    process.env.CUSTOMER_IO_APP_API_KEY
  );
}

function getTrackAuthHeader() {
  const siteId = process.env.CUSTOMER_IO_SITE_ID;
  const apiKey = process.env.CUSTOMER_IO_TRACK_API_KEY;
  const encoded = Buffer.from(`${siteId}:${apiKey}`).toString("base64");
  return `Basic ${encoded}`;
}

function getAppAuthHeader() {
  return `Bearer ${process.env.CUSTOMER_IO_APP_API_KEY}`;
}

async function customerIoFetch(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Customer.io API ${res.status}: ${body.slice(0, 300) || res.statusText}`
    );
  }
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Identify a person by email (Customer.io customer id). */
async function identifyPerson({ email, attributes = {} }) {
  const customerId = encodeURIComponent(String(email).trim().toLowerCase());
  const url = `${getTrackBaseUrl()}/api/v1/customers/${customerId}`;
  await customerIoFetch(url, {
    method: "PUT",
    headers: {
      Authorization: getTrackAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: String(email).trim(),
      ...attributes,
    }),
  });
}

/** Track an event for journey/campaign triggers. */
async function trackEvent({ email, eventName, data = {} }) {
  const customerId = encodeURIComponent(String(email).trim().toLowerCase());
  const url = `${getTrackBaseUrl()}/api/v1/customers/${customerId}/events`;
  await customerIoFetch(url, {
    method: "POST",
    headers: {
      Authorization: getTrackAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: eventName,
      data: {
        brandName: EMAIL_BRAND_NAME,
        ...data,
      },
    }),
  });
}

/** Send a transactional message by template ID. */
async function sendTransactional({
  to,
  transactionalMessageId,
  messageData = {},
  replyTo,
  cc,
}) {
  const payload = {
    transactional_message_id: Number(transactionalMessageId),
    to: String(to).trim(),
    identifiers: { email: String(to).trim() },
    message_data: {
      brandName: EMAIL_BRAND_NAME,
      ...messageData,
    },
  };
  if (replyTo && String(replyTo).trim()) {
    payload.reply_to = String(replyTo).trim();
  }
  const ccList = Array.isArray(cc)
    ? [...new Set(cc.map((e) => String(e || "").trim()).filter(Boolean))]
    : [];
  if (ccList.length > 0) {
    payload.bcc = ccList.join(",");
  }

  await customerIoFetch(`${getApiBaseUrl()}/v1/send/email`, {
    method: "POST",
    headers: {
      Authorization: getAppAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

async function logUsageIfNeeded(usage) {
  if (usage?.accountId != null && usage?.userId != null) {
    const { logEmailUsage } = require("../usageService");
    logEmailUsage({
      accountId: usage.accountId,
      userId: usage.userId,
      emailType: usage.emailType || "transactional",
      provider: "customer_io",
    }).catch((err) => console.error("[customerIoProvider] logEmailUsage:", err.message));
  }
}

/**
 * Deliver email via Customer.io (event and/or transactional mode).
 * @param {Object} opts
 * @param {string} opts.to
 * @param {Object} opts.config - email_template_configs row
 * @param {Object} opts.messageData - merge variables
 * @param {string} [opts.replyTo]
 * @param {string[]} [opts.cc]
 * @param {Object} [opts.usage]
 */
async function deliverViaCustomerIo({ to, config, messageData, replyTo, cc, usage }) {
  if (!isCustomerIoConfigured()) {
    throw new Error(
      "Customer.io not configured. Set CUSTOMER_IO_SITE_ID, CUSTOMER_IO_TRACK_API_KEY, and CUSTOMER_IO_APP_API_KEY."
    );
  }

  const mode = config.customerIoMode || config.customer_io_mode || "event";
  const eventName = config.customerIoEventName || config.customer_io_event_name;
  const transactionalId =
    config.customerIoTransactionalId ?? config.customer_io_transactional_id;

  const displayName =
    messageData.inviteeName ||
    messageData.userName ||
    messageData.recipientFirstName ||
    "";
  await identifyPerson({
    email: to,
    attributes: {
      ...(messageData.recipientFirstName
        ? { first_name: messageData.recipientFirstName }
        : {}),
      ...(displayName ? { name: displayName } : {}),
    },
  });

  if (mode === "transactional" || mode === "both") {
    if (!transactionalId) {
      throw new Error("Customer.io transactional_message_id is not configured for this email type.");
    }
    await sendTransactional({
      to,
      transactionalMessageId: transactionalId,
      messageData,
      replyTo,
      cc,
    });
  }

  if (mode === "event" || mode === "both") {
    if (!eventName) {
      throw new Error("Customer.io event_name is not configured for this email type.");
    }
    await trackEvent({ email: to, eventName, data: messageData });
  }

  await logUsageIfNeeded(usage);
  return { success: true, provider: "customer_io" };
}

const PROPERTY_INVITATION_ACCEPTED_EVENT = "property_invitation_accepted";
const PROPERTY_ADDED_EVENT = "property_added";

/**
 * Track property invitation acceptance for Customer.io journeys (exit / branch).
 * No-op when Customer.io is not configured; errors are logged, not thrown.
 */
async function trackPropertyInvitationAccepted({
  inviteeEmail,
  invitationId,
  propertyId,
  propertyAddress = "",
  inviteeName = "",
}) {
  if (!isCustomerIoConfigured()) return;

  const email = String(inviteeEmail || "").trim();
  if (!email) return;

  try {
    const displayName = String(inviteeName || "").trim();
    await identifyPerson({
      email,
      attributes: displayName ? { name: displayName } : {},
    });
    await trackEvent({
      email,
      eventName: PROPERTY_INVITATION_ACCEPTED_EVENT,
      data: {
        invitationId: invitationId ?? null,
        propertyId: propertyId ?? null,
        propertyAddress: String(propertyAddress || "").trim(),
      },
    });
  } catch (err) {
    console.error(
      "[customerIoProvider] trackPropertyInvitationAccepted:",
      err.message
    );
  }
}

function getCustomerIoWorkspaceUrl() {
  const siteId = process.env.CUSTOMER_IO_SITE_ID;
  if (!siteId) return null;
  const region = getRegion();
  const host = region === "eu" ? "fly.customer.io" : "fly.customer.io";
  return `https://${host}/workspaces/${siteId}`;
}

/**
 * Track when a user adds a property (create or invitation accept).
 * Used in Customer.io journeys to exit / skip follow-ups (e.g. welcome nudge).
 * No-op when Customer.io is not configured; errors are logged, not thrown.
 */
async function trackPropertyAdded({
  userEmail,
  userName = "",
  propertyId,
  propertyAddress = "",
  propertyUid = "",
  accountId,
  isFirstPropertyForUser = false,
  source = "create",
}) {
  if (!isCustomerIoConfigured()) return;

  const email = String(userEmail || "").trim();
  if (!email) return;

  try {
    const displayName = String(userName || "").trim();
    await identifyPerson({
      email,
      attributes: displayName ? { name: displayName } : {},
    });
    await trackEvent({
      email,
      eventName: PROPERTY_ADDED_EVENT,
      data: {
        propertyId: propertyId ?? null,
        propertyAddress: String(propertyAddress || "").trim(),
        propertyUid: String(propertyUid || "").trim(),
        accountId: accountId ?? null,
        isFirstPropertyForUser: Boolean(isFirstPropertyForUser),
        source: String(source || "create").trim(),
        brandName: EMAIL_BRAND_NAME,
      },
    });
  } catch (err) {
    console.error("[customerIoProvider] trackPropertyAdded:", err.message);
  }
}

module.exports = {
  isCustomerIoConfigured,
  identifyPerson,
  trackEvent,
  sendTransactional,
  deliverViaCustomerIo,
  trackPropertyInvitationAccepted,
  trackPropertyAdded,
  PROPERTY_INVITATION_ACCEPTED_EVENT,
  PROPERTY_ADDED_EVENT,
  getCustomerIoWorkspaceUrl,
  getRegion,
};
