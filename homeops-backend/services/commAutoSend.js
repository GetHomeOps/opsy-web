"use strict";

/**
 * Auto-send communications when trigger events fire.
 * Rules are scoped by account_id and only apply to sent communications.
 * Recipient is the user who triggered the event (in-app notification), filtered by rule trigger_role
 * (homeowner vs agent). NULL trigger_role is treated as homeowner for legacy rows.
 */

const db = require("../db");
const Notification = require("../models/notification");

const ALLOWED_TRIGGER_EVENTS = new Set([
  "user_created",
  "property_invitation_accepted",
]);

async function getRulesForTrigger(triggerEvent, accountId, triggeringUserRole) {
  if (!accountId || !ALLOWED_TRIGGER_EVENTS.has(triggerEvent)) return [];

  const role =
    triggeringUserRole === "agent" ? "agent" : "homeowner";

  const result = await db.query(
    `SELECT cr.id, cr.communication_id, cr.trigger_event, cr.trigger_role,
            c.subject, c.delivery_channel AS "deliveryChannel"
     FROM comm_rules cr
     JOIN communications c ON c.id = cr.communication_id
     WHERE cr.is_active = true
       AND cr.trigger_event = $1
       AND cr.account_id = $2
       AND c.status = 'sent'
       AND (
         ($3 = 'homeowner' AND (cr.trigger_role IS NULL OR cr.trigger_role = 'homeowner'))
         OR ($3 = 'agent' AND cr.trigger_role = 'agent')
       )`,
    [triggerEvent, accountId, role]
  );
  return result.rows;
}

async function sendToUser(communicationId, userId, title) {
  await Notification.create({
    userId,
    type: "communication_sent",
    communicationId,
    title: title || "New message",
  });

  await db.query(
    `INSERT INTO comm_recipients (communication_id, user_id, channel, status, delivered_at)
     VALUES ($1, $2, 'in_app', 'delivered', NOW())`,
    [communicationId, userId]
  );
}

/**
 * Homeowner account creation (self-serve signup, Google signup, onboarding, or new user via invite).
 */
async function onUserCreated({ userId, role, accountId }) {
  if (!userId || !accountId) return;
  if (role !== "homeowner" && role !== "agent") return;

  const rules = await getRulesForTrigger("user_created", accountId, role);
  for (const rule of rules) {
    try {
      await sendToUser(
        rule.communication_id,
        userId,
        `New: ${rule.subject || "Message"}`
      );
    } catch (err) {
      console.error(
        `[commAutoSend] user_created comm ${rule.communication_id} → user ${userId}:`,
        err.message
      );
    }
  }
}

/**
 * A user accepted a property invitation (new or existing user).
 */
async function onPropertyInvitationAccepted({ userId, accountId, role }) {
  if (!userId || !accountId) return;

  const effectiveRole = role === "agent" ? "agent" : "homeowner";
  const rules = await getRulesForTrigger(
    "property_invitation_accepted",
    accountId,
    effectiveRole
  );
  for (const rule of rules) {
    try {
      await sendToUser(
        rule.communication_id,
        userId,
        `New: ${rule.subject || "Message"}`
      );
    } catch (err) {
      console.error(
        `[commAutoSend] property_invitation_accepted comm ${rule.communication_id} → user ${userId}:`,
        err.message
      );
    }
  }
}

module.exports = {
  onUserCreated,
  onPropertyInvitationAccepted,
  getRulesForTrigger,
  ALLOWED_TRIGGER_EVENTS,
};
