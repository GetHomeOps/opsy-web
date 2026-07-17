"use strict";

/**
 * Tier Service
 *
 * Enforces subscription tier limits. Reads limits from plan_limits (preferred)
 * or subscription_products. Checks usage before allowing actions.
 *
 * Exports: getAccountLimits, getEffectiveLimits, canCreateProperty, canAddContact,
 *          canInviteViewer, canAddTeamMember, checkAiTokenQuota, checkAiFeaturesAllowed,
 *          checkPrePurchaseAllowed, canUploadDocumentToSystem
 */

const db = require("../db");
const { BILLING_MOCK_MODE, AI_TOKEN_COST_USD } = require("../config");

const DEFAULT_LIMITS = {
  maxProperties: 3, maxContacts: 50, maxViewers: 5, maxTeamMembers: 10,
  aiTokenMonthlyQuota: 50000, maxDocumentsPerSystem: 5, aiFeaturesEnabled: true,
  prePurchaseEnabled: false,
};

function isAdminRole(role) {
  return role === "super_admin" || role === "admin";
}

/** Normalize a plan_limits row, converting a USD AI budget into a token quota. */
function applyAiTokenQuota(row) {
  let aiTokenMonthlyQuota = row.aiTokenMonthlyQuota;
  if (row.aiTokenMonthlyValueUsd != null && row.aiTokenMonthlyValueUsd > 0) {
    const pricePerToken = row.aiTokenPriceUsd != null && row.aiTokenPriceUsd > 0
      ? Number(row.aiTokenPriceUsd) : AI_TOKEN_COST_USD;
    if (pricePerToken > 0) {
      aiTokenMonthlyQuota = Math.floor(row.aiTokenMonthlyValueUsd / pricePerToken);
    }
  }
  return { ...DEFAULT_LIMITS, ...row, aiTokenMonthlyQuota };
}

/** Resolve plan limits directly from a plan (subscription_products) code. Used for the
 *  grace-period snapshot so entitlements stay deterministic even if the sponsor's live
 *  plan later changes. Falls back to DEFAULT_LIMITS when the code is unknown. */
async function getLimitsForPlanCode(planCode) {
  if (!planCode) return { ...DEFAULT_LIMITS };
  const limRes = await db.query(
    `SELECT pl.max_properties AS "maxProperties", pl.max_contacts AS "maxContacts",
            pl.max_viewers AS "maxViewers", pl.max_team_members AS "maxTeamMembers",
            pl.ai_token_monthly_quota AS "aiTokenMonthlyQuota",
            pl.ai_token_monthly_value_usd AS "aiTokenMonthlyValueUsd",
            pl.ai_token_price_usd AS "aiTokenPriceUsd",
            pl.max_documents_per_system AS "maxDocumentsPerSystem",
            COALESCE(pl.ai_features_enabled, true) AS "aiFeaturesEnabled",
            COALESCE(pl.pre_purchase_enabled, false) AS "prePurchaseEnabled"
     FROM plan_limits pl
     JOIN subscription_products sp ON sp.id = pl.subscription_product_id
     WHERE sp.code = $1
     LIMIT 1`,
    [planCode]
  );
  if (limRes.rows[0]) return applyAiTokenQuota(limRes.rows[0]);
  return { ...DEFAULT_LIMITS };
}

async function getAccountLimits(accountId) {
  const subRes = await db.query(
    `SELECT asub.subscription_product_id
     FROM account_subscriptions asub
     WHERE asub.account_id = $1 AND asub.status IN ('active', 'trialing')
     ORDER BY asub.current_period_end DESC NULLS LAST
     LIMIT 1`,
    [accountId]
  );

  const productId = subRes.rows[0]?.subscription_product_id;
  if (productId) {
    const limRes = await db.query(
      `SELECT pl.max_properties AS "maxProperties", pl.max_contacts AS "maxContacts",
              pl.max_viewers AS "maxViewers", pl.max_team_members AS "maxTeamMembers",
              pl.ai_token_monthly_quota AS "aiTokenMonthlyQuota",
              pl.ai_token_monthly_value_usd AS "aiTokenMonthlyValueUsd",
              pl.ai_token_price_usd AS "aiTokenPriceUsd",
              pl.max_documents_per_system AS "maxDocumentsPerSystem",
              COALESCE(pl.ai_features_enabled, true) AS "aiFeaturesEnabled",
              COALESCE(pl.pre_purchase_enabled, false) AS "prePurchaseEnabled"
       FROM plan_limits pl WHERE pl.subscription_product_id = $1`,
      [productId]
    );
    if (limRes.rows[0]) {
      const row = limRes.rows[0];
      let aiTokenMonthlyQuota = row.aiTokenMonthlyQuota;
      if (row.aiTokenMonthlyValueUsd != null && row.aiTokenMonthlyValueUsd > 0) {
        const pricePerToken = row.aiTokenPriceUsd != null && row.aiTokenPriceUsd > 0
          ? Number(row.aiTokenPriceUsd) : AI_TOKEN_COST_USD;
        if (pricePerToken > 0) {
          aiTokenMonthlyQuota = Math.floor(row.aiTokenMonthlyValueUsd / pricePerToken);
        }
      }
      return { ...DEFAULT_LIMITS, ...row, aiTokenMonthlyQuota };
    }
    const spRes = await db.query(
      `SELECT max_properties AS "maxProperties", max_contacts AS "maxContacts",
              max_viewers AS "maxViewers", max_team_members AS "maxTeamMembers"
       FROM subscription_products WHERE id = $1`,
      [productId]
    );
    if (spRes.rows[0]) return { ...DEFAULT_LIMITS, ...spRes.rows[0] };
  }

  const freeRes = await db.query(
    `SELECT pl.max_properties AS "maxProperties", pl.max_contacts AS "maxContacts",
            pl.max_viewers AS "maxViewers", pl.max_team_members AS "maxTeamMembers",
            pl.ai_token_monthly_quota AS "aiTokenMonthlyQuota",
            pl.ai_token_monthly_value_usd AS "aiTokenMonthlyValueUsd",
            pl.ai_token_price_usd AS "aiTokenPriceUsd",
            pl.max_documents_per_system AS "maxDocumentsPerSystem",
            COALESCE(pl.ai_features_enabled, true) AS "aiFeaturesEnabled",
            COALESCE(pl.pre_purchase_enabled, false) AS "prePurchaseEnabled"
     FROM plan_limits pl
     JOIN subscription_products sp ON sp.id = pl.subscription_product_id
     WHERE sp.code = 'homeowner_free' LIMIT 1`
  );
  if (freeRes.rows[0]) {
    const row = freeRes.rows[0];
    let aiTokenMonthlyQuota = row.aiTokenMonthlyQuota;
    if (row.aiTokenMonthlyValueUsd != null && row.aiTokenMonthlyValueUsd > 0) {
      const pricePerToken = row.aiTokenPriceUsd != null && row.aiTokenPriceUsd > 0
        ? Number(row.aiTokenPriceUsd) : AI_TOKEN_COST_USD;
      if (pricePerToken > 0) {
        aiTokenMonthlyQuota = Math.floor(row.aiTokenMonthlyValueUsd / pricePerToken);
      }
    }
    return { ...DEFAULT_LIMITS, ...row, aiTokenMonthlyQuota };
  }

  const fallback = await db.query(
    `SELECT max_properties AS "maxProperties", max_contacts AS "maxContacts",
            max_viewers AS "maxViewers", max_team_members AS "maxTeamMembers"
     FROM subscription_products WHERE (code = 'homeowner_free' OR LOWER(name) = 'free') AND is_active = true LIMIT 1`
  );
  return fallback.rows[0] ? { ...DEFAULT_LIMITS, ...fallback.rows[0] } : DEFAULT_LIMITS;
}

/** Get effective limits for a user (via their primary account). */
async function getEffectiveLimits(userId) {
  const accRes = await db.query(
    `SELECT account_id FROM account_users WHERE user_id = $1 ORDER BY (account_id IN (SELECT id FROM accounts WHERE owner_user_id = $1)) DESC LIMIT 1`,
    [userId]
  );
  if (!accRes.rows[0]) return DEFAULT_LIMITS;
  return getAccountLimits(accRes.rows[0].account_id);
}

/**
 * Resolve monthly AI token cap from plan limits.
 * When AI features are enabled but no token cap is configured (quota 0 with no budget),
 * treat as no monthly cap — the feature flag is the primary gate.
 */
function resolveAiTokenMonthlyQuota(limits) {
  const quota = limits?.aiTokenMonthlyQuota;
  if (quota == null || quota < 0) return null;
  if (quota > 0) return quota;
  if (limits?.aiFeaturesEnabled === false) return 0;
  return null;
}

/** Check if user has AI token quota remaining this month. Returns { allowed, used, quota }.
 *  Pass { propertyId } so agent-subsidized properties inherit the sponsor's quota cap.
 *  Usage is always metered per user; only the cap is resolved from the property plan. */
async function checkAiTokenQuota(userId, userRole, { propertyId } = {}) {
  if (isAdminRole(userRole)) return { allowed: true, used: 0, quota: 999999 };
  if (BILLING_MOCK_MODE) return { allowed: true, used: 0, quota: 999999 };

  const limits = propertyId
    ? await getPropertyEntitlements(propertyId)
    : await getEffectiveLimits(userId);
  const quota = resolveAiTokenMonthlyQuota(limits);
  if (quota === 0) return { allowed: false, used: 0, quota: 0 };
  if (quota == null) return { allowed: true, used: 0, quota: 999999 };

  const usedRes = await db.query(
    `SELECT COALESCE(SUM(prompt_tokens + completion_tokens), 0)::bigint AS used
     FROM user_api_usage WHERE user_id = $1 AND created_at >= date_trunc('month', CURRENT_TIMESTAMP)`,
    [userId]
  );
  const used = Number(usedRes.rows[0]?.used || 0);
  return { allowed: used < quota, used, quota };
}

/** Whether inspection analysis + AI chat are allowed for this user’s plan (admins / mock bypass).
 *  Pass { propertyId } so agent-subsidized properties inherit the sponsor's AI entitlement. */
async function checkAiFeaturesAllowed(userId, userRole, { propertyId } = {}) {
  if (isAdminRole(userRole)) return { allowed: true };
  if (BILLING_MOCK_MODE) return { allowed: true };

  const limits = propertyId
    ? await getPropertyEntitlements(propertyId)
    : await getEffectiveLimits(userId);
  const enabled = limits.aiFeaturesEnabled !== false;
  return {
    allowed: enabled,
    message: enabled
      ? undefined
      : "AI features (inspection analysis and assistant) are not included in your current plan. Upgrade to a plan that includes AI.",
  };
}

/** Whether Pre-Purchase Analysis is allowed for this user's plan (admins / mock bypass).
 *  Default OFF — only plans with prePurchaseEnabled === true grant access. */
async function checkPrePurchaseAllowed(userId, userRole) {
  if (isAdminRole(userRole)) return { allowed: true };
  if (BILLING_MOCK_MODE) return { allowed: true };

  const limits = await getEffectiveLimits(userId);
  const enabled = limits.prePurchaseEnabled === true;
  return {
    allowed: enabled,
    message: enabled
      ? undefined
      : "Pre-Purchase Analysis is not included in your current plan. Upgrade to a plan that includes Pre-Purchase.",
  };
}

async function countAccountOwnedProperties(accountId) {
  /* Count only properties that still have a team. Orphan rows (account_id set but
     no property_users) are invisible in the Properties list (which joins
     property_users) and must not consume plan slots or block "Add Property".
     Also exclude properties whose billing was handed to a sponsoring agent account. */
  const countRes = await db.query(
    `SELECT COUNT(*)::int AS count
     FROM properties p
     WHERE p.account_id = $1
       AND p.active_sponsor_account_id IS NULL
       AND EXISTS (
         SELECT 1 FROM property_users pu WHERE pu.property_id = p.id
       )`,
    [accountId]
  );
  return countRes.rows[0]?.count ?? 0;
}

/**
 * Resolve the effective plan limits/features for a single property.
 *
 * When the property is sponsored (agent-subsidized), entitlements derive from the
 * sponsoring account's subscription; otherwise from the property's owning account.
 * Returns the limits object augmented with { sponsored, sourceAccountId }.
 *
 * Note (bounded inheritance): account-scoped limits such as `maxContacts` are NOT
 * inherited via this helper — they remain on the beneficiary's own account. This
 * resolver is for property-scoped entitlements (documents-per-system, property
 * feature flags, AI usage tied to a property).
 */
async function getPropertyEntitlements(propertyId) {
  const res = await db.query(
    `SELECT p.account_id AS "accountId",
            p.active_sponsor_account_id AS "sponsorAccountId",
            p.grace_until AS "graceUntil",
            ps.grace_plan_code AS "gracePlanCode"
     FROM properties p
     LEFT JOIN property_sponsorships ps
       ON ps.property_id = p.id AND ps.status = 'grace'
     WHERE p.id = $1`,
    [propertyId]
  );
  const row = res.rows[0];
  if (!row) return { ...DEFAULT_LIMITS, sponsored: false, grace: false, sourceAccountId: null };

  // During the grace period, entitlements resolve from the snapshotted plan code so
  // they stay stable even if the sponsor account has since downgraded.
  const inGrace =
    row.graceUntil && new Date(row.graceUntil) > new Date();
  if (inGrace) {
    const limits = await getLimitsForPlanCode(row.gracePlanCode);
    return {
      ...limits,
      sponsored: true,
      grace: true,
      sourceAccountId: row.sponsorAccountId || row.accountId,
    };
  }

  const sourceAccountId = row.sponsorAccountId || row.accountId;
  const limits = await getAccountLimits(sourceAccountId);
  return { ...limits, sponsored: Boolean(row.sponsorAccountId), grace: false, sourceAccountId };
}

/** Whether an account has any active/trialing subscription (paid or free). */
async function accountHasActiveSubscription(accountId) {
  if (!accountId) return false;
  const res = await db.query(
    `SELECT 1 FROM account_subscriptions
     WHERE account_id = $1 AND status IN ('active', 'trialing') LIMIT 1`,
    [accountId]
  );
  return res.rows.length > 0;
}

/** Whether an account's active subscription is a paid (non-zero-cost) plan. */
async function accountHasActivePaidSubscription(accountId) {
  if (!accountId) return false;
  const res = await db.query(
    `SELECT 1
     FROM account_subscriptions asub
     JOIN subscription_products sp ON sp.id = asub.subscription_product_id
     LEFT JOIN plan_prices pp ON pp.stripe_price_id = asub.stripe_price_id
     WHERE asub.account_id = $1
       AND asub.status IN ('active', 'trialing')
       AND (
         COALESCE(pp.unit_amount, 0) > 0
         OR (asub.stripe_price_id IS NULL AND COALESCE(sp.price::float, 0) > 0)
       )
     LIMIT 1`,
    [accountId]
  );
  return res.rows.length > 0;
}

/** Resolve a user's primary account id (prefers the account they own). */
async function resolvePrimaryAccountId(userId) {
  if (!userId) return null;
  const res = await db.query(
    `SELECT au.account_id
     FROM account_users au
     LEFT JOIN accounts a ON a.id = au.account_id
     WHERE au.user_id = $1
     ORDER BY (a.owner_user_id = $1) DESC
     LIMIT 1`,
    [userId]
  );
  return res.rows[0]?.account_id ?? null;
}

function buildPropertyLabel(row) {
  const parts = [row?.address, row?.city, row?.state].filter(Boolean);
  return parts.length ? parts.join(", ") : "your property";
}

/**
 * Determine whether a homeowner can hand their (single) agent-managed property's
 * billing to the agent's plan, so they stop paying.
 *
 * Conditions:
 *  - user is a homeowner currently on a paid plan
 *  - their account owns exactly one (non-sponsored) property
 *  - that property has an agent (platform-role agent) on the team
 *  - the agent's account has an active plan with remaining property capacity
 *  - the property is not already sponsored/pending
 *
 * @returns {Promise<{eligible: boolean, reason?: string, property?, agent?, accessUntil?}>}
 */
async function getSponsorshipEligibility({ userId, accountId, userRole }) {
  const role = (userRole || "homeowner").toLowerCase();
  if (isAdminRole(role) || role === "agent") {
    return { eligible: false, reason: "not_homeowner" };
  }
  if (!accountId) return { eligible: false, reason: "no_account" };

  // Must currently be paying (so there is something to save them).
  if (!(await accountHasActivePaidSubscription(accountId))) {
    return { eligible: false, reason: "not_on_paid_plan" };
  }

  // Exactly one owned, not-yet-sponsored property.
  const propsRes = await db.query(
    `SELECT id, property_uid AS uid, address, city, state
     FROM properties
     WHERE account_id = $1 AND active_sponsor_account_id IS NULL
     ORDER BY id ASC`,
    [accountId]
  );
  if (propsRes.rows.length !== 1) {
    return { eligible: false, reason: "not_single_property" };
  }
  const property = propsRes.rows[0];

  // Already sponsored / pending?
  const existing = await db.query(
    `SELECT 1 FROM property_sponsorships
     WHERE property_id = $1 AND status IN ('pending', 'active') LIMIT 1`,
    [property.id]
  );
  if (existing.rows.length > 0) {
    return { eligible: false, reason: "already_sponsored" };
  }

  // Find the agent on the property.
  const agentRes = await db.query(
    `SELECT u.id AS "userId", u.name, u.email
     FROM property_users pu
     JOIN users u ON u.id = pu.user_id
     WHERE pu.property_id = $1 AND LOWER(u.role::text) = 'agent'
     ORDER BY pu.created_at ASC
     LIMIT 1`,
    [property.id]
  );
  if (!agentRes.rows[0]) {
    return { eligible: false, reason: "no_agent" };
  }
  const agent = agentRes.rows[0];

  const agentAccountId = await resolvePrimaryAccountId(agent.userId);
  if (!agentAccountId) return { eligible: false, reason: "agent_no_account" };

  if (!(await accountHasActiveSubscription(agentAccountId))) {
    return { eligible: false, reason: "agent_no_plan" };
  }

  // Agent capacity. The property already counts toward the agent's limit, so
  // "has room" means the agent is not over their plan's property cap.
  const agentLimits = await getAccountLimits(agentAccountId);
  const agentCount = await countAgentManagedProperties(agent.userId);
  if (agentLimits.maxProperties != null && agentCount > agentLimits.maxProperties) {
    return {
      eligible: false,
      reason: "agent_limit_reached",
      agent: { userId: agent.userId, name: agent.name, email: agent.email, accountId: agentAccountId },
    };
  }

  // Agent plan display name (for the offer modal's entitlements summary).
  const agentPlanRes = await db.query(
    `SELECT sp.name
     FROM account_subscriptions asub
     JOIN subscription_products sp ON sp.id = asub.subscription_product_id
     WHERE asub.account_id = $1 AND asub.status IN ('active', 'trialing')
     ORDER BY asub.current_period_end DESC NULLS LAST
     LIMIT 1`,
    [agentAccountId]
  );
  const agentPlanName = agentPlanRes.rows[0]?.name || null;

  // When does paid access run until?
  const periodRes = await db.query(
    `SELECT current_period_end AS "currentPeriodEnd"
     FROM account_subscriptions
     WHERE account_id = $1 AND status IN ('active', 'trialing')
     ORDER BY current_period_end DESC NULLS LAST
     LIMIT 1`,
    [accountId]
  );

  return {
    eligible: true,
    property: { id: property.id, uid: property.uid, label: buildPropertyLabel(property) },
    agent: {
      userId: agent.userId,
      name: agent.name || agent.email,
      email: agent.email,
      accountId: agentAccountId,
      planName: agentPlanName,
      entitlements: {
        maxProperties: agentLimits.maxProperties ?? null,
        maxContacts: agentLimits.maxContacts ?? null,
        aiTokenMonthlyQuota: agentLimits.aiTokenMonthlyQuota ?? null,
        maxDocumentsPerSystem: agentLimits.maxDocumentsPerSystem ?? null,
        aiFeaturesEnabled: agentLimits.aiFeaturesEnabled !== false,
      },
    },
    accessUntil: periodRes.rows[0]?.currentPeriodEnd || null,
  };
}

/** Distinct properties where the user is on the team with platform role agent. */
async function countAgentManagedProperties(userId) {
  if (!userId) return 0;
  const countRes = await db.query(
    `SELECT COUNT(DISTINCT pu.property_id)::int AS count
     FROM property_users pu
     INNER JOIN users u ON u.id = pu.user_id
     WHERE pu.user_id = $1 AND LOWER(u.role::text) = 'agent'`,
    [userId]
  );
  return countRes.rows[0]?.count ?? 0;
}

/** Role-aware property count for plan limit enforcement and billing usage. */
async function countPropertiesForLimit({ accountId, userId, userRole }) {
  if (isAdminRole(userRole)) return 0;
  const role = (userRole || "homeowner").toLowerCase();
  if (role === "agent") {
    return countAgentManagedProperties(userId);
  }
  return countAccountOwnedProperties(accountId);
}

async function canCreateProperty(accountId, userRole, userId) {
  if (isAdminRole(userRole)) return { allowed: true, current: 0, max: 999999 };
  const limits = await getAccountLimits(accountId);
  const current = await countPropertiesForLimit({ accountId, userId, userRole });
  return { allowed: current < limits.maxProperties, current, max: limits.maxProperties };
}

async function canAddContact(accountId, userRole) {
  if (isAdminRole(userRole)) return { allowed: true, current: 0, max: 999999 };
  const limits = await getAccountLimits(accountId);
  const countRes = await db.query(
    `SELECT COUNT(*)::int AS count FROM account_contacts WHERE account_id = $1`,
    [accountId]
  );
  const current = countRes.rows[0].count;
  return { allowed: current < limits.maxContacts, current, max: limits.maxContacts };
}

async function canInviteViewer(accountId, propertyId, userRole) {
  if (isAdminRole(userRole)) return { allowed: true, current: 0, max: 999999 };
  const limits = await getAccountLimits(accountId);
  /* Count accepted viewers + pending viewer invitations so outstanding invites
     cannot bypass the plan limit while they sit unaccepted. */
  const countRes = await db.query(
    `SELECT
       (SELECT COUNT(*)::int FROM property_users
          WHERE property_id = $1 AND role = 'viewer')
       +
       (SELECT COUNT(*)::int FROM invitations
          WHERE property_id = $1 AND status = 'pending' AND intended_role = 'viewer')
       AS count`,
    [propertyId]
  );
  const current = countRes.rows[0].count;
  return { allowed: current < limits.maxViewers, current, max: limits.maxViewers };
}

async function canAddTeamMember(accountId, propertyId, userRole, options = {}) {
  if (isAdminRole(userRole)) return { allowed: true, current: 0, max: 999999 };
  const limits = options.limits ?? (await getAccountLimits(accountId));
  const countRes = await db.query(
    `SELECT
       (SELECT COUNT(*)::int FROM property_users
          WHERE property_id = $1 AND role != 'viewer')
       +
       (SELECT COUNT(*)::int FROM invitations
          WHERE property_id = $1
            AND status = 'pending'
            AND COALESCE(intended_role, 'editor') != 'viewer')
       AS count`,
    [propertyId]
  );
  const current = countRes.rows[0].count;
  return { allowed: current < limits.maxTeamMembers, current, max: limits.maxTeamMembers };
}

/**
 * One limits fetch + one grouped count query for bulk property invitations.
 * @returns {Promise<Map<number, { allowed: boolean, current: number, max: number }>>}
 */
async function getTeamMemberInviteEligibilityByProperty(accountId, propertyIds, userRole) {
  const map = new Map();
  if (!propertyIds?.length) return map;
  if (isAdminRole(userRole)) {
    for (const id of propertyIds) {
      map.set(id, { allowed: true, current: 0, max: 999999 });
    }
    return map;
  }
  const limits = await getAccountLimits(accountId);
  const max = limits.maxTeamMembers;
  const countRes = await db.query(
    `SELECT property_id, SUM(count)::int AS count FROM (
       SELECT property_id, COUNT(*)::int AS count
         FROM property_users
         WHERE property_id = ANY($1::int[]) AND role != 'viewer'
         GROUP BY property_id
       UNION ALL
       SELECT property_id, COUNT(*)::int AS count
         FROM invitations
         WHERE property_id = ANY($1::int[])
           AND status = 'pending'
           AND COALESCE(intended_role, 'editor') != 'viewer'
         GROUP BY property_id
     ) t
     GROUP BY property_id`,
    [propertyIds]
  );
  const countByProp = new Map(countRes.rows.map((r) => [r.property_id, r.count]));
  for (const pid of propertyIds) {
    const current = countByProp.get(pid) ?? 0;
    map.set(pid, { allowed: current < max, current, max });
  }
  return map;
}

/**
 * @returns {Promise<Map<number, { allowed: boolean, current: number, max: number }>>}
 */
async function getViewerInviteEligibilityByProperty(accountId, propertyIds, userRole) {
  const map = new Map();
  if (!propertyIds?.length) return map;
  if (isAdminRole(userRole)) {
    for (const id of propertyIds) {
      map.set(id, { allowed: true, current: 0, max: 999999 });
    }
    return map;
  }
  const limits = await getAccountLimits(accountId);
  const max = limits.maxViewers;
  /* Combine accepted viewers + pending viewer invitations per property. */
  const countRes = await db.query(
    `SELECT property_id, SUM(count)::int AS count FROM (
       SELECT property_id, COUNT(*)::int AS count
         FROM property_users
         WHERE property_id = ANY($1::int[]) AND role = 'viewer'
         GROUP BY property_id
       UNION ALL
       SELECT property_id, COUNT(*)::int AS count
         FROM invitations
         WHERE property_id = ANY($1::int[]) AND status = 'pending' AND intended_role = 'viewer'
         GROUP BY property_id
     ) t
     GROUP BY property_id`,
    [propertyIds]
  );
  const countByProp = new Map(countRes.rows.map((r) => [r.property_id, r.count]));
  for (const pid of propertyIds) {
    const current = countByProp.get(pid) ?? 0;
    map.set(pid, { allowed: current < max, current, max });
  }
  return map;
}

/** Check if a document can be uploaded to a specific system on a property. */
async function canUploadDocumentToSystem(accountId, propertyId, systemKey, userRole) {
  if (isAdminRole(userRole)) return { allowed: true, current: 0, max: 999999 };
  /* Resolve from the property's effective plan so agent-subsidized properties
     inherit the sponsor's document allowance (property-scoped entitlement). */
  const limits = propertyId
    ? await getPropertyEntitlements(propertyId)
    : await getAccountLimits(accountId);
  const max = limits.maxDocumentsPerSystem ?? 5;

  const countRes = await db.query(
    `SELECT COUNT(*)::int AS count FROM property_documents WHERE property_id = $1 AND system_key = $2`,
    [propertyId, systemKey]
  );
  const current = countRes.rows[0]?.count || 0;
  return { allowed: current < max, current, max };
}

module.exports = {
  getAccountLimits,
  getLimitsForPlanCode,
  getEffectiveLimits,
  getPropertyEntitlements,
  accountHasActiveSubscription,
  accountHasActivePaidSubscription,
  resolvePrimaryAccountId,
  getSponsorshipEligibility,
  countAccountOwnedProperties,
  countAgentManagedProperties,
  countPropertiesForLimit,
  canCreateProperty,
  canAddContact,
  canInviteViewer,
  canAddTeamMember,
  getTeamMemberInviteEligibilityByProperty,
  getViewerInviteEligibilityByProperty,
  checkAiTokenQuota,
  checkAiFeaturesAllowed,
  checkPrePurchaseAllowed,
  canUploadDocumentToSystem,
  isAdminRole,
};
