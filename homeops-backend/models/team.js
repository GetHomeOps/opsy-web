"use strict";

const db = require("../db");
const { NotFoundError, BadRequestError } = require("../expressError");
const { sqlForPartialUpdate } = require("../helpers/sql");
const { addPresignedUrlToItem } = require("../helpers/presignedUrls");

const TEAM_BRANDING_SELECT = `
  id,
  office_id AS "officeId",
  name,
  status,
  accent_color AS "accentColor",
  sidebar_icon_key AS "sidebarIconKey",
  agent_card_logo_key AS "agentCardLogoKey",
  agent_card_accent_color AS "agentCardAccentColor",
  agent_card_background_color AS "agentCardBackgroundColor",
  agent_card_agent_label AS "agentCardAgentLabel",
  agent_card_company_name AS "agentCardCompanyName",
  sidebar_text_color AS "sidebarTextColor",
  agent_card_text_color AS "agentCardTextColor",
  button_color AS "buttonColor",
  button_text_color AS "buttonTextColor",
  created_at AS "createdAt",
  updated_at AS "updatedAt"`;

const BRANDING_JS_TO_SQL = {
  accentColor: "accent_color",
  sidebarIconKey: "sidebar_icon_key",
  agentCardLogoKey: "agent_card_logo_key",
  agentCardAccentColor: "agent_card_accent_color",
  agentCardBackgroundColor: "agent_card_background_color",
  agentCardAgentLabel: "agent_card_agent_label",
  agentCardCompanyName: "agent_card_company_name",
  sidebarTextColor: "sidebar_text_color",
  agentCardTextColor: "agent_card_text_color",
  buttonColor: "button_color",
  buttonTextColor: "button_text_color",
};

const HAS_CUSTOMIZATION_SQL = (alias) => `(
  ${alias}.accent_color IS NOT NULL
  OR ${alias}.sidebar_icon_key IS NOT NULL
  OR ${alias}.agent_card_logo_key IS NOT NULL
  OR ${alias}.agent_card_accent_color IS NOT NULL
  OR ${alias}.agent_card_background_color IS NOT NULL
  OR ${alias}.agent_card_agent_label IS NOT NULL
  OR ${alias}.agent_card_company_name IS NOT NULL
  OR ${alias}.sidebar_text_color IS NOT NULL
  OR ${alias}.agent_card_text_color IS NOT NULL
  OR ${alias}.button_color IS NOT NULL
  OR ${alias}.button_text_color IS NOT NULL
)`;

function normalizeBrandingValue(key, value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    return trimmed;
  }
  return value;
}

class Team {
  static _rowToApi(row) {
    if (!row) return null;
    return {
      id: row.id,
      officeId: row.officeId ?? row.office_id,
      name: row.name,
      status: row.status,
      accentColor: row.accentColor ?? row.accent_color ?? null,
      sidebarIconKey: row.sidebarIconKey ?? row.sidebar_icon_key ?? null,
      agentCardLogoKey: row.agentCardLogoKey ?? row.agent_card_logo_key ?? null,
      agentCardAccentColor: row.agentCardAccentColor ?? row.agent_card_accent_color ?? null,
      agentCardBackgroundColor:
        row.agentCardBackgroundColor ?? row.agent_card_background_color ?? null,
      agentCardAgentLabel: row.agentCardAgentLabel ?? row.agent_card_agent_label ?? null,
      agentCardCompanyName: row.agentCardCompanyName ?? row.agent_card_company_name ?? null,
      sidebarTextColor: row.sidebarTextColor ?? row.sidebar_text_color ?? null,
      agentCardTextColor: row.agentCardTextColor ?? row.agent_card_text_color ?? null,
      buttonColor: row.buttonColor ?? row.button_color ?? null,
      buttonTextColor: row.buttonTextColor ?? row.button_text_color ?? null,
      hasCustomization: row.hasCustomization ?? null,
      createdAt: row.createdAt ?? row.created_at,
      updatedAt: row.updatedAt ?? row.updated_at,
    };
  }

  static async getById(id) {
    const result = await db.query(
      `SELECT ${TEAM_BRANDING_SELECT}
       FROM teams WHERE id = $1`,
      [id]
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundError(`Team not found: ${id}`);
    return Team._rowToApi(row);
  }

  static async listApprovedByAgency(agencyId, { q = "", limit = 200 } = {}) {
    const term = String(q || "").trim();
    const values = [agencyId, "approved", "approved"];
    let where = `o.agency_id = $1 AND t.status = $2 AND o.status = $3`;
    if (term) {
      values.push(`%${term}%`);
      const i = values.length;
      where += ` AND (t.name ILIKE $${i} OR o.name ILIKE $${i})`;
    }
    values.push(Math.min(Number(limit) || 200, 500));
    const result = await db.query(
      `SELECT t.id, t.office_id AS "officeId", t.name, t.status,
              o.name AS "officeName"
       FROM teams t
       INNER JOIN offices o ON o.id = t.office_id
       WHERE ${where}
       ORDER BY o.name ASC, t.name ASC
       LIMIT $${values.length}`,
      values
    );
    return result.rows.map((row) => ({
      id: row.id,
      officeId: row.officeId,
      name: row.name,
      status: row.status,
      officeName: row.officeName,
    }));
  }

  static async searchApprovedByOffice(officeId, { q = "", limit = 50 } = {}) {
    const term = String(q || "").trim();
    const values = [officeId, "approved"];
    let where = `office_id = $1 AND status = $2`;
    if (term) {
      values.push(`%${term}%`);
      where += ` AND name ILIKE $${values.length}`;
    }
    values.push(Math.min(Number(limit) || 50, 100));
    const result = await db.query(
      `SELECT id, office_id AS "officeId", name, status
       FROM teams
       WHERE ${where}
       ORDER BY name ASC
       LIMIT $${values.length}`,
      values
    );
    return result.rows.map(Team._rowToApi);
  }

  static async createApproved({ officeId, name }, client = null) {
    const run = client ? (text, params) => client.query(text, params) : db.query.bind(db);
    const result = await run(
      `INSERT INTO teams (office_id, name, status)
       VALUES ($1, $2, 'approved')
       RETURNING id, office_id AS "officeId", name, status`,
      [officeId, name]
    );
    return Team._rowToApi(result.rows[0]);
  }

  static async findApprovedByName(officeId, name, client = null) {
    const run = client ? (text, params) => client.query(text, params) : db.query.bind(db);
    const result = await run(
      `SELECT id, office_id AS "officeId", name, status
       FROM teams
       WHERE office_id = $1 AND status = 'approved' AND LOWER(TRIM(name)) = LOWER(TRIM($2))
       LIMIT 1`,
      [officeId, name]
    );
    return result.rows[0] ? Team._rowToApi(result.rows[0]) : null;
  }

  static async approve(id, client = null) {
    const run = client ? (text, params) => client.query(text, params) : db.query.bind(db);
    const result = await run(
      `UPDATE teams SET status = 'approved', updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, status`,
      [id]
    );
    if (!result.rows[0]) throw new NotFoundError(`Team not found: ${id}`);
    return result.rows[0];
  }

  static async update(id, fields = {}) {
    const sets = [];
    const values = [];
    let idx = 1;

    if (fields.name !== undefined) {
      sets.push(`name = $${idx}`);
      values.push(fields.name);
      idx += 1;
    }
    if (fields.officeId !== undefined) {
      sets.push(`office_id = $${idx}`);
      values.push(fields.officeId);
      idx += 1;
    }

    if (sets.length === 0) {
      const existing = await Team.getById(id);
      const office = await db.query(`SELECT name FROM offices WHERE id = $1`, [existing.officeId]);
      return {
        ...existing,
        officeName: office.rows[0]?.name || null,
      };
    }

    sets.push("updated_at = NOW()");
    values.push(id);
    const result = await db.query(
      `UPDATE teams SET ${sets.join(", ")}
       WHERE id = $${idx}
       RETURNING id, office_id AS "officeId", name, status,
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      values
    );
    if (!result.rows[0]) throw new NotFoundError(`Team not found: ${id}`);
    const updated = result.rows[0];
    const office = await db.query(`SELECT name FROM offices WHERE id = $1`, [updated.officeId]);
    return {
      id: updated.id,
      officeId: updated.officeId,
      name: updated.name,
      status: updated.status,
      officeName: office.rows[0]?.name || null,
    };
  }

  /**
   * List teams for the Customization admin UI (platform admin).
   * Teams are always customizable; agent branding overrides team at runtime.
   */
  static async listForCustomization() {
    const result = await db.query(
      `SELECT t.id,
              t.name,
              t.status,
              t.office_id AS "officeId",
              o.name AS "officeName",
              ag.id AS "agencyId",
              ag.name AS "agencyName",
              ${HAS_CUSTOMIZATION_SQL("t")} AS "hasCustomization",
              ${HAS_CUSTOMIZATION_SQL("ag")} AS "agencyHasCustomization",
              t.created_at AS "createdAt",
              t.updated_at AS "updatedAt"
       FROM teams t
       INNER JOIN offices o ON o.id = t.office_id
       INNER JOIN agencies ag ON ag.id = o.agency_id
       ORDER BY ag.name ASC, o.name ASC, t.name ASC`
    );
    return result.rows.map((row) => {
      const agencyHasCustomization = !!row.agencyHasCustomization;
      return {
        id: row.id,
        name: row.name,
        status: row.status,
        officeId: row.officeId,
        officeName: row.officeName,
        agencyId: row.agencyId,
        agencyName: row.agencyName,
        hasCustomization: !!row.hasCustomization,
        agencyHasCustomization,
        customizable: true,
        inheritsFromLabel: null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    });
  }

  /** Get branding fields for a team, with presigned display URLs. */
  static async getBranding(id) {
    const result = await db.query(
      `SELECT t.id,
              t.name,
              t.status,
              t.office_id AS "officeId",
              o.name AS "officeName",
              ag.id AS "agencyId",
              ag.name AS "agencyName",
              t.accent_color AS "accentColor",
              t.sidebar_icon_key AS "sidebarIconKey",
              t.agent_card_logo_key AS "agentCardLogoKey",
              t.agent_card_accent_color AS "agentCardAccentColor",
              t.agent_card_background_color AS "agentCardBackgroundColor",
              t.agent_card_agent_label AS "agentCardAgentLabel",
              t.agent_card_company_name AS "agentCardCompanyName",
              t.sidebar_text_color AS "sidebarTextColor",
              t.agent_card_text_color AS "agentCardTextColor",
              t.button_color AS "buttonColor",
              t.button_text_color AS "buttonTextColor",
              ${HAS_CUSTOMIZATION_SQL("t")} AS "hasCustomization",
              ${HAS_CUSTOMIZATION_SQL("ag")} AS "agencyHasCustomization"
       FROM teams t
       INNER JOIN offices o ON o.id = t.office_id
       INNER JOIN agencies ag ON ag.id = o.agency_id
       WHERE t.id = $1`,
      [id]
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundError(`Team not found: ${id}`);
    return Team._withBrandingUrls(row);
  }

  /** Partial-update branding fields. Pass null to clear a field. */
  static async updateBranding(id, data) {
    const payload = {};
    for (const key of Object.keys(BRANDING_JS_TO_SQL)) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        payload[key] = normalizeBrandingValue(key, data[key]);
      }
    }
    if (Object.keys(payload).length === 0) {
      throw new BadRequestError("No branding data to update");
    }

    const { setCols, values } = sqlForPartialUpdate(payload, BRANDING_JS_TO_SQL);
    const idVarIdx = "$" + (values.length + 1);

    const result = await db.query(
      `UPDATE teams
       SET ${setCols}, updated_at = NOW()
       WHERE id = ${idVarIdx}
       RETURNING id`,
      [...values, id]
    );

    if (!result.rows[0]) throw new NotFoundError(`Team not found: ${id}`);
    return Team.getBranding(id);
  }

  static async _withBrandingUrls(row) {
    let withSidebar = await addPresignedUrlToItem(
      row,
      "sidebarIconKey",
      "sidebarIconUrl"
    );
    withSidebar = await addPresignedUrlToItem(
      withSidebar,
      "agentCardLogoKey",
      "agentCardLogoUrl"
    );
    const agencyHasCustomization = !!withSidebar.agencyHasCustomization;
    return {
      id: withSidebar.id,
      name: withSidebar.name,
      url: null,
      officeId: withSidebar.officeId ?? null,
      officeName: withSidebar.officeName ?? null,
      agencyId: withSidebar.agencyId ?? null,
      agencyName: withSidebar.agencyName ?? null,
      accentColor: withSidebar.accentColor ?? null,
      sidebarIconKey: withSidebar.sidebarIconKey ?? null,
      sidebarIconUrl: withSidebar.sidebarIconUrl ?? null,
      agentCardLogoKey: withSidebar.agentCardLogoKey ?? null,
      agentCardLogoUrl: withSidebar.agentCardLogoUrl ?? null,
      agentCardAccentColor: withSidebar.agentCardAccentColor ?? null,
      agentCardBackgroundColor: withSidebar.agentCardBackgroundColor ?? null,
      agentCardAgentLabel: withSidebar.agentCardAgentLabel ?? null,
      agentCardCompanyName: withSidebar.agentCardCompanyName ?? null,
      sidebarTextColor: withSidebar.sidebarTextColor ?? null,
      agentCardTextColor: withSidebar.agentCardTextColor ?? null,
      buttonColor: withSidebar.buttonColor ?? null,
      buttonTextColor: withSidebar.buttonTextColor ?? null,
      status: withSidebar.status ?? null,
      hasCustomization: !!withSidebar.hasCustomization,
      agencyHasCustomization,
      customizable: true,
      source: "team",
      inheritsFromLabel: null,
      inheritsFromType: null,
    };
  }
}

Team.HAS_CUSTOMIZATION_SQL = HAS_CUSTOMIZATION_SQL;

module.exports = Team;
