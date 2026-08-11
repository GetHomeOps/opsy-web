"use strict";

/**
 * Admin bulk agent onboarding routes.
 * Mounted at /properties/bulk-onboard (before the generic /properties/:uid routes).
 */

const express = require("express");
const { ensureLoggedIn, ensurePlatformAdmin } = require("../middleware/auth");
const {
  previewBulkOnboard,
  executeBulkOnboard,
} = require("../services/bulkOnboardService");

const router = express.Router();

/** POST /preview — dry-run match/validation for a batch */
router.post(
  "/preview",
  ensureLoggedIn,
  ensurePlatformAdmin,
  async function (req, res, next) {
    try {
      const { agentUserId, rows } = req.body || {};
      const result = await previewBulkOnboard({ agentUserId, rows });
      return res.json(result);
    } catch (err) {
      return next(err);
    }
  }
);

/** POST / — execute bulk create + agent assign + homeowner invites */
router.post(
  "/",
  ensureLoggedIn,
  ensurePlatformAdmin,
  async function (req, res, next) {
    try {
      const { agentUserId, rows, options } = req.body || {};
      const result = await executeBulkOnboard({
        agentUserId,
        rows,
        adminUserId: res.locals.user?.id,
        adminUserRole: res.locals.user?.role,
        options: options || {},
      });
      return res.status(201).json(result);
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
