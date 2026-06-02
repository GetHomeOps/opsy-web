"use strict";

const db = require("../db");
const { NotFoundError } = require("../expressError");

class Team {
  static _rowToApi(row) {
    if (!row) return null;
    return {
      id: row.id,
      officeId: row.officeId ?? row.office_id,
      name: row.name,
      status: row.status,
      createdAt: row.createdAt ?? row.created_at,
      updatedAt: row.updatedAt ?? row.updated_at,
    };
  }

  static async getById(id) {
    const result = await db.query(
      `SELECT id, office_id AS "officeId", name, status,
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM teams WHERE id = $1`,
      [id]
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundError(`Team not found: ${id}`);
    return Team._rowToApi(row);
  }

  static async listApprovedByAgency(agencyId, { q = "", limit = 200 } = {}) {
    const term = String(q || "").trim();
    const values = [agencyId, "approved", "approved"];
    let where = `o.agency_id = $1 AND t.status = $2 AND o.status = $3`;
    if (term) {
      values.push(`%${term}%`);
      const i = values.length;
      where += ` AND (t.name ILIKE $${i} OR o.name ILIKE $${i})`;
    }
    values.push(Math.min(Number(limit) || 200, 500));
    const result = await db.query(
      `SELECT t.id, t.office_id AS "officeId", t.name, t.status,
              o.name AS "officeName"
       FROM teams t
       INNER JOIN offices o ON o.id = t.office_id
       WHERE ${where}
       ORDER BY o.name ASC, t.name ASC
       LIMIT $${values.length}`,
      values
    );
    return result.rows.map((row) => ({
      id: row.id,
      officeId: row.officeId,
      name: row.name,
      status: row.status,
      officeName: row.officeName,
    }));
  }

  static async searchApprovedByOffice(officeId, { q = "", limit = 50 } = {}) {
    const term = String(q || "").trim();
    const values = [officeId, "approved"];
    let where = `office_id = $1 AND status = $2`;
    if (term) {
      values.push(`%${term}%`);
      where += ` AND name ILIKE $${values.length}`;
    }
    values.push(Math.min(Number(limit) || 50, 100));
    const result = await db.query(
      `SELECT id, office_id AS "officeId", name, status
       FROM teams
       WHERE ${where}
       ORDER BY name ASC
       LIMIT $${values.length}`,
      values
    );
    return result.rows.map(Team._rowToApi);
  }

  static async createApproved({ officeId, name }, client = null) {
    const run = client ? (text, params) => client.query(text, params) : db.query.bind(db);
    const result = await run(
      `INSERT INTO teams (office_id, name, status)
       VALUES ($1, $2, 'approved')
       RETURNING id, office_id AS "officeId", name, status`,
      [officeId, name]
    );
    return Team._rowToApi(result.rows[0]);
  }

  static async findApprovedByName(officeId, name, client = null) {
    const run = client ? (text, params) => client.query(text, params) : db.query.bind(db);
    const result = await run(
      `SELECT id, office_id AS "officeId", name, status
       FROM teams
       WHERE office_id = $1 AND status = 'approved' AND LOWER(TRIM(name)) = LOWER(TRIM($2))
       LIMIT 1`,
      [officeId, name]
    );
    return result.rows[0] ? Team._rowToApi(result.rows[0]) : null;
  }

  static async approve(id, client = null) {
    const run = client ? (text, params) => client.query(text, params) : db.query.bind(db);
    const result = await run(
      `UPDATE teams SET status = 'approved', updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, status`,
      [id]
    );
    if (!result.rows[0]) throw new NotFoundError(`Team not found: ${id}`);
    return result.rows[0];
  }

  static async update(id, fields = {}) {
    const sets = [];
    const values = [];
    let idx = 1;

    if (fields.name !== undefined) {
      sets.push(`name = $${idx}`);
      values.push(fields.name);
      idx += 1;
    }
    if (fields.officeId !== undefined) {
      sets.push(`office_id = $${idx}`);
      values.push(fields.officeId);
      idx += 1;
    }

    if (sets.length === 0) {
      const existing = await Team.getById(id);
      const office = await db.query(`SELECT name FROM offices WHERE id = $1`, [existing.officeId]);
      return {
        ...existing,
        officeName: office.rows[0]?.name || null,
      };
    }

    sets.push("updated_at = NOW()");
    values.push(id);
    const result = await db.query(
      `UPDATE teams SET ${sets.join(", ")}
       WHERE id = $${idx}
       RETURNING id, office_id AS "officeId", name, status,
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      values
    );
    if (!result.rows[0]) throw new NotFoundError(`Team not found: ${id}`);
    const updated = result.rows[0];
    const office = await db.query(`SELECT name FROM offices WHERE id = $1`, [updated.officeId]);
    return {
      id: updated.id,
      officeId: updated.officeId,
      name: updated.name,
      status: updated.status,
      officeName: office.rows[0]?.name || null,
    };
  }
}

module.exports = Team;
