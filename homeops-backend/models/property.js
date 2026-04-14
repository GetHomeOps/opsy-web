"use strict";

/**
 * Property Model
 *
 * Manages properties in the `properties` table. Properties represent real estate
 * units with detailed attributes (address, specs, schools, etc.) and support
 * multi-user access via property_users.
 *
 * Key operations:
 * - create / get / getAll: CRUD for properties
 * - getPropertiesByAccountId / getPropertiesByUserId: Filter by account or user
 * - addUserToProperty / updatePropertyUsers: Manage property team access
 * - getPropertyTeam / getAgentByAccountId: Retrieve team/agent data
 */

const { customAlphabet } = require("nanoid");

/** Generate readable property UIDs: uppercase + digits only, no ambiguous chars (0/O, 1/l/I) */
const genPropertyUid = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 8);
const db = require("../db");
const { BadRequestError, NotFoundError } = require("../expressError");
const { generatePassportId } = require("../helpers/properties");
const { sqlForPartialUpdate } = require("../helpers/sql");

/**
 * Columns returned by list endpoints (getAll, getPropertiesByUserId, etc.).
 * Omits heavy/unused-for-lists columns: effective_year_built_source, sq_ft_unfinished,
 * sq_ft_source, lot_size_source, lot_dim, price_per_sq_ft, total_price_per_sq_ft,
 * phone_to_show, roof_type, school_district_websites, list_date, expire_date,
 * identity_data_source, identity_lookup_populated_keys, address_line_2,
 * created_at, updated_at.
 * Includes identity fields needed by the frontend computeHpsScore fallback.
 */
const PROPERTY_LIST_COLUMNS = `
  p.id, p.property_uid, p.account_id,
  p.passport_id, p.property_name, p.main_photo, p.hps_score,
  p.tax_id, p.county,
  p.address, p.address_line_1, p.city, p.state, p.zip,
  p.owner_name, p.owner_name_2, p.owner_city,
  p.occupant_name, p.occupant_type, p.owner_phone,
  p.property_type, p.sub_type, p.year_built, p.effective_year_built,
  p.sq_ft_total, p.sq_ft_finished, p.garage_sq_ft,
  p.total_dwelling_sq_ft, p.lot_size,
  p.bed_count, p.bath_count, p.full_baths,
  p.three_quarter_baths, p.half_baths,
  p.number_of_showers, p.number_of_bathtubs,
  p.fireplaces, p.fireplace_types,
  p.basement, p.parking_type,
  p.total_covered_parking, p.total_uncovered_parking,
  p.school_district, p.elementary_school,
  p.junior_high_school, p.senior_high_school`;

/** True when the property team includes a user whose platform role is agent, admin, or super_admin (Opsy agent). */
const PROPERTY_LIST_HAS_OPSY_AGENT = `EXISTS (
  SELECT 1
  FROM property_users pu_has_opsy_agent
  INNER JOIN users u_has_opsy_agent ON u_has_opsy_agent.id = pu_has_opsy_agent.user_id
  WHERE pu_has_opsy_agent.property_id = p.id
    AND u_has_opsy_agent.role IN ('agent', 'admin', 'super_admin')
) AS has_opsy_agent`;

/** Insertable columns for properties (matches opsy-schema.sql; excludes id, created_at, updated_at) */
const PROPERTY_INSERT_COLUMNS = [
  "property_uid",
  "account_id",
  "passport_id", "property_name", "main_photo", "tax_id", "county",
  "address", "address_line_1", "address_line_2", "city", "state", "zip",
  "owner_name", "owner_name_2", "owner_city", "occupant_name", "occupant_type",
  "owner_phone", "phone_to_show", "property_type", "sub_type", "roof_type",
  "year_built", "effective_year_built", "effective_year_built_source",
  "sq_ft_total", "sq_ft_finished", "sq_ft_unfinished", "garage_sq_ft",
  "total_dwelling_sq_ft", "sq_ft_source", "lot_size", "lot_size_source",
  "lot_dim", "price_per_sq_ft", "total_price_per_sq_ft",
  "bed_count", "bath_count", "full_baths", "three_quarter_baths", "half_baths",
  "number_of_showers", "number_of_bathtubs", "fireplaces", "fireplace_types",
  "basement", "parking_type", "total_covered_parking", "total_uncovered_parking",
  "school_district", "elementary_school", "junior_high_school", "senior_high_school",
  "school_district_websites", "list_date", "expire_date",
  "identity_data_source",
  "identity_lookup_populated_keys",
];

/** Integer columns – coerce string to int; default 0 when missing/invalid */
const PROPERTY_INTEGER_COLUMNS = new Set([
  "year_built", "effective_year_built", "bed_count", "bath_count", "full_baths",
  "three_quarter_baths", "half_baths", "number_of_showers", "number_of_bathtubs",
  "fireplaces", "total_covered_parking", "total_uncovered_parking",
]);
/** Numeric (decimal) columns – coerce string to number; default 0 when missing/invalid */
const PROPERTY_NUMBER_COLUMNS = new Set([
  "sq_ft_total", "sq_ft_finished", "sq_ft_unfinished", "garage_sq_ft", "total_dwelling_sq_ft",
]);

const DEFAULT_YEAR = 0;  // use 0 for unknown year; set to e.g. new Date().getFullYear() for "current year"

/**
 * node-pg encodes JavaScript arrays as Postgres array literals (e.g. {a,b}), which are invalid for JSONB.
 * Bind a JSON text value so PostgreSQL accepts the column assignment.
 */
function normalizeIdentityLookupPopulatedKeys(val) {
  if (val === undefined || val === null || val === "") return null;
  let arr = val;
  if (typeof val === "string") {
    try {
      arr = JSON.parse(val);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(arr)) return null;
  const strings = arr
    .map((x) => (typeof x === "string" ? x : x == null ? "" : String(x)))
    .map((s) => s.trim())
    .filter(Boolean);
  return JSON.stringify(strings);
}

function coerceValue(key, val) {
  if (val === undefined || val === null || val === "") return null;
  if (key === "identity_lookup_populated_keys") {
    return normalizeIdentityLookupPopulatedKeys(val);
  }
  if (PROPERTY_INTEGER_COLUMNS.has(key)) {
    const n = Number(val);
    return Number.isNaN(n) ? DEFAULT_YEAR : Math.floor(n);
  }
  if (PROPERTY_NUMBER_COLUMNS.has(key)) {
    const n = Number(val);
    return Number.isNaN(n) ? 0 : n;
  }
  return val;
}

class Property {
  /* Get all properties */
  static async getAll() {
    const result = await db.query(
      `SELECT ${PROPERTY_LIST_COLUMNS}, ${PROPERTY_LIST_HAS_OPSY_AGENT}, owner_sub.name AS owner_user_name
       FROM properties p
       LEFT JOIN (
         SELECT DISTINCT ON (pu.property_id)
           pu.property_id, u.name
         FROM property_users pu
         JOIN users u ON u.id = pu.user_id
         ORDER BY pu.property_id,
           CASE WHEN pu.role = 'owner' THEN 0 ELSE 1 END,
           pu.created_at
       ) owner_sub ON owner_sub.property_id = p.id`
    );
    return result.rows;
  }

  /* Create a new property from provided data (any subset of columns) */
  static async create(data = {}) {
    const withUid = { ...data, property_uid: data.property_uid || genPropertyUid() };
    if (!withUid.passport_id && withUid.state != null && withUid.zip != null) {
      withUid.passport_id = generatePassportId({ state: withUid.state, zip: withUid.zip });
    }
    const keys = Object.keys(withUid).filter((k) => PROPERTY_INSERT_COLUMNS.includes(k));
    if (keys.length === 0) {
      throw new BadRequestError("No valid property data provided");
    }
    const values = keys.map((k) => (k === "property_uid" ? withUid.property_uid : coerceValue(k, withUid[k])));
    const cols = keys.map((k) => `"${k}"`).join(", ");
    const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
    const result = await db.query(
      `INSERT INTO properties (${cols})
       VALUES (${placeholders})
       RETURNING id, property_uid, passport_id, account_id, address, city, state, zip`,
      values
    );
    return result.rows[0];
  }

  /* Add user to property (upsert: update role if already exists) */
  static async addUserToProperty({ property_id, user_id, role = 'editor' }) {
    const result = await db.query(
      `INSERT INTO property_users (property_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (property_id, user_id) DO UPDATE SET role = EXCLUDED.role, updated_at = NOW()
       RETURNING property_id, user_id, role`,
      [property_id, user_id, role]
    );
    return result.rows[0];
  }

  /* Get property by property uid or numeric id */
  static async get(uid) {
    try {
      const isNumeric = /^\d+$/.test(String(uid));
      const result = await db.query(
        isNumeric
          ? `SELECT * FROM properties WHERE id = $1`
          : `SELECT * FROM properties WHERE property_uid = $1`,
        [isNumeric ? parseInt(uid, 10) : uid]
      );
      const property = result.rows[0];
      if (!property) throw new NotFoundError(`No property with uid: ${uid}`);
      return property;
    } catch (err) {
      throw err;
    }
  }

  /* Get agents/admins for an account */
  static async getAgentByAccountId(accountId) {
    const result = await db.query(
      `SELECT u.id,
              u.email,
              u.name,
              u.phone,
              u.role
       FROM account_users au
       JOIN users u ON u.id = au.user_id
       WHERE au.account_id = $1 AND (u.role = 'agent' OR au.role = 'admin')
       ORDER BY u.name`,
      [accountId]
    );
    return result.rows;
  }

  /* Get properties by account id */
  static async getPropertiesByAccountId(accountId) {
    const result = await db.query(
      `SELECT ${PROPERTY_LIST_COLUMNS}, ${PROPERTY_LIST_HAS_OPSY_AGENT}, owner_sub.name AS owner_user_name
       FROM properties p
       LEFT JOIN (
         SELECT DISTINCT ON (pu.property_id)
           pu.property_id, u.name
         FROM property_users pu
         JOIN users u ON u.id = pu.user_id
         ORDER BY pu.property_id,
           CASE WHEN pu.role = 'owner' THEN 0 ELSE 1 END,
           pu.created_at
       ) owner_sub ON owner_sub.property_id = p.id
       WHERE p.account_id = $1`,
      [accountId]
    );
    return result.rows;
  }

  /* Get properties by users's id */
  static async getPropertiesByUserId(userId) {
    const result = await db.query(
      `SELECT ${PROPERTY_LIST_COLUMNS}, owner_sub.name AS owner_user_name,
              pu.role AS property_role,
              ${PROPERTY_LIST_HAS_OPSY_AGENT}
       FROM properties p
       JOIN property_users pu ON p.id = pu.property_id
       LEFT JOIN (
         SELECT DISTINCT ON (pu2.property_id)
           pu2.property_id, u.name
         FROM property_users pu2
         JOIN users u ON u.id = pu2.user_id
         ORDER BY pu2.property_id,
           CASE WHEN pu2.role = 'owner' THEN 0 ELSE 1 END,
           pu2.created_at
       ) owner_sub ON owner_sub.property_id = p.id
       WHERE pu.user_id = $1`,
      [userId]
    );
    return result.rows;
  }

  /* Get properties where the user has a pending invitation (not yet in property_users) */
  static async getPropertiesWithPendingInvitations(userEmail) {
    const result = await db.query(
      `SELECT DISTINCT ON (p.id)
        ${PROPERTY_LIST_COLUMNS},
        ${PROPERTY_LIST_HAS_OPSY_AGENT},
        i.id AS _invitation_id,
        i.intended_role AS _invitation_role,
        i.expires_at AS _invitation_expires_at,
        owner_sub.name AS owner_user_name
       FROM properties p
       JOIN invitations i ON i.property_id = p.id
       LEFT JOIN (
         SELECT DISTINCT ON (pu.property_id)
           pu.property_id, u.name
         FROM property_users pu
         JOIN users u ON u.id = pu.user_id
         ORDER BY pu.property_id,
           CASE WHEN pu.role = 'owner' THEN 0 ELSE 1 END,
           pu.created_at
       ) owner_sub ON owner_sub.property_id = p.id
       WHERE LOWER(i.invitee_email) = LOWER($1)
         AND i.type = 'property'
         AND i.status = 'pending'
         AND i.expires_at > NOW()
       ORDER BY p.id, i.created_at DESC`,
      [userEmail]
    );
    return result.rows;
  }

  /* Get team for property: returns actual user records with their role on this property */
  static async getPropertyTeam(propertyId) {
    const result = await db.query(
      `SELECT u.id, u.email, u.name, u.phone, u.role, u.is_active, u.contact_id, u.image, u.avatar_url,
              pu.role AS property_role
       FROM property_users pu
       JOIN users u ON u.id = pu.user_id
       WHERE pu.property_id = $1
       ORDER BY u.name`,
      [propertyId]
    );
    return result.rows;
  }

  /* Update property */
  static async updateProperty(id, data) {
    const payload = { ...data };
    if (Object.prototype.hasOwnProperty.call(payload, "identity_lookup_populated_keys")) {
      payload.identity_lookup_populated_keys = normalizeIdentityLookupPopulatedKeys(
        payload.identity_lookup_populated_keys
      );
    }
    const { setCols, values } = sqlForPartialUpdate(payload, {
      passport_id: "passport_id",
      property_name: "property_name",
      main_photo: "main_photo",
      tax_id: "tax_id",
      county: "county",
      address: "address",
      address_line_1: "address_line_1",
      address_line_2: "address_line_2",
      city: "city",
      state: "state",
      zip: "zip",
      owner_name: "owner_name",
      owner_name_2: "owner_name_2",
      owner_city: "owner_city",
      occupant_name: "occupant_name",
      occupant_type: "occupant_type",
      owner_phone: "owner_phone",
      phone_to_show: "phone_to_show",
      property_type: "property_type",
      sub_type: "sub_type",
      roof_type: "roof_type",
      year_built: "year_built",
      effective_year_built: "effective_year_built",
      effective_year_built_source: "effective_year_built_source",
      sq_ft_total: "sq_ft_total",
      sq_ft_finished: "sq_ft_finished",
      sq_ft_unfinished: "sq_ft_unfinished",
      garage_sq_ft: "garage_sq_ft",
      total_dwelling_sq_ft: "total_dwelling_sq_ft",
      sq_ft_source: "sq_ft_source",
      lot_size: "lot_size",
      lot_size_source: "lot_size_source",
      lot_dim: "lot_dim",
      price_per_sq_ft: "price_per_sq_ft",
      total_price_per_sq_ft: "total_price_per_sq_ft",
      bed_count: "bed_count",
      bath_count: "bath_count",
      full_baths: "full_baths",
      three_quarter_baths: "three_quarter_baths",
      half_baths: "half_baths",
      number_of_showers: "number_of_showers",
      number_of_bathtubs: "number_of_bathtubs",
      fireplaces: "fireplaces",
      fireplace_types: "fireplace_types",
      basement: "basement",
      parking_type: "parking_type",
      total_covered_parking: "total_covered_parking",
      total_uncovered_parking: "total_uncovered_parking",
      school_district: "school_district",
      elementary_school: "elementary_school",
      junior_high_school: "junior_high_school",
      senior_high_school: "senior_high_school",
      school_district_websites: "school_district_websites",
      list_date: "list_date",
      expire_date: "expire_date",
      identity_lookup_populated_keys: "identity_lookup_populated_keys",
    });
    const idVarIdx = "$" + (values.length + 1);

    const querySql = `UPDATE properties
                      SET ${setCols}
                      WHERE id = ${idVarIdx}
                      RETURNING *`;
    const result = await db.query(querySql, [...values, id]);
    const property = result.rows[0];

    if (!property) throw new NotFoundError(`No property: ${id}`);

    return property;
  }

  /** Delete a property by id or property_uid. Clears invitations.property_id first (FK has no CASCADE). */
  static async remove(uid) {
    const property = await Property.get(uid);
    const id = property.id;
    await db.query(
      `UPDATE invitations SET property_id = NULL WHERE property_id = $1`,
      [id]
    );
    await db.query(`DELETE FROM properties WHERE id = $1`, [id]);
    return { deleted: true, id };
  }

  /** Sync property_users to the given array of users.
   *  1. Load current (property_id, user_id) pairs for this property.
   *  2. Diff: remove pairs that are not in the new array; add/update pairs that are in the new array.
   *  Preserves created_at for users that stay; only DELETE removed, INSERT/UPDATE the rest.
   *
   *  Time: O(M + N) — M = current rows for property, N = desired list size. Constant 3–4 queries.
   *
   *  @param {number} propertyId - internal property id
   *  @param {Array<{ id: number, role?: string }>} users - desired team (id = user_id, role defaults to 'editor')
   *  @returns {Promise<Array>} rows from property_users for this property after sync
   */
  static async updatePropertyUsers(propertyId, users) {
    if (!Array.isArray(users)) throw new BadRequestError("users must be an array");
    const ALLOWED_ROLES = ["owner", "editor", "viewer"];
    const normalizeRole = (r) => (ALLOWED_ROLES.includes(r) ? r : "editor");

    const byId = new Map();
    for (const u of users) byId.set(u.id, u);
    const uniqueUsers = Array.from(byId.values());
    const newIds = new Set(uniqueUsers.map((u) => u.id));

    await db.query("BEGIN");
    try {
      const current = await db.query(
        "SELECT user_id FROM property_users WHERE property_id = $1",
        [propertyId]
      );
      const currentIds = new Set(current.rows.map((r) => r.user_id));
      const toRemove = [...currentIds].filter((id) => !newIds.has(id));

      if (toRemove.length > 0) {
        await db.query(
          "DELETE FROM property_users WHERE property_id = $1 AND user_id = ANY($2::int[])",
          [propertyId, toRemove]
        );
      }

      if (uniqueUsers.length === 0) {
        await db.query("COMMIT");
        return [];
      }

      const placeholders = uniqueUsers.map((_, i) => `($1, $${2 + i * 2}, $${3 + i * 2})`).join(", ");
      const values = [propertyId, ...uniqueUsers.flatMap((u) => [u.id, normalizeRole(u.role || "editor")])];
      const result = await db.query(
        `INSERT INTO property_users (property_id, user_id, role)
         VALUES ${placeholders}
         ON CONFLICT (property_id, user_id) DO UPDATE SET role = EXCLUDED.role, updated_at = NOW()
         RETURNING property_id, user_id, role`,
        values
      );
      await db.query("COMMIT");
      return result.rows;
    } catch (err) {
      await db.query("ROLLBACK");
      throw err;
    }
  }
}

module.exports = Property;
