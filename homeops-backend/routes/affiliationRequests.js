"use strict";

const express = require("express");
const { ensureLoggedIn, ensureSuperAdmin } = require("../middleware/auth");
const { BadRequestError } = require("../expressError");
const AffiliationRequest = require("../models/affiliationRequest");
const {
  approveRequest,
  rejectRequest,
  getAgentAffiliationStatus,
  ensureAgent,
  notifySuperAdminsOfPendingRequest,
} = require("../services/affiliationService");

const router = express.Router();

async function requireAgent(req, res, next) {
  try {
    const userId = res.locals.user?.id;
    if (!userId) throw new BadRequestError("Authentication required");
    await ensureAgent(userId);
    next();
  } catch (err) {
    next(err);
  }
}

/** POST / — create affiliation request (agent) */
router.post("/", ensureLoggedIn, requireAgent, async function (req, res, next) {
  try {
    const userId = res.locals.user.id;
    const {
      requestType,
      requestedName,
      agencyId,
      officeId,
      notes,
      addressLine1,
      address_line1,
      city,
      state,
      phone,
      website,
      mainOfficeName,
      mainTeamName,
      logoUrl,
    } = req.body;
    const request = await AffiliationRequest.create({
      requestedByUserId: userId,
      requestType,
      requestedName,
      agencyId: agencyId != null ? Number(agencyId) : null,
      officeId: officeId != null ? Number(officeId) : null,
      notes,
      addressLine1:
        addressLine1 != null
          ? String(addressLine1).trim() || null
          : address_line1 != null
            ? String(address_line1).trim() || null
            : null,
      city,
      state,
      phone: phone != null && String(phone).trim() ? String(phone).trim() : null,
      website,
      mainOfficeName,
      mainTeamName,
      logoUrl: logoUrl != null && String(logoUrl).trim() ? String(logoUrl).trim() : null,
    });
    await notifySuperAdminsOfPendingRequest(request);
    const payload = await getAgentAffiliationStatus(userId);
    return res.status(201).json({ request, ...payload });
  } catch (err) {
    return next(err);
  }
});

/** GET /?status=pending — super admin queue */
router.get("/", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    const status = req.query.status || "pending";
    if (status !== "pending") {
      throw new BadRequestError("Only pending requests are supported in v1");
    }
    const requests = await AffiliationRequest.listPending();
    return res.json({ requests });
  } catch (err) {
    return next(err);
  }
});

/** POST /:id/approve */
router.post("/:id/approve", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    const reviewerId = res.locals.user.id;
    const result = await approveRequest(Number(req.params.id), reviewerId);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

/** POST /:id/reject */
router.post("/:id/reject", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    const reviewerId = res.locals.user.id;
    const result = await rejectRequest(Number(req.params.id), reviewerId);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
