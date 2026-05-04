"use strict";

/**
 * Backfill missing child rows for recurring maintenance_events that were
 * created before recurrence expansion was implemented. Safe to run repeatedly.
 */
const db = require("../db");

function toDateOnly(value) {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function formatYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function computeOccurrenceDates(
  startDateStr,
  recurrenceType,
  intervalValue = null,
  intervalUnit = null,
  { maxOccurrences = 60, maxHorizonMonths = 60 } = {},
) {
  if (!recurrenceType || recurrenceType === "one-time") return [];
  const start = new Date(`${String(startDateStr).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(start.getTime())) return [];

  const horizon = new Date(start);
  horizon.setMonth(horizon.getMonth() + maxHorizonMonths);

  const occurrences = [];
  const cursor = new Date(start);

  for (let i = 0; i < maxOccurrences; i += 1) {
    if (recurrenceType === "quarterly") cursor.setMonth(cursor.getMonth() + 3);
    else if (recurrenceType === "semi-annually") cursor.setMonth(cursor.getMonth() + 6);
    else if (recurrenceType === "annually") cursor.setFullYear(cursor.getFullYear() + 1);
    else if (recurrenceType === "custom") {
      const value = parseInt(intervalValue, 10);
      if (!Number.isFinite(value) || value < 1) break;
      if (intervalUnit === "days") cursor.setDate(cursor.getDate() + value);
      else if (intervalUnit === "weeks") cursor.setDate(cursor.getDate() + value * 7);
      else if (intervalUnit === "months") cursor.setMonth(cursor.getMonth() + value);
      else break;
    } else break;

    if (cursor > horizon) break;
    occurrences.push(formatYMD(cursor));
  }
  return occurrences;
}

async function run() {
  const parents = await db.query(
    `SELECT *
       FROM maintenance_events
      WHERE recurrence_parent_id IS NULL
        AND recurrence_type IS NOT NULL
        AND recurrence_type <> 'one-time'
      ORDER BY id ASC`,
  );

  let inserted = 0;
  for (const parent of parents.rows) {
    const dates = computeOccurrenceDates(
      toDateOnly(parent.scheduled_date),
      parent.recurrence_type,
      parent.recurrence_interval_value,
      parent.recurrence_interval_unit,
    );

    for (const scheduledDate of dates) {
      const res = await db.query(
        `INSERT INTO maintenance_events
           (property_id, system_key, system_name,
            contractor_id, contractor_source, contractor_name,
            scheduled_date, scheduled_time,
            recurrence_type, recurrence_interval_value, recurrence_interval_unit,
            recurrence_parent_id,
            alert_timing, alert_custom_days, email_reminder,
            message_enabled, message_body,
            status, event_type, timezone, checklist_item_id, created_by)
         SELECT
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
            false,NULL,$16,$17,$18,NULL,$19
         WHERE NOT EXISTS (
           SELECT 1
             FROM maintenance_events
            WHERE recurrence_parent_id = $12
              AND scheduled_date = $7
         )
         RETURNING id`,
        [
          parent.property_id,
          parent.system_key,
          parent.system_name,
          parent.contractor_id,
          parent.contractor_source,
          parent.contractor_name,
          scheduledDate,
          parent.scheduled_time,
          parent.recurrence_type,
          parent.recurrence_interval_value,
          parent.recurrence_interval_unit,
          parent.id,
          parent.alert_timing,
          parent.alert_custom_days,
          parent.email_reminder,
          parent.status,
          parent.event_type,
          parent.timezone,
          parent.created_by,
        ],
      );
      inserted += res.rows.length;
    }
  }

  // eslint-disable-next-line no-console
  console.log(`Backfilled ${inserted} recurring maintenance event occurrence(s).`);
  process.exit(0);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
