"use strict";

const db = require("../db");
const { NotFoundError, BadRequestError } = require("../expressError");
const { sqlForPartialUpdate } = require("../helpers/sql");
const { addPresignedUrlToItem } = require("../helpers/presignedUrls");
const Office = require("./office");

const AGENCY_BRANDING_SELECT = `
  id,
  name,
  legal_name AS "legalName",
  website,
  address_line1 AS "addressLine1",
  city,
  state,
  phone,
  logo_url AS "logoUrl",
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

class Agency {
  static _rowToApi(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      legalName: row.legalName ?? row.legal_name,
      website: row.website,
      addressLine1: row.addressLine1 ?? row.address_line1,
      city: row.city,
      state: row.state,
      phone: row.phone,
      logoUrl: row.logoUrl ?? row.logo_url,
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
      `SELECT ${AGENCY_BRANDING_SELECT}
       FROM agencies WHERE id = $1`,
      [id]
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundError(`Agency not found: ${id}`);
    return Agency._rowToApi(row);
  }

  static async searchApproved({ q = "", limit = 50 } = {}) {
    const term = String(q || "").trim();
    const values = ["approved"];
    let where = `status = $1`;
    if (term) {
      values.push(`%${term}%`);
      const i = values.length;
      where += ` AND (
        name ILIKE $${i} OR city ILIKE $${i} OR state ILIKE $${i} OR website ILIKE $${i}
      )`;
    }
    values.push(Math.min(Number(limit) || 50, 100));
    const result = await db.query(
      `SELECT id, name, legal_name AS "legalName", website,
              address_line1 AS "addressLine1", city, state, phone,
              logo_url AS "logoUrl", status
       FROM agencies
       WHERE ${where}
       ORDER BY name ASC
       LIMIT $${values.length}`,
      values
    );
    return result.rows.map(Agency._rowToApi);
  }

  static async createApproved({ name, legalName, website, addressLine1, city, state, phone, logoUrl }, client = null) {
    const run = client ? (text, params) => client.query(text, params) : db.query.bind(db);
    const result = await run(
      `INSERT INTO agencies (name, legal_name, website, address_line1, city, state, phone, logo_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'approved')
       RETURNING id, name, legal_name AS "legalName", website,
                 address_line1 AS "addressLine1", city, state, phone,
                 logo_url AS "logoUrl", status`,
      [name, legalName || null, website || null, addressLine1 || null, city || null, state || null, phone || null, logoUrl || null]
    );
    return Agency._rowToApi(result.rows[0]);
  }

  static async findApprovedByName(name, client = null) {
    const run = client ? (text, params) => client.query(text, params) : db.query.bind(db);
    const result = await run(
      `SELECT id, name, legal_name AS "legalName", website,
              address_line1 AS "addressLine1", city, state, phone,
              logo_url AS "logoUrl", status
       FROM agencies
       WHERE status = 'approved' AND LOWER(TRIM(name)) = LOWER(TRIM($1))
       LIMIT 1`,
      [name]
    );
    return result.rows[0] ? Agency._rowToApi(result.rows[0]) : null;
  }

  static _parseFilterList(value) {
    if (!value) return [];
    const raw = Array.isArray(value) ? value : [value];
    return raw
      .flatMap((v) => String(v).split(","))
      .map((s) => s.trim())
      .filter(Boolean);
  }

  /** Shared WHERE clause for admin list, count, and facets. */
  static _buildListFilters({
    q = "",
    status,
    statuses,
    states,
    cities,
    omitStates = false,
    omitCities = false,
  } = {}) {
    const values = [];
    const clauses = [];

    const statusList = Agency._parseFilterList(statuses?.length ? statuses : status);
    if (statusList.length === 1) {
      values.push(statusList[0]);
      clauses.push(`status = $${values.length}`);
    } else if (statusList.length > 1) {
      values.push(statusList);
      clauses.push(`status = ANY($${values.length}::text[])`);
    }

    const stateList = omitStates ? [] : Agency._parseFilterList(states);
    if (stateList.length > 0) {
      values.push(stateList);
      clauses.push(`state = ANY($${values.length}::text[])`);
    }

    const cityList = omitCities ? [] : Agency._parseFilterList(cities);
    if (cityList.length > 0) {
      values.push(cityList);
      clauses.push(`city = ANY($${values.length}::text[])`);
    }

    const term = String(q || "").trim();
    if (term) {
      values.push(`%${term}%`);
      const i = values.length;
      clauses.push(`(
        name ILIKE $${i} OR legal_name ILIKE $${i} OR city ILIKE $${i} OR state ILIKE $${i} OR website ILIKE $${i}
      )`);
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    return { where, values };
  }

  static _resolveSort(sortBy = "name", sortDir = "asc") {
    const columns = {
      name: "name",
      legalName: "legal_name",
      city: "city",
      website: "website",
      status: "status",
    };
    const col = columns[sortBy] || "name";
    const dir = String(sortDir).toLowerCase() === "desc" ? "DESC" : "ASC";
    return `${col} ${dir}`;
  }

  static async countAll(filters = {}) {
    const { where, values } = Agency._buildListFilters(filters);
    const result = await db.query(
      `SELECT COUNT(*)::int AS count FROM agencies ${where}`,
      values
    );
    return result.rows[0]?.count ?? 0;
  }

  static async listDistinctStates(filters = {}) {
    const { where, values } = Agency._buildListFilters({
      ...filters,
      omitStates: true,
    });
    const and = where ? `${where} AND` : "WHERE";
    const result = await db.query(
      `SELECT DISTINCT state AS value
       FROM agencies
       ${and} state IS NOT NULL AND TRIM(state) <> ''
       ORDER BY value ASC
       LIMIT 500`,
      values
    );
    return result.rows.map((r) => r.value);
  }

  static async listDistinctCities(filters = {}) {
    const { where, values } = Agency._buildListFilters({
      ...filters,
      omitCities: true,
    });
    const and = where ? `${where} AND` : "WHERE";
    const result = await db.query(
      `SELECT DISTINCT city AS value
       FROM agencies
       ${and} city IS NOT NULL AND TRIM(city) <> ''
       ORDER BY value ASC
       LIMIT 500`,
      values
    );
    return result.rows.map((r) => r.value);
  }

  static async listAll({
    q = "",
    status,
    statuses,
    states,
    cities,
    sortBy = "name",
    sortDir = "asc",
    limit = 100,
    offset = 0,
  } = {}) {
    const { where, values } = Agency._buildListFilters({
      q,
      status,
      statuses,
      states,
      cities,
    });
    const orderBy = Agency._resolveSort(sortBy, sortDir);
    const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);
    const safeOffset = Math.max(Number(offset) || 0, 0);
    values.push(safeLimit);
    const limitIdx = values.length;
    values.push(safeOffset);
    const offsetIdx = values.length;
    const result = await db.query(
      `SELECT id, name, legal_name AS "legalName", website,
              city, state, logo_url AS "logoUrl", status
       FROM agencies
       ${where}
       ORDER BY ${orderBy}
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      values
    );
    return result.rows.map(Agency._rowToApi);
  }

  /** Create approved agency + default main office (for admin import / manual add). */
  static async createApprovedWithDefaultOffice(
    { name, legalName, website, addressLine1, city, state, phone, logoUrl, officeName },
    client = null
  ) {
    const run = client ? (text, params) => client.query(text, params) : db.query.bind(db);
    const dbClient = client ? null : await db.connect();
    const conn = client || dbClient;
    try {
      if (!client) await conn.query("BEGIN");
      const agency = await Agency.createApproved(
        { name, legalName, website, addressLine1, city, state, phone, logoUrl },
        conn
      );
      const office = await Office.createApproved(
        {
          agencyId: agency.id,
          name: officeName || `${name} — Main Office`,
          city: city || null,
          state: state || null,
          phone: phone || null,
        },
        conn
      );
      if (!client) await conn.query("COMMIT");
      return { agency, office };
    } catch (err) {
      if (!client) await conn.query("ROLLBACK");
      throw err;
    } finally {
      if (dbClient) dbClient.release();
    }
  }

  static async update(id, fields = {}) {
    const allowed = ["name", "legalName", "website", "addressLine1", "city", "state", "phone", "logoUrl"];
    const sets = [];
    const values = [];
    let idx = 1;

    for (const key of allowed) {
      if (fields[key] === undefined) continue;
      const col =
        key === "legalName"
          ? "legal_name"
          : key === "logoUrl"
            ? "logo_url"
            : key === "addressLine1"
              ? "address_line1"
              : key;
      sets.push(`${col} = $${idx}`);
      values.push(fields[key]);
      idx += 1;
    }

    if (sets.length === 0) {
      return Agency.getById(id);
    }

    sets.push("updated_at = NOW()");
    values.push(id);
    const result = await db.query(
      `UPDATE agencies SET ${sets.join(", ")}
       WHERE id = $${idx}
       RETURNING id, name, legal_name AS "legalName", website,
                 address_line1 AS "addressLine1", city, state, phone,
                 logo_url AS "logoUrl", status, created_at AS "createdAt", updated_at AS "updatedAt"`,
      values
    );
    if (!result.rows[0]) throw new NotFoundError(`Agency not found: ${id}`);
    return Agency._rowToApi(result.rows[0]);
  }

  static async approve(id, client = null) {
    const run = client ? (text, params) => client.query(text, params) : db.query.bind(db);
    const result = await run(
      `UPDATE agencies SET status = 'approved', updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, status`,
      [id]
    );
    if (!result.rows[0]) throw new NotFoundError(`Agency not found: ${id}`);
    return result.rows[0];
  }

  /**
   * List agencies for the Customization admin UI (platform admin).
   * Includes hasCustomization flag from branding columns.
   */
  static async listForCustomization() {
    const result = await db.query(
      `SELECT id,
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
              (
                accent_color IS NOT NULL
                OR sidebar_icon_key IS NOT NULL
                OR agent_card_logo_key IS NOT NULL
                OR agent_card_accent_color IS NOT NULL
                OR agent_card_background_color IS NOT NULL
                OR agent_card_agent_label IS NOT NULL
                OR agent_card_company_name IS NOT NULL
                OR sidebar_text_color IS NOT NULL
                OR agent_card_text_color IS NOT NULL
                OR button_color IS NOT NULL
                OR button_text_color IS NOT NULL
              ) AS "hasCustomization",
              created_at AS "createdAt",
              updated_at AS "updatedAt"
       FROM agencies
       ORDER BY name ASC`
    );
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      hasCustomization: !!row.hasCustomization,
      customizable: true,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  /** Get branding fields for an agency, with presigned display URLs. */
  static async getBranding(id) {
    const agency = await Agency.getById(id);
    return Agency._withBrandingUrls(agency);
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
      `UPDATE agencies
       SET ${setCols}, updated_at = NOW()
       WHERE id = ${idVarIdx}
       RETURNING ${AGENCY_BRANDING_SELECT}`,
      [...values, id]
    );

    const agency = result.rows[0];
    if (!agency) throw new NotFoundError(`Agency not found: ${id}`);

    return Agency._withBrandingUrls(Agency._rowToApi(agency));
  }

  static async _withBrandingUrls(agency) {
    let withSidebar = await addPresignedUrlToItem(
      agency,
      "sidebarIconKey",
      "sidebarIconUrl"
    );
    withSidebar = await addPresignedUrlToItem(
      withSidebar,
      "agentCardLogoKey",
      "agentCardLogoUrl"
    );
    return {
      id: withSidebar.id,
      name: withSidebar.name,
      url: null,
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
      customizable: true,
      source: "agency",
    };
  }
}

module.exports = Agency;
