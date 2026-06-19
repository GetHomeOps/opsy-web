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
const {
  sendHelpdeskInspectionReviewCreatedEmail,
  sendInspectionAnalysisReadyEmail,
} = require("./emailService");
const { APP_BASE_URL } = require("../config");

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

  // Internal ops email (kino@heyopsy.com + dev@heyopsy.com)
  try {
    await sendHelpdeskInspectionReviewCreatedEmail(detail);
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
