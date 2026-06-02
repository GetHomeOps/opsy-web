"use strict";

const express = require("express");
const { ensureLoggedIn } = require("../middleware/auth");
const { BadRequestError } = require("../expressError");
const Agency = require("../models/agency");
const Office = require("../models/office");
const Team = require("../models/team");
const AgentAffiliation = require("../models/agentAffiliation");
const AffiliationRequest = require("../models/affiliationRequest");
const {
  getAgentAffiliationStatus,
  skipAffiliationOnboarding,
  ensureAgent,
} = require("../services/affiliationService");
const { addPresignedUrlToItem, addPresignedUrlsToItems } = require("../helpers/presignedUrls");

const router = express.Router();

async function enrichAffiliationPayload(payload) {
  if (payload?.affiliation?.agency?.logoUrl) {
    payload.affiliation.agency = await addPresignedUrlToItem(
      payload.affiliation.agency,
      "logoUrl",
      "logoDisplayUrl"
    );
  }
  return payload;
}

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

/** GET /me — current affiliation status for agent */
router.get("/me", ensureLoggedIn, requireAgent, async function (req, res, next) {
  try {
    const userId = res.locals.user.id;
    return res.json(await enrichAffiliationPayload(await getAgentAffiliationStatus(userId)));
  } catch (err) {
    return next(err);
  }
});

/** POST /me — set affiliation from approved selections */
router.post("/me", ensureLoggedIn, requireAgent, async function (req, res, next) {
  try {
    const userId = res.locals.user.id;
    const { agencyId, officeId, teamId } = req.body;
    if (!agencyId || !officeId) {
      throw new BadRequestError("agencyId and officeId are required");
    }

    const pending = await AffiliationRequest.getPendingForUser(userId);
    if (pending) {
      throw new BadRequestError("Resolve your pending affiliation request first");
    }

    await AgentAffiliation.upsertActive({
      userId,
      agencyId: Number(agencyId),
      officeId: Number(officeId),
      teamId: teamId != null && teamId !== "" ? Number(teamId) : null,
    });

    return res.json(await enrichAffiliationPayload(await getAgentAffiliationStatus(userId)));
  } catch (err) {
    return next(err);
  }
});

/** POST /me/leave — leave current agency */
router.post("/me/leave", ensureLoggedIn, requireAgent, async function (req, res, next) {
  try {
    const userId = res.locals.user.id;
    await AgentAffiliation.leave(userId);
    const payload = await getAgentAffiliationStatus(userId);
    return res.json(payload);
  } catch (err) {
    return next(err);
  }
});

/** POST /me/skip-onboarding */
router.post("/me/skip-onboarding", ensureLoggedIn, requireAgent, async function (req, res, next) {
  try {
    const userId = res.locals.user.id;
    await skipAffiliationOnboarding(userId);
    return res.json({ skipped: true });
  } catch (err) {
    return next(err);
  }
});

/** GET /agencies?q= — search approved agencies */
router.get("/agencies", ensureLoggedIn, async function (req, res, next) {
  try {
    const agencies = await Agency.searchApproved({ q: req.query.q, limit: req.query.limit });
    return res.json({
      agencies: await addPresignedUrlsToItems(agencies, "logoUrl", "logoDisplayUrl"),
    });
  } catch (err) {
    return next(err);
  }
});

/** GET /agencies/:id/offices?q= */
router.get("/agencies/:agencyId/offices", ensureLoggedIn, async function (req, res, next) {
  try {
    const offices = await Office.searchApprovedByAgency(Number(req.params.agencyId), {
      q: req.query.q,
      limit: req.query.limit,
    });
    return res.json({ offices });
  } catch (err) {
    return next(err);
  }
});

/** GET /offices/:id/teams?q= */
router.get("/offices/:officeId/teams", ensureLoggedIn, async function (req, res, next) {
  try {
    const teams = await Team.searchApprovedByOffice(Number(req.params.officeId), {
      q: req.query.q,
      limit: req.query.limit,
    });
    return res.json({ teams });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
