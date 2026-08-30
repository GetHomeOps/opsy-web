"use strict";

/**
 * Customer.io email provider — identify, track events, and transactional sends.
 *
 * Env: CUSTOMER_IO_SITE_ID, CUSTOMER_IO_APP_API_KEY, CUSTOMER_IO_TRACK_API_KEY,
 *      CUSTOMER_IO_REGION (us|eu, default us)
 */

const db = require("../../db");
const { EMAIL_BRAND_NAME } = require("../../config");
const { shouldSuppressOutboundEmail } = require("../../helpers/demoEnvironment");
const { buildSeasonalMaintenanceEventFields } = require("../../helpers/seasonalMaintenance");

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

async function customerIoFetch(url, options = {}, { bypassDemoSuppression = false } = {}) {
  if (shouldSuppressOutboundEmail() && !bypassDemoSuppression) {
    console.info("[customerIoProvider] Customer.io call suppressed (demo)", {
      url: String(url || "").slice(0, 120),
    });
    return null;
  }

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
async function identifyPerson({ email, attributes = {}, bypassDemoSuppression = false }) {
  const customerId = encodeURIComponent(String(email).trim().toLowerCase());
  const url = `${getTrackBaseUrl()}/api/v1/customers/${customerId}`;
  await customerIoFetch(
    url,
    {
      method: "PUT",
      headers: {
        Authorization: getTrackAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: String(email).trim(),
        ...attributes,
      }),
    },
    { bypassDemoSuppression }
  );
}

/** Track an event for journey/campaign triggers. */
async function trackEvent({ email, eventName, data = {}, bypassDemoSuppression = false }) {
  const customerId = encodeURIComponent(String(email).trim().toLowerCase());
  const url = `${getTrackBaseUrl()}/api/v1/customers/${customerId}/events`;
  await customerIoFetch(
    url,
    {
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
    },
    { bypassDemoSuppression }
  );
}

/** Send a transactional message by template ID. */
async function sendTransactional({
  to,
  transactionalMessageId,
  messageData = {},
  replyTo,
  cc,
  bypassDemoSuppression = false,
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

  await customerIoFetch(
    `${getApiBaseUrl()}/v1/send/email`,
    {
      method: "POST",
      headers: {
        Authorization: getAppAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    { bypassDemoSuppression }
  );
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
async function deliverViaCustomerIo({
  to,
  config,
  messageData,
  replyTo,
  cc,
  usage,
  bypassDemoSuppression = false,
}) {
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
    bypassDemoSuppression,
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
      bypassDemoSuppression,
    });
  }

  if (mode === "event" || mode === "both") {
    if (!eventName) {
      throw new Error("Customer.io event_name is not configured for this email type.");
    }
    await trackEvent({
      email: to,
      eventName,
      data: messageData,
      bypassDemoSuppression,
    });
  }

  await logUsageIfNeeded(usage);
  return { success: true, provider: "customer_io" };
}

const PROPERTY_INVITATION_ACCEPTED_EVENT = "property_invitation_accepted";
const PROPERTY_ADDED_EVENT = "property_added";
const LOGGED_IN_EVENT = "logged_in";
const PROPERTY_DELETED_EVENT = "property_deleted";
const NO_PROPERTIES_REMAINING_EVENT = "no_properties_remaining";
const PROPERTY_INVITATION_DECLINED_EVENT = "property_invitation_declined";
const PROPERTY_INVITATION_REVOKED_EVENT = "property_invitation_revoked";

/** Fire-and-forget Customer.io track; logs errors, never throws. */
async function trackLifecycleEvent({ email, eventName, data = {}, attributes = {} }) {
  if (!isCustomerIoConfigured()) return;

  const normalizedEmail = String(email || "").trim();
  if (!normalizedEmail) return;

  try {
    await identifyPerson({ email: normalizedEmail, attributes });
    await trackEvent({
      email: normalizedEmail,
      eventName,
      data: { brandName: EMAIL_BRAND_NAME, ...data },
    });
  } catch (err) {
    console.error(`[customerIoProvider] ${eventName}:`, err.message);
  }
}

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

function getFlyBaseUrl() {
  return "https://fly.customer.io";
}

function getFlyAuthHeader() {
  const token =
    process.env.CUSTOMER_IO_WRITE_TOKEN || process.env.CUSTOMER_IO_APP_API_KEY;
  if (!token) {
    throw new Error(
      "Customer.io not configured. Set CUSTOMER_IO_WRITE_TOKEN or CUSTOMER_IO_APP_API_KEY."
    );
  }
  return `Bearer ${token}`;
}

/**
 * Send a real test of a stored Customer.io email template (not just a Track event).
 * Uses sample event_data so {{ event.* }} Liquid renders.
 */
async function sendTestTemplate({
  to,
  templateId,
  eventData = {},
  prependTest = true,
  bypassDemoSuppression = false,
}) {
  if (!isCustomerIoConfigured()) {
    throw new Error(
      "Customer.io not configured. Set CUSTOMER_IO_SITE_ID, CUSTOMER_IO_TRACK_API_KEY, and CUSTOMER_IO_APP_API_KEY."
    );
  }
  const environmentId = process.env.CUSTOMER_IO_ENVIRONMENT_ID || "218445";
  const id = Number(templateId);
  if (!id || Number.isNaN(id)) {
    throw new Error("Customer.io template_id is required for a test send.");
  }
  return customerIoFetch(
    `${getFlyBaseUrl()}/v1/environments/${environmentId}/verify/email_template`,
    {
      method: "POST",
      headers: {
        Authorization: getFlyAuthHeader(),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        template_id: id,
        to: String(to).trim(),
        event_data: eventData,
        prepend_test: prependTest !== false,
      }),
    },
    { bypassDemoSuppression }
  );
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
  propertyState = "",
  propertyCity = "",
  region = "",
  accountId,
  isFirstPropertyForUser = false,
  source = "create",
}) {
  if (!isCustomerIoConfigured()) return;

  const email = String(userEmail || "").trim();
  if (!email) return;

  try {
    const displayName = String(userName || "").trim();
    const state = String(propertyState || "").trim();
    const city = String(propertyCity || "").trim();
    const seasonalFields = buildSeasonalMaintenanceEventFields({
      state,
      region: String(region || "").trim(),
    });
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
        state,
        city,
        accountId: accountId ?? null,
        isFirstPropertyForUser: Boolean(isFirstPropertyForUser),
        source: String(source || "create").trim(),
        brandName: EMAIL_BRAND_NAME,
        ...seasonalFields,
      },
    });
  } catch (err) {
    console.error("[customerIoProvider] trackPropertyAdded:", err.message);
  }
}

/**
 * Track app login for Customer.io segments and journey exit rules.
 * Updates last_login_at on the person profile.
 */
async function trackUserLoggedIn({
  userEmail,
  userName = "",
  userId,
  source = "password",
}) {
  const nowUnix = Math.floor(Date.now() / 1000);
  const displayName = String(userName || "").trim();
  await trackLifecycleEvent({
    email: userEmail,
    eventName: LOGGED_IN_EVENT,
    attributes: {
      ...(displayName ? { name: displayName } : {}),
      last_login_at: nowUnix,
    },
    data: {
      userId: userId ?? null,
      source: String(source || "password").trim(),
      loggedInAt: nowUnix,
    },
  });
}

async function trackPropertyInvitationDeclined({
  inviteeEmail,
  invitationId,
  propertyId,
  propertyAddress = "",
  invitationType = "property",
}) {
  await trackLifecycleEvent({
    email: inviteeEmail,
    eventName: PROPERTY_INVITATION_DECLINED_EVENT,
    data: {
      invitationId: invitationId ?? null,
      propertyId: propertyId ?? null,
      propertyAddress: String(propertyAddress || "").trim(),
      invitationType: String(invitationType || "property").trim(),
    },
  });
}

async function trackPropertyInvitationRevoked({
  inviteeEmail,
  invitationId,
  propertyId,
  propertyAddress = "",
  invitationType = "property",
}) {
  await trackLifecycleEvent({
    email: inviteeEmail,
    eventName: PROPERTY_INVITATION_REVOKED_EVENT,
    data: {
      invitationId: invitationId ?? null,
      propertyId: propertyId ?? null,
      propertyAddress: String(propertyAddress || "").trim(),
      invitationType: String(invitationType || "property").trim(),
    },
  });
}

async function trackPropertyDeleted({
  userEmail,
  propertyId,
  propertyAddress = "",
  propertyUid = "",
  reason = "deleted",
}) {
  await trackLifecycleEvent({
    email: userEmail,
    eventName: PROPERTY_DELETED_EVENT,
    data: {
      propertyId: propertyId ?? null,
      propertyAddress: String(propertyAddress || "").trim(),
      propertyUid: String(propertyUid || "").trim(),
      reason: String(reason || "deleted").trim(),
    },
  });
}

async function trackNoPropertiesRemaining({
  userEmail,
  userId,
  reason = "unknown",
  lastPropertyId = null,
  lastPropertyUid = "",
}) {
  await trackLifecycleEvent({
    email: userEmail,
    eventName: NO_PROPERTIES_REMAINING_EVENT,
    data: {
      userId: userId ?? null,
      reason: String(reason || "unknown").trim(),
      lastPropertyId: lastPropertyId ?? null,
      lastPropertyUid: String(lastPropertyUid || "").trim(),
    },
  });
}

/**
 * Notify invitees and team members that a property was deleted so Customer.io
 * journeys can exit. Call before Property.remove().
 */
async function notifyCustomerIoPropertyDeleted(propertyId) {
  if (!isCustomerIoConfigured()) return null;

  const id = Number(propertyId);
  if (!id || Number.isNaN(id)) return;

  try {
    const [propRes, inviteRes, memberRes] = await Promise.all([
      db.query(
        `SELECT address, property_uid FROM properties WHERE id = $1`,
        [id]
      ),
      db.query(
        `SELECT DISTINCT LOWER(TRIM(invitee_email)) AS email
         FROM invitations
         WHERE property_id = $1`,
        [id]
      ),
      db.query(
        `SELECT DISTINCT u.id AS user_id, LOWER(TRIM(u.email)) AS email
         FROM property_users pu
         JOIN users u ON u.id = pu.user_id
         WHERE pu.property_id = $1 AND u.email IS NOT NULL`,
        [id]
      ),
    ]);

    const propertyRow = propRes.rows[0];
    if (!propertyRow) return null;

    const propertyAddress = String(propertyRow.address || "").trim();
    const propertyUid = String(propertyRow.property_uid || "").trim();
    const emails = new Set();
    const memberUserIds = new Set();
    for (const row of inviteRes.rows) {
      const email = String(row.email || "").trim();
      if (email) emails.add(email);
    }
    for (const row of memberRes.rows) {
      const email = String(row.email || "").trim();
      if (email) emails.add(email);
      const userId = Number(row.user_id);
      if (userId && !Number.isNaN(userId)) memberUserIds.add(userId);
    }

    await Promise.all(
      [...emails].map((email) =>
        trackPropertyDeleted({
          userEmail: email,
          propertyId: id,
          propertyAddress,
          propertyUid,
          reason: "deleted",
        })
      )
    );

    if (memberUserIds.size > 0) {
      return {
        memberUserIds: [...memberUserIds],
        propertyId: id,
        propertyUid,
        propertyAddress,
      };
    }
    return { memberUserIds: [], propertyId: id, propertyUid, propertyAddress };
  } catch (err) {
    console.error(
      "[customerIoProvider] notifyCustomerIoPropertyDeleted:",
      err.message
    );
    return null;
  }
}

module.exports = {
  isCustomerIoConfigured,
  identifyPerson,
  trackEvent,
  sendTransactional,
  deliverViaCustomerIo,
  sendTestTemplate,
  trackPropertyInvitationAccepted,
  trackPropertyAdded,
  trackUserLoggedIn,
  trackPropertyInvitationDeclined,
  trackPropertyInvitationRevoked,
  trackPropertyDeleted,
  trackNoPropertiesRemaining,
  notifyCustomerIoPropertyDeleted,
  PROPERTY_INVITATION_ACCEPTED_EVENT,
  PROPERTY_ADDED_EVENT,
  LOGGED_IN_EVENT,
  PROPERTY_DELETED_EVENT,
  NO_PROPERTIES_REMAINING_EVENT,
  PROPERTY_INVITATION_DECLINED_EVENT,
  PROPERTY_INVITATION_REVOKED_EVENT,
  getCustomerIoWorkspaceUrl,
  getRegion,
};
