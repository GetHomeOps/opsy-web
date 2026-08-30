"use strict";

const db = require("../db");
const { BadRequestError, NotFoundError } = require("../expressError");
const { resolveFindingSystemType } = require("../services/systemTypes");

/** Build a human-readable "suggested when" string from a template's cadence. */
function buildSuggestedWhen(tpl) {
  const { frequency, frequency_unit, lifecycle_replacement_years } = tpl || {};
  if (frequency && frequency_unit) {
    if (frequency === 1) {
      const singular = String(frequency_unit).replace(/s$/, "");
      return `Every ${singular}`;
    }
    return `Every ${frequency} ${frequency_unit}`;
  }
  if (lifecycle_replacement_years) {
    return `After ~${lifecycle_replacement_years} years`;
  }
  return null;
}

class InspectionChecklistItem {

  /** Remove all checklist items derived from a given analysis result (used before re-generating). */
  static async deleteByAnalysisResult(analysisResultId) {
    if (!analysisResultId) return;
    await db.query(
      `DELETE FROM inspection_checklist_items WHERE analysis_result_id = $1`,
      [analysisResultId]
    );
  }

  /**
   * Auto-generate checklist items from an inspection analysis result.
   * Merges needs_attention and maintenance_suggestions into individual trackable rows.
   */
  static async generateFromAnalysis(analysisResult) {
    const { id: analysisResultId, property_id } = analysisResult;
    if (!analysisResultId || !property_id) {
      throw new BadRequestError("analysisResultId and property_id are required");
    }

    const needsAttention = analysisResult.needs_attention || [];
    const maintenanceSuggestions = analysisResult.maintenance_suggestions || [];

    const rows = [];

    for (let i = 0; i < needsAttention.length; i++) {
      const n = needsAttention[i];
      rows.push({
        analysis_result_id: analysisResultId,
        property_id,
        system_key:
          resolveFindingSystemType({
            systemType: n.systemType,
            title: n.title,
            suggestedAction: n.suggestedAction,
            description: n.suggestedAction,
          }) ||
          n.systemType ||
          "general",
        source: "needs_attention",
        source_index: i,
        title: n.title || n.suggestedAction || "Inspection finding",
        description: n.suggestedAction || null,
        severity: n.severity || "medium",
        priority: n.priority || "medium",
        suggested_when: null,
        evidence: n.evidence || null,
      });
    }

    for (let i = 0; i < maintenanceSuggestions.length; i++) {
      const m = maintenanceSuggestions[i];
      rows.push({
        analysis_result_id: analysisResultId,
        property_id,
        system_key:
          resolveFindingSystemType({
            systemType: m.systemType,
            task: m.task,
            rationale: m.rationale,
            description: m.rationale,
          }) ||
          m.systemType ||
          "general",
        source: "maintenance_suggestion",
        source_index: i,
        title: m.task || "Maintenance task",
        description: m.rationale || null,
        severity: null,
        priority: m.priority || "medium",
        suggested_when: m.suggestedWhen || null,
        evidence: null,
      });
    }

    if (rows.length === 0) return [];

    const values = [];
    const placeholders = [];
    let paramIdx = 1;

    for (const row of rows) {
      placeholders.push(
        `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`
      );
      values.push(
        row.analysis_result_id, row.property_id, row.system_key,
        row.source, row.source_index, row.title,
        row.description, row.severity, row.priority,
        row.suggested_when, row.evidence
      );
    }

    const result = await db.query(
      `INSERT INTO inspection_checklist_items
         (analysis_result_id, property_id, system_key, source, source_index,
          title, description, severity, priority, suggested_when, evidence)
       VALUES ${placeholders.join(", ")}
       RETURNING *`,
      values
    );
    return result.rows;
  }

  /**
   * Generate Action Items for a system by copying its active default
   * recommendation templates into inspection_checklist_items.
   *
   * Source is 'default_recommendation'. Frequency / lifecycle data is copied
   * structurally and also folded into a human-readable suggested_when string.
   * Returns the inserted rows (empty array when there are no templates).
   */
  static async generateDefaultRecommendations({ propertyId, systemKey, templates }) {
    if (!propertyId || !systemKey) {
      throw new BadRequestError("propertyId and systemKey are required");
    }
    if (!Array.isArray(templates) || templates.length === 0) return [];

    const values = [];
    const placeholders = [];
    let idx = 1;

    for (const tpl of templates) {
      placeholders.push(
        `($${idx++}, $${idx++}, 'default_recommendation', $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, 'pending')`
      );
      values.push(
        propertyId,
        systemKey,
        (tpl.title || "Maintenance task").slice(0, 500),
        tpl.description || null,
        tpl.priority || "medium",
        buildSuggestedWhen(tpl),
        tpl.frequency ?? null,
        tpl.frequency_unit || null,
        tpl.lifecycle_replacement_years ?? null,
        tpl.id ?? null
      );
    }

    const result = await db.query(
      `INSERT INTO inspection_checklist_items
         (property_id, system_key, source, title, description, priority,
          suggested_when, frequency, frequency_unit, lifecycle_replacement_years,
          template_id, status)
       VALUES ${placeholders.join(", ")}
       RETURNING *`,
      values
    );
    return result.rows;
  }

  /** Create a user-defined checklist item (not derived from analysis). */
  static async createUserItem({
    propertyId,
    systemKey,
    title,
    description,
    priority,
    nextDueDate,
    status,
  }) {
    if (!propertyId || !systemKey || !title) {
      throw new BadRequestError("propertyId, systemKey, and title are required");
    }
    const allowedStatus = new Set(["pending", "in_progress"]);
    const nextStatus = allowedStatus.has(status) ? status : "pending";
    const result = await db.query(
      `INSERT INTO inspection_checklist_items
         (property_id, system_key, source, title, description, priority, status, next_due_date)
       VALUES ($1, $2, 'user_created', $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        propertyId,
        systemKey,
        title.slice(0, 500),
        description || null,
        priority || "medium",
        nextStatus,
        nextDueDate || null,
      ]
    );
    return result.rows[0];
  }

  /** Delete a user-managed checklist item. user_created and generated
   *  default_recommendation items can be deleted; inspection-derived items cannot. */
  static async deleteUserItem(id) {
    const item = await this.get(id);
    if (!["user_created", "default_recommendation"].includes(item.source)) {
      throw new BadRequestError("Only user-managed items can be deleted");
    }
    await db.query(`DELETE FROM inspection_checklist_items WHERE id = $1`, [id]);
    return item;
  }

  /** Get all checklist items for a property, optionally filtered. */
  static async getByPropertyId(propertyId, { systemKey, status } = {}) {
    const conditions = ["i.property_id = $1"];
    const params = [propertyId];
    let idx = 2;

    if (systemKey) {
      conditions.push(`LOWER(i.system_key) = LOWER($${idx++})`);
      params.push(systemKey);
    }
    if (status) {
      conditions.push(`i.status = $${idx++}`);
      params.push(status);
    }

    const result = await db.query(
      `SELECT i.*,
              (SELECT COUNT(*)::int FROM property_documents d
                WHERE d.checklist_item_id = i.id) AS bid_count
       FROM inspection_checklist_items i
       WHERE ${conditions.join(" AND ")}
       ORDER BY
         CASE i.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
         CASE i.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
         i.created_at ASC`,
      params
    );
    return result.rows;
  }

  /** Get progress stats for a property. */
  static async getProgress(propertyId) {
    const result = await db.query(
      `SELECT
         system_key,
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
         COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
         COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
         COUNT(*) FILTER (WHERE status = 'deferred')::int AS deferred,
         COUNT(*) FILTER (WHERE status = 'not_applicable')::int AS not_applicable
       FROM inspection_checklist_items
       WHERE property_id = $1
       GROUP BY system_key
       ORDER BY system_key`,
      [propertyId]
    );

    const bySystem = {};
    let total = 0;
    let completed = 0;
    let pending = 0;

    for (const row of result.rows) {
      bySystem[row.system_key] = {
        total: row.total,
        completed: row.completed,
        pending: row.pending,
        in_progress: row.in_progress,
        deferred: row.deferred,
        not_applicable: row.not_applicable,
      };
      total += row.total;
      completed += row.completed;
      pending += row.pending;
    }

    return { total, completed, pending, bySystem };
  }

  /** Get a single item by ID. */
  static async get(id) {
    const result = await db.query(
      `SELECT * FROM inspection_checklist_items WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      throw new NotFoundError(`Checklist item ${id} not found`);
    }
    return result.rows[0];
  }

  /** Update status, notes, or linked_maintenance_id. */
  static async update(id, data) {
    const allowedFields = [
      "status",
      "notes",
      "linked_maintenance_id",
      "completed_at",
      "completed_by",
      "frequency",
      "frequency_unit",
      "last_performed_date",
      "next_due_date",
      "bid_status",
      "selected_bid_document_id",
      "bid_selected_at",
    ];
    const setClauses = [];
    const params = [];
    let idx = 1;

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        setClauses.push(`${field} = $${idx++}`);
        params.push(data[field]);
      }
    }

    if (setClauses.length === 0) {
      throw new BadRequestError("No valid fields to update");
    }

    setClauses.push(`updated_at = NOW()`);
    params.push(id);

    const result = await db.query(
      `UPDATE inspection_checklist_items
       SET ${setClauses.join(", ")}
       WHERE id = $${idx}
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      throw new NotFoundError(`Checklist item ${id} not found`);
    }
    return result.rows[0];
  }

  /** True when an action item should recur (recommended or has structural cadence). */
  static isRecurringItem(item) {
    if (!item) return false;
    if (item.source === "default_recommendation") return true;
    if (item.frequency && item.frequency_unit) return true;
    if (item.lifecycle_replacement_years) return true;
    return false;
  }

  /**
   * Record that recurring maintenance was performed without completing the item.
   * Updates last_performed_date and keeps the item active for the next cycle.
   */
  static async recordPerformed(id, { maintenanceId = null, lastPerformedDate = null } = {}) {
    const updateData = {
      status: "pending",
      completed_at: null,
      completed_by: null,
    };
    if (maintenanceId != null && maintenanceId !== "") {
      const parsed = parseInt(maintenanceId, 10);
      if (Number.isInteger(parsed) && parsed > 0) {
        updateData.linked_maintenance_id = parsed;
      }
    }
    if (lastPerformedDate) {
      updateData.last_performed_date = String(lastPerformedDate).slice(0, 10);
    }
    return this.update(id, updateData);
  }

  /**
   * Mark an item as completed, optionally linking to a maintenance record.
   */
  static async complete(id, { userId, maintenanceId = null, notes = null, lastPerformedDate = null } = {}) {
    const updateData = {
      status: "completed",
      completed_at: new Date().toISOString(),
      completed_by: userId || null,
    };
    if (maintenanceId != null && maintenanceId !== "") {
      const parsed = parseInt(maintenanceId, 10);
      if (Number.isInteger(parsed) && parsed > 0) {
        updateData.linked_maintenance_id = parsed;
      }
    }
    if (notes !== null) updateData.notes = notes;
    if (lastPerformedDate) {
      updateData.last_performed_date = String(lastPerformedDate).slice(0, 10);
    }
    return this.update(id, updateData);
  }
}

module.exports = InspectionChecklistItem;
