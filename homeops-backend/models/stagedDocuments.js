"use strict";

/**
 * StagedDocument Model
 *
 * Inbox / staging area for the Documents tab. Files live here after S3
 * upload but before the user assigns them to a property system folder.
 * When filed, a row is moved into property_documents and removed here.
 *
 * Operations: create, get, getByPropertyId, update, remove, removeMany.
 */

const db = require("../db");
const { BadRequestError, NotFoundError } = require("../expressError");

const ALLOWED_PROPOSED_FIELDS = [
  "proposed_system_key",
  "proposed_document_type",
  "proposed_document_name",
  "proposed_document_date",
];

class StagedDocument {
  /** Create a staged document row.
   *
   * Required: { property_id, user_id, document_key, original_name }
   * Optional: file_size_bytes, mime_type, proposed_system_key,
   *           proposed_document_type, proposed_document_name,
   *           proposed_document_date, upload_status, error_message
   */
  static async create(data) {
    const {
      property_id,
      user_id,
      document_key,
      original_name,
      file_size_bytes = 0,
      mime_type = null,
      proposed_system_key = null,
      proposed_document_type = null,
      proposed_document_name = null,
      proposed_document_date = null,
      upload_status = "uploaded",
      error_message = null,
    } = data;

    if (!property_id || !user_id || !document_key || !original_name) {
      throw new BadRequestError(
        "property_id, user_id, document_key, and original_name are required",
      );
    }

    const result = await db.query(
      `INSERT INTO staged_documents (
        property_id,
        user_id,
        document_key,
        original_name,
        file_size_bytes,
        mime_type,
        proposed_system_key,
        proposed_document_type,
        proposed_document_name,
        proposed_document_date,
        upload_status,
        error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        property_id,
        user_id,
        document_key,
        original_name,
        Math.max(0, Number(file_size_bytes) || 0),
        mime_type,
        proposed_system_key,
        proposed_document_type,
        proposed_document_name,
        proposed_document_date,
        upload_status,
        error_message,
      ],
    );
    return result.rows[0];
  }

  static async get(id) {
    const result = await db.query(
      `SELECT * FROM staged_documents WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundError(`No staged document with id: ${id}`);
    return row;
  }

  static async getByPropertyId(propertyId) {
    const result = await db.query(
      `SELECT * FROM staged_documents
       WHERE property_id = $1
       ORDER BY created_at DESC`,
      [propertyId],
    );
    return result.rows;
  }

  /** Patch only proposed_* metadata fields (and optionally upload_status). */
  static async update(id, data) {
    const fields = [];
    const values = [];
    let i = 1;

    for (const key of ALLOWED_PROPOSED_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        fields.push(`${key} = $${i++}`);
        values.push(data[key]);
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(data, "upload_status") &&
      typeof data.upload_status === "string"
    ) {
      fields.push(`upload_status = $${i++}`);
      values.push(data.upload_status);
    }

    if (Object.prototype.hasOwnProperty.call(data, "error_message")) {
      fields.push(`error_message = $${i++}`);
      values.push(data.error_message);
    }

    if (!fields.length) {
      return this.get(id);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await db.query(
      `UPDATE staged_documents
       SET ${fields.join(", ")}
       WHERE id = $${i}
       RETURNING *`,
      values,
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundError(`No staged document with id: ${id}`);
    return row;
  }

  static async remove(id) {
    const result = await db.query(
      `DELETE FROM staged_documents WHERE id = $1 RETURNING *`,
      [id],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundError(`No staged document with id: ${id}`);
    return row;
  }

  static async removeMany(ids) {
    if (!Array.isArray(ids) || !ids.length) return [];
    const result = await db.query(
      `DELETE FROM staged_documents WHERE id = ANY($1::int[]) RETURNING *`,
      [ids],
    );
    return result.rows;
  }
}

module.exports = StagedDocument;
