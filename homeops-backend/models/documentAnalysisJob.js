"use strict";

const db = require("../db");
const { BadRequestError, NotFoundError } = require("../expressError");

class DocumentAnalysisJob {
  static async create(data) {
    const {
      property_id,
      user_id,
      property_document_id,
      s3_key,
      file_name,
      mime_type,
      system_key,
      document_type,
    } = data;

    if (!property_id || !user_id || !property_document_id || !s3_key || !system_key) {
      throw new BadRequestError(
        "property_id, user_id, property_document_id, s3_key, and system_key are required",
      );
    }

    const result = await db.query(
      `INSERT INTO document_analysis_jobs
         (property_id, user_id, property_document_id, s3_key, file_name, mime_type,
          system_key, document_type, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'queued')
       RETURNING *`,
      [
        property_id,
        user_id,
        property_document_id,
        s3_key,
        file_name || null,
        mime_type || null,
        system_key,
        document_type || null,
      ],
    );
    return result.rows[0];
  }

  static async get(id) {
    const result = await db.query(
      `SELECT * FROM document_analysis_jobs WHERE id = $1`,
      [id],
    );
    const job = result.rows[0];
    if (!job) throw new NotFoundError(`No document analysis job with id: ${id}`);
    return job;
  }

  static async updateStatus(id, { status, progress, error_message }) {
    const result = await db.query(
      `UPDATE document_analysis_jobs
       SET status = COALESCE($2, status),
           progress = COALESCE($3, progress),
           error_message = COALESCE($4, error_message),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, status, progress, error_message],
    );
    const job = result.rows[0];
    if (!job) throw new NotFoundError(`No document analysis job with id: ${id}`);
    return job;
  }

  static async getActiveForDocument(propertyDocumentId) {
    const result = await db.query(
      `SELECT * FROM document_analysis_jobs
       WHERE property_document_id = $1
         AND status IN ('queued', 'processing')
       ORDER BY created_at DESC
       LIMIT 1`,
      [propertyDocumentId],
    );
    return result.rows[0] || null;
  }

  static async listByProperty(propertyId) {
    const result = await db.query(
      `SELECT j.*,
              r.id AS result_id,
              r.detected_category,
              r.findings,
              r.review_status,
              r.applied_fields,
              r.created_at AS result_created_at,
              r.updated_at AS result_updated_at,
              d.document_name,
              d.document_date,
              d.document_key,
              d.document_type
       FROM document_analysis_jobs j
       LEFT JOIN document_analysis_results r ON r.job_id = j.id
       LEFT JOIN property_documents d ON d.id = j.property_document_id
       WHERE j.property_id = $1
       ORDER BY j.created_at DESC`,
      [propertyId],
    );
    return result.rows;
  }
}

module.exports = DocumentAnalysisJob;
