"use strict";

/**
 * Properties Helper
 *
 * - generatePassportId: STATE-ZIP-NNNNN passport id (e.g., TX-78701-38472).
 * - PROPERTY_UID_REGEX / isPropertyUid: 8-digit numeric public identifier.
 * - resolvePropertyId(db, raw): resolve a URL param to a numeric properties.id.
 *
 * Exports: generatePassportId, PROPERTY_UID_REGEX, isPropertyUid, resolvePropertyId
 */

const crypto = require("crypto");

/**
 * Public-facing property identifier shape.
 *
 * New properties use 8 numeric digits (leading zeros allowed). Anything matching
 * this exact shape is resolved against `properties.property_uid`. Other numeric
 * strings are treated as the internal `properties.id` primary key. Legacy
 * alphanumeric uids are no longer routable.
 *
 * 100M combinations; ambiguity with `properties.id` only begins past 10M rows.
 */
const PROPERTY_UID_REGEX = /^\d{8}$/;
const isPropertyUid = (raw) => PROPERTY_UID_REGEX.test(String(raw ?? ""));

/**
 * Generate a unique passport ID for a property.
 * Format: STATE-ZIP-NNNNN (e.g. TX-78701-38472).
 *
 * @param {Object} opts
 * @param {string} opts.state - State code (e.g. "TX", "tx")
 * @param {string} opts.zip  - Zip code (e.g. "78701", "78701-1234")
 * @returns {string} Unique passport ID
 */
function generatePassportId({ state, zip }) {
  const statePart = String(state || "")
    .trim()
    .toUpperCase()
    .slice(0, 2);
  const zipPart = String(zip || "")
    .trim()
    .replace(/\D/g, "")
    .slice(0, 5);
  const uniquePart = String(crypto.randomInt(10000, 100000));
  return [statePart, zipPart, uniquePart].filter(Boolean).join("-");
}

/**
 * Resolve a raw URL identifier to the numeric `properties.id`.
 *
 * - 8 digits → look up by `property_uid` (returns null if not found).
 * - Other digit-only string → parsed as primary-key id.
 * - Anything else → null (caller decides whether to 404 / forbid).
 *
 * @param {{ query: Function }} db - pg-style db client (must expose `.query(sql, params)`).
 * @param {string|number} raw      - identifier from the URL/body.
 * @returns {Promise<number|null>}
 */
async function resolvePropertyId(db, raw) {
  if (raw == null || raw === "") return null;
  const str = String(raw);
  if (PROPERTY_UID_REGEX.test(str)) {
    const result = await db.query(
      `SELECT id FROM properties WHERE property_uid = $1`,
      [str]
    );
    return result.rows[0]?.id ?? null;
  }
  if (/^\d+$/.test(str)) return parseInt(str, 10);
  return null;
}

module.exports = {
  generatePassportId,
  PROPERTY_UID_REGEX,
  isPropertyUid,
  resolvePropertyId,
};
