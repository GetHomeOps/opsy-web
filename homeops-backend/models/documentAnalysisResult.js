"use strict";

const db = require("../db");
const { BadRequestError, NotFoundError } = require("../expressError");

class DocumentAnalysisResult {
  static async create(data) {
    const {
      job_id,
      property_id,
      property_document_id,
      system_key,
      detected_category,
      findings,
    } = data;

    if (!job_id || !property_id || !property_document_id || !system_key || !detected_category) {
      throw new BadRequestError(
        "job_id, property_id, property_document_id, system_key, and detected_category are required",
      );
    }

    const result = await db.query(
      `INSERT INTO document_analysis_results
         (job_id, property_id, property_document_id, system_key, detected_category, findings)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        job_id,
        property_id,
        property_document_id,
        system_key,
        detected_category,
        JSON.stringify(findings || []),
      ],
    );
    return result.rows[0];
  }

  static async get(id) {
    const result = await db.query(
      `SELECT * FROM document_analysis_results WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundError(`No document analysis result with id: ${id}`);
    return row;
  }

  static async getByJobId(jobId) {
    const result = await db.query(
      `SELECT * FROM document_analysis_results WHERE job_id = $1`,
      [jobId],
    );
    return result.rows[0] || null;
  }

  static async updateReview(id, { review_status, applied_fields }) {
    const result = await db.query(
      `UPDATE document_analysis_results
       SET review_status = COALESCE($2, review_status),
           applied_fields = COALESCE($3, applied_fields),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        review_status,
        applied_fields != null ? JSON.stringify(applied_fields) : null,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundError(`No document analysis result with id: ${id}`);
    return row;
  }

  static async listApprovedBySystem(propertyId, systemKey) {
    const result = await db.query(
      `SELECT r.*,
              d.document_name,
              d.document_date,
              d.document_key,
              d.document_type
       FROM document_analysis_results r
       JOIN property_documents d ON d.id = r.property_document_id
       WHERE r.property_id = $1
         AND r.system_key = $2
         AND r.review_status IN ('approved', 'partially_approved')
       ORDER BY r.updated_at DESC`,
      [propertyId, systemKey],
    );
    return result.rows;
  }

  static async listPendingByProperty(propertyId) {
    const result = await db.query(
      `SELECT r.*,
              d.document_name,
              d.document_date,
              d.document_key,
              j.status AS job_status,
              j.progress AS job_progress,
              j.error_message AS job_error
       FROM document_analysis_results r
       JOIN document_analysis_jobs j ON j.id = r.job_id
       JOIN property_documents d ON d.id = r.property_document_id
       WHERE r.property_id = $1
         AND r.review_status = 'pending_review'
         AND j.status = 'completed'
       ORDER BY r.created_at DESC`,
      [propertyId],
    );
    return result.rows;
  }
}

module.exports = DocumentAnalysisResult;
