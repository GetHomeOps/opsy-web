"use strict";

/**
 * Notifications for the AI inspection analysis review workflow.
 *
 * - notifyAdminsReviewReady: when a new analysis completes, alert every Super Admin
 *   (in-app bell + internal ops email) that a review is required.
 * - notifyCustomerApproved: when a Super Admin approves, notify the customer
 *   (in-app bell + email) that their results are ready.
 */

const db = require("../db");
const Notification = require("../models/notification");
const { sendOpsTeamInternalNotification, sendInspectionAnalysisReadyEmail } = require("./emailService");
const { APP_BASE_URL } = require("../config");

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function base() {
  return (APP_BASE_URL || "").replace(/\/$/, "");
}

/** Build a human-readable property address from a detail/queue row. */
function formatPropertyAddress(row) {
  const line =
    row.address ||
    [row.address_line_1, row.city, row.state, row.zip].filter(Boolean).join(", ");
  return (
    line ||
    row.property_name ||
    (row.property_uid ? `Property ${row.property_uid}` : `Property #${row.property_id}`)
  );
}

function reviewLink(row) {
  const b = base();
  const acct = (row.account_url || "").replace(/^\/+|\/+$/g, "");
  if (!b || !acct || !row.id) return b || "";
  return `${b}/${acct}/helpdesk/inspection-reviews/${row.id}`;
}

function propertyLink(row) {
  const b = base();
  const acct = (row.account_url || "").replace(/^\/+|\/+$/g, "");
  const uid = row.property_uid ? String(row.property_uid).trim() : "";
  if (!b || !acct || !uid) return b || "";
  return `${b}/${acct}/properties/${encodeURIComponent(uid)}`;
}

async function getSuperAdminIds() {
  const res = await db.query(`SELECT id FROM users WHERE role = 'super_admin' AND is_active = true`);
  return res.rows.map((r) => r.id);
}

async function getPropertyMemberIds(propertyId) {
  const res = await db.query(
    `SELECT user_id FROM property_users WHERE property_id = $1`,
    [propertyId]
  );
  return res.rows.map((r) => r.user_id);
}

/**
 * Alert Super Admins that a new inspection analysis needs review.
 * @param {object} detail - row from InspectionAnalysisResult.getReviewDetail(id)
 */
async function notifyAdminsReviewReady(detail) {
  if (!detail?.id) return;

  const propertyAddress = formatPropertyAddress(detail);
  const customerName = detail.uploader_name || detail.owner_name || "Customer";
  const link = reviewLink(detail);
  const title = `New inspection analysis to review — ${propertyAddress}`;

  // In-app bell for each Super Admin
  try {
    const adminIds = await getSuperAdminIds();
    for (const userId of adminIds) {
      await Notification.create({
        userId,
        type: "inspection_review_requested",
        title,
        propertyId: detail.property_id,
        inspectionAnalysisResultId: detail.id,
      }).catch((e) =>
        console.error("[inspectionReviewNotify] admin bell:", e.message)
      );
    }
  } catch (err) {
    console.error("[inspectionReviewNotify] super admin lookup:", err.message);
  }

  // Internal ops email
  const uploadedAt = detail.uploaded_at ? new Date(detail.uploaded_at).toLocaleString() : "";
  const inner = `
      <p style="font-size: 15px; color: #111827;">A new AI inspection analysis is ready for review.</p>
      <table style="border-collapse: collapse; font-size: 14px; margin: 12px 0;">
        <tr><td style="padding: 4px 12px 4px 0; color: #6b7280;">Property address</td><td>${escapeHtml(propertyAddress)}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #6b7280;">Customer</td><td>${escapeHtml(customerName)}${detail.uploader_email ? ` (${escapeHtml(detail.uploader_email)})` : ""}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #6b7280;">Inspection ID</td><td>#${escapeHtml(String(detail.id))} (job #${escapeHtml(String(detail.job_id))})</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #6b7280;">Uploaded</td><td>${escapeHtml(uploadedAt)}</td></tr>
        ${link ? `<tr><td style="padding: 4px 12px 4px 0; color: #6b7280;">Review page</td><td><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></td></tr>` : ""}
      </table>`;
  try {
    await sendOpsTeamInternalNotification({
      subject: `Inspection review needed: ${propertyAddress.slice(0, 90)}`,
      innerHtml: inner,
    });
  } catch (err) {
    console.error("[inspectionReviewNotify] ops email:", err.message);
  }
}

/**
 * Notify the customer that their reviewed analysis has been approved and is ready.
 * @param {object} detail - row from InspectionAnalysisResult.getReviewDetail(id)
 */
async function notifyCustomerApproved(detail) {
  if (!detail?.id) return;

  const propertyAddress = formatPropertyAddress(detail);
  const link = propertyLink(detail);
  const title = "Your inspection analysis is ready";

  // In-app bell for everyone on the property
  try {
    const memberIds = await getPropertyMemberIds(detail.property_id);
    for (const userId of memberIds) {
      await Notification.create({
        userId,
        type: "inspection_analysis_ready",
        title,
        propertyId: detail.property_id,
        inspectionAnalysisResultId: detail.id,
      }).catch((e) =>
        console.error("[inspectionReviewNotify] customer bell:", e.message)
      );
    }
  } catch (err) {
    console.error("[inspectionReviewNotify] property members lookup:", err.message);
  }

  // Email the uploader (the person who submitted the report)
  if (detail.uploader_email) {
    try {
      await sendInspectionAnalysisReadyEmail({
        to: detail.uploader_email,
        userName: detail.uploader_name || "",
        propertyLabel: propertyAddress,
        viewUrl: link,
        usage: { accountId: detail.account_id, userId: detail.uploader_id, emailType: "inspection_analysis_ready" },
      });
    } catch (err) {
      console.error("[inspectionReviewNotify] customer email:", err.message);
    }
  }
}

module.exports = {
  notifyAdminsReviewReady,
  notifyCustomerApproved,
  formatPropertyAddress,
};
