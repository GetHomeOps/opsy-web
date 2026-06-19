"use strict";

/**
 * Internal ops alerts for helpdesk tickets and other platform events.
 * Helpdesk ticket creates email dev@heyopsy.com; inspection reviews email kino + dev.
 * Other ops alerts use OPS_TEAM_NOTIFY_EMAIL (default HeyOpsy@heyopsy.com).
 * Also creates in-app bell notifications for platform admins on new helpdesk tickets
 * and when a requester replies on an existing ticket.
 */

const db = require("../db");
const Notification = require("../models/notification");
const {
  sendHelpdeskTicketCreatedOpsEmail,
  sendOpsTeamInternalNotification,
} = require("./emailService");
const { APP_BASE_URL } = require("../config");

const HELPDESK_TICKET_TYPES = ["support", "feedback", "data_adjustment"];

const TYPE_LABELS = {
  support: "Support",
  feedback: "Feedback",
  data_adjustment: "Data adjustment",
};

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function detailsTable(rows) {
  const body = rows
    .filter(([, v]) => v != null && String(v).trim() !== "")
    .map(
      ([label, value]) =>
        `<tr><td style="padding: 4px 12px 4px 0; color: #6b7280; vertical-align: top;">${escapeHtml(label)}</td><td style="vertical-align: top;">${escapeHtml(value)}</td></tr>`
    )
    .join("");
  if (!body) return "";
  return `<table style="border-collapse: collapse; font-size: 14px; margin: 12px 0;">${body}</table>`;
}

async function getPlatformAdminUserIds() {
  const r = await db.query(
    `SELECT id FROM users WHERE role IN ('admin', 'super_admin') AND is_active = true`
  );
  return r.rows.map((row) => row.id);
}

async function notifyNewUserAccount({ userId, email, name, role, source }) {
  const base = (APP_BASE_URL || "").replace(/\/$/, "");
  const inner = `
      <p style="font-size: 15px; color: #111827;">A new user account was created.</p>
      ${detailsTable([
        ["Name", name],
        ["Email", email],
        ["Role", role],
        ["User ID", userId != null ? String(userId) : ""],
        ["Source", source],
        ["App", base || "(not configured)"],
      ])}`;
  try {
    await sendOpsTeamInternalNotification({ subject: `New account: ${email || name || userId}`, innerHtml: inner });
  } catch (err) {
    console.error("[opsTeamNotify] new account:", err.message);
  }
}

async function notifyUserReplyOnHelpdeskTicket(ticket, reply) {
  if (!ticket?.id || !reply || reply.isAutomated || reply.role !== "user") return;
  if (!HELPDESK_TICKET_TYPES.includes(ticket.type)) return;

  const typeLabel = TYPE_LABELS[ticket.type] || "Helpdesk";
  const subjectSnippet = (ticket.subject || "").slice(0, 120);
  const authorName =
    reply.authorName || reply.authorEmail || ticket.createdByName || "User";
  const title = `${authorName} replied on ${typeLabel.toLowerCase()} ticket: ${subjectSnippet}`;

  try {
    const adminIds = await getPlatformAdminUserIds();
    for (const userId of adminIds) {
      await Notification.create({
        userId,
        type: "helpdesk_ticket_user_reply",
        title,
        supportTicketId: ticket.id,
      }).catch((e) =>
        console.error("[opsTeamNotify] helpdesk user reply bell:", e.message)
      );
    }
  } catch (err) {
    console.error("[opsTeamNotify] platform admin lookup:", err.message);
  }
}

async function notifyNewSupportOrFeedbackTicket(ticket) {
  if (!ticket?.id || !HELPDESK_TICKET_TYPES.includes(ticket.type)) return;

  const typeLabel = TYPE_LABELS[ticket.type] || "Helpdesk";
  const subjectSnippet = (ticket.subject || "").slice(0, 120);
  const title = `New ${typeLabel.toLowerCase()} ticket: ${subjectSnippet}`;

  try {
    const adminIds = await getPlatformAdminUserIds();
    for (const userId of adminIds) {
      await Notification.create({
        userId,
        type: "helpdesk_ticket_created",
        title,
        supportTicketId: ticket.id,
      }).catch((e) =>
        console.error("[opsTeamNotify] helpdesk bell:", e.message)
      );
    }
  } catch (err) {
    console.error("[opsTeamNotify] platform admin lookup:", err.message);
  }

  try {
    await sendHelpdeskTicketCreatedOpsEmail(ticket);
  } catch (err) {
    console.error("[opsTeamNotify] support ticket:", err.message);
  }
}

async function notifyPropertyMissingAgent(prop) {
  if (!prop) return;
  const label = [prop.address, prop.city, prop.state].filter(Boolean).join(", ") || prop.property_uid || `Property #${prop.id}`;
  const base = (APP_BASE_URL || "").replace(/\/$/, "");
  const accountUrl = (prop.account_url || "").replace(/^\/+|\/+$/g, "");
  const uid = prop.property_uid ? String(prop.property_uid).trim() : "";
  const link =
    base && accountUrl && uid
      ? `${base}/${accountUrl}/properties/${encodeURIComponent(uid)}`
      : base || "";
  const inner = `
      <p style="font-size: 15px; color: #111827;">A property has no Opsy team member with the agent role.</p>
      ${detailsTable([
        ["Property", label],
        ["Property ID", prop.id != null ? String(prop.id) : ""],
        ["Property UID", prop.property_uid || ""],
        ["Account ID", prop.account_id != null ? String(prop.account_id) : ""],
        ["Open in app", link],
      ])}`;
  try {
    await sendOpsTeamInternalNotification({
      subject: `Property without agent: ${label.slice(0, 100)}`,
      innerHtml: inner,
    });
  } catch (err) {
    console.error("[opsTeamNotify] property missing agent:", err.message);
  }
}

module.exports = {
  notifyNewUserAccount,
  notifyNewSupportOrFeedbackTicket,
  notifyUserReplyOnHelpdeskTicket,
  notifyPropertyMissingAgent,
};
