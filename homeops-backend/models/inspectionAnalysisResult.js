"use strict";

const db = require("../db");
const { BadRequestError, NotFoundError } = require("../expressError");

const RESULT_COLUMNS = `id, job_id, property_id, condition_rating, condition_confidence, condition_rationale,
                 systems_detected, needs_attention, suggested_systems_to_add, maintenance_suggestions,
                 summary, citations, review_status, reviewed_by, reviewed_at, review_notes,
                 review_submitted_at, created_at`;

class InspectionAnalysisResult {
  /** Create a result from job. Starts in `pending_review` (hidden from customer). */
  static async create(data) {
    const {
      job_id,
      property_id,
      condition_rating,
      condition_confidence,
      condition_rationale,
      systems_detected,
      needs_attention,
      suggested_systems_to_add,
      maintenance_suggestions,
      summary,
      citations,
    } = data;

    if (!job_id || !property_id || !condition_rating) {
      throw new BadRequestError("job_id, property_id, and condition_rating are required");
    }

    const result = await db.query(
      `INSERT INTO inspection_analysis_results
         (job_id, property_id, condition_rating, condition_confidence, condition_rationale,
          systems_detected, needs_attention, suggested_systems_to_add, maintenance_suggestions,
          summary, citations)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING ${RESULT_COLUMNS}`,
      [
        job_id,
        property_id,
        condition_rating,
        condition_confidence ?? null,
        condition_rationale ?? null,
        JSON.stringify(systems_detected || []),
        JSON.stringify(needs_attention || []),
        JSON.stringify(suggested_systems_to_add || []),
        JSON.stringify(maintenance_suggestions || []),
        summary ?? null,
        JSON.stringify(citations || []),
      ]
    );
    return result.rows[0];
  }

  /** Get result by job id. */
  static async getByJobId(jobId) {
    const result = await db.query(
      `SELECT ${RESULT_COLUMNS}
       FROM inspection_analysis_results
       WHERE job_id = $1`,
      [jobId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get latest result by property id.
   * @param {string|number} propertyId
   * @param {{approvedOnly?: boolean}} [opts] - When approvedOnly, only return a result that
   *   has passed human review (review_status = 'approved'). Customer-facing consumers should
   *   pass this so unreviewed findings stay hidden.
   */
  static async getByPropertyId(propertyId, { approvedOnly = false } = {}) {
    const result = await db.query(
      `SELECT ${RESULT_COLUMNS}
       FROM inspection_analysis_results
       WHERE property_id = $1
         ${approvedOnly ? "AND review_status = 'approved'" : ""}
       ORDER BY created_at DESC
       LIMIT 1`,
      [propertyId]
    );
    return result.rows[0] || null;
  }

  /** Get result by id. */
  static async get(id) {
    const result = await db.query(
      `SELECT ${RESULT_COLUMNS}
       FROM inspection_analysis_results
       WHERE id = $1`,
      [id]
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundError(`No analysis result with id: ${id}`);
    return row;
  }

  /**
   * Set review decision (approve / request revisions).
   * @param {number} id
   * @param {{review_status: string, reviewed_by?: number, review_notes?: string|null}} data
   */
  static async setReview(id, { review_status, reviewed_by = null, review_notes = null }) {
    const valid = ["pending_review", "approved", "revision_requested"];
    if (!valid.includes(review_status)) {
      throw new BadRequestError(`Invalid review_status: ${review_status}`);
    }
    const reviewedAt = review_status === "pending_review" ? null : new Date();
    const result = await db.query(
      `UPDATE inspection_analysis_results
       SET review_status = $2,
           reviewed_by = $3,
           reviewed_at = $4,
           review_notes = $5
       WHERE id = $1
       RETURNING ${RESULT_COLUMNS}`,
      [id, review_status, reviewed_by, reviewedAt, review_notes]
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundError(`No analysis result with id: ${id}`);
    return row;
  }

  /** Save reviewer feedback without changing review status. */
  static async updateReviewFeedback(id, { review_notes, reviewed_by = null }) {
    const result = await db.query(
      `UPDATE inspection_analysis_results
       SET review_notes = $2,
           reviewed_by = COALESCE($3, reviewed_by)
       WHERE id = $1
       RETURNING ${RESULT_COLUMNS}`,
      [id, review_notes, reviewed_by]
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundError(`No analysis result with id: ${id}`);
    return row;
  }

  /**
   * Replace the action-item arrays (needs_attention / maintenance_suggestions) — used when a
   * reviewer adds/removes items during "Request Revisions".
   */
  static async updateFindings(id, { needs_attention, maintenance_suggestions }) {
    const result = await db.query(
      `UPDATE inspection_analysis_results
       SET needs_attention = COALESCE($2, needs_attention),
           maintenance_suggestions = COALESCE($3, maintenance_suggestions)
       WHERE id = $1
       RETURNING ${RESULT_COLUMNS}`,
      [
        id,
        needs_attention != null ? JSON.stringify(needs_attention) : null,
        maintenance_suggestions != null ? JSON.stringify(maintenance_suggestions) : null,
      ]
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundError(`No analysis result with id: ${id}`);
    return row;
  }

  /** Update analysis content during admin review (summary, conditions, findings, etc.). */
  static async updateAnalysis(id, data = {}) {
    const allowedScalars = [
      "condition_rating",
      "condition_confidence",
      "condition_rationale",
      "summary",
    ];
    const allowedJson = [
      "systems_detected",
      "needs_attention",
      "maintenance_suggestions",
      "suggested_systems_to_add",
      "citations",
    ];

    const sets = [];
    const values = [id];
    let idx = 2;

    for (const key of allowedScalars) {
      if (data[key] !== undefined) {
        sets.push(`${key} = $${idx++}`);
        values.push(data[key]);
      }
    }
    for (const key of allowedJson) {
      if (data[key] !== undefined) {
        sets.push(`${key} = $${idx++}`);
        values.push(JSON.stringify(data[key]));
      }
    }

    if (sets.length === 0) {
      return this.get(id);
    }

    const result = await db.query(
      `UPDATE inspection_analysis_results
       SET ${sets.join(", ")}
       WHERE id = $1
       RETURNING ${RESULT_COLUMNS}`,
      values
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundError(`No analysis result with id: ${id}`);
    return row;
  }

  /**
   * Admin review queue: analyses in review or recently approved,
   * enriched with property / customer / account info for the Helpdesk queue.
   */
  static async listForReview({ status = null } = {}) {
    const statuses = status
      ? [status]
      : ["pending_review", "revision_requested", "approved"];
    const result = await db.query(
      `SELECT r.id,
              r.property_id,
              r.condition_rating,
              r.review_status,
              r.review_notes,
              r.review_submitted_at,
              r.reviewed_at,
              r.created_at,
              j.id AS job_id,
              j.file_name,
              j.created_at AS uploaded_at,
              p.property_uid,
              p.property_name,
              p.address,
              p.address_line_1,
              p.city,
              p.state,
              p.zip,
              p.owner_name,
              a.url AS account_url,
              uploader.name AS uploader_name,
              uploader.email AS uploader_email,
              reviewer.name AS reviewer_name
       FROM inspection_analysis_results r
       JOIN inspection_analysis_jobs j ON j.id = r.job_id
       JOIN properties p ON p.id = r.property_id
       LEFT JOIN accounts a ON a.id = p.account_id
       LEFT JOIN users uploader ON uploader.id = j.user_id
       LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by
       WHERE r.review_status = ANY($1)
       ORDER BY r.review_submitted_at ASC NULLS LAST, r.created_at ASC`,
      [statuses]
    );
    return result.rows;
  }

  /** Full detail for the admin review page (all analysis output + property/customer context). */
  static async getReviewDetail(id) {
    const result = await db.query(
      `SELECT r.*,
              j.file_name,
              j.s3_key,
              j.mime_type,
              j.user_id AS uploader_id,
              j.created_at AS uploaded_at,
              p.property_uid,
              p.property_name,
              p.address,
              p.address_line_1,
              p.address_line_2,
              p.city,
              p.state,
              p.zip,
              p.owner_name,
              p.account_id,
              a.url AS account_url,
              a.name AS account_name,
              uploader.name AS uploader_name,
              uploader.email AS uploader_email,
              reviewer.name AS reviewer_name,
              reviewer.email AS reviewer_email
       FROM inspection_analysis_results r
       JOIN inspection_analysis_jobs j ON j.id = r.job_id
       JOIN properties p ON p.id = r.property_id
       LEFT JOIN accounts a ON a.id = p.account_id
       LEFT JOIN users uploader ON uploader.id = j.user_id
       LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by
       WHERE r.id = $1`,
      [id]
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundError(`No analysis result with id: ${id}`);
    return row;
  }

  /** Count results awaiting review (for Helpdesk KPI). */
  static async countPendingReview() {
    const result = await db.query(
      `SELECT COUNT(*)::int AS c
       FROM inspection_analysis_results
       WHERE review_status IN ('pending_review', 'revision_requested')`
    );
    return result.rows[0]?.c ?? 0;
  }
}

module.exports = InspectionAnalysisResult;
