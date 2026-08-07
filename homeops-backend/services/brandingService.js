"use strict";

/**
 * Resolve effective white-label branding for an account.
 *
 * Rules:
 * - Agency with customization → agency branding
 * - Else team with customization → team branding
 * - Agent without affiliation → own account branding
 * - Affiliated agent with neither agency nor team customization → Opsy defaults
 * - Homeowner with active property sponsor → sponsor agent’s effective branding
 * - Otherwise → Opsy defaults (empty fields)
 */

const db = require("../db");
const Account = require("../models/account");
const Agency = require("../models/agency");
const Team = require("../models/team");
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

const HAS_CUSTOMIZATION_SQL = Team.HAS_CUSTOMIZATION_SQL;

/**
 * Load owner role + optional active agency/team for an account.
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
            ag.name AS "agencyName",
            ${HAS_CUSTOMIZATION_SQL("ag")} AS "agencyHasCustomization",
            aff.team_id AS "teamId",
            tm.name AS "teamName",
            ${HAS_CUSTOMIZATION_SQL("tm")} AS "teamHasCustomization"
     FROM accounts a
     LEFT JOIN users u ON u.id = a.owner_user_id
     LEFT JOIN LATERAL (
       SELECT aa.agency_id, aa.team_id
       FROM agent_affiliations aa
       WHERE aa.user_id = a.owner_user_id AND aa.status = 'active'
       LIMIT 1
     ) aff ON true
     LEFT JOIN agencies ag ON ag.id = aff.agency_id
     LEFT JOIN teams tm ON tm.id = aff.team_id
     WHERE a.id = $1`,
    [accountId]
  );
  const row = result.rows[0];
  if (!row) throw new NotFoundError(`No account with id: ${accountId}`);
  return {
    ...row,
    agencyHasCustomization: !!row.agencyHasCustomization,
    teamHasCustomization: !!row.teamHasCustomization,
  };
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
 * Whether a team may be customized (parent agency has no branding).
 * @param {number|string} teamId
 */
async function isTeamCustomizable(teamId) {
  const result = await db.query(
    `SELECT ${HAS_CUSTOMIZATION_SQL("ag")} AS "agencyHasCustomization"
     FROM teams t
     INNER JOIN offices o ON o.id = t.office_id
     INNER JOIN agencies ag ON ag.id = o.agency_id
     WHERE t.id = $1`,
    [teamId]
  );
  if (!result.rows[0]) throw new NotFoundError(`Team not found: ${teamId}`);
  return !result.rows[0].agencyHasCustomization;
}

/**
 * Reject branding updates for teams overridden by agency branding.
 * @param {number|string} teamId
 */
async function assertTeamCustomizable(teamId) {
  const ok = await isTeamCustomizable(teamId);
  if (!ok) {
    throw new BadRequestError(
      "This team can’t be customized while its agency has branding. Clear the agency customization first, or edit the agency instead."
    );
  }
}

/**
 * Admin-list metadata for an account row (type, agency, customizable, inheritsFrom).
 * @param {object} row - enriched account from getAll or owner context
 */
function buildListMeta(row) {
  const accountType = row.ownerRole || row.accountType || "unknown";
  const agencyId = row.agencyId ?? null;
  const agencyName = row.agencyName ?? null;
  const teamId = row.teamId ?? null;
  const teamName = row.teamName ?? null;
  const agencyHasCustomization = !!row.agencyHasCustomization;
  const teamHasCustomization = !!row.teamHasCustomization;
  const customizable = accountType === "agent" && !agencyId;

  let inheritsFromLabel = null;
  let inheritsFromType = null;

  if (!customizable) {
    if (accountType === "agent" && agencyId) {
      if (agencyHasCustomization) {
        inheritsFromType = "agency";
        inheritsFromLabel = agencyName
          ? `Inherits from agency ${agencyName}`
          : "Inherits from agency";
      } else if (teamId && teamHasCustomization) {
        inheritsFromType = "team";
        inheritsFromLabel = teamName
          ? `Inherits from team ${teamName}`
          : "Inherits from team";
      } else {
        inheritsFromType = "default";
        inheritsFromLabel = "Uses Opsy defaults (no agency or team branding)";
      }
    } else if (accountType === "homeowner") {
      if (row.sponsorAccountId || row.inheritsFromSponsor) {
        if (row.sponsorAgencyHasCustomization) {
          inheritsFromType = "sponsor_agency";
          inheritsFromLabel = row.sponsorAgencyName
            ? `Inherits from agency ${row.sponsorAgencyName} (via sponsoring agent)`
            : "Inherits from sponsoring agent's agency";
        } else if (row.sponsorTeamHasCustomization) {
          inheritsFromType = "sponsor_team";
          inheritsFromLabel = row.sponsorTeamName
            ? `Inherits from team ${row.sponsorTeamName} (via sponsoring agent)`
            : "Inherits from sponsoring agent's team";
        } else {
          const sponsorName =
            row.sponsorAccountName ||
            row.sponsorAgencyName ||
            row.inheritsFromLabelName;
          inheritsFromType = "sponsor_agent";
          inheritsFromLabel = sponsorName
            ? `Inherits from sponsoring agent ${sponsorName}`
            : "Inherits from sponsoring agent";
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
    teamId,
    teamName,
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
            ag.name AS "sponsorAgencyName",
            ${HAS_CUSTOMIZATION_SQL("ag")} AS "sponsorAgencyHasCustomization",
            aff.team_id AS "sponsorTeamId",
            tm.name AS "sponsorTeamName",
            ${HAS_CUSTOMIZATION_SQL("tm")} AS "sponsorTeamHasCustomization"
     FROM properties p
     JOIN accounts sa ON sa.id = p.active_sponsor_account_id
     LEFT JOIN LATERAL (
       SELECT aa.agency_id, aa.team_id
       FROM agent_affiliations aa
       WHERE aa.user_id = sa.owner_user_id AND aa.status = 'active'
       LIMIT 1
     ) aff ON true
     LEFT JOIN agencies ag ON ag.id = aff.agency_id
     LEFT JOIN teams tm ON tm.id = aff.team_id
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
      sponsorAgencyHasCustomization: !!sponsor.sponsorAgencyHasCustomization,
      sponsorTeamId: sponsor.sponsorTeamId,
      sponsorTeamName: sponsor.sponsorTeamName,
      sponsorTeamHasCustomization: !!sponsor.sponsorTeamHasCustomization,
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
 * Resolve stored branding payload for a team (with URLs).
 */
async function getTeamBrandingPayload(teamId) {
  return Team.getBranding(teamId);
}

/**
 * Resolve stored branding payload for an account (own columns, with URLs).
 */
async function getAccountStoredBrandingPayload(accountId) {
  return Account.getBranding(accountId);
}

/**
 * Resolve effective branding for an agent account (agency, team, or own).
 * Does not handle homeowners.
 */
async function resolveAgentEffectiveBranding(accountId, ctx) {
  if (ctx.agencyId && ctx.agencyHasCustomization) {
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
      teamId: ctx.teamId ?? null,
      teamName: ctx.teamName ?? null,
      inheritsFromLabel: ctx.agencyName
        ? `Inherits from agency ${ctx.agencyName}`
        : "Inherits from agency",
      inheritsFromType: "agency",
    };
  }

  if (ctx.agencyId && ctx.teamId && ctx.teamHasCustomization) {
    const branding = await getTeamBrandingPayload(ctx.teamId);
    return {
      ...branding,
      id: ctx.id,
      name: ctx.name,
      url: ctx.url,
      source: "team",
      customizable: false,
      agencyId: ctx.agencyId,
      agencyName: ctx.agencyName,
      teamId: ctx.teamId,
      teamName: ctx.teamName,
      inheritsFromLabel: ctx.teamName
        ? `Inherits from team ${ctx.teamName}`
        : "Inherits from team",
      inheritsFromType: "team",
    };
  }

  if (ctx.agencyId) {
    return {
      ...EMPTY_BRANDING_FIELDS,
      id: ctx.id,
      name: ctx.name,
      url: ctx.url,
      source: "default",
      customizable: false,
      agencyId: ctx.agencyId,
      agencyName: ctx.agencyName,
      teamId: ctx.teamId ?? null,
      teamName: ctx.teamName ?? null,
      inheritsFromLabel: "Uses Opsy defaults (no agency or team branding)",
      inheritsFromType: "default",
    };
  }

  const branding = await getAccountStoredBrandingPayload(accountId);
  return {
    ...branding,
    source: "account",
    customizable: true,
    agencyId: null,
    agencyName: null,
    teamId: null,
    teamName: null,
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
      let source = "sponsor_agent";
      if (sponsorEffective.source === "agency") source = "sponsor_agency";
      else if (sponsorEffective.source === "team") source = "sponsor_team";

      let inheritsFromLabel =
        sponsorCtx.name
          ? `Inherits from sponsoring agent ${sponsorCtx.name}`
          : "Inherits from sponsoring agent";
      if (sponsorEffective.source === "agency" && sponsorCtx.agencyName) {
        inheritsFromLabel = `Inherits from agency ${sponsorCtx.agencyName} (via sponsoring agent)`;
      } else if (sponsorEffective.source === "team" && sponsorCtx.teamName) {
        inheritsFromLabel = `Inherits from team ${sponsorCtx.teamName} (via sponsoring agent)`;
      }

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
        teamId: sponsorCtx.teamId ?? null,
        teamName: sponsorCtx.teamName ?? null,
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
      teamId: null,
      teamName: null,
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
    teamId: null,
    teamName: null,
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
  isTeamCustomizable,
  assertTeamCustomizable,
  buildListMeta,
  enrichAccountsWithSponsorshipMeta,
  getEffectiveAccountBranding,
  EMPTY_BRANDING_FIELDS,
  HAS_CUSTOMIZATION_SQL,
};
