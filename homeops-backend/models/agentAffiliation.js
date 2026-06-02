"use strict";

const db = require("../db");
const { BadRequestError } = require("../expressError");
const Agency = require("./agency");
const Office = require("./office");
const Team = require("./team");

class AgentAffiliation {
  /** @returns {Map<number, { agency: { id: number, name: string, logoUrl: string | null } }>} */
  static async getActiveForUserIds(userIds) {
    const ids = [...new Set((userIds || []).map((id) => Number(id)).filter(Boolean))];
    const map = new Map();
    if (!ids.length) return map;

    const result = await db.query(
      `SELECT aa.user_id AS "userId", aa.agency_id AS "agencyId",
              ag.name AS "agencyName", ag.legal_name AS "agencyLegalName",
              ag.logo_url AS "agencyLogoUrl", ag.website AS "agencyWebsite",
              ag.address_line1 AS "agencyAddressLine1", ag.city AS "agencyCity",
              ag.state AS "agencyState", ag.phone AS "agencyPhone"
       FROM agent_affiliations aa
       JOIN agencies ag ON ag.id = aa.agency_id
       WHERE aa.user_id = ANY($1::int[]) AND aa.status = 'active'`,
      [ids]
    );

    for (const row of result.rows) {
      map.set(Number(row.userId), {
        agency: {
          id: row.agencyId,
          name: row.agencyName,
          legalName: row.agencyLegalName,
          logoUrl: row.agencyLogoUrl,
          website: row.agencyWebsite,
          addressLine1: row.agencyAddressLine1,
          city: row.agencyCity,
          state: row.agencyState,
          phone: row.agencyPhone,
        },
      });
    }
    return map;
  }

  static async getActiveForUser(userId) {
    const result = await db.query(
      `SELECT aa.id, aa.user_id AS "userId", aa.agency_id AS "agencyId",
              aa.office_id AS "officeId", aa.team_id AS "teamId", aa.status,
              aa.effective_from AS "effectiveFrom", aa.effective_to AS "effectiveTo",
              ag.name AS "agencyName", ag.logo_url AS "agencyLogoUrl",
              o.name AS "officeName", t.name AS "teamName"
       FROM agent_affiliations aa
       JOIN agencies ag ON ag.id = aa.agency_id
       JOIN offices o ON o.id = aa.office_id
       LEFT JOIN teams t ON t.id = aa.team_id
       WHERE aa.user_id = $1 AND aa.status = 'active'
       LIMIT 1`,
      [userId]
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      userId: row.userId,
      agencyId: row.agencyId,
      officeId: row.officeId,
      teamId: row.teamId,
      status: row.status,
      effectiveFrom: row.effectiveFrom,
      effectiveTo: row.effectiveTo,
      agency: {
        id: row.agencyId,
        name: row.agencyName,
        logoUrl: row.agencyLogoUrl,
      },
      office: { id: row.officeId, name: row.officeName },
      team: row.teamId ? { id: row.teamId, name: row.teamName } : null,
    };
  }

  static async deactivateActive(userId, client) {
    await client.query(
      `UPDATE agent_affiliations
       SET status = 'left', effective_to = NOW(), updated_at = NOW()
       WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );
  }

  static async validateApprovedHierarchy({ agencyId, officeId, teamId }) {
    const agency = await Agency.getById(agencyId);
    if (agency.status !== "approved") {
      throw new BadRequestError("Selected agency is not approved");
    }
    const office = await Office.getById(officeId);
    if (office.status !== "approved") {
      throw new BadRequestError("Selected office is not approved");
    }
    if (Number(office.agencyId) !== Number(agencyId)) {
      throw new BadRequestError("Office does not belong to the selected agency");
    }
    if (teamId != null) {
      const team = await Team.getById(teamId);
      if (team.status !== "approved") {
        throw new BadRequestError("Selected team is not approved");
      }
      if (Number(team.officeId) !== Number(officeId)) {
        throw new BadRequestError("Team does not belong to the selected office");
      }
    }
  }

  static async upsertActive({ userId, agencyId, officeId, teamId = null }, client = null) {
    await AgentAffiliation.validateApprovedHierarchy({ agencyId, officeId, teamId });

    if (client) {
      await AgentAffiliation.deactivateActive(userId, client);
      const result = await client.query(
        `INSERT INTO agent_affiliations (user_id, agency_id, office_id, team_id, status)
         VALUES ($1, $2, $3, $4, 'active')
         RETURNING id`,
        [userId, agencyId, officeId, teamId || null]
      );
      return result.rows[0].id;
    }

    const dbClient = await db.connect();
    try {
      await dbClient.query("BEGIN");
      await AgentAffiliation.deactivateActive(userId, dbClient);
      const result = await dbClient.query(
        `INSERT INTO agent_affiliations (user_id, agency_id, office_id, team_id, status)
         VALUES ($1, $2, $3, $4, 'active')
         RETURNING id`,
        [userId, agencyId, officeId, teamId || null]
      );
      await dbClient.query("COMMIT");
      return result.rows[0].id;
    } catch (err) {
      await dbClient.query("ROLLBACK");
      throw err;
    } finally {
      dbClient.release();
    }
  }

  static async leave(userId) {
    const active = await AgentAffiliation.getActiveForUser(userId);
    if (!active) {
      throw new BadRequestError("No active affiliation to leave");
    }
    await db.query(
      `UPDATE agent_affiliations
       SET status = 'left', effective_to = NOW(), updated_at = NOW()
       WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );
    return { left: true };
  }

  static _rowToAgentListItem(row) {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      image: row.image,
      isActive: row.isActive,
      affiliation: row.affiliationId
        ? {
            id: row.affiliationId,
            status: row.affiliationStatus,
            agency: row.agencyId
              ? { id: row.agencyId, name: row.agencyName }
              : null,
            office: row.officeId
              ? { id: row.officeId, name: row.officeName }
              : null,
            team: row.teamId
              ? { id: row.teamId, name: row.teamName }
              : null,
          }
        : null,
    };
  }

  static _parseFilterList(value) {
    if (!value) return [];
    const raw = Array.isArray(value) ? value : [value];
    return raw
      .flatMap((v) => String(v).split(","))
      .map((s) => s.trim())
      .filter(Boolean);
  }

  static _buildAgentListFilters({
    q = "",
    agencies,
    offices,
    teams,
    omitAgencies = false,
    omitOffices = false,
    omitTeams = false,
  } = {}) {
    const values = [];
    const clauses = [];

    const term = String(q || "").trim();
    if (term) {
      values.push(`%${term}%`);
      const i = values.length;
      clauses.push(`(
        u.name ILIKE $${i} OR u.email ILIKE $${i}
        OR ag.name ILIKE $${i} OR o.name ILIKE $${i} OR t.name ILIKE $${i}
      )`);
    }

    const agencyIds = omitAgencies
      ? []
      : AgentAffiliation._parseFilterList(agencies)
          .map((id) => Number(id))
          .filter(Boolean);
    if (agencyIds.length) {
      values.push(agencyIds);
      clauses.push(`ag.id = ANY($${values.length}::int[])`);
    }

    const officeIds = omitOffices
      ? []
      : AgentAffiliation._parseFilterList(offices)
          .map((id) => Number(id))
          .filter(Boolean);
    if (officeIds.length) {
      values.push(officeIds);
      clauses.push(`o.id = ANY($${values.length}::int[])`);
    }

    const teamIds = omitTeams
      ? []
      : AgentAffiliation._parseFilterList(teams)
          .map((id) => Number(id))
          .filter(Boolean);
    if (teamIds.length) {
      values.push(teamIds);
      clauses.push(`t.id = ANY($${values.length}::int[])`);
    }

    const where = clauses.length ? `AND ${clauses.join(" AND ")}` : "";
    return { where, values };
  }

  static _agentListFromClause() {
    return `
      FROM users u
      LEFT JOIN agent_affiliations aa ON aa.user_id = u.id AND aa.status = 'active'
      LEFT JOIN agencies ag ON ag.id = aa.agency_id
      LEFT JOIN offices o ON o.id = aa.office_id
      LEFT JOIN teams t ON t.id = aa.team_id
      WHERE u.role = 'agent'`;
  }

  static async listDistinctAgenciesForAdmin(filters = {}) {
    const { where, values } = AgentAffiliation._buildAgentListFilters({
      ...filters,
      omitAgencies: true,
    });
    const result = await db.query(
      `SELECT DISTINCT ag.id AS value, ag.name AS label
       ${AgentAffiliation._agentListFromClause()}
       AND ag.id IS NOT NULL
       ${where}
       ORDER BY label ASC
       LIMIT 500`,
      values
    );
    return result.rows.map((row) => ({
      value: String(row.value),
      label: row.label,
    }));
  }

  static async listDistinctOfficesForAdmin(filters = {}) {
    const { where, values } = AgentAffiliation._buildAgentListFilters({
      ...filters,
      omitOffices: true,
    });
    const result = await db.query(
      `SELECT DISTINCT o.id AS value, o.name AS label
       ${AgentAffiliation._agentListFromClause()}
       AND o.id IS NOT NULL
       ${where}
       ORDER BY label ASC
       LIMIT 500`,
      values
    );
    return result.rows.map((row) => ({
      value: String(row.value),
      label: row.label,
    }));
  }

  static async listDistinctTeamsForAdmin(filters = {}) {
    const { where, values } = AgentAffiliation._buildAgentListFilters({
      ...filters,
      omitTeams: true,
    });
    const result = await db.query(
      `SELECT DISTINCT t.id AS value, t.name AS label
       ${AgentAffiliation._agentListFromClause()}
       AND t.id IS NOT NULL
       ${where}
       ORDER BY label ASC
       LIMIT 500`,
      values
    );
    return result.rows.map((row) => ({
      value: String(row.value),
      label: row.label,
    }));
  }

  static async countAgentsForAdmin(filters = {}) {
    const { where, values } = AgentAffiliation._buildAgentListFilters(filters);
    const result = await db.query(
      `SELECT COUNT(*)::int AS count
       ${AgentAffiliation._agentListFromClause()}
       ${where}`,
      values
    );
    return result.rows[0]?.count ?? 0;
  }

  static async listAgentsForAdmin({
    q = "",
    agencies,
    offices,
    teams,
    limit = 25,
    offset = 0,
    sortBy = "name",
    sortDir = "asc",
  } = {}) {
    const { where, values } = AgentAffiliation._buildAgentListFilters({
      q,
      agencies,
      offices,
      teams,
    });
    const columns = {
      name: "u.name",
      email: "u.email",
      agency: "ag.name",
      office: "o.name",
      team: "t.name",
      status: "CASE WHEN aa.id IS NOT NULL THEN 1 ELSE 0 END",
    };
    const col = columns[sortBy] || "u.name";
    const dir = String(sortDir).toLowerCase() === "desc" ? "DESC" : "ASC";
    const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
    const safeOffset = Math.max(Number(offset) || 0, 0);
    values.push(safeLimit);
    const limitIdx = values.length;
    values.push(safeOffset);
    const offsetIdx = values.length;

    const result = await db.query(
      `SELECT u.id, u.name, u.email, u.phone, u.image,
              u.is_active AS "isActive",
              aa.id AS "affiliationId", aa.status AS "affiliationStatus",
              ag.id AS "agencyId", ag.name AS "agencyName",
              o.id AS "officeId", o.name AS "officeName",
              t.id AS "teamId", t.name AS "teamName"
       ${AgentAffiliation._agentListFromClause()}
       ${where}
       ORDER BY ${col} ${dir} NULLS LAST, u.name ASC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      values
    );
    return result.rows.map(AgentAffiliation._rowToAgentListItem);
  }
}

module.exports = AgentAffiliation;
