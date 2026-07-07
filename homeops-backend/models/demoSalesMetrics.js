"use strict";

const db = require("../db");

const DEMO_ACCOUNT_FILTER = `u.demo_login_password IS NOT NULL`;

function deriveStatus(row) {
  if (row.demoFirstLoginAt) return "opened";
  const expiresAt = row.demoExpiresAt ? new Date(row.demoExpiresAt) : null;
  if (expiresAt && expiresAt <= new Date()) return "expired";
  return "pending";
}

function buildDateFilters({ from, to }, params) {
  const clauses = [];
  if (from) {
    params.push(from);
    clauses.push(`u.created_at >= $${params.length}::timestamptz`);
  }
  if (to) {
    params.push(to);
    clauses.push(`u.created_at <= $${params.length}::timestamptz`);
  }
  return clauses;
}

/** Demo sales metrics for ready-to-use accounts on demo.heyopsy.com. */
class DemoSalesMetrics {

  /** Platform totals and per-creator rollup. */
  static async getSummary({ from, to } = {}) {
    const params = [];
    const dateClauses = buildDateFilters({ from, to }, params);
    const dateWhere = dateClauses.length ? `AND ${dateClauses.join(" AND ")}` : "";

    const totalsRes = await db.query(
      `SELECT
         COUNT(*)::int AS "totalCreated",
         COUNT(*) FILTER (WHERE u.demo_first_login_at IS NOT NULL)::int AS "totalOpened",
         COUNT(*) FILTER (
           WHERE u.demo_first_login_at IS NULL
             AND (u.demo_expires_at IS NULL OR u.demo_expires_at > NOW())
         )::int AS "pendingOpen",
         COUNT(*) FILTER (
           WHERE u.demo_first_login_at IS NULL
             AND u.demo_expires_at IS NOT NULL
             AND u.demo_expires_at <= NOW()
         )::int AS "expiredUnopened"
       FROM users u
       WHERE ${DEMO_ACCOUNT_FILTER}
         ${dateWhere}`,
      params
    );

    const totals = totalsRes.rows[0] || {
      totalCreated: 0,
      totalOpened: 0,
      pendingOpen: 0,
      expiredUnopened: 0,
    };
    const totalCreated = totals.totalCreated || 0;
    const totalOpened = totals.totalOpened || 0;

    const creatorsRes = await db.query(
      `SELECT
         COALESCE(creator.id, 0) AS "creatorId",
         COALESCE(creator.name, 'Unknown') AS "creatorName",
         COALESCE(creator.email, '') AS "creatorEmail",
         COUNT(*)::int AS "totalCreated",
         COUNT(*) FILTER (WHERE u.demo_first_login_at IS NOT NULL)::int AS "totalOpened",
         COUNT(*) FILTER (
           WHERE u.demo_first_login_at IS NULL
             AND (u.demo_expires_at IS NULL OR u.demo_expires_at > NOW())
         )::int AS "pendingOpen",
         COUNT(*) FILTER (
           WHERE u.demo_first_login_at IS NULL
             AND u.demo_expires_at IS NOT NULL
             AND u.demo_expires_at <= NOW()
         )::int AS "expiredUnopened"
       FROM users u
       LEFT JOIN users creator ON creator.id = u.demo_provisioned_by_user_id
       WHERE ${DEMO_ACCOUNT_FILTER}
         ${dateWhere}
       GROUP BY creator.id, creator.name, creator.email
       ORDER BY COUNT(*) DESC, COALESCE(creator.name, 'Unknown') ASC`,
      params
    );

    const creators = creatorsRes.rows.map((row) => {
      const created = row.totalCreated || 0;
      const opened = row.totalOpened || 0;
      return {
        ...row,
        openRate: created > 0 ? Math.round((opened / created) * 1000) / 10 : 0,
      };
    });

    return {
      totals: {
        ...totals,
        openRate: totalCreated > 0 ? Math.round((totalOpened / totalCreated) * 1000) / 10 : 0,
      },
      creators,
    };
  }

  /** Paginated list of provisioned demo accounts. */
  static async getAccounts({
    createdBy,
    status,
    from,
    to,
    limit = 50,
    offset = 0,
  } = {}) {
    const params = [];
    const where = [DEMO_ACCOUNT_FILTER];

    if (createdBy != null && createdBy !== "") {
      const creatorId = Number(createdBy);
      if (creatorId === 0) {
        where.push(`u.demo_provisioned_by_user_id IS NULL`);
      } else if (Number.isFinite(creatorId)) {
        params.push(creatorId);
        where.push(`u.demo_provisioned_by_user_id = $${params.length}`);
      }
    }

    if (status === "opened") {
      where.push(`u.demo_first_login_at IS NOT NULL`);
    } else if (status === "pending") {
      where.push(`u.demo_first_login_at IS NULL`);
      where.push(`(u.demo_expires_at IS NULL OR u.demo_expires_at > NOW())`);
    } else if (status === "expired") {
      where.push(`u.demo_first_login_at IS NULL`);
      where.push(`u.demo_expires_at IS NOT NULL AND u.demo_expires_at <= NOW()`);
    }

    const dateClauses = buildDateFilters({ from, to }, params);
    where.push(...dateClauses);

    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const safeOffset = Math.max(Number(offset) || 0, 0);

    params.push(safeLimit, safeOffset);

    const result = await db.query(
      `SELECT
         u.id,
         u.name,
         u.email,
         u.role,
         u.created_at AS "createdAt",
         u.demo_expires_at AS "demoExpiresAt",
         u.demo_first_login_at AS "demoFirstLoginAt",
         u.demo_paired_agent_id AS "demoPairedAgentId",
         u.demo_provisioned_by_user_id AS "provisionedByUserId",
         creator.name AS "provisionedByName",
         creator.email AS "provisionedByEmail",
         COUNT(*) OVER()::int AS "totalCount"
       FROM users u
       LEFT JOIN users creator ON creator.id = u.demo_provisioned_by_user_id
       WHERE ${where.join(" AND ")}
       ORDER BY u.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const rows = result.rows;
    const totalCount = rows[0]?.totalCount ?? 0;

    const accounts = rows.map(({ totalCount: _tc, ...row }) => ({
      ...row,
      isPairedHomeowner: row.demoPairedAgentId != null,
      status: deriveStatus(row),
    }));

    return { accounts, totalCount, limit: safeLimit, offset: safeOffset };
  }
}

module.exports = DemoSalesMetrics;
