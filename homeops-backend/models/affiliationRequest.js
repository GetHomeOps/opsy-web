"use strict";

const db = require("../db");
const { BadRequestError, NotFoundError } = require("../expressError");

class AffiliationRequest {
  static _rowToApi(row) {
    if (!row) return null;
    return {
      id: row.id,
      requestedByUserId: row.requestedByUserId ?? row.requested_by_user_id,
      agencyId: row.agencyId ?? row.agency_id,
      officeId: row.officeId ?? row.office_id,
      requestedName: row.requestedName ?? row.requested_name,
      requestType: row.requestType ?? row.request_type,
      status: row.status,
      notes: row.notes,
      addressLine1: row.addressLine1 ?? row.address_line1,
      city: row.city,
      state: row.state,
      phone: row.phone,
      website: row.website,
      mainOfficeName: row.mainOfficeName ?? row.main_office_name,
      mainTeamName: row.mainTeamName ?? row.main_team_name,
      logoUrl: row.logoUrl ?? row.logo_url,
      reviewedByUserId: row.reviewedByUserId ?? row.reviewed_by_user_id,
      reviewedAt: row.reviewedAt ?? row.reviewed_at,
      resolvedEntityId: row.resolvedEntityId ?? row.resolved_entity_id,
      createdAt: row.createdAt ?? row.created_at,
      updatedAt: row.updatedAt ?? row.updated_at,
      requestedByName: row.requestedByName,
      requestedByEmail: row.requestedByEmail,
      agencyName: row.agencyName,
      officeName: row.officeName,
    };
  }

  static async getPendingForUser(userId) {
    const result = await db.query(
      `SELECT id, requested_by_user_id AS "requestedByUserId",
              agency_id AS "agencyId", office_id AS "officeId",
              requested_name AS "requestedName", request_type AS "requestType",
              status, notes, address_line1 AS "addressLine1", city, state, phone, website,
              main_office_name AS "mainOfficeName", main_team_name AS "mainTeamName",
              logo_url AS "logoUrl",
              created_at AS "createdAt"
       FROM affiliation_requests
       WHERE requested_by_user_id = $1 AND status = 'pending'
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );
    return result.rows[0] ? AffiliationRequest._rowToApi(result.rows[0]) : null;
  }

  static async listPending() {
    const result = await db.query(
      `SELECT ar.id, ar.requested_by_user_id AS "requestedByUserId",
              ar.agency_id AS "agencyId", ar.office_id AS "officeId",
              ar.requested_name AS "requestedName", ar.request_type AS "requestType",
              ar.status, ar.notes, ar.address_line1 AS "addressLine1", ar.city, ar.state,
              ar.phone, ar.website,
              ar.main_office_name AS "mainOfficeName", ar.main_team_name AS "mainTeamName",
              ar.logo_url AS "logoUrl",
              ar.created_at AS "createdAt",
              u.name AS "requestedByName", u.email AS "requestedByEmail",
              ag.name AS "agencyName", o.name AS "officeName"
       FROM affiliation_requests ar
       JOIN users u ON u.id = ar.requested_by_user_id
       LEFT JOIN agencies ag ON ag.id = ar.agency_id
       LEFT JOIN offices o ON o.id = ar.office_id
       WHERE ar.status = 'pending'
       ORDER BY ar.created_at ASC`
    );
    return result.rows.map(AffiliationRequest._rowToApi);
  }

  static async getById(id) {
    const result = await db.query(
      `SELECT ar.id, ar.requested_by_user_id AS "requestedByUserId",
              ar.agency_id AS "agencyId", ar.office_id AS "officeId",
              ar.requested_name AS "requestedName", ar.request_type AS "requestType",
              ar.status, ar.notes, ar.address_line1 AS "addressLine1", ar.city, ar.state,
              ar.phone, ar.website,
              ar.main_office_name AS "mainOfficeName", ar.main_team_name AS "mainTeamName",
              ar.logo_url AS "logoUrl",
              ar.reviewed_by_user_id AS "reviewedByUserId",
              ar.reviewed_at AS "reviewedAt", ar.resolved_entity_id AS "resolvedEntityId",
              ar.created_at AS "createdAt",
              u.name AS "requestedByName", u.email AS "requestedByEmail",
              ag.name AS "agencyName", o.name AS "officeName"
       FROM affiliation_requests ar
       JOIN users u ON u.id = ar.requested_by_user_id
       LEFT JOIN agencies ag ON ag.id = ar.agency_id
       LEFT JOIN offices o ON o.id = ar.office_id
       WHERE ar.id = $1`,
      [id]
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundError(`Affiliation request not found: ${id}`);
    return AffiliationRequest._rowToApi(row);
  }

  static async create({
    requestedByUserId,
    requestType,
    requestedName,
    agencyId,
    officeId,
    notes,
    addressLine1,
    city,
    state,
    phone,
    website,
    mainOfficeName,
    mainTeamName,
    logoUrl,
  }) {
    const name = String(requestedName || "").trim();
    if (!name) throw new BadRequestError("requestedName is required");
    if (!["agency", "office", "team"].includes(requestType)) {
      throw new BadRequestError("requestType must be agency, office, or team");
    }
    if (requestType === "office" && !agencyId) {
      throw new BadRequestError("agencyId is required for office requests");
    }
    if (requestType === "team" && (!agencyId || !officeId)) {
      throw new BadRequestError("agencyId and officeId are required for team requests");
    }

    const existing = await AffiliationRequest.getPendingForUser(requestedByUserId);
    if (existing) {
      throw new BadRequestError("You already have a pending affiliation request");
    }

    const result = await db.query(
      `INSERT INTO affiliation_requests
         (requested_by_user_id, agency_id, office_id, requested_name, request_type, notes,
          address_line1, city, state, phone, website, main_office_name, main_team_name, logo_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'pending')
       RETURNING id, requested_by_user_id AS "requestedByUserId",
                 agency_id AS "agencyId", office_id AS "officeId",
                 requested_name AS "requestedName", request_type AS "requestType",
                 status, notes, address_line1 AS "addressLine1", city, state, phone, website,
                 main_office_name AS "mainOfficeName", main_team_name AS "mainTeamName",
                 logo_url AS "logoUrl",
                 created_at AS "createdAt"`,
      [
        requestedByUserId,
        agencyId || null,
        officeId || null,
        name,
        requestType,
        notes || null,
        addressLine1 || null,
        city || null,
        state || null,
        phone || null,
        website || null,
        mainOfficeName || null,
        mainTeamName || null,
        logoUrl || null,
      ]
    );
    return AffiliationRequest._rowToApi(result.rows[0]);
  }

  static async markReviewed(id, { status, reviewedByUserId, resolvedEntityId }, client) {
    const result = await client.query(
      `UPDATE affiliation_requests
       SET status = $2, reviewed_by_user_id = $3, reviewed_at = NOW(),
           resolved_entity_id = $4, updated_at = NOW()
       WHERE id = $1 AND status = 'pending'
       RETURNING id, status`,
      [id, status, reviewedByUserId, resolvedEntityId || null]
    );
    if (!result.rows[0]) {
      throw new BadRequestError("Request not found or already reviewed");
    }
    return result.rows[0];
  }
}

module.exports = AffiliationRequest;
