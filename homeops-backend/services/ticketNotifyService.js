"use strict";

/**
 * Ticket Notification Service
 *
 * Handles user-facing notifications for support/feedback tickets:
 *   - Automated in-thread acknowledgment reply posted when a ticket is created.
 *   - Confirmation email to the creator on ticket create (mirrors the auto-reply copy).
 *   - Reply notification email to the creator whenever an agent posts a reply.
 *
 * Emails are sent via AWS SES (see emailService.js). Internal ops alerts live in
 * opsTeamNotifyService.js — this file is exclusively for the submitting user.
 */

const SupportTicket = require("../models/supportTicket");
const {
  sendSupportTicketReceivedEmail,
  sendSupportTicketReplyEmail,
} = require("./emailService");
const { APP_BASE_URL } = require("../config");

/** Friendly first-name fallback from `users.name` (may be a full name). */
function firstNameOf(userName) {
  if (!userName || typeof userName !== "string") return null;
  const trimmed = userName.trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0] || null;
}

/**
 * Build the automated response text posted as the first admin reply on every
 * new support/feedback ticket. Copy follows common help-desk best practices:
 * acknowledge receipt, set clear expectations on next steps and response time,
 * and invite the user to add more context.
 */
function generateAutomatedReplyText(ticket) {
  const firstName = firstNameOf(ticket?.createdByName);
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";

  if (ticket?.type === "feedback") {
    return [
      greeting,
      "",
      `Thank you for sharing your feedback with Opsy — it's been received and will be reviewed by our product team.`,
      "",
      "What happens next:",
      "- Our product team reviews new feedback on a rolling basis.",
      "- You'll receive an email notification whenever we post an update or have a follow-up question.",
      "- You can reply to this thread at any time to add context, examples, or screenshots.",
      "",
      "We read every submission. Thanks again for taking the time to help us improve Opsy.",
      "",
      "— The Opsy Product Team",
    ].join("\n");
  }

  return [
    greeting,
    "",
    `Thank you for reaching out to Opsy Support — your request has been received and a member of our team will review it shortly.`,
    "",
    "What to expect:",
    "- A team member will reply here within 1 business day.",
    "- You'll get an email notification whenever we post an update.",
    "- You can reply to this thread at any time to add more information, screenshots, or affected properties.",
    "",
    "If the issue is urgent or blocking work for multiple users, please reply with the word \"urgent\" so we can triage accordingly.",
    "",
    "— The Opsy Support Team",
  ].join("\n");
}

/**
 * Build a deep link to the user's ticket detail page. Uses the joined
 * `accountUrl` on the ticket when available; falls back to admin-shared
 * helpdesk URL otherwise so the CTA is never broken.
 */
function buildTicketUrl(ticket) {
  const base = (APP_BASE_URL || "").replace(/\/$/, "");
  if (!base || !ticket?.id) return base || "";
  const accountUrl = ticket?.accountUrl
    ? String(ticket.accountUrl).replace(/^\/+|\/+$/g, "")
    : null;
  if (accountUrl) {
    return `${base}/${accountUrl}/settings/support/${ticket.id}`;
  }
  return `${base}/helpdesk/support/${ticket.id}`;
}

/**
 * Post the automated acknowledgment reply on a support/feedback ticket.
 * No-op for `data_adjustment` tickets (handled by a different flow).
 * Safe to fire-and-forget: logs and swallows errors.
 */
async function postAutomatedInitialReply(ticket) {
  if (!ticket || !["support", "feedback"].includes(ticket.type)) return null;
  try {
    const body = generateAutomatedReplyText(ticket);
    const updated = await SupportTicket.addReply(ticket.id, {
      authorId: null,
      role: "admin",
      body,
      isAutomated: true,
    });
    return { ticket: updated, body };
  } catch (err) {
    console.error(
      "[ticketNotify] failed to post automated reply for ticket",
      ticket?.id,
      err.message
    );
    return null;
  }
}

/**
 * Email the ticket creator confirming receipt of their submission and
 * mirroring the automated in-thread acknowledgment so they have a paper
 * trail even if they never come back to the app.
 */
async function notifyUserTicketCreated(ticket, { autoResponseText } = {}) {
  if (!ticket || !["support", "feedback"].includes(ticket.type)) return;
  const to = ticket.createdByEmail;
  if (!to) return;
  try {
    await sendSupportTicketReceivedEmail({
      to,
      ticket,
      viewUrl: buildTicketUrl(ticket),
      autoResponseText: autoResponseText || generateAutomatedReplyText(ticket),
      usage: ticket.accountId && ticket.createdBy
        ? {
            accountId: ticket.accountId,
            userId: ticket.createdBy,
            emailType: "support_ticket_received",
          }
        : undefined,
    });
  } catch (err) {
    console.error(
      "[ticketNotify] failed to email creator on ticket create",
      ticket?.id,
      err.message
    );
  }
}

/**
 * Email the ticket creator when a team member posts a reply.
 * Intentionally skips:
 *   - Automated replies (already acknowledged by the create email).
 *   - User-authored replies (no need to notify themselves).
 *   - Replies where the author is the creator (shouldn't happen for admin replies, but defensive).
 */
async function notifyUserAdminReply(ticket, reply) {
  if (!ticket || !reply) return;
  if (reply.isAutomated) return;
  if (reply.role !== "admin") return;
  if (reply.authorId && ticket.createdBy && reply.authorId === ticket.createdBy) return;

  const to = ticket.createdByEmail;
  if (!to) return;
  try {
    await sendSupportTicketReplyEmail({
      to,
      userName: ticket.createdByName || ticket.createdByEmail,
      ticket,
      reply,
      viewUrl: buildTicketUrl(ticket),
      usage: ticket.accountId && ticket.createdBy
        ? {
            accountId: ticket.accountId,
            userId: ticket.createdBy,
            emailType: "support_ticket_reply",
          }
        : undefined,
    });
  } catch (err) {
    console.error(
      "[ticketNotify] failed to email creator on admin reply",
      ticket?.id,
      err.message
    );
  }
}

module.exports = {
  generateAutomatedReplyText,
  buildTicketUrl,
  postAutomatedInitialReply,
  notifyUserTicketCreated,
  notifyUserAdminReply,
};
