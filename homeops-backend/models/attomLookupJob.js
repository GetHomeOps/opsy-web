"use strict";

/**
 * ATTOM Lookup Job Model
 *
 * Backs `attom_lookup_jobs` (see opsy-schema.sql).
 *
 * A job represents one pending/attempted call to ATTOM's /property/basicprofile
 * for a given property. Triggered either from bulk import (auto) or the
 * IdentityTab "Refresh property data" button (manual_refresh).
 *
 * State machine:
 *   queued -> processing -> (completed | failed | queued-on-retry)
 */

const db = require("../db");
const { BadRequestError, NotFoundError } = require("../expressError");

const TERMINAL_STATUSES = new Set(["completed", "failed", "skipped"]);
const ACTIVE_STATUSES = new Set(["queued", "processing"]);

class AttomLookupJob {
  /** Create a new job (defaults: status='queued', attempts=0, max_attempts=3, run_after=NOW()). */
  static async create({
    property_id,
    account_id,
    user_id = null,
    trigger,
    max_attempts = 3,
  }) {
    if (!property_id) throw new BadRequestError("property_id is required");
    if (!account_id) throw new BadRequestError("account_id is required");
    if (!trigger || !["bulk_import", "manual_refresh"].includes(trigger)) {
      throw new BadRequestError(
        "trigger must be 'bulk_import' or 'manual_refresh'"
      );
    }
    const result = await db.query(
      `INSERT INTO attom_lookup_jobs
         (property_id, account_id, user_id, trigger, status, attempts, max_attempts, run_after)
       VALUES ($1, $2, $3, $4, 'queued', 0, $5, NOW())
       RETURNING id, property_id, account_id, user_id, trigger, status, attempts, max_attempts,
                 error_code, error_message, populated_keys, run_after, created_at, updated_at`,
      [property_id, account_id, user_id, trigger, max_attempts]
    );
    return result.rows[0];
  }

  /** Get job by id. */
  static async get(id) {
    const result = await db.query(
      `SELECT id, property_id, account_id, user_id, trigger, status, attempts, max_attempts,
              error_code, error_message, populated_keys, run_after, created_at, updated_at
       FROM attom_lookup_jobs
       WHERE id = $1`,
      [id]
    );
    const job = result.rows[0];
    if (!job) throw new NotFoundError(`No attom lookup job with id: ${id}`);
    return job;
  }

  /** Mark job 'processing' and bump attempts. */
  static async markProcessing(id) {
    const result = await db.query(
      `UPDATE attom_lookup_jobs
       SET status = 'processing',
           attempts = attempts + 1,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, status, attempts, max_attempts`,
      [id]
    );
    const job = result.rows[0];
    if (!job) throw new NotFoundError(`No attom lookup job with id: ${id}`);
    return job;
  }

  /** Mark job 'completed'. Stores which camelCase keys were actually written. */
  static async markCompleted(id, { populated_keys } = {}) {
    const keysJson =
      Array.isArray(populated_keys) && populated_keys.length > 0
        ? JSON.stringify(populated_keys)
        : JSON.stringify([]);
    const result = await db.query(
      `UPDATE attom_lookup_jobs
       SET status = 'completed',
           populated_keys = $2::jsonb,
           error_code = NULL,
           error_message = NULL,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, status, populated_keys`,
      [id, keysJson]
    );
    const job = result.rows[0];
    if (!job) throw new NotFoundError(`No attom lookup job with id: ${id}`);
    return job;
  }

  /** Mark job 'failed' with an error code + message. */
  static async markFailed(id, { error_code, error_message } = {}) {
    const result = await db.query(
      `UPDATE attom_lookup_jobs
       SET status = 'failed',
           error_code = $2,
           error_message = $3,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, status, error_code, error_message`,
      [id, error_code || "error", error_message || "ATTOM lookup failed"]
    );
    const job = result.rows[0];
    if (!job) throw new NotFoundError(`No attom lookup job with id: ${id}`);
    return job;
  }

  /** Re-queue a job to run later (used on transient failures / rate-limit backoff). */
  static async reschedule(id, { retryAfterMs, error_code, error_message }) {
    const result = await db.query(
      `UPDATE attom_lookup_jobs
       SET status = 'queued',
           run_after = NOW() + ($2 * INTERVAL '1 millisecond'),
           error_code = $3,
           error_message = $4,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, status, attempts, max_attempts, run_after`,
      [id, Math.max(0, Number(retryAfterMs) || 0), error_code || null, error_message || null]
    );
    const job = result.rows[0];
    if (!job) throw new NotFoundError(`No attom lookup job with id: ${id}`);
    return job;
  }

  /** Most-recent job for a property (any status). */
  static async getLatestForProperty(propertyId) {
    if (!propertyId) return null;
    const result = await db.query(
      `SELECT id, property_id, account_id, user_id, trigger, status, attempts, max_attempts,
              error_code, error_message, populated_keys, run_after, created_at, updated_at
       FROM attom_lookup_jobs
       WHERE property_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [propertyId]
    );
    return result.rows[0] || null;
  }

  /** Most-recent job for each of the given property ids (any status).
   *  Returns an array of rows (one per property that has any job); properties
   *  without a job are simply absent from the result. Uses DISTINCT ON so we
   *  make exactly one DB round-trip instead of N.
   */
  static async getLatestForProperties(propertyIds) {
    if (!Array.isArray(propertyIds) || propertyIds.length === 0) return [];
    const ids = propertyIds
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0);
    if (ids.length === 0) return [];
    const result = await db.query(
      `SELECT DISTINCT ON (property_id)
              id, property_id, account_id, user_id, trigger, status, attempts, max_attempts,
              error_code, error_message, populated_keys, run_after, created_at, updated_at
       FROM attom_lookup_jobs
       WHERE property_id = ANY($1::int[])
       ORDER BY property_id, created_at DESC`,
      [ids]
    );
    return result.rows;
  }

  /** Most-recent active (queued/processing) job for a property, or null. */
  static async getLatestActiveForProperty(propertyId) {
    if (!propertyId) return null;
    const result = await db.query(
      `SELECT id, property_id, status, attempts, max_attempts, run_after, created_at, updated_at
       FROM attom_lookup_jobs
       WHERE property_id = $1 AND status IN ('queued', 'processing')
       ORDER BY created_at DESC
       LIMIT 1`,
      [propertyId]
    );
    return result.rows[0] || null;
  }

  /**
   * Return job ids that are eligible to run now:
   *   - status = 'queued' or 'processing' (the latter recovers jobs stuck from a prior crash)
   *   - run_after <= NOW()
   * Ordered oldest-first so the queue drains FIFO.
   */
  static async getReadyJobIds({ limit = 500 } = {}) {
    const result = await db.query(
      `SELECT id FROM attom_lookup_jobs
       WHERE status IN ('queued', 'processing')
         AND run_after <= NOW()
       ORDER BY run_after ASC, created_at ASC
       LIMIT $1`,
      [limit]
    );
    return result.rows.map((r) => r.id);
  }
}

AttomLookupJob.TERMINAL_STATUSES = TERMINAL_STATUSES;
AttomLookupJob.ACTIVE_STATUSES = ACTIVE_STATUSES;

module.exports = AttomLookupJob;
