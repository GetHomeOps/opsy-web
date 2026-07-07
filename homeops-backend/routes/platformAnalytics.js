"use strict";

const express = require("express");
const { ensurePlatformAdmin, ensureSuperAdmin, ensureLoggedIn } = require("../middleware/auth");
const PlatformMetrics = require("../models/platformMetrics");
const DemoSalesMetrics = require("../models/demoSalesMetrics");
const { isDemoEnvironment } = require("../helpers/demoEnvironment");
const { ensureDemoUserSchema } = require("../helpers/demoUserSchema");
const { ForbiddenError } = require("../expressError");

const router = express.Router();

function ensureDemoSalesAnalytics(req, res, next) {
  if (!isDemoEnvironment()) {
    return next(new ForbiddenError("Demo sales analytics are only available on the demo site."));
  }
  return ensureSuperAdmin(req, res, next);
}

/** GET /summary - Platform totals (users, accounts, properties, etc.). Platform admin only. */
router.get("/summary", ensurePlatformAdmin, async function (req, res, next) {
  try {
    const summary = await PlatformMetrics.getPlatformSummary();
    return res.json({ summary });
  } catch (err) {
    return next(err);
  }
});

/** GET /daily - Daily metrics by date range. Query: startDate, endDate. Platform admin only. */
router.get("/daily", ensurePlatformAdmin, async function (req, res, next) {
  try {
    const { startDate, endDate } = req.query;
    const metrics = await PlatformMetrics.getDailyMetrics({ startDate, endDate });
    return res.json({ metrics });
  } catch (err) {
    return next(err);
  }
});

/** GET /growth/:entity - Monthly growth. Entity: users, accounts, properties. Query: months. Platform admin only. */
router.get("/growth/:entity", ensurePlatformAdmin, async function (req, res, next) {
  try {
    const { entity } = req.params;
    const months = req.query.months ? Number(req.query.months) : 12;
    const growth = await PlatformMetrics.getMonthlyGrowth(entity, months);
    return res.json({ growth });
  } catch (err) {
    return next(err);
  }
});

/** GET /accounts - Account analytics snapshot. Platform admin only. */
router.get("/accounts", ensurePlatformAdmin, async function (req, res, next) {
  try {
    const analytics = await PlatformMetrics.getAccountAnalytics();
    return res.json({ analytics });
  } catch (err) {
    return next(err);
  }
});

/** GET /accounts/activity - Per-account user activity: logins, sessions, pages, patterns. Platform admin only. */
router.get("/accounts/activity", ensurePlatformAdmin, async function (req, res, next) {
  try {
    const { accounts, activityHeatmapDays } =
      await PlatformMetrics.getUserActivityByAccount({
        timeZone: req.query.timeZone,
      });
    return res.json({ accounts, activityHeatmapDays });
  } catch (err) {
    return next(err);
  }
});

/** GET /accounts/:accountId - Single account analytics. Platform admin only. */
router.get("/accounts/:accountId", ensurePlatformAdmin, async function (req, res, next) {
  try {
    const analytics = await PlatformMetrics.getAccountAnalyticsById(Number(req.params.accountId));
    return res.json({ analytics });
  } catch (err) {
    return next(err);
  }
});

/** GET /costs/summary - Usage cost summary. Query: startDate, endDate. Platform admin only. */
router.get("/costs/summary", ensurePlatformAdmin, async function (req, res, next) {
  try {
    const { startDate, endDate } = req.query;
    const summary = await PlatformMetrics.getCostSummary({ startDate, endDate });
    return res.json({ summary });
  } catch (err) {
    return next(err);
  }
});

/** GET /costs/per-account - Cost per account. Query: startDate, endDate. Platform admin only. */
router.get("/costs/per-account", ensurePlatformAdmin, async function (req, res, next) {
  try {
    const { startDate, endDate } = req.query;
    const data = await PlatformMetrics.getCostPerAccount({ startDate, endDate });
    return res.json({ accounts: data });
  } catch (err) {
    return next(err);
  }
});

/** GET /costs/per-user - Cost per user with API calls, documents, storage. Query: startDate, endDate. Platform admin only. */
router.get("/costs/per-user", ensurePlatformAdmin, async function (req, res, next) {
  try {
    const { startDate, endDate } = req.query;
    const data = await PlatformMetrics.getCostPerUser({ startDate, endDate });
    return res.json({ users: data });
  } catch (err) {
    return next(err);
  }
});

/** GET /agents - Agent analytics: agents, their properties, homeowners, invitations, communications, visits. Platform admin only. */
router.get("/agents", ensurePlatformAdmin, async function (req, res, next) {
  try {
    const result = await PlatformMetrics.getAgentAnalytics();
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

/** GET /properties - Property analytics: team, owner, per-member activity. Platform admin only. */
router.get("/properties", ensurePlatformAdmin, async function (req, res, next) {
  try {
    const result = await PlatformMetrics.getPropertyAnalytics();
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

/** GET /demo-sales/summary - Demo account sales rollup. Super admin on demo site only. */
router.get("/demo-sales/summary", ensureLoggedIn, ensureDemoSalesAnalytics, async function (req, res, next) {
  try {
    await ensureDemoUserSchema();
    const { from, to } = req.query;
    const summary = await DemoSalesMetrics.getSummary({ from, to });
    return res.json(summary);
  } catch (err) {
    return next(err);
  }
});

/** GET /demo-sales/accounts - Paginated demo accounts. Super admin on demo site only. */
router.get("/demo-sales/accounts", ensureLoggedIn, ensureDemoSalesAnalytics, async function (req, res, next) {
  try {
    await ensureDemoUserSchema();
    const { createdBy, status, from, to, limit, offset } = req.query;
    const result = await DemoSalesMetrics.getAccounts({
      createdBy,
      status,
      from,
      to,
      limit,
      offset,
    });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
