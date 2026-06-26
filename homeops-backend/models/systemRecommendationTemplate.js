"use strict";

/**
 * SystemRecommendationTemplate Model
 *
 * Manages the Super Admin-curated library in `system_recommendation_templates`.
 * Each template is copied into a property's Action Items
 * (`inspection_checklist_items`) the first time the matching canonical system is
 * added to a property (see services/systemRecommendationGenerator.js).
 *
 * Key operations:
 * - getAll / getAllGrouped: list templates (admin views)
 * - getActiveBySystemKey: active templates used at generation time
 * - create / update / remove: CRUD
 * - reorder: persist sort order within a single system
 */

const db = require("../db");
const { NotFoundError, BadRequestError } = require("../expressError");
const { CANONICAL_SYSTEMS } = require("../services/systemTypes");

const COLUMNS = `id, system_key, title, description, frequency, frequency_unit,
  priority, lifecycle_replacement_years, active, sort_order, created_at, updated_at`;

class SystemRecommendationTemplate {
  /** List all templates ordered by system then sort order. */
  static async getAll() {
    const result = await db.query(
      `SELECT ${COLUMNS}
       FROM system_recommendation_templates
       ORDER BY system_key ASC, sort_order ASC, id ASC`
    );
    return result.rows;
  }

  /** List all templates grouped by system_key: { [system_key]: [...] }. */
  static async getAllGrouped() {
    const rows = await this.getAll();
    const grouped = {};
    for (const row of rows) {
      if (!grouped[row.system_key]) grouped[row.system_key] = [];
      grouped[row.system_key].push(row);
    }
    return grouped;
  }

  /** Active templates for a canonical system, ordered for generation. */
  static async getActiveBySystemKey(systemKey) {
    const result = await db.query(
      `SELECT ${COLUMNS}
       FROM system_recommendation_templates
       WHERE system_key = $1 AND active = TRUE
       ORDER BY sort_order ASC, id ASC`,
      [systemKey]
    );
    return result.rows;
  }

  /** Get a single template by id. */
  static async get(id) {
    const result = await db.query(
      `SELECT ${COLUMNS} FROM system_recommendation_templates WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      throw new NotFoundError(`Recommendation template ${id} not found`);
    }
    return result.rows[0];
  }

  /** Validate that a system_key is one of the canonical systems. */
  static assertCanonicalSystem(systemKey) {
    if (!CANONICAL_SYSTEMS.includes(systemKey)) {
      throw new BadRequestError(
        `system_key must be one of: ${CANONICAL_SYSTEMS.join(", ")}`
      );
    }
  }

  /** Create a new template. Defaults sort_order to the end of its system group. */
  static async create(data) {
    const {
      system_key,
      title,
      description = null,
      frequency = null,
      frequency_unit = null,
      priority = "medium",
      lifecycle_replacement_years = null,
      active = true,
      sort_order,
    } = data;

    if (!system_key || !title) {
      throw new BadRequestError("system_key and title are required");
    }
    this.assertCanonicalSystem(system_key);

    let order = sort_order;
    if (order == null) {
      const res = await db.query(
        `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next
         FROM system_recommendation_templates WHERE system_key = $1`,
        [system_key]
      );
      order = res.rows[0].next;
    }

    const result = await db.query(
      `INSERT INTO system_recommendation_templates
         (system_key, title, description, frequency, frequency_unit,
          priority, lifecycle_replacement_years, active, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${COLUMNS}`,
      [
        system_key,
        title.slice(0, 500),
        description,
        frequency,
        frequency_unit,
        priority,
        lifecycle_replacement_years,
        Boolean(active),
        order,
      ]
    );
    return result.rows[0];
  }

  /** Update an existing template. */
  static async update(id, data) {
    const allowed = [
      "system_key",
      "title",
      "description",
      "frequency",
      "frequency_unit",
      "priority",
      "lifecycle_replacement_years",
      "active",
      "sort_order",
    ];

    if (data.system_key !== undefined) {
      this.assertCanonicalSystem(data.system_key);
    }

    const setClauses = [];
    const params = [];
    let idx = 1;
    for (const field of allowed) {
      if (data[field] !== undefined) {
        setClauses.push(`${field} = $${idx++}`);
        params.push(field === "title" ? String(data[field]).slice(0, 500) : data[field]);
      }
    }
    if (setClauses.length === 0) {
      throw new BadRequestError("No valid fields to update");
    }
    setClauses.push(`updated_at = NOW()`);
    params.push(id);

    const result = await db.query(
      `UPDATE system_recommendation_templates
       SET ${setClauses.join(", ")}
       WHERE id = $${idx}
       RETURNING ${COLUMNS}`,
      params
    );
    if (result.rows.length === 0) {
      throw new NotFoundError(`Recommendation template ${id} not found`);
    }
    return result.rows[0];
  }

  /** Delete a template. Does NOT affect already-generated Action Items. */
  static async remove(id) {
    const result = await db.query(
      `DELETE FROM system_recommendation_templates WHERE id = $1 RETURNING id`,
      [id]
    );
    if (result.rows.length === 0) {
      throw new NotFoundError(`Recommendation template ${id} not found`);
    }
    return { id: result.rows[0].id };
  }

  /** Persist a new ordering of templates within a single system. */
  static async reorder(systemKey, orderedIds) {
    if (!systemKey) throw new BadRequestError("systemKey is required");
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      throw new BadRequestError("orderedIds must be a non-empty array");
    }

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      for (let i = 0; i < orderedIds.length; i++) {
        await client.query(
          `UPDATE system_recommendation_templates
           SET sort_order = $1, updated_at = NOW()
           WHERE id = $2 AND system_key = $3`,
          [i, orderedIds[i], systemKey]
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    return this.getActiveBySystemKey(systemKey);
  }
}

module.exports = SystemRecommendationTemplate;
