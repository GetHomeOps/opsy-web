"use strict";

/**
 * Create homeowner- and agent-facing Home Anniversary calendar series when a
 * property first gets a last_sale_date. Idempotent: a unique index plus an
 * existence check prevent duplicate series.
 */

const db = require("../db");
const MaintenanceEvent = require("../models/maintenanceEvent");

const SYSTEM_KEY = "homeAnniversary";
const HOMEOWNER_TITLE = "Home Anniversary";
const AGENT_NOTES =
  "Send a note or small gift celebrating their home purchase anniversary.";
const UNIQUE_VIOLATION = "23505";

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function toDateOnly(value) {
  if (value == null) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return null;
}

/**
 * Next upcoming anniversary of lastSaleDate (YYYY-MM-DD).
 * Feb 29 maps to Feb 28 on non-leap years. If that month/day this year is
 * before today, use next year.
 *
 * @param {string} lastSaleDateStr
 * @param {string} [todayStr] YYYY-MM-DD; defaults to UTC today
 * @returns {string|null}
 */
function nextAnniversaryDate(lastSaleDateStr, todayStr) {
  const sale = toDateOnly(lastSaleDateStr);
  if (!sale) return null;
  const today = todayStr || new Date().toISOString().slice(0, 10);
  const month = parseInt(sale.slice(5, 7), 10);
  const day = parseInt(sale.slice(8, 10), 10);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return null;

  function dateInYear(year) {
    let d = day;
    if (month === 2 && day === 29 && !isLeapYear(year)) d = 28;
    return `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  const thisYear = parseInt(today.slice(0, 4), 10);
  let candidate = dateInYear(thisYear);
  if (candidate < today) candidate = dateInYear(thisYear + 1);
  return candidate;
}

function ownerLabel(property) {
  const raw =
    String(property?.owner_name || "").trim() ||
    String(property?.occupant_name || "").trim() ||
    String(property?.property_name || "").trim() ||
    String(property?.address || "").trim() ||
    String(property?.address_line_1 || "").trim() ||
    "Homeowner";
  // "Home Anniversary — " is 20 chars; system_name is VARCHAR(100).
  return raw.length > 80 ? `${raw.slice(0, 79).trimEnd()}…` : raw;
}

/**
 * Create both anniversary series if last_sale_date is set and none exist yet.
 * Never throws — property create / ATTOM must not fail because of calendar writes.
 *
 * @param {number} propertyId
 * @param {{ createdByUserId?: number|null }} [opts]
 * @param {{ queryFn?: Function, createEvent?: Function }} [deps]
 */
async function ensureHomeAnniversaryEvents(propertyId, opts = {}, deps = {}) {
  const query = deps.queryFn || ((sql, params) => db.query(sql, params));
  const createEvent = deps.createEvent || ((data) => MaintenanceEvent.create(data));

  if (!propertyId) return { created: false, reason: "missing_property" };

  try {
    const propRes = await query(
      `SELECT id, last_sale_date, owner_name, occupant_name, property_name,
              address, address_line_1
         FROM properties WHERE id = $1`,
      [propertyId],
    );
    const property = propRes.rows[0];
    if (!property) return { created: false, reason: "property_missing" };

    const lastSale = toDateOnly(property.last_sale_date);
    if (!lastSale) return { created: false, reason: "no_last_sale_date" };

    const existing = await query(
      `SELECT audience FROM maintenance_events
        WHERE property_id = $1
          AND system_key = $2
          AND recurrence_parent_id IS NULL`,
      [propertyId, SYSTEM_KEY],
    );
    const have = new Set(existing.rows.map((r) => r.audience));
    const needsHomeowner = !have.has("homeowner");
    const needsAgent = !have.has("agent");
    if (!needsHomeowner && !needsAgent) {
      return { created: false, reason: "already_exists" };
    }

    const scheduledDate = nextAnniversaryDate(lastSale);
    if (!scheduledDate) return { created: false, reason: "invalid_date" };

    const owner = ownerLabel(property);
    const base = {
      property_id: propertyId,
      system_key: SYSTEM_KEY,
      scheduled_date: scheduledDate,
      recurrence_type: "annually",
      status: "scheduled",
      event_type: "homeAnniversary",
      created_by: opts.createdByUserId || null,
      email_reminder: false,
      message_enabled: false,
    };

    if (needsHomeowner) {
      await createEvent({
        ...base,
        audience: "homeowner",
        system_name: HOMEOWNER_TITLE,
      });
    }
    if (needsAgent) {
      await createEvent({
        ...base,
        audience: "agent",
        system_name: `Home Anniversary — ${owner}`,
        message_body: AGENT_NOTES,
      });
    }

    return { created: true, scheduledDate };
  } catch (err) {
    if (err?.code === UNIQUE_VIOLATION) {
      return { created: false, reason: "already_exists" };
    }
    console.error("[homeAnniversary] ensure failed:", err?.message);
    return { created: false, reason: "error" };
  }
}

module.exports = {
  SYSTEM_KEY,
  nextAnniversaryDate,
  ownerLabel,
  toDateOnly,
  ensureHomeAnniversaryEvents,
};
