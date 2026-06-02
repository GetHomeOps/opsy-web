"use strict";

const db = require("../db");
const { NotFoundError } = require("../expressError");

class Office {
  static _rowToApi(row) {
    if (!row) return null;
    return {
      id: row.id,
      agencyId: row.agencyId ?? row.agency_id,
      name: row.name,
      addressLine1: row.addressLine1 ?? row.address_line1,
      city: row.city,
      state: row.state,
      zip: row.zip,
      phone: row.phone,
      status: row.status,
      createdAt: row.createdAt ?? row.created_at,
      updatedAt: row.updatedAt ?? row.updated_at,
    };
  }

  static async getById(id) {
    const result = await db.query(
      `SELECT id, agency_id AS "agencyId", name, address_line1 AS "addressLine1",
              city, state, zip, phone, status, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM offices WHERE id = $1`,
      [id]
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundError(`Office not found: ${id}`);
    return Office._rowToApi(row);
  }

  static async listApprovedByAgency(agencyId, { limit = 200 } = {}) {
    return Office.searchApprovedByAgency(agencyId, { q: "", limit });
  }

  static async searchApprovedByAgency(agencyId, { q = "", limit = 50 } = {}) {
    const term = String(q || "").trim();
    const values = [agencyId, "approved"];
    let where = `agency_id = $1 AND status = $2`;
    if (term) {
      values.push(`%${term}%`);
      const i = values.length;
      where += ` AND (name ILIKE $${i} OR city ILIKE $${i} OR state ILIKE $${i})`;
    }
    values.push(Math.min(Number(limit) || 50, 100));
    const result = await db.query(
      `SELECT id, agency_id AS "agencyId", name, address_line1 AS "addressLine1",
              city, state, zip, phone, status
       FROM offices
       WHERE ${where}
       ORDER BY name ASC
       LIMIT $${values.length}`,
      values
    );
    return result.rows.map(Office._rowToApi);
  }

  static async createApproved(
    { agencyId, name, addressLine1, city, state, zip, phone },
    client = null
  ) {
    const run = client ? (text, params) => client.query(text, params) : db.query.bind(db);
    const result = await run(
      `INSERT INTO offices (agency_id, name, address_line1, city, state, zip, phone, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'approved')
       RETURNING id, agency_id AS "agencyId", name, city, state, status`,
      [agencyId, name, addressLine1 || null, city || null, state || null, zip || null, phone || null]
    );
    return Office._rowToApi(result.rows[0]);
  }

  static async findApprovedByName(agencyId, name, client = null) {
    const run = client ? (text, params) => client.query(text, params) : db.query.bind(db);
    const result = await run(
      `SELECT id, agency_id AS "agencyId", name, city, state, status
       FROM offices
       WHERE agency_id = $1 AND status = 'approved' AND LOWER(TRIM(name)) = LOWER(TRIM($2))
       LIMIT 1`,
      [agencyId, name]
    );
    return result.rows[0] ? Office._rowToApi(result.rows[0]) : null;
  }

  static async approve(id, client = null) {
    const run = client ? (text, params) => client.query(text, params) : db.query.bind(db);
    const result = await run(
      `UPDATE offices SET status = 'approved', updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, status`,
      [id]
    );
    if (!result.rows[0]) throw new NotFoundError(`Office not found: ${id}`);
    return result.rows[0];
  }

  static async update(id, fields = {}) {
    const allowed = ["name", "addressLine1", "city", "state", "zip", "phone"];
    const sets = [];
    const values = [];
    let idx = 1;

    for (const key of allowed) {
      if (fields[key] === undefined) continue;
      const col =
        key === "addressLine1"
          ? "address_line1"
          : key;
      sets.push(`${col} = $${idx}`);
      values.push(fields[key]);
      idx += 1;
    }

    if (sets.length === 0) {
      return Office.getById(id);
    }

    sets.push("updated_at = NOW()");
    values.push(id);
    const result = await db.query(
      `UPDATE offices SET ${sets.join(", ")}
       WHERE id = $${idx}
       RETURNING id, agency_id AS "agencyId", name, address_line1 AS "addressLine1",
                 city, state, zip, phone, status, created_at AS "createdAt", updated_at AS "updatedAt"`,
      values
    );
    if (!result.rows[0]) throw new NotFoundError(`Office not found: ${id}`);
    return Office._rowToApi(result.rows[0]);
  }
}

module.exports = Office;
