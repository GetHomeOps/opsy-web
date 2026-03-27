"use strict";

/**
 * PlatformMetrics Model
 *
 * Provides analytics and metrics for the platform. Reads from snapshots
 * (daily_metrics_snapshot, account_analytics_snapshot) and raw tables.
 *
 * Key operations:
 * - getDailyMetrics: Time-series metrics by date range
 * - getAccountAnalytics / getAccountAnalyticsById: Per-account analytics
 * - getPlatformSummary: Totals for users, accounts, properties, subscriptions
 * - getMonthlyGrowth: Growth trends by entity type
 * - refreshDailySnapshot / refreshAccountAnalytics: Update snapshot tables
 * - getCostSummary / getCostPerAccount: Usage cost analytics
 */

const db = require("../db");

class PlatformMetrics {
  static async getDailyMetrics({ startDate, endDate } = {}) {
    const clauses = [];
    const values = [];
    values.push(startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    clauses.push(`date >= $${values.length}`);
    if (endDate) {
      values.push(endDate);
      clauses.push(`date <= $${values.length}`);
    }
    const where = `WHERE ${clauses.join(" AND ")}`;
    const result = await db.query(
      `SELECT * FROM daily_metrics_snapshot ${where} ORDER BY date ASC`,
      values
    );
    return result.rows;
  }

  static async getAccountAnalytics() {
    const result = await db.query(
      `SELECT * FROM account_analytics_snapshot ORDER BY total_properties DESC`
    );
    return result.rows;
  }

  static async getAccountAnalyticsById(accountId) {
    const result = await db.query(
      `SELECT * FROM account_analytics_snapshot WHERE account_id = $1`,
      [accountId]
    );
    return result.rows[0] || null;
  }

  static async getPlatformSummary() {
    const [usersRes, activeUsersRes, pendingSignupsRes, accountsRes, propsRes, sysRes, maintRes, subsRes] = await Promise.all([
      db.query(`SELECT COUNT(*)::int AS count FROM users`),
      // Active users = completed onboarding (excludes abandoned signups)
      db.query(`SELECT COUNT(*)::int AS count FROM users WHERE onboarding_completed = true AND is_active = true`),
      // Pending signups = registered but never finished onboarding/payment
      db.query(`SELECT COUNT(*)::int AS count FROM users WHERE onboarding_completed = false`),
      db.query(`SELECT COUNT(*)::int AS count FROM accounts`),
      db.query(`SELECT COUNT(*)::int AS count FROM properties`),
      db.query(`SELECT COUNT(*)::int AS count FROM property_systems`),
      db.query(`SELECT COUNT(*)::int AS count FROM property_maintenance`),
      db.query(`SELECT COUNT(*)::int AS count FROM account_subscriptions`),
    ]);

    const totalUsers = usersRes.rows[0].count;
    const activeUsers = activeUsersRes.rows[0].count;
    const pendingSignups = pendingSignupsRes.rows[0].count;
    const totalAccounts = accountsRes.rows[0].count;
    const totalProperties = propsRes.rows[0].count;
    const totalSystems = sysRes.rows[0].count;
    const totalMaintenanceRecords = maintRes.rows[0].count;
    const totalSubscriptions = subsRes.rows[0].count;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [newUsersRes, newActiveUsersRes, newAccountsRes, newPropsRes] = await Promise.all([
      db.query(`SELECT COUNT(*)::int AS count FROM users WHERE created_at >= $1`, [thirtyDaysAgo]),
      // New active users = completed onboarding in last 30 days
      db.query(`SELECT COUNT(*)::int AS count FROM users WHERE onboarding_completed = true AND created_at >= $1`, [thirtyDaysAgo]),
      db.query(`SELECT COUNT(*)::int AS count FROM accounts WHERE created_at >= $1`, [thirtyDaysAgo]),
      db.query(`SELECT COUNT(*)::int AS count FROM properties WHERE created_at >= $1`, [thirtyDaysAgo]),
    ]);

    const avgPropertiesPerAccount = totalAccounts > 0
      ? +(totalProperties / totalAccounts).toFixed(1)
      : 0;
    const avgUsersPerAccount = totalAccounts > 0
      ? +(activeUsers / totalAccounts).toFixed(1)
      : 0;

    const avgHpsRes = await db.query(
      `SELECT ROUND(AVG(hps_score))::int AS avg FROM properties WHERE hps_score IS NOT NULL`
    );

    const roleRes = await db.query(
      `SELECT role::text AS role, COUNT(*)::int AS count FROM users GROUP BY role ORDER BY count DESC`
    );

    const subStatusRes = await db.query(
      `SELECT status, COUNT(*)::int AS count FROM account_subscriptions GROUP BY status ORDER BY count DESC`
    );

    // Paid subscriptions = active/trialing accounts with subscription_product.price > 0 (excludes free plans)
    const paidSubsRes = await db.query(
      `SELECT COUNT(*)::int AS count
       FROM account_subscriptions s
       JOIN subscription_products sp ON sp.id = s.subscription_product_id
       WHERE s.status IN ('active', 'trialing') AND sp.price > 0`
    );
    const paidSubscriptionsCount = paidSubsRes.rows[0]?.count ?? 0;

    return {
      totalUsers,
      activeUsers,
      pendingSignups,
      totalAccounts,
      totalProperties,
      totalSystems,
      totalMaintenanceRecords,
      totalSubscriptions,
      newUsersLast30d: newUsersRes.rows[0].count,
      newActiveUsersLast30d: newActiveUsersRes.rows[0].count,
      newAccountsLast30d: newAccountsRes.rows[0].count,
      newPropertiesLast30d: newPropsRes.rows[0].count,
      avgPropertiesPerAccount,
      avgUsersPerAccount,
      avgHpsScore: avgHpsRes.rows[0]?.avg || 0,
      usersByRole: roleRes.rows,
      subscriptionsByStatus: subStatusRes.rows,
      paidSubscriptionsCount,
    };
  }

  static async getMonthlyGrowth(entity, months = 12) {
    const allowedEntities = ["users", "accounts", "properties", "account_subscriptions"];
    if (!allowedEntities.includes(entity)) {
      entity = "users";
    }
    const result = await db.query(
      `SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
              COUNT(*)::int AS count
       FROM ${entity}
       WHERE created_at >= DATE_TRUNC('month', NOW()) - INTERVAL '${months} months'
       GROUP BY DATE_TRUNC('month', created_at)
       ORDER BY month ASC`
    );
    return result.rows;
  }

  static async refreshDailySnapshot() {
    const today = new Date().toISOString().split('T')[0];
    const [usersRes, accountsRes, propsRes] = await Promise.all([
      db.query(`SELECT COUNT(*)::int AS count FROM users WHERE created_at::date <= $1`, [today]),
      db.query(`SELECT COUNT(*)::int AS count FROM accounts WHERE created_at::date <= $1`, [today]),
      db.query(`SELECT COUNT(*)::int AS count FROM properties WHERE created_at::date <= $1`, [today]),
    ]);
    const [newUsersRes, newAccountsRes, newPropsRes] = await Promise.all([
      db.query(`SELECT COUNT(*)::int AS count FROM users WHERE created_at::date = $1`, [today]),
      db.query(`SELECT COUNT(*)::int AS count FROM accounts WHERE created_at::date = $1`, [today]),
      db.query(`SELECT COUNT(*)::int AS count FROM properties WHERE created_at::date = $1`, [today]),
    ]);
    await db.query(
      `INSERT INTO daily_metrics_snapshot (date, total_users, total_accounts, total_properties, new_users, new_accounts, new_properties)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (date) DO UPDATE SET
         total_users = EXCLUDED.total_users,
         total_accounts = EXCLUDED.total_accounts,
         total_properties = EXCLUDED.total_properties,
         new_users = EXCLUDED.new_users,
         new_accounts = EXCLUDED.new_accounts,
         new_properties = EXCLUDED.new_properties`,
      [today, usersRes.rows[0].count, accountsRes.rows[0].count, propsRes.rows[0].count,
        newUsersRes.rows[0].count, newAccountsRes.rows[0].count, newPropsRes.rows[0].count]
    );
  }

  static async refreshAccountAnalytics() {
    await db.query(`DELETE FROM account_analytics_snapshot`);
    await db.query(
      `INSERT INTO account_analytics_snapshot
        (account_id, account_name, total_properties, total_users, total_systems,
         total_maintenance_records, avg_hps_score, last_active_at)
       SELECT
         a.id,
         a.name,
         COUNT(DISTINCT p.id)::int,
         COUNT(DISTINCT au.user_id)::int,
         COUNT(DISTINCT ps.system_key)::int,
         COUNT(DISTINCT pm.id)::int,
         ROUND(AVG(p.hps_score))::int,
         MAX(GREATEST(p.updated_at, a.updated_at))
       FROM accounts a
       LEFT JOIN account_users au ON au.account_id = a.id
       LEFT JOIN properties p ON p.account_id = a.id
       LEFT JOIN property_systems ps ON ps.property_id = p.id
       LEFT JOIN property_maintenance pm ON pm.property_id = p.id
       GROUP BY a.id, a.name`
    );
  }

  static async getCostSummary({ startDate, endDate } = {}) {
    const clauses = [];
    const values = [];
    if (startDate) {
      values.push(startDate);
      clauses.push(`created_at::date >= $${values.length}::date`);
    }
    if (endDate) {
      values.push(endDate);
      clauses.push(`created_at::date <= $${values.length}::date`);
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

    const totalRes = await db.query(
      `SELECT COALESCE(SUM(total_cost), 0)::numeric(12,6) AS "totalCost",
              COUNT(DISTINCT account_id)::int AS "accountCount",
              COUNT(DISTINCT user_id)::int AS "userCount"
       FROM account_usage_events ${where}`,
      values
    );

    const breakdownRes = await db.query(
      `SELECT category, COALESCE(SUM(total_cost), 0)::numeric(12,6) AS cost
       FROM account_usage_events ${where}
       GROUP BY category ORDER BY cost DESC`,
      values
    );

    const row = totalRes.rows[0];
    return {
      totalCost: parseFloat(row.totalCost),
      accountCount: row.accountCount,
      userCount: row.userCount,
      avgCostPerAccount: row.accountCount > 0 ? parseFloat((row.totalCost / row.accountCount).toFixed(6)) : 0,
      avgCostPerUser: row.userCount > 0 ? parseFloat((row.totalCost / row.userCount).toFixed(6)) : 0,
      breakdown: breakdownRes.rows,
    };
  }

  static async getCostPerAccount({ startDate, endDate } = {}) {
    const clauses = [];
    const values = [];
    if (startDate) {
      values.push(startDate);
      clauses.push(`ue.created_at::date >= $${values.length}::date`);
    }
    if (endDate) {
      values.push(endDate);
      clauses.push(`ue.created_at::date <= $${values.length}::date`);
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

    const result = await db.query(
      `SELECT a.id AS "accountId", a.name AS "accountName",
              u.name AS "ownerName", u.email AS "ownerEmail",
              sp.name AS "tier",
              sp.price AS "revenue",
              COALESCE(SUM(ue.total_cost), 0)::numeric(12,6) AS "totalCost",
              (sp.price - COALESCE(SUM(ue.total_cost), 0))::numeric(12,2) AS "margin"
       FROM accounts a
       LEFT JOIN users u ON u.id = a.owner_user_id
       LEFT JOIN account_subscriptions asub ON asub.account_id = a.id AND asub.status = 'active'
       LEFT JOIN subscription_products sp ON sp.id = asub.subscription_product_id
       LEFT JOIN account_usage_events ue ON ue.account_id = a.id ${where ? 'AND ' + clauses.join(' AND ') : ''}
       GROUP BY a.id, a.name, u.name, u.email, sp.name, sp.price
       ORDER BY "totalCost" DESC`,
      values
    );
    return result.rows;
  }

  /**
   * Get cost per user: total cost, breakdown by category (AI, S3 storage, email),
   * API call count (OpenAI), document count (S3 uploads), and token count.
   * Includes ALL users (including super_admin) even when they have no usage (shows $0).
   */
  static async getCostPerUser({ startDate, endDate } = {}) {
    const clauses = [];
    const values = [];
    if (startDate) {
      values.push(startDate);
      clauses.push(`ue.created_at::date >= $${values.length}::date`);
    }
    if (endDate) {
      values.push(endDate);
      clauses.push(`ue.created_at::date <= $${values.length}::date`);
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const subWhere = clauses.length > 0
      ? clauses.map((c) => c.replace("ue.", "ue2.")).join(" AND ")
      : "TRUE";

    const result = await db.query(
      `WITH usage_by_user AS (
         SELECT
           ue.user_id,
           COALESCE(SUM(ue.total_cost), 0)::numeric(12,6) AS "totalCost",
           COALESCE(SUM(CASE WHEN ue.category = 'ai_tokens' THEN ue.total_cost ELSE 0 END), 0)::numeric(12,6) AS "aiCost",
           COALESCE(SUM(CASE WHEN ue.category = 'storage' THEN ue.total_cost ELSE 0 END), 0)::numeric(12,6) AS "storageCost",
           COALESCE(SUM(CASE WHEN ue.category = 'email' THEN ue.total_cost ELSE 0 END), 0)::numeric(12,6) AS "emailCost",
           COUNT(CASE WHEN ue.category = 'ai_tokens' THEN 1 END)::int AS "apiCallCount",
           COUNT(CASE WHEN ue.category = 'storage' THEN 1 END)::int AS "documentCount",
           COALESCE(SUM(CASE WHEN ue.category = 'ai_tokens' THEN ue.quantity ELSE 0 END), 0)::bigint AS "tokenCount"
         FROM account_usage_events ue
         ${where}
         GROUP BY ue.user_id
       )
       SELECT u.id AS "userId",
              u.name AS "userName", u.email AS "userEmail",
              u.role::text AS "userRole",
              (SELECT STRING_AGG(DISTINCT a2.name, ', ')
               FROM account_usage_events ue2
               JOIN accounts a2 ON a2.id = ue2.account_id
               WHERE ue2.user_id = u.id AND ${subWhere}) AS "accountNames",
              COALESCE(ub."totalCost", 0)::numeric(12,6) AS "totalCost",
              COALESCE(ub."aiCost", 0)::numeric(12,6) AS "aiCost",
              COALESCE(ub."storageCost", 0)::numeric(12,6) AS "storageCost",
              COALESCE(ub."emailCost", 0)::numeric(12,6) AS "emailCost",
              COALESCE(ub."apiCallCount", 0)::int AS "apiCallCount",
              COALESCE(ub."documentCount", 0)::int AS "documentCount",
              COALESCE(ub."tokenCount", 0)::bigint AS "tokenCount"
       FROM users u
       LEFT JOIN usage_by_user ub ON ub.user_id = u.id
       ORDER BY "totalCost" DESC NULLS LAST, u.name`,
      values
    );

    return result.rows.map((row) => ({
      userId: row.userId,
      userName: row.userName,
      userEmail: row.userEmail,
      userRole: row.userRole || "",
      accountNames: row.accountNames || "",
      totalCost: parseFloat(row.totalCost),
      aiCost: parseFloat(row.aiCost),
      storageCost: parseFloat(row.storageCost),
      emailCost: parseFloat(row.emailCost),
      apiCallCount: row.apiCallCount,
      documentCount: row.documentCount,
      tokenCount: Number(row.tokenCount),
    }));
  }

  /**
   * Get agent analytics: each agent user with their properties,
   * homeowner counts per property, invitations, communications, and visits (page views).
   */
  static async getAgentAnalytics() {
    const agentsRes = await db.query(
      `WITH agent_accounts AS (
        SELECT au.user_id AS agent_id, au.account_id, a.name AS account_name
        FROM account_users au
        JOIN accounts a ON a.id = au.account_id
        JOIN users u ON u.id = au.user_id AND u.role::text = 'agent'
      ),
      agent_property_ids AS (
        SELECT aa.agent_id, p.id AS property_id
        FROM agent_accounts aa
        JOIN properties p ON p.account_id = aa.account_id
      )
      SELECT
        u.id AS "agentId",
        u.name AS "agentName",
        u.email AS "agentEmail",
        COALESCE((
          SELECT json_agg(json_build_object('id', aa.account_id, 'name', aa.account_name))
          FROM agent_accounts aa WHERE aa.agent_id = u.id
        ), '[]'::json) AS "accounts",
        COALESCE((
          SELECT COUNT(*)::int FROM agent_property_ids ap WHERE ap.agent_id = u.id
        ), 0) AS "propertiesCount",
        COALESCE((
          SELECT COUNT(*)::int FROM invitations i WHERE i.inviter_user_id = u.id
        ), 0) AS "invitationsSent",
        COALESCE((
          SELECT COUNT(*)::int FROM communications c WHERE c.created_by = u.id AND c.status = 'sent'
        ), 0) AS "communicationsSent",
        COALESCE((
          SELECT COUNT(*)::int
          FROM platform_engagement_events e
          WHERE e.event_type = 'page_view'
            AND e.user_id IN (
              SELECT pu.user_id FROM agent_property_ids ap
              JOIN property_users pu ON pu.property_id = ap.property_id
              WHERE ap.agent_id = u.id
            )
        ), 0) AS "pageViews"
      FROM users u
      WHERE u.role::text = 'agent'
      ORDER BY u.name`
    );

    const agents = agentsRes.rows.map((row) => ({
      ...row,
      accounts: Array.isArray(row.accounts) ? row.accounts : (row.accounts ? JSON.parse(row.accounts) : []),
    }));

    for (const agent of agents) {
      const propsRes = await db.query(
        `SELECT p.id AS "propertyId", p.property_name AS "propertyName",
                p.address, p.city, p.state,
                (SELECT COUNT(*)::int
                 FROM property_users pu
                 JOIN users u ON u.id = pu.user_id
                 WHERE pu.property_id = p.id AND u.role::text = 'homeowner') AS "homeownersCount"
         FROM properties p
         JOIN account_users au ON au.account_id = p.account_id
         WHERE au.user_id = $1
         ORDER BY p.property_name NULLS LAST, p.address`,
        [agent.agentId]
      );
      const propRows = propsRes.rows;
      const propIds = propRows.map((r) => r.propertyId).filter(Boolean);
      let membersByProperty = new Map();
      if (propIds.length > 0) {
        const memRes = await db.query(
          `SELECT pu.property_id AS "propertyId",
                  pu.user_id AS "userId",
                  pu.role AS "propertyRole",
                  u.name AS "userName",
                  u.email AS "userEmail",
                  u.role::text AS "userRole"
           FROM property_users pu
           JOIN users u ON u.id = pu.user_id
           WHERE pu.property_id = ANY($1::int[])
           ORDER BY pu.property_id,
             CASE pu.role WHEN 'owner' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END,
             u.name NULLS LAST`,
          [propIds]
        );
        for (const row of memRes.rows) {
          if (!membersByProperty.has(row.propertyId)) {
            membersByProperty.set(row.propertyId, []);
          }
          membersByProperty.get(row.propertyId).push({
            userId: row.userId,
            userName: row.userName,
            userEmail: row.userEmail,
            userRole: row.userRole || "",
            propertyRole: row.propertyRole,
          });
        }
      }
      agent.properties = propRows.map((p) => ({
        ...p,
        members: membersByProperty.get(p.propertyId) || [],
      }));
    }

    return { agents };
  }

  /**
   * Property analytics: each property with account, document count, team (property_users),
   * owner(s), and per-member activity (page views scoped to property URL, inspection AI jobs,
   * maintenance events created, invitations tied to the property).
   */
  static async getPropertyAnalytics() {
    const propsRes = await db.query(
      `SELECT p.id AS "propertyId",
              p.property_uid AS "propertyUid",
              p.property_name AS "propertyName",
              p.address,
              p.city,
              p.state,
              p.owner_name AS "recordOwnerName",
              p.created_at AS "createdAt",
              fu.user_id AS "createdByUserId",
              fu.user_name AS "createdByName",
              fu.user_email AS "createdByEmail",
              a.id AS "accountId",
              a.name AS "accountName",
              (SELECT COUNT(*)::int FROM property_documents pd WHERE pd.property_id = p.id) AS "documentsCount"
       FROM properties p
       JOIN accounts a ON a.id = p.account_id
       LEFT JOIN LATERAL (
         SELECT pu.user_id,
                u.name AS user_name,
                u.email AS user_email
         FROM property_users pu
         JOIN users u ON u.id = pu.user_id
         WHERE pu.property_id = p.id
         ORDER BY pu.created_at ASC NULLS LAST, pu.user_id ASC
         LIMIT 1
       ) fu ON true
       ORDER BY a.name NULLS LAST, p.property_name NULLS LAST, p.id`
    );

    const inviteAcceptRes = await db.query(
      `SELECT property_id AS "propertyId",
              COUNT(*) FILTER (WHERE status = 'accepted' AND accepted_at IS NOT NULL)::int AS "invitesAccepted",
              AVG(EXTRACT(EPOCH FROM (accepted_at - created_at))) FILTER (
                WHERE status = 'accepted' AND accepted_at IS NOT NULL
              ) AS "avgInviteAcceptSeconds"
       FROM invitations
       WHERE property_id IS NOT NULL
       GROUP BY property_id`
    );

    const inviteStatsByProperty = new Map();
    for (const row of inviteAcceptRes.rows) {
      const avg = row.avgInviteAcceptSeconds;
      inviteStatsByProperty.set(row.propertyId, {
        invitesAccepted: row.invitesAccepted ?? 0,
        avgInviteAcceptSeconds:
          avg != null && !Number.isNaN(Number(avg)) ? Number(avg) : null,
      });
    }

    const teamRes = await db.query(
      `SELECT pu.property_id AS "propertyId",
              pu.user_id AS "userId",
              pu.role AS "propertyRole",
              u.name AS "userName",
              u.email AS "userEmail",
              u.role::text AS "userRole"
       FROM property_users pu
       JOIN users u ON u.id = pu.user_id
       ORDER BY pu.property_id,
         CASE pu.role WHEN 'owner' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END,
         u.name NULLS LAST`
    );

    const visitsRes = await db.query(
      `WITH visit_slugs AS (
         SELECT (regexp_match(e.event_data->>'path', '/properties/([^/?#]+)'))[1] AS slug,
                e.user_id AS user_id,
                COUNT(*)::int AS visits
         FROM platform_engagement_events e
         WHERE e.event_type = 'page_view'
           AND e.user_id IS NOT NULL
           AND e.event_data->>'path' IS NOT NULL
           AND e.event_data->>'path' LIKE '%/properties/%'
         GROUP BY 1, 2
       )
       SELECT p.id AS "propertyId",
              v.user_id AS "userId",
              v.visits AS "pageViews"
       FROM visit_slugs v
       JOIN properties p ON p.property_uid IS NOT NULL AND p.property_uid = v.slug
       WHERE v.slug IS NOT NULL`
    );

    const aiRes = await db.query(
      `SELECT property_id AS "propertyId",
              user_id AS "userId",
              COUNT(*)::int AS "aiAnalyses"
       FROM inspection_analysis_jobs
       GROUP BY property_id, user_id`
    );

    const maintRes = await db.query(
      `SELECT property_id AS "propertyId",
              created_by AS "userId",
              COUNT(*)::int AS "maintenanceEvents"
       FROM maintenance_events
       WHERE created_by IS NOT NULL
       GROUP BY property_id, created_by`
    );

    const invRes = await db.query(
      `SELECT property_id AS "propertyId",
              inviter_user_id AS "userId",
              COUNT(*)::int AS "invitationsSent"
       FROM invitations
       WHERE property_id IS NOT NULL
       GROUP BY property_id, inviter_user_id`
    );

    const statKey = (propertyId, userId) => `${propertyId}:${userId}`;
    const visitMap = new Map();
    for (const r of visitsRes.rows) {
      visitMap.set(statKey(r.propertyId, r.userId), r.pageViews);
    }
    const aiMap = new Map();
    for (const r of aiRes.rows) {
      aiMap.set(statKey(r.propertyId, r.userId), r.aiAnalyses);
    }
    const maintMap = new Map();
    for (const r of maintRes.rows) {
      maintMap.set(statKey(r.propertyId, r.userId), r.maintenanceEvents);
    }
    const invMap = new Map();
    for (const r of invRes.rows) {
      invMap.set(statKey(r.propertyId, r.userId), r.invitationsSent);
    }

    const teamByProperty = new Map();
    for (const row of teamRes.rows) {
      if (!teamByProperty.has(row.propertyId)) teamByProperty.set(row.propertyId, []);
      teamByProperty.get(row.propertyId).push(row);
    }

    const properties = propsRes.rows.map((p) => {
      const rawMembers = teamByProperty.get(p.propertyId) || [];
      const members = rawMembers.map((m) => ({
        userId: m.userId,
        userName: m.userName,
        userEmail: m.userEmail,
        userRole: m.userRole || "",
        propertyRole: m.propertyRole,
        pageViews: visitMap.get(statKey(p.propertyId, m.userId)) ?? 0,
        aiAnalyses: aiMap.get(statKey(p.propertyId, m.userId)) ?? 0,
        maintenanceEvents: maintMap.get(statKey(p.propertyId, m.userId)) ?? 0,
        invitationsSent: invMap.get(statKey(p.propertyId, m.userId)) ?? 0,
      }));

      const ownerMembers = members.filter((m) => m.propertyRole === "owner");
      let ownerDisplay =
        ownerMembers.map((o) => o.userName || o.userEmail).filter(Boolean).join(", ") || null;
      if (!ownerDisplay) ownerDisplay = p.recordOwnerName || null;

      const createdByDisplay =
        p.createdByName ||
        p.createdByEmail ||
        (p.createdByUserId != null ? `User #${p.createdByUserId}` : null);

      const invStats = inviteStatsByProperty.get(p.propertyId) || {
        invitesAccepted: 0,
        avgInviteAcceptSeconds: null,
      };

      const {
        recordOwnerName,
        createdByUserId,
        createdByName,
        createdByEmail,
        ...rest
      } = p;
      return {
        ...rest,
        ownerDisplay,
        createdByDisplay,
        invitesAccepted: invStats.invitesAccepted,
        avgInviteAcceptSeconds: invStats.avgInviteAcceptSeconds,
        teamCount: members.length,
        members,
      };
    });

    return { properties };
  }
}

module.exports = PlatformMetrics;
