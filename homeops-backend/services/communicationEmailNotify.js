"use strict";

/**
 * Sends “new communication in Opsy” notification emails (SES) with a link to the in-app viewer.
 * Used when agents/admins send a communication and when auto-send rules deliver to a user.
 */

const db = require("../db");
const { APP_BASE_URL } = require("../config");
const { sendCommunicationNotifyEmail } = require("./emailService");

async function getAccountSlug(accountId) {
  if (!accountId) return "home";
  const accRow = await db.query(`SELECT url, name FROM accounts WHERE id = $1`, [accountId]);
  return String(accRow.rows[0]?.url || accRow.rows[0]?.name || "home").replace(/^\/+|\/+$/g, "");
}

/**
 * @param {object} opts
 * @param {number} opts.communicationId
 * @param {number} opts.accountId
 * @param {string} [opts.subject]
 * @param {Array<{ name?: string, email?: string }>} opts.users
 * @param {number|null} [opts.actorUserId] - sender; omit or null for automated delivery (skips usage log)
 */
async function notifyCommunicationRecipientsByEmail({
  communicationId,
  accountId,
  subject,
  users,
  actorUserId,
}) {
  const base = (APP_BASE_URL || "").replace(/\/$/, "");
  if (!base) {
    console.warn("[communicationEmailNotify] APP_BASE_URL / APP_WEB_ORIGIN not set — skipping notify emails");
    return;
  }

  const accountSlug = await getAccountSlug(accountId);
  const viewUrl = `${base}/${accountSlug}/communications/${communicationId}/view`;

  for (const u of users || []) {
    const to = u?.email && String(u.email).trim();
    if (!to) continue;

    sendCommunicationNotifyEmail({
      to,
      userName: u.name,
      subjectLine: subject,
      viewUrl,
      usage:
        accountId != null && actorUserId != null
          ? { accountId, userId: actorUserId, emailType: "communication_notify" }
          : undefined,
    }).catch((e) => console.error("[communicationEmailNotify]", e.message));
  }
}

module.exports = { notifyCommunicationRecipientsByEmail };
