"use strict";

/**
 * Last-12-month property activity for Homeaversary emails.
 * Completed maintenance is the primary "tasks performed" source.
 */

const db = require("../db");
const { SYSTEM_LABELS } = require("../constants/propertyDataGapRules");

const MAX_TASK_TITLES = 5;
const WINDOW_MONTHS = 12;

const EMPTY_COPY = {
  homeowner:
    "Start logging maintenance in Opsy and next year’s Homeaversary will include your year in review.",
  agent:
    "No completed tasks logged yet — a check-in is a good way to start the year.",
};

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function windowStartFrom(now) {
  const when = now instanceof Date ? now : new Date();
  const start = new Date(when.getTime());
  start.setUTCMonth(start.getUTCMonth() - WINDOW_MONTHS);
  return start;
}

function humanizeSystemKey(systemKey) {
  const key = String(systemKey || "").trim();
  if (!key) return "";
  if (SYSTEM_LABELS[key]) return SYSTEM_LABELS[key];
  return key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function taskTitleFromRecord(row) {
  const description = String(row?.description || "").trim();
  if (description) return description;
  const recordType = String(row?.record_type || row?.recordType || "").trim();
  const system = humanizeSystemKey(row?.system_key || row?.systemKey);
  if (recordType && system) return `${recordType} · ${system}`;
  if (recordType) return recordType;
  if (system) return system;
  return "Maintenance";
}

function buildYearInReviewHtml(tasks, audience) {
  const rows = (tasks || []).slice(0, MAX_TASK_TITLES);
  if (!rows.length) {
    const copy = audience === "agent" ? EMPTY_COPY.agent : EMPTY_COPY.homeowner;
    return (
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
      `<tr><td style="font-size:14px; line-height:1.6; color:#3a3a3a; font-family:Georgia,'Times New Roman',Times,serif;">` +
      `${escapeHtml(copy)}</td></tr></table>`
    );
  }

  return rows
    .map((task, i) => {
      const title = escapeHtml(task.title || taskTitleFromRecord(task));
      const pad = i === rows.length - 1 ? "0" : "12px";
      return (
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
        `<td valign="top" width="18" style="padding-bottom:${pad}; color:#b8863b; font-size:14px; line-height:1.5;">&#10003;</td>` +
        `<td valign="top" style="padding-bottom:${pad}; font-size:14px; line-height:1.5; color:#2f2f2f; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">` +
        `${title}</td></tr></table>`
      );
    })
    .join("");
}

function buildMilestoneColumns({
  yearsOwned,
  streetLabel,
  tasksCompletedCount,
  documentsUploadedCount,
}) {
  const yearsNum = Number(yearsOwned);
  const years = Number.isFinite(yearsNum) && yearsNum > 0 ? yearsNum : 1;
  const street = String(streetLabel || "").trim() || "your home";
  const tasks = Number(tasksCompletedCount) || 0;
  const docs = Number(documentsUploadedCount) || 0;

  return {
    milestone1Title: `${years} Year${years === 1 ? "" : "s"}`,
    milestone1Body: `at ${street}`,
    milestone2Title: tasks > 0 ? String(tasks) : "Memories made",
    milestone2Body: tasks > 0 ? `task${tasks === 1 ? "" : "s"} completed` : "and more to come",
    milestone3Title: docs > 0 ? String(docs) : "Here for you",
    milestone3Body: docs > 0 ? `document${docs === 1 ? "" : "s"} added` : "every step of the way",
  };
}

function buildMilestoneHtml(columns) {
  const cell = (title, body, last) =>
    `<td width="33%" valign="top" style="padding:0 10px${last ? " 0 0" : ""}; ${
      last ? "" : "border-right:1px solid #e5e0d4;"
    } text-align:center;">` +
    `<p style="margin:0 0 4px; color:#1f3d36; font-size:16px; font-weight:700; font-family:Georgia,'Times New Roman',Times,serif;">${escapeHtml(
      title
    )}</p>` +
    `<p style="margin:0; color:#6b6560; font-size:12px; line-height:1.4; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${escapeHtml(
      body
    )}</p></td>`;

  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
    `<tr>` +
    cell(columns.milestone1Title, columns.milestone1Body, false) +
    cell(columns.milestone2Title, columns.milestone2Body, false) +
    cell(columns.milestone3Title, columns.milestone3Body, true) +
    `</tr></table>`
  );
}

function toMergeFields(review, { audience, yearsOwned, streetLabel } = {}) {
  const tasks = review?.tasks || [];
  const tasksCompletedCount = Number(review?.tasksCompletedCount) || 0;
  const documentsUploadedCount = Number(review?.documentsUploadedCount) || 0;
  const systemsServicedCount = Number(review?.systemsServicedCount) || 0;
  const columns = buildMilestoneColumns({
    yearsOwned,
    streetLabel,
    tasksCompletedCount,
    documentsUploadedCount,
  });

  return {
    tasksCompletedCount: String(tasksCompletedCount),
    documentsUploadedCount: String(documentsUploadedCount),
    systemsServicedCount: String(systemsServicedCount),
    hasYearInReview: tasksCompletedCount > 0 ? "true" : "",
    yearInReviewHtml: buildYearInReviewHtml(tasks, audience),
    milestoneHtml: buildMilestoneHtml(columns),
    ...columns,
  };
}

const EMPTY_REVIEW = {
  tasksCompletedCount: 0,
  documentsUploadedCount: 0,
  systemsServicedCount: 0,
  tasks: [],
};

async function loadYearInReview(propertyId, { query, now } = {}) {
  const id = Number(propertyId);
  if (!id || Number.isNaN(id)) return { ...EMPTY_REVIEW, tasks: [] };

  const run = query || ((sql, params) => db.query(sql, params));
  const windowStart = windowStartFrom(now);

  try {
    const [tasksRes, docsRes] = await Promise.all([
      run(
        `SELECT
            COUNT(*)::int AS tasks_completed,
            COUNT(DISTINCT system_key)::int AS systems_serviced
           FROM property_maintenance
          WHERE property_id = $1
            AND completed_at >= $2
            AND (
              LOWER(COALESCE(status, '')) = 'completed'
              OR record_status IN ('user_completed', 'contractor_completed')
            )`,
        [id, windowStart]
      ),
      run(
        `SELECT COUNT(*)::int AS documents_uploaded
           FROM property_documents
          WHERE property_id = $1
            AND created_at >= $2`,
        [id, windowStart]
      ),
    ]);

    const tasksCompletedCount = Number(tasksRes.rows[0]?.tasks_completed) || 0;
    const systemsServicedCount = Number(tasksRes.rows[0]?.systems_serviced) || 0;
    const documentsUploadedCount = Number(docsRes.rows[0]?.documents_uploaded) || 0;

    let tasks = [];
    if (tasksCompletedCount > 0) {
      const listRes = await run(
        `SELECT
            data->>'description' AS description,
            data->>'recordType' AS record_type,
            system_key,
            completed_at
           FROM property_maintenance
          WHERE property_id = $1
            AND completed_at >= $2
            AND (
              LOWER(COALESCE(status, '')) = 'completed'
              OR record_status IN ('user_completed', 'contractor_completed')
            )
          ORDER BY completed_at DESC
          LIMIT $3`,
        [id, windowStart, MAX_TASK_TITLES]
      );
      tasks = (listRes.rows || []).map((row) => ({
        title: taskTitleFromRecord(row),
        systemKey: row.system_key,
        completedAt: row.completed_at,
      }));
    }

    return {
      tasksCompletedCount,
      documentsUploadedCount,
      systemsServicedCount,
      tasks,
    };
  } catch (err) {
    console.warn("[homeaversary] year-in-review load failed:", err?.message);
    return { ...EMPTY_REVIEW, tasks: [] };
  }
}

function propertyStreetLabel(property) {
  const line1 = String(property?.address_line_1 || "").trim();
  if (line1) return line1;
  const full = String(property?.address || "").trim();
  if (full) return full.split(",")[0].trim() || full;
  return String(property?.property_name || "").trim() || "your home";
}

module.exports = {
  MAX_TASK_TITLES,
  EMPTY_COPY,
  EMPTY_REVIEW,
  taskTitleFromRecord,
  buildYearInReviewHtml,
  buildMilestoneColumns,
  buildMilestoneHtml,
  toMergeFields,
  loadYearInReview,
  propertyStreetLabel,
  windowStartFrom,
};
