"use strict";

const db = require("../db");
const { BadRequestError, NotFoundError } = require("../expressError");
const { sqlForPartialUpdate } = require("../helpers/sql");

const ANALYSIS_COLUMNS = `
  id, account_id, property_id, created_by, display_name, street, city, state, zip,
  photo_key, identity_data, identity_data_source,
  status, progress_pct, progress_message, error_message,
  overall_condition_score, overall_condition_rating, executive_summary,
  repair_cost_low, repair_cost_high, repair_confidence,
  positive_findings, top_concerns, disclaimer_version,
  started_at, completed_at, created_at, updated_at
`;

const IN_PROGRESS_STATUSES = [
  "uploading",
  "extracting",
  "identifying_systems",
  "detecting_issues",
  "generating_recommendations",
];

class PrePurchaseAnalysis {
  static async create({
    account_id,
    created_by,
    property_id = null,
    display_name = null,
    street = null,
    city = null,
    state = null,
    zip = null,
    photo_key = null,
    identity_data = null,
    identity_data_source = null,
  }) {
    if (!account_id || !created_by) {
      throw new BadRequestError("account_id and created_by are required");
    }
    if (!street && !display_name) {
      throw new BadRequestError("Provide an address or display name");
    }

    const result = await db.query(
      `INSERT INTO pre_purchase_analyses
         (account_id, property_id, created_by, display_name, street, city, state, zip, photo_key,
          identity_data, identity_data_source, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, 'draft')
       RETURNING ${ANALYSIS_COLUMNS}`,
      [
        account_id,
        property_id || null,
        created_by,
        display_name || null,
        street || null,
        city || null,
        state || null,
        zip || null,
        photo_key || null,
        identity_data ? JSON.stringify(identity_data) : null,
        identity_data_source || null,
      ]
    );
    return result.rows[0];
  }

  static async get(id) {
    const result = await db.query(
      `SELECT ${ANALYSIS_COLUMNS} FROM pre_purchase_analyses WHERE id = $1`,
      [id]
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundError(`No pre-purchase analysis with id: ${id}`);
    return row;
  }

  static async getFull(id) {
    const analysis = await this.get(id);
    const [documents, systems, findings, recommendations, professionalMatches] =
      await Promise.all([
        this.getDocuments(id),
        this.getSystems(id),
        this.getFindings(id),
        this.getRecommendations(id),
        this.getProfessionalMatches(id),
      ]);

    const issueCounts = { major: 0, moderate: 0, minor: 0 };
    for (const f of findings) {
      if (issueCounts[f.severity] != null) issueCounts[f.severity] += 1;
    }

    return {
      ...analysis,
      documents,
      systems,
      findings,
      recommendations,
      professionalMatches,
      issueCounts,
    };
  }

  static async list({
    accountId,
    status = null,
    search = null,
    limit = 50,
    offset = 0,
  } = {}) {
    if (!accountId) throw new BadRequestError("accountId is required");

    const conditions = ["a.account_id = $1"];
    const values = [accountId];
    let idx = 2;

    if (status) {
      if (status === "in_progress") {
        conditions.push(`a.status = ANY($${idx}::text[])`);
        values.push(IN_PROGRESS_STATUSES);
      } else {
        conditions.push(`a.status = $${idx}`);
        values.push(status);
      }
      idx++;
    }

    if (search && String(search).trim()) {
      conditions.push(`(
        COALESCE(a.display_name, '') ILIKE $${idx}
        OR COALESCE(a.street, '') ILIKE $${idx}
        OR COALESCE(a.city, '') ILIKE $${idx}
        OR COALESCE(a.state, '') ILIKE $${idx}
        OR COALESCE(a.zip, '') ILIKE $${idx}
        OR CONCAT_WS(', ',
             NULLIF(TRIM(COALESCE(a.street, '')), ''),
             NULLIF(TRIM(COALESCE(a.city, '')), ''),
             NULLIF(TRIM(COALESCE(a.state, '')), ''),
             NULLIF(TRIM(COALESCE(a.zip, '')), '')
           ) ILIKE $${idx}
      )`);
      values.push(`%${String(search).trim()}%`);
      idx++;
    }

    const where = `WHERE ${conditions.join(" AND ")}`;
    values.push(Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200));
    values.push(Math.max(parseInt(offset, 10) || 0, 0));

    const result = await db.query(
      `SELECT a.id, a.account_id, a.property_id, a.created_by, a.display_name,
              a.street, a.city, a.state, a.zip, a.photo_key, a.status,
              a.progress_pct, a.progress_message, a.error_message,
              a.overall_condition_score, a.overall_condition_rating,
              a.repair_cost_low, a.repair_cost_high, a.repair_confidence,
              a.started_at, a.completed_at, a.created_at, a.updated_at,
              (
                SELECT COUNT(*)::int FROM pre_purchase_findings f
                WHERE f.analysis_id = a.id AND f.severity = 'major'
              ) AS major_issues_count,
              (
                SELECT COUNT(*)::int FROM pre_purchase_documents d
                WHERE d.analysis_id = a.id
              ) AS document_count
       FROM pre_purchase_analyses a
       ${where}
       ORDER BY a.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      values
    );

    const countRes = await db.query(
      `SELECT COUNT(*)::int AS total FROM pre_purchase_analyses a ${where}`,
      values.slice(0, idx - 1)
    );

    return { analyses: result.rows, total: countRes.rows[0]?.total ?? 0 };
  }

  static async getStats(accountId) {
    if (!accountId) throw new BadRequestError("accountId is required");
    const result = await db.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status = ANY($2::text[]))::int AS in_progress,
         COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
         COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
         COUNT(*) FILTER (WHERE status = 'draft')::int AS draft,
         COALESCE((
           SELECT COUNT(*)::int FROM pre_purchase_findings f
           JOIN pre_purchase_analyses a2 ON a2.id = f.analysis_id
           WHERE a2.account_id = $1 AND f.severity = 'major'
         ), 0) AS critical_issues
       FROM pre_purchase_analyses
       WHERE account_id = $1`,
      [accountId, IN_PROGRESS_STATUSES]
    );
    return result.rows[0];
  }

  static async update(id, data) {
    const mapping = {
      propertyId: "property_id",
      displayName: "display_name",
      street: "street",
      city: "city",
      state: "state",
      zip: "zip",
      photoKey: "photo_key",
      status: "status",
      progressPct: "progress_pct",
      progressMessage: "progress_message",
      errorMessage: "error_message",
      overallConditionScore: "overall_condition_score",
      overallConditionRating: "overall_condition_rating",
      executiveSummary: "executive_summary",
      repairCostLow: "repair_cost_low",
      repairCostHigh: "repair_cost_high",
      repairConfidence: "repair_confidence",
      positiveFindings: "positive_findings",
      topConcerns: "top_concerns",
      disclaimerVersion: "disclaimer_version",
      startedAt: "started_at",
      completedAt: "completed_at",
    };

    const jsData = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && mapping[key]) {
        // node-pg treats JS arrays as PG arrays; jsonb columns need JSON strings
        if (
          (key === "positiveFindings" || key === "topConcerns") &&
          value !== null &&
          typeof value === "object"
        ) {
          jsData[key] = JSON.stringify(value);
        } else {
          jsData[key] = value;
        }
      }
    }
    if (Object.keys(jsData).length === 0) {
      throw new BadRequestError("No data to update");
    }

    const { setCols, values } = sqlForPartialUpdate(jsData, mapping);
    values.push(id);

    const result = await db.query(
      `UPDATE pre_purchase_analyses
       SET ${setCols}, updated_at = NOW()
       WHERE id = $${values.length}
       RETURNING ${ANALYSIS_COLUMNS}`,
      values
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundError(`No pre-purchase analysis with id: ${id}`);
    return row;
  }

  static async updateProgress(id, { status, progressPct, progressMessage, errorMessage }) {
    return this.update(id, {
      status,
      progressPct,
      progressMessage,
      errorMessage: errorMessage === undefined ? undefined : errorMessage,
    });
  }

  static async clearResults(analysisId) {
    await db.query(
      `DELETE FROM pre_purchase_professional_matches WHERE analysis_id = $1`,
      [analysisId]
    );
    await db.query(
      `DELETE FROM pre_purchase_recommendations WHERE analysis_id = $1`,
      [analysisId]
    );
    await db.query(
      `DELETE FROM pre_purchase_findings WHERE analysis_id = $1`,
      [analysisId]
    );
    await db.query(
      `DELETE FROM pre_purchase_systems WHERE analysis_id = $1`,
      [analysisId]
    );
    await db.query(
      `UPDATE pre_purchase_analyses
       SET overall_condition_score = NULL,
           overall_condition_rating = NULL,
           executive_summary = NULL,
           repair_cost_low = NULL,
           repair_cost_high = NULL,
           repair_confidence = NULL,
           positive_findings = '[]'::jsonb,
           top_concerns = '[]'::jsonb,
           completed_at = NULL,
           error_message = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [analysisId]
    );
  }

  /* ---------- Documents ---------- */

  static async addDocument({
    analysis_id,
    document_name,
    document_type = "other",
    document_key,
    mime_type = null,
    page_count = null,
    file_size_bytes = null,
    uploaded_by = null,
  }) {
    if (!analysis_id || !document_name || !document_key) {
      throw new BadRequestError("analysis_id, document_name, and document_key are required");
    }
    const result = await db.query(
      `INSERT INTO pre_purchase_documents
         (analysis_id, document_name, document_type, document_key, mime_type,
          page_count, file_size_bytes, uploaded_by, analysis_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
       RETURNING id, analysis_id, document_name, document_type, document_key,
                 mime_type, page_count, file_size_bytes, analysis_status,
                 uploaded_by, created_at, updated_at`,
      [
        analysis_id,
        document_name,
        document_type || "other",
        document_key,
        mime_type,
        page_count,
        file_size_bytes,
        uploaded_by,
      ]
    );
    return result.rows[0];
  }

  static async getDocuments(analysisId) {
    const result = await db.query(
      `SELECT id, analysis_id, document_name, document_type, document_key,
              mime_type, page_count, file_size_bytes, analysis_status,
              uploaded_by, created_at, updated_at
       FROM pre_purchase_documents
       WHERE analysis_id = $1
       ORDER BY created_at ASC`,
      [analysisId]
    );
    return result.rows;
  }

  static async getDocument(docId) {
    const result = await db.query(
      `SELECT id, analysis_id, document_name, document_type, document_key,
              mime_type, page_count, file_size_bytes, analysis_status,
              uploaded_by, created_at, updated_at
       FROM pre_purchase_documents WHERE id = $1`,
      [docId]
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundError(`No document with id: ${docId}`);
    return row;
  }

  static async removeDocument(docId) {
    const doc = await this.getDocument(docId);
    await db.query(`DELETE FROM pre_purchase_documents WHERE id = $1`, [docId]);
    return doc;
  }

  static async updateDocumentStatus(docId, analysisStatus) {
    const result = await db.query(
      `UPDATE pre_purchase_documents
       SET analysis_status = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, analysis_id, document_name, document_type, document_key,
                 mime_type, page_count, file_size_bytes, analysis_status,
                 uploaded_by, created_at, updated_at`,
      [docId, analysisStatus]
    );
    return result.rows[0];
  }

  /* ---------- Systems / findings / recommendations / matches ---------- */

  static async insertSystem(data) {
    const result = await db.query(
      `INSERT INTO pre_purchase_systems
         (analysis_id, system_key, system_label, condition, condition_confidence,
          issues_count, repair_cost_low, repair_cost_high, urgency,
          evidence_summary, evidence_sources, details, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13)
       RETURNING *`,
      [
        data.analysis_id,
        data.system_key,
        data.system_label,
        data.condition || "unknown",
        data.condition_confidence ?? null,
        data.issues_count ?? 0,
        data.repair_cost_low ?? null,
        data.repair_cost_high ?? null,
        data.urgency || null,
        data.evidence_summary || null,
        JSON.stringify(data.evidence_sources || []),
        JSON.stringify(data.details || {}),
        data.sort_order ?? 0,
      ]
    );
    return result.rows[0];
  }

  static async getSystems(analysisId) {
    const result = await db.query(
      `SELECT * FROM pre_purchase_systems
       WHERE analysis_id = $1
       ORDER BY sort_order ASC, id ASC`,
      [analysisId]
    );
    return result.rows;
  }

  static async insertFinding(data) {
    const result = await db.query(
      `INSERT INTO pre_purchase_findings
         (analysis_id, system_id, document_id, severity, urgency, title, description,
          evidence, source_excerpt, page_reference, estimated_cost_low, estimated_cost_high,
          recommended_action, confidence, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        data.analysis_id,
        data.system_id || null,
        data.document_id || null,
        data.severity || "moderate",
        data.urgency || null,
        data.title,
        data.description || null,
        data.evidence || null,
        data.source_excerpt || null,
        data.page_reference || null,
        data.estimated_cost_low ?? null,
        data.estimated_cost_high ?? null,
        data.recommended_action || null,
        data.confidence ?? null,
        data.sort_order ?? 0,
      ]
    );
    return result.rows[0];
  }

  static async getFindings(analysisId) {
    const result = await db.query(
      `SELECT f.*, s.system_key, s.system_label
       FROM pre_purchase_findings f
       LEFT JOIN pre_purchase_systems s ON s.id = f.system_id
       WHERE f.analysis_id = $1
       ORDER BY
         CASE f.severity WHEN 'major' THEN 0 WHEN 'moderate' THEN 1 ELSE 2 END,
         f.sort_order ASC, f.id ASC`,
      [analysisId]
    );
    return result.rows;
  }

  static async insertRecommendation(data) {
    const result = await db.query(
      `INSERT INTO pre_purchase_recommendations
         (analysis_id, finding_id, system_key, urgency_group, title, description, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        data.analysis_id,
        data.finding_id || null,
        data.system_key || null,
        data.urgency_group || "near_term",
        data.title,
        data.description || null,
        data.sort_order ?? 0,
      ]
    );
    return result.rows[0];
  }

  static async getRecommendations(analysisId) {
    const result = await db.query(
      `SELECT * FROM pre_purchase_recommendations
       WHERE analysis_id = $1
       ORDER BY
         CASE urgency_group
           WHEN 'immediate' THEN 0
           WHEN 'near_term' THEN 1
           WHEN 'long_term' THEN 2
           ELSE 3
         END,
         sort_order ASC, id ASC`,
      [analysisId]
    );
    return result.rows;
  }

  static async insertProfessionalMatch(data) {
    const result = await db.query(
      `INSERT INTO pre_purchase_professional_matches
         (analysis_id, recommendation_id, finding_id, system_key,
          professional_id, match_reason, match_score)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        data.analysis_id,
        data.recommendation_id || null,
        data.finding_id || null,
        data.system_key || null,
        data.professional_id,
        data.match_reason || null,
        data.match_score ?? 0,
      ]
    );
    return result.rows[0];
  }

  static async getProfessionalMatches(analysisId) {
    const result = await db.query(
      `SELECT m.*,
              p.company_name, p.contact_name, p.first_name, p.last_name,
              p.city AS professional_city, p.state AS professional_state,
              p.service_area, p.rating, p.review_count, p.profile_photo,
              p.phone, p.email, p.is_verified, p.years_in_business,
              pc.name AS category_name, sc.name AS subcategory_name
       FROM pre_purchase_professional_matches m
       JOIN professionals p ON p.id = m.professional_id
       LEFT JOIN professional_categories pc ON pc.id = p.category_id
       LEFT JOIN professional_categories sc ON sc.id = p.subcategory_id
       WHERE m.analysis_id = $1
       ORDER BY m.match_score DESC NULLS LAST, p.rating DESC NULLS LAST`,
      [analysisId]
    );
    return result.rows;
  }

  static async remove(id) {
    const result = await db.query(
      `DELETE FROM pre_purchase_analyses WHERE id = $1 RETURNING id`,
      [id]
    );
    if (!result.rows[0]) throw new NotFoundError(`No pre-purchase analysis with id: ${id}`);
    return result.rows[0];
  }
}

PrePurchaseAnalysis.IN_PROGRESS_STATUSES = IN_PROGRESS_STATUSES;

module.exports = PrePurchaseAnalysis;
