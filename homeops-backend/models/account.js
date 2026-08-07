"use strict";

/**
 * Account Model
 *
 * Manages multi-tenant accounts in the `accounts` table. Each account represents
 * an organization/workspace with an owner and optional members.
 *
 * Key operations:
 * - create / get / getAll / getUserAccounts: CRUD for accounts
 * - addUserToAccount / removeUserFromAccount: Manage account membership
 * - linkNewUserToAccount: Create account and assign owner in one step
 */

const db = require("../db");
const {
  NotFoundError,
  BadRequestError
} = require("../expressError");
const { sqlForPartialUpdate } = require("../helpers/sql");
const { generateAccountUrl } = require("../services/accountService");
const { isAccountLinkedToUser } = require("../helpers/accountUsers");
const { addPresignedUrlToItem } = require("../helpers/presignedUrls");

/** Shared SELECT list for account rows including branding columns. */
const ACCOUNT_SELECT = `
  id,
  name,
  url,
  owner_user_id AS "ownerUserId",
  accent_color AS "accentColor",
  sidebar_icon_key AS "sidebarIconKey",
  agent_card_logo_key AS "agentCardLogoKey",
  agent_card_accent_color AS "agentCardAccentColor",
  agent_card_background_color AS "agentCardBackgroundColor",
  agent_card_agent_label AS "agentCardAgentLabel",
  agent_card_company_name AS "agentCardCompanyName",
  sidebar_text_color AS "sidebarTextColor",
  agent_card_text_color AS "agentCardTextColor",
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
};

/** Normalize empty strings to null for optional branding fields. */
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

class Account {

  /** Create a new account.
   *
   * Data: { name, ownerUserId }
   *
   * Returns { id, name, url, ownerUserId, createdAt, updatedAt }
   *
   * Throws BadRequestError if name or ownerUserId is missing.
   **/
  static async create({ name, ownerUserId }) {
    if (!name) {
      throw new BadRequestError("Name is required to create an account");
    }
    if (!ownerUserId) {
      throw new BadRequestError("Owner user ID is required to create an account");
    }

    const url = await generateAccountUrl(name);

    const result = await db.query(
      `INSERT INTO accounts (
              name,
              url,
              owner_user_id)
       VALUES ($1, $2, $3)
       RETURNING id,
              name,
              url,
              owner_user_id AS "ownerUserId",
              created_at AS "createdAt",
              updated_at AS "updatedAt"`,
      [name, url, ownerUserId]
    );

    return result.rows[0];
  }

  /** Get a specific account by id.
   *
   * Returns { id, name, url, ownerUserId, createdAt, updatedAt }
   *
   * Throws NotFoundError if account not found.
   **/
  static async get(id) {
    const result = await db.query(
      `SELECT ${ACCOUNT_SELECT}
       FROM accounts
       WHERE id = $1`,
      [id]
    );

    const account = result.rows[0];
    if (!account) throw new NotFoundError(`No account with id: ${id}`);

    return account;
  }

  /** Get all accounts.
   *
   * Returns [{ id, name, url, ownerUserId, ownerEmail, accountType, agencyId,
   *   agencyName, customizable, inheritsFromLabel, hasCustomization, ... }, ...]
   *
   * Throws NotFoundError if no accounts are found.
   **/
  static async getAll() {
    const { HAS_CUSTOMIZATION_SQL } = require("../services/brandingService");
    const result = await db.query(
      `SELECT a.id,
              a.name,
              a.url,
              a.owner_user_id AS "ownerUserId",
              u.email AS "ownerEmail",
              COALESCE(u.role::text, 'unknown') AS "accountType",
              aff.agency_id AS "agencyId",
              ag.name AS "agencyName",
              ${HAS_CUSTOMIZATION_SQL("ag")} AS "agencyHasCustomization",
              aff.team_id AS "teamId",
              tm.name AS "teamName",
              ${HAS_CUSTOMIZATION_SQL("tm")} AS "teamHasCustomization",
              a.accent_color AS "accentColor",
              a.sidebar_icon_key AS "sidebarIconKey",
              a.agent_card_logo_key AS "agentCardLogoKey",
              a.agent_card_accent_color AS "agentCardAccentColor",
              a.agent_card_background_color AS "agentCardBackgroundColor",
              a.agent_card_agent_label AS "agentCardAgentLabel",
              a.agent_card_company_name AS "agentCardCompanyName",
              a.sidebar_text_color AS "sidebarTextColor",
              a.agent_card_text_color AS "agentCardTextColor",
              a.created_at AS "createdAt",
              a.updated_at AS "updatedAt",
              (
                (
                  aff.agency_id IS NULL
                  AND (
                    a.accent_color IS NOT NULL
                    OR a.sidebar_icon_key IS NOT NULL
                    OR a.agent_card_logo_key IS NOT NULL
                    OR a.agent_card_accent_color IS NOT NULL
                    OR a.agent_card_background_color IS NOT NULL
                    OR a.agent_card_agent_label IS NOT NULL
                    OR a.agent_card_company_name IS NOT NULL
                    OR a.sidebar_text_color IS NOT NULL
                    OR a.agent_card_text_color IS NOT NULL
                  )
                )
                OR (
                  aff.agency_id IS NOT NULL
                  AND ${HAS_CUSTOMIZATION_SQL("ag")}
                )
                OR (
                  aff.agency_id IS NOT NULL
                  AND NOT COALESCE(${HAS_CUSTOMIZATION_SQL("ag")}, false)
                  AND aff.team_id IS NOT NULL
                  AND ${HAS_CUSTOMIZATION_SQL("tm")}
                )
              ) AS "hasCustomization"
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
       ORDER BY a.name ASC`
    );

    const accounts = result.rows;
    if (accounts.length === 0) throw new NotFoundError("No accounts found");

    const { buildListMeta, enrichAccountsWithSponsorshipMeta } = require("../services/brandingService");

    const withMeta = accounts.map((a) => {
      const meta = buildListMeta(a);
      return {
        ...a,
        ...meta,
        customizable: meta.customizable,
      };
    });

    return enrichAccountsWithSponsorshipMeta(withMeta);
  }

  /** Get all accounts for a specific user.
   *
   * @param {number} userId
   * @returns [{ id, name, url, ownerUserId, branding..., createdAt, updatedAt }, ...]
   *
   * Throws NotFoundError if user has no accounts.
   **/
  static async getUserAccounts(userId) {
    const result = await db.query(
      `SELECT a.id,
              a.name,
              a.url,
              a.owner_user_id AS "ownerUserId",
              a.accent_color AS "accentColor",
              a.sidebar_icon_key AS "sidebarIconKey",
              a.agent_card_logo_key AS "agentCardLogoKey",
              a.agent_card_accent_color AS "agentCardAccentColor",
              a.agent_card_background_color AS "agentCardBackgroundColor",
              a.agent_card_agent_label AS "agentCardAgentLabel",
              a.agent_card_company_name AS "agentCardCompanyName",
              a.sidebar_text_color AS "sidebarTextColor",
              a.agent_card_text_color AS "agentCardTextColor",
              a.created_at AS "createdAt",
              a.updated_at AS "updatedAt"
       FROM accounts a
       JOIN account_users au ON a.id = au.account_id
       WHERE au.user_id = $1
       ORDER BY (a.owner_user_id = $1) DESC, a.created_at ASC`,
      [userId]
    );

    const accounts = result.rows;
    if (accounts.length === 0) throw new NotFoundError(`No accounts found for user with ID: ${userId}`);

    return accounts;
  }

  /** Update account data with `data`.
   *
   * Data can include: { name, url }
   *
   * Returns account row including branding fields.
   *
   * Throws NotFoundError if account not found.
   **/
  static async update(id, data) {
    const { setCols, values } = sqlForPartialUpdate(data, {});
    const idVarIdx = "$" + (values.length + 1);

    const querySql = `
      UPDATE accounts
      SET ${setCols}
      WHERE id = ${idVarIdx}
      RETURNING ${ACCOUNT_SELECT}`;
    const result = await db.query(querySql, [...values, id]);
    const account = result.rows[0];

    if (!account) throw new NotFoundError(`No account with id: ${id}`);

    return account;
  }

  /**
   * Get branding fields for an account, with presigned display URLs for icons.
   *
   * @param {number|string} id
   * @returns {Promise<object>}
   */
  static async getBranding(id) {
    const account = await this.get(id);
    return this._withBrandingUrls(account);
  }

  /**
   * Partial-update branding fields. Pass null to clear a field.
   *
   * @param {number|string} id
   * @param {object} data - camelCase branding fields
   * @returns {Promise<object>} branding with display URLs
   */
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
      `UPDATE accounts
       SET ${setCols}, updated_at = NOW()
       WHERE id = ${idVarIdx}
       RETURNING ${ACCOUNT_SELECT}`,
      [...values, id]
    );

    const account = result.rows[0];
    if (!account) throw new NotFoundError(`No account with id: ${id}`);

    return this._withBrandingUrls(account);
  }

  /** Attach presigned URLs for sidebar icon and agent card logo. */
  static async _withBrandingUrls(account) {
    let withSidebar = await addPresignedUrlToItem(
      account,
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
      url: withSidebar.url,
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
    };
  }

  /** Remove an account.
   *
   * Returns { deleted: id }
   *
   * Throws NotFoundError if account not found.
   **/
  static async remove(id) {
    const result = await db.query(
      `DELETE
       FROM accounts
       WHERE id = $1
       RETURNING id`,
      [id]
    );

    const account = result.rows[0];
    if (!account) throw new NotFoundError(`No account with id: ${id}`);

    return { deleted: id };
  }

  /** Add a user to an account.
   *
   * If the account has no users yet, role is forced to 'owner'.
   * Uses upsert: if the user is already in the account, updates their role.
   *
   * Data: { userId, accountId, role }
   *
   * Returns { accountId, userId, role, createdAt }
   **/
  static async addUserToAccount({ userId, accountId, role = 'member' }) {
    /* Safeguard: the platform account (owned by a super_admin, e.g. "main") must
     * stay super_admin-only. Adding a non-super-admin as a member would attribute
     * their properties/usage to that account and pollute their own account list,
     * so block it here as a last line of defense across all call sites. The owner
     * themselves is always allowed (covers account creation). */
    const ownerRes = await db.query(
      `SELECT a.owner_user_id, u.role::text AS owner_role
         FROM accounts a
         JOIN users u ON u.id = a.owner_user_id
        WHERE a.id = $1`,
      [accountId]
    );
    const owner = ownerRes.rows[0];
    if (owner && owner.owner_role === 'super_admin' && owner.owner_user_id !== userId) {
      const addeeRes = await db.query(
        `SELECT role::text AS role FROM users WHERE id = $1`,
        [userId]
      );
      if (addeeRes.rows[0]?.role !== 'super_admin') {
        throw new BadRequestError(
          "Cannot add a non-super-admin user to the platform (super admin) account."
        );
      }
    }

    const isLinked = await isAccountLinkedToUser(accountId);

    if (!isLinked) {
      role = 'owner';
    }

    try {
      const result = await db.query(
        `INSERT INTO account_users (
            account_id,
            user_id,
            role)
        VALUES ($1, $2, $3)
        ON CONFLICT (account_id, user_id) DO UPDATE SET role = EXCLUDED.role
        RETURNING account_id AS "accountId",
                  user_id AS "userId",
                  role,
                  created_at AS "createdAt"`,
        [accountId, userId, role]
      );

      return result.rows[0];
    } catch (err) {
      console.error("Error adding user to account:", err);
      throw err;
    }
  }

  /** Checks if a user is linked to a specific account.
   *  Returns true if linked, false otherwise.
   */
  static async isUserLinkedToAccount(userId, accountId) {
    try {
      const result = await db.query(
        `SELECT user_id
        FROM account_users
        WHERE user_id = $1 AND account_id = $2`,
        [userId, accountId]
      );

      return result.rows.length > 0;
    } catch (err) {
      console.error("Error checking if user is linked to account:", err);
      throw err;
    }
  }

  /** Create a new account and link a user as owner.
   *
   * Data: { name, userId }
   *
   * Returns the created account.
   */
  static async linkNewUserToAccount({ name, userId }) {
    try {
      const account = await this.create({ name, ownerUserId: userId });
      await this.addUserToAccount({ userId, accountId: account.id, role: 'owner' });
      return account;
    } catch (err) {
      console.error("Error linking new user to account:", err);
      throw err;
    }
  }

  /** Remove a user from an account.
   *
   * Data: { userId, accountId }
   */
  static async removeUserFromAccount({ userId, accountId }) {
    try {
      const result = await db.query(
        `DELETE FROM account_users
        WHERE user_id = $1 AND account_id = $2`,
        [userId, accountId]
      );
      return result.rows[0];
    } catch (err) {
      console.error("Error removing user from account:", err);
      throw err;
    }
  }
}

module.exports = Account;
