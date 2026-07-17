"use strict";

/**
 * Resolve effective white-label branding for an account.
 *
 * Rules:
 * - Agency → own agency branding (edited separately)
 * - Agent with active agency affiliation → agency branding
 * - Agent without affiliation → own account branding
 * - Homeowner with active property sponsor → sponsor agent’s effective branding
 * - Otherwise → Opsy defaults (empty fields)
 */

const db = require("../db");
const Account = require("../models/account");
const Agency = require("../models/agency");
const { BadRequestError, NotFoundError } = require("../expressError");

const EMPTY_BRANDING_FIELDS = {
  accentColor: null,
  sidebarIconKey: null,
  sidebarIconUrl: null,
  agentCardLogoKey: null,
  agentCardLogoUrl: null,
  agentCardAccentColor: null,
  agentCardBackgroundColor: null,
  agentCardAgentLabel: null,
  agentCardCompanyName: null,
  sidebarTextColor: null,
  agentCardTextColor: null,
};

/**
 * Load owner role + optional active agency for an account.
 * @param {number|string} accountId
 */
async function getAccountOwnerContext(accountId) {
  const result = await db.query(
    `SELECT a.id,
            a.name,
            a.url,
            a.owner_user_id AS "ownerUserId",
            u.role::text AS "ownerRole",
            u.name AS "ownerName",
            u.email AS "ownerEmail",
            aff.agency_id AS "agencyId",
            ag.name AS "agencyName"
     FROM accounts a
     LEFT JOIN users u ON u.id = a.owner_user_id
     LEFT JOIN LATERAL (
       SELECT aa.agency_id
       FROM agent_affiliations aa
       WHERE aa.user_id = a.owner_user_id AND aa.status = 'active'
       LIMIT 1
     ) aff ON true
     LEFT JOIN agencies ag ON ag.id = aff.agency_id
     WHERE a.id = $1`,
    [accountId]
  );
  const row = result.rows[0];
  if (!row) throw new NotFoundError(`No account with id: ${accountId}`);
  return row;
}

/**
 * First active sponsor account id for any property owned by this account.
 * @param {number|string} accountId
 * @returns {Promise<number|null>}
 */
async function getActiveSponsorAccountId(accountId) {
  const result = await db.query(
    `SELECT p.active_sponsor_account_id AS "sponsorAccountId"
     FROM properties p
     WHERE p.account_id = $1
       AND p.active_sponsor_account_id IS NOT NULL
     ORDER BY p.id ASC
     LIMIT 1`,
    [accountId]
  );
  const id = result.rows[0]?.sponsorAccountId;
  return id != null ? Number(id) : null;
}

/**
 * Whether this account may be customized (unaffiliated agent account).
 * @param {number|string} accountId
 */
async function isAccountCustomizable(accountId) {
  const ctx = await getAccountOwnerContext(accountId);
  return ctx.ownerRole === "agent" && !ctx.agencyId;
}

/**
 * Admin-list metadata for an account row (type, agency, customizable, inheritsFrom).
 * @param {object} row - enriched account from getAll or owner context
 */
function buildListMeta(row) {
  const accountType = row.ownerRole || row.accountType || "unknown";
  const agencyId = row.agencyId ?? null;
  const agencyName = row.agencyName ?? null;
  const customizable = accountType === "agent" && !agencyId;

  let inheritsFromLabel = null;
  let inheritsFromType = null;

  if (!customizable) {
    if (accountType === "agent" && agencyId) {
      inheritsFromType = "agency";
      inheritsFromLabel = agencyName
        ? `Inherits from agency ${agencyName}`
        : "Inherits from agency";
    } else if (accountType === "homeowner") {
      if (row.sponsorAccountId || row.inheritsFromSponsor) {
        const sponsorName =
          row.sponsorAccountName ||
          row.sponsorAgencyName ||
          row.inheritsFromLabelName;
        inheritsFromType = row.sponsorAgencyId ? "sponsor_agency" : "sponsor_agent";
        inheritsFromLabel = sponsorName
          ? `Inherits from sponsoring agent ${sponsorName}`
          : "Inherits from sponsoring agent";
        if (row.sponsorAgencyName) {
          inheritsFromLabel = `Inherits from agency ${row.sponsorAgencyName} (via sponsoring agent)`;
          inheritsFromType = "sponsor_agency";
        }
      } else {
        inheritsFromType = "default";
        inheritsFromLabel = "Homeowner accounts aren’t customizable";
      }
    } else {
      inheritsFromType = "default";
      inheritsFromLabel = "Only agent accounts without an agency can be customized";
    }
  }

  return {
    accountType,
    agencyId,
    agencyName,
    customizable,
    inheritsFromLabel,
    inheritsFromType,
  };
}

/**
 * Attach list metadata for homeowner sponsorship inheritance labels.
 * Batch helper used by Account.getAll.
 */
async function enrichAccountsWithSponsorshipMeta(accounts) {
  const homeownerIds = accounts
    .filter((a) => a.accountType === "homeowner")
    .map((a) => a.id);
  if (!homeownerIds.length) return accounts;

  const result = await db.query(
    `SELECT DISTINCT ON (p.account_id)
            p.account_id AS "accountId",
            p.active_sponsor_account_id AS "sponsorAccountId",
            sa.name AS "sponsorAccountName",
            sa.url AS "sponsorAccountUrl",
            aff.agency_id AS "sponsorAgencyId",
            ag.name AS "sponsorAgencyName"
     FROM properties p
     JOIN accounts sa ON sa.id = p.active_sponsor_account_id
     LEFT JOIN LATERAL (
       SELECT aa.agency_id
       FROM agent_affiliations aa
       WHERE aa.user_id = sa.owner_user_id AND aa.status = 'active'
       LIMIT 1
     ) aff ON true
     LEFT JOIN agencies ag ON ag.id = aff.agency_id
     WHERE p.account_id = ANY($1::int[])
       AND p.active_sponsor_account_id IS NOT NULL
     ORDER BY p.account_id, p.id ASC`,
    [homeownerIds]
  );

  const byAccount = new Map(
    result.rows.map((r) => [Number(r.accountId), r])
  );

  return accounts.map((a) => {
    if (a.accountType !== "homeowner") return a;
    const sponsor = byAccount.get(Number(a.id));
    if (!sponsor) {
      return {
        ...a,
        ...buildListMeta(a),
      };
    }
    const withSponsor = {
      ...a,
      sponsorAccountId: sponsor.sponsorAccountId,
      sponsorAccountName: sponsor.sponsorAccountName,
      sponsorAccountUrl: sponsor.sponsorAccountUrl,
      sponsorAgencyId: sponsor.sponsorAgencyId,
      sponsorAgencyName: sponsor.sponsorAgencyName,
    };
    return {
      ...withSponsor,
      ...buildListMeta(withSponsor),
    };
  });
}

/**
 * Resolve stored branding payload for an agency (with URLs).
 */
async function getAgencyBrandingPayload(agencyId) {
  return Agency.getBranding(agencyId);
}

/**
 * Resolve stored branding payload for an account (own columns, with URLs).
 */
async function getAccountStoredBrandingPayload(accountId) {
  return Account.getBranding(accountId);
}

/**
 * Resolve effective branding for an agent account (agency or own).
 * Does not handle homeowners.
 */
async function resolveAgentEffectiveBranding(accountId, ctx) {
  if (ctx.agencyId) {
    const branding = await getAgencyBrandingPayload(ctx.agencyId);
    return {
      ...branding,
      // Keep account identity in payload for UI shell context
      id: ctx.id,
      name: ctx.name,
      url: ctx.url,
      source: "agency",
      customizable: false,
      agencyId: ctx.agencyId,
      agencyName: ctx.agencyName,
      inheritsFromLabel: ctx.agencyName
        ? `Inherits from agency ${ctx.agencyName}`
        : "Inherits from agency",
      inheritsFromType: "agency",
    };
  }

  const branding = await getAccountStoredBrandingPayload(accountId);
  return {
    ...branding,
    source: "account",
    customizable: true,
    agencyId: null,
    agencyName: null,
    inheritsFromLabel: null,
    inheritsFromType: null,
  };
}

/**
 * Effective branding for any account (inheritance applied).
 * @param {number|string} accountId
 */
async function getEffectiveAccountBranding(accountId) {
  const ctx = await getAccountOwnerContext(accountId);
  const role = ctx.ownerRole;

  if (role === "agent") {
    return resolveAgentEffectiveBranding(accountId, ctx);
  }

  if (role === "homeowner") {
    const sponsorAccountId = await getActiveSponsorAccountId(accountId);
    if (sponsorAccountId) {
      const sponsorCtx = await getAccountOwnerContext(sponsorAccountId);
      const sponsorEffective = await resolveAgentEffectiveBranding(
        sponsorAccountId,
        sponsorCtx
      );
      const source =
        sponsorEffective.source === "agency" ? "sponsor_agency" : "sponsor_agent";
      const inheritsFromLabel =
        sponsorEffective.source === "agency" && sponsorCtx.agencyName
          ? `Inherits from agency ${sponsorCtx.agencyName} (via sponsoring agent)`
          : sponsorCtx.name
            ? `Inherits from sponsoring agent ${sponsorCtx.name}`
            : "Inherits from sponsoring agent";
      return {
        ...EMPTY_BRANDING_FIELDS,
        ...sponsorEffective,
        id: ctx.id,
        name: ctx.name,
        url: ctx.url,
        source,
        customizable: false,
        agencyId: sponsorCtx.agencyId ?? null,
        agencyName: sponsorCtx.agencyName ?? null,
        inheritsFromLabel,
        inheritsFromType: source,
        sponsorAccountId,
      };
    }

    return {
      ...EMPTY_BRANDING_FIELDS,
      id: ctx.id,
      name: ctx.name,
      url: ctx.url,
      source: "default",
      customizable: false,
      agencyId: null,
      agencyName: null,
      inheritsFromLabel: "Homeowner accounts aren’t customizable",
      inheritsFromType: "default",
    };
  }

  return {
    ...EMPTY_BRANDING_FIELDS,
    id: ctx.id,
    name: ctx.name,
    url: ctx.url,
    source: "default",
    customizable: false,
    agencyId: null,
    agencyName: null,
    inheritsFromLabel: "Only agent accounts without an agency can be customized",
    inheritsFromType: "default",
  };
}

/**
 * Reject branding updates for non-customizable accounts.
 * @param {number|string} accountId
 */
async function assertAccountCustomizable(accountId) {
  const ok = await isAccountCustomizable(accountId);
  if (!ok) {
    throw new BadRequestError(
      "Only agent accounts that are not affiliated with an agency can be customized."
    );
  }
}

module.exports = {
  getAccountOwnerContext,
  getActiveSponsorAccountId,
  isAccountCustomizable,
  assertAccountCustomizable,
  buildListMeta,
  enrichAccountsWithSponsorshipMeta,
  getEffectiveAccountBranding,
  EMPTY_BRANDING_FIELDS,
};
