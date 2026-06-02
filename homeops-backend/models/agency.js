"use strict";

const db = require("../db");
const { NotFoundError } = require("../expressError");
const Office = require("./office");

class Agency {
  static _rowToApi(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      legalName: row.legalName ?? row.legal_name,
      website: row.website,
      addressLine1: row.addressLine1 ?? row.address_line1,
      city: row.city,
      state: row.state,
      phone: row.phone,
      logoUrl: row.logoUrl ?? row.logo_url,
      status: row.status,
      createdAt: row.createdAt ?? row.created_at,
      updatedAt: row.updatedAt ?? row.updated_at,
    };
  }

  static async getById(id) {
    const result = await db.query(
      `SELECT id, name, legal_name AS "legalName", website,
              address_line1 AS "addressLine1", city, state, phone,
              logo_url AS "logoUrl", status, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM agencies WHERE id = $1`,
      [id]
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundError(`Agency not found: ${id}`);
    return Agency._rowToApi(row);
  }

  static async searchApproved({ q = "", limit = 50 } = {}) {
    const term = String(q || "").trim();
    const values = ["approved"];
    let where = `status = $1`;
    if (term) {
      values.push(`%${term}%`);
      const i = values.length;
      where += ` AND (
        name ILIKE $${i} OR city ILIKE $${i} OR state ILIKE $${i} OR website ILIKE $${i}
      )`;
    }
    values.push(Math.min(Number(limit) || 50, 100));
    const result = await db.query(
      `SELECT id, name, legal_name AS "legalName", website,
              address_line1 AS "addressLine1", city, state, phone,
              logo_url AS "logoUrl", status
       FROM agencies
       WHERE ${where}
       ORDER BY name ASC
       LIMIT $${values.length}`,
      values
    );
    return result.rows.map(Agency._rowToApi);
  }

  static async createApproved({ name, legalName, website, addressLine1, city, state, phone, logoUrl }, client = null) {
    const run = client ? (text, params) => client.query(text, params) : db.query.bind(db);
    const result = await run(
      `INSERT INTO agencies (name, legal_name, website, address_line1, city, state, phone, logo_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'approved')
       RETURNING id, name, legal_name AS "legalName", website,
                 address_line1 AS "addressLine1", city, state, phone,
                 logo_url AS "logoUrl", status`,
      [name, legalName || null, website || null, addressLine1 || null, city || null, state || null, phone || null, logoUrl || null]
    );
    return Agency._rowToApi(result.rows[0]);
  }

  static async findApprovedByName(name, client = null) {
    const run = client ? (text, params) => client.query(text, params) : db.query.bind(db);
    const result = await run(
      `SELECT id, name, legal_name AS "legalName", website,
              address_line1 AS "addressLine1", city, state, phone,
              logo_url AS "logoUrl", status
       FROM agencies
       WHERE status = 'approved' AND LOWER(TRIM(name)) = LOWER(TRIM($1))
       LIMIT 1`,
      [name]
    );
    return result.rows[0] ? Agency._rowToApi(result.rows[0]) : null;
  }

  static _parseFilterList(value) {
    if (!value) return [];
    const raw = Array.isArray(value) ? value : [value];
    return raw
      .flatMap((v) => String(v).split(","))
      .map((s) => s.trim())
      .filter(Boolean);
  }

  /** Shared WHERE clause for admin list, count, and facets. */
  static _buildListFilters({
    q = "",
    status,
    statuses,
    states,
    cities,
    omitStates = false,
    omitCities = false,
  } = {}) {
    const values = [];
    const clauses = [];

    const statusList = Agency._parseFilterList(statuses?.length ? statuses : status);
    if (statusList.length === 1) {
      values.push(statusList[0]);
      clauses.push(`status = $${values.length}`);
    } else if (statusList.length > 1) {
      values.push(statusList);
      clauses.push(`status = ANY($${values.length}::text[])`);
    }

    const stateList = omitStates ? [] : Agency._parseFilterList(states);
    if (stateList.length > 0) {
      values.push(stateList);
      clauses.push(`state = ANY($${values.length}::text[])`);
    }

    const cityList = omitCities ? [] : Agency._parseFilterList(cities);
    if (cityList.length > 0) {
      values.push(cityList);
      clauses.push(`city = ANY($${values.length}::text[])`);
    }

    const term = String(q || "").trim();
    if (term) {
      values.push(`%${term}%`);
      const i = values.length;
      clauses.push(`(
        name ILIKE $${i} OR legal_name ILIKE $${i} OR city ILIKE $${i} OR state ILIKE $${i} OR website ILIKE $${i}
      )`);
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    return { where, values };
  }

  static _resolveSort(sortBy = "name", sortDir = "asc") {
    const columns = {
      name: "name",
      legalName: "legal_name",
      city: "city",
      website: "website",
      status: "status",
    };
    const col = columns[sortBy] || "name";
    const dir = String(sortDir).toLowerCase() === "desc" ? "DESC" : "ASC";
    return `${col} ${dir}`;
  }

  static async countAll(filters = {}) {
    const { where, values } = Agency._buildListFilters(filters);
    const result = await db.query(
      `SELECT COUNT(*)::int AS count FROM agencies ${where}`,
      values
    );
    return result.rows[0]?.count ?? 0;
  }

  static async listDistinctStates(filters = {}) {
    const { where, values } = Agency._buildListFilters({
      ...filters,
      omitStates: true,
    });
    const and = where ? `${where} AND` : "WHERE";
    const result = await db.query(
      `SELECT DISTINCT state AS value
       FROM agencies
       ${and} state IS NOT NULL AND TRIM(state) <> ''
       ORDER BY value ASC
       LIMIT 500`,
      values
    );
    return result.rows.map((r) => r.value);
  }

  static async listDistinctCities(filters = {}) {
    const { where, values } = Agency._buildListFilters({
      ...filters,
      omitCities: true,
    });
    const and = where ? `${where} AND` : "WHERE";
    const result = await db.query(
      `SELECT DISTINCT city AS value
       FROM agencies
       ${and} city IS NOT NULL AND TRIM(city) <> ''
       ORDER BY value ASC
       LIMIT 500`,
      values
    );
    return result.rows.map((r) => r.value);
  }

  static async listAll({
    q = "",
    status,
    statuses,
    states,
    cities,
    sortBy = "name",
    sortDir = "asc",
    limit = 100,
    offset = 0,
  } = {}) {
    const { where, values } = Agency._buildListFilters({
      q,
      status,
      statuses,
      states,
      cities,
    });
    const orderBy = Agency._resolveSort(sortBy, sortDir);
    const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);
    const safeOffset = Math.max(Number(offset) || 0, 0);
    values.push(safeLimit);
    const limitIdx = values.length;
    values.push(safeOffset);
    const offsetIdx = values.length;
    const result = await db.query(
      `SELECT id, name, legal_name AS "legalName", website,
              city, state, logo_url AS "logoUrl", status
       FROM agencies
       ${where}
       ORDER BY ${orderBy}
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      values
    );
    return result.rows.map(Agency._rowToApi);
  }

  /** Create approved agency + default main office (for admin import / manual add). */
  static async createApprovedWithDefaultOffice(
    { name, legalName, website, addressLine1, city, state, phone, logoUrl, officeName },
    client = null
  ) {
    const run = client ? (text, params) => client.query(text, params) : db.query.bind(db);
    const dbClient = client ? null : await db.connect();
    const conn = client || dbClient;
    try {
      if (!client) await conn.query("BEGIN");
      const agency = await Agency.createApproved(
        { name, legalName, website, addressLine1, city, state, phone, logoUrl },
        conn
      );
      const office = await Office.createApproved(
        {
          agencyId: agency.id,
          name: officeName || `${name} — Main Office`,
          city: city || null,
          state: state || null,
          phone: phone || null,
        },
        conn
      );
      if (!client) await conn.query("COMMIT");
      return { agency, office };
    } catch (err) {
      if (!client) await conn.query("ROLLBACK");
      throw err;
    } finally {
      if (dbClient) dbClient.release();
    }
  }

  static async update(id, fields = {}) {
    const allowed = ["name", "legalName", "website", "addressLine1", "city", "state", "phone", "logoUrl"];
    const sets = [];
    const values = [];
    let idx = 1;

    for (const key of allowed) {
      if (fields[key] === undefined) continue;
      const col =
        key === "legalName"
          ? "legal_name"
          : key === "logoUrl"
            ? "logo_url"
            : key === "addressLine1"
              ? "address_line1"
              : key;
      sets.push(`${col} = $${idx}`);
      values.push(fields[key]);
      idx += 1;
    }

    if (sets.length === 0) {
      return Agency.getById(id);
    }

    sets.push("updated_at = NOW()");
    values.push(id);
    const result = await db.query(
      `UPDATE agencies SET ${sets.join(", ")}
       WHERE id = $${idx}
       RETURNING id, name, legal_name AS "legalName", website,
                 address_line1 AS "addressLine1", city, state, phone,
                 logo_url AS "logoUrl", status, created_at AS "createdAt", updated_at AS "updatedAt"`,
      values
    );
    if (!result.rows[0]) throw new NotFoundError(`Agency not found: ${id}`);
    return Agency._rowToApi(result.rows[0]);
  }

  static async approve(id, client = null) {
    const run = client ? (text, params) => client.query(text, params) : db.query.bind(db);
    const result = await run(
      `UPDATE agencies SET status = 'approved', updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, status`,
      [id]
    );
    if (!result.rows[0]) throw new NotFoundError(`Agency not found: ${id}`);
    return result.rows[0];
  }
}

module.exports = Agency;
