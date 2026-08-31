"use strict";

const express = require("express");
const jsonschema = require("jsonschema");
const { ensureLoggedIn, ensureSuperAdmin, ensurePlatformAdmin, ensurePropertyAccess, ensurePropertyOwner, ensureUserCanAccessAccountFromBody, ensureUserCanAccessAccountByParam, clearPropertyAccessCache } = require("../middleware/auth");
const { BadRequestError, ForbiddenError } = require("../expressError");
const Property = require("../models/property");
const propertyNewSchema = require("../schemas/propertyNew.json");
const propertyUpdateSchema = require("../schemas/propertyUpdate.json");
const { generatePassportId, isPropertyUid } = require("../helpers/properties");
const {
  resolvePropertiesListUserId,
  resolveAssistantAgentUserId,
} = require("../helpers/propertyAccess");
const { addPresignedUrlToItem, addPresignedUrlsToItems, addUserAvatarUrlsToItems } = require("../helpers/presignedUrls");
const { canCreateProperty, checkAiTokenQuota, checkAiFeaturesAllowed, getAccountLimits } = require("../services/tierService");
const { assertDemoAiAllowed } = require("../helpers/demoEnvironment");
const { onPropertyCreated } = require("../services/resourceAutoSend");
const { ensureHomeAnniversaryEvents } = require("../services/homeAnniversaryService");
const { syncPropertyMissingAgentAdminNotifications } = require("../services/propertyMissingAgentNotifications");
const { assertAtMostOneAgentOnProperty } = require("../services/propertyAgentPolicy");
const propertySponsorshipService = require("../services/propertySponsorshipService");
const InspectionAnalysisJob = require("../models/inspectionAnalysisJob");
const InspectionAnalysisResult = require("../models/inspectionAnalysisResult");
const { enqueue } = require("../services/inspectionAnalysisQueue");
const AttomLookupJob = require("../models/attomLookupJob");
const { enqueue: enqueueAttomLookup } = require("../services/attomLookupQueue");
const Contact = require("../models/contact");
const SavedProfessional = require("../models/savedProfessional");
const Invitation = require("../models/invitation");
const User = require("../models/user");
const PropertyOwnershipTransferRequest = require("../models/propertyOwnershipTransferRequest");
const db = require("../db");
const { isAllowedInspectionAnalysisS3Key } = require("../constants/s3Upload");
const AgentAffiliation = require("../models/agentAffiliation");
const customerIoProvider = require("../services/emailProviders/customerIoProvider");
const customerIoLifecycleService = require("../services/customerIoLifecycleService");
const {
  getPropertyOwnerUserId,
  transferOwnershipBeforeOwnerRemoval,
} = require("../services/propertyOwnershipService");

const router = new express.Router();

/** Successful inspection analyses per property (initial run + one rerun). */
const MAX_INSPECTION_ANALYSIS_RUNS_PER_PROPERTY = 2;

/** HomeOps internal platform roles: omit from team lists for non-internal viewers. */
const INTERNAL_TEAM_PLATFORM_ROLES = new Set(["admin", "super_admin"]);

/**
 * @param {Array<Record<string, unknown>>} members
 * @param {string | undefined} viewerPlatformRole
 */
function filterPropertyTeamForViewer(members, viewerPlatformRole) {
  if (viewerPlatformRole === "admin" || viewerPlatformRole === "super_admin") {
    return members;
  }
  return members.filter(
    (m) =>
      m._pending ||
      !INTERNAL_TEAM_PLATFORM_ROLES.has(m.role)
  );
}

/** Team tab role for a pending invitation — never treat invitees as internal staff. */
function resolvePendingInvitationTeamRole(inv, matchedUser) {
  if (inv.intendedPropertyRole) return inv.intendedPropertyRole;
  const platformRole = String(matchedUser?.role ?? "").toLowerCase();
  if (
    platformRole &&
    platformRole !== "admin" &&
    platformRole !== "super_admin"
  ) {
    return matchedUser.role;
  }
  return "homeowner";
}

/** Attach affiliated agency (name + presigned logo) to agent members on a property team. */
async function enrichTeamWithAgentAgencies(members) {
  const agentIds = members
    .filter((m) => !m._pending && String(m.role || "").toLowerCase() === "agent")
    .map((m) => Number(m.id))
    .filter(Boolean);
  if (!agentIds.length) return members;

  const affiliationByUserId = await AgentAffiliation.getActiveForUserIds(agentIds);

  return Promise.all(
    members.map(async (member) => {
      if (member._pending || String(member.role || "").toLowerCase() !== "agent") {
        return member;
      }
      const affiliation = affiliationByUserId.get(Number(member.id));
      if (!affiliation?.agency?.name) return member;

      const agency = await addPresignedUrlToItem(
        { ...affiliation.agency },
        "logoUrl",
        "logoDisplayUrl"
      );

      return {
        ...member,
        agency: {
          id: agency.id,
          name: agency.name,
          legalName: agency.legalName || null,
          logoDisplayUrl: agency.logoDisplayUrl || null,
          website: agency.website || null,
          addressLine1: agency.addressLine1 || null,
          city: agency.city || null,
          state: agency.state || null,
          phone: agency.phone || null,
        },
      };
    })
  );
}

/** POST / - Create property, add creator as owner. Enforces tier limit. */
router.post("/", ensureLoggedIn, ensureUserCanAccessAccountFromBody(), async function (req, res, next) {
  try {
    const validator = jsonschema.validate(req.body, propertyNewSchema);
    if (!validator.valid) {
      const errs = validator.errors.map(e => e.stack);
      throw new BadRequestError(errs);
    }

    const accountId = req.body.account_id;
    if (!accountId) throw new BadRequestError("account_id is required");

    const userRole = res.locals.user?.role;
    const creatorId = res.locals.user?.id;
    const creatorRole = userRole === "homeowner" ? "homeowner" : "agent";
    if (userRole !== 'super_admin' && userRole !== 'admin') {
      const tierCheck = await canCreateProperty(accountId, userRole, creatorId);
      if (!tierCheck.allowed) {
        throw new ForbiddenError(`Property limit reached (${tierCheck.current}/${tierCheck.max}). Upgrade your plan.`);
      }
    }

    if (!creatorId) {
      throw new BadRequestError("Authenticated user is required to create a property");
    }

    const passport_id = generatePassportId({ state: req.body.state, zip: req.body.zip });
    /* Create property + owner membership atomically so a failed team insert
       cannot leave an account-owned orphan that still consumes plan limits. */
    const client = await db.connect();
    let property;
    try {
      await client.query("BEGIN");
      property = await Property.create(
        { ...req.body, passport_id, account_id: accountId },
        { client }
      );
      await Property.addUserToProperty(
        {
          property_id: property.id,
          user_id: creatorId,
          role: "owner",
        },
        { client }
      );
      await client.query("COMMIT");
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (_) {
        /* ignore rollback errors */
      }
      throw err;
    } finally {
      client.release();
    }

    try {
      await ensureHomeAnniversaryEvents(property.id, { createdByUserId: creatorId });
    } catch (annivErr) {
      console.error("[homeAnniversary] property created:", annivErr?.message);
    }

    /* Bulk-import path enqueues an async ATTOM public-records lookup. The queue
     * throttles calls (ATTOM_MIN_DELAY_MS) and retries transient failures, so
     * large imports never overwhelm ATTOM's rate limit. */
    if (req.body.enqueueAttomLookup === true) {
      try {
        const job = await AttomLookupJob.create({
          property_id: property.id,
          account_id: accountId,
          user_id: creatorId || null,
          trigger: "bulk_import",
        });
        enqueueAttomLookup(job.id);
      } catch (attomErr) {
        console.error("[attomLookup] enqueue-on-create failed:", attomErr?.message);
      }
    }

    let isFirstPropertyForUser = false;
    if (creatorId) {
      const countResult = await db.query(
        `SELECT COUNT(*)::int AS count FROM property_users WHERE user_id = $1`,
        [creatorId]
      );
      isFirstPropertyForUser = (countResult.rows[0]?.count ?? 0) === 1;
    }

    try {
      await onPropertyCreated({
        propertyId: property.id,
        accountId,
        createdByUserId: creatorId,
        creatorRole,
        isFirstPropertyForUser,
      });
    } catch (autoErr) {
      console.error("[resourceAutoSend] property created:", autoErr.message);
    }

    try {
      await syncPropertyMissingAgentAdminNotifications(property.id);
    } catch (missingAgentErr) {
      console.error("[propertyMissingAgent] property created:", missingAgentErr.message);
    }

    if (creatorId && res.locals.user?.email) {
      const propertyAddress =
        property.address ||
        [property.address_line_1, property.city, property.state, property.zip]
          .filter(Boolean)
          .join(", ");
      customerIoProvider
        .trackPropertyAdded({
          userEmail: res.locals.user.email,
          userName: res.locals.user.name,
          propertyId: property.id,
          propertyAddress,
          propertyUid: property.property_uid,
          propertyState: property.state,
          propertyCity: property.city,
          accountId,
          isFirstPropertyForUser,
          source: "create",
        })
        .catch((e) =>
          console.error("[customerIo] trackPropertyAdded create:", e.message)
        );
      customerIoLifecycleService
        .syncCustomerIoUserPropertyState({
          userId: creatorId,
          userEmail: res.locals.user.email,
        })
        .catch((e) =>
          console.error("[customerIo] sync property state create:", e.message)
        );
    }

    const propertyWithUrl = await addPresignedUrlToItem(property, "main_photo", "main_photo_url");
    if (creatorId && res.locals.user?.name) {
      propertyWithUrl.owner_user_name = res.locals.user.name;
    }
    return res.status(201).json({ property: propertyWithUrl });
  } catch (err) {
    return next(err);
  }
});

/** GET / - List all properties. Platform admin only. */
router.get("/", ensurePlatformAdmin, async function (req, res, next) {
  try {
    const properties = await Property.getAll();
    const propertiesWithUrls = await addPresignedUrlsToItems(properties, "main_photo", "main_photo_url");
    return res.json({ properties: propertiesWithUrls });
  } catch (err) {
    return next(err);
  }
});

/** GET /user/:userId - List properties for user. User or admin only.
 *  Also includes properties with pending invitations (marked with _pendingInvitation). */
router.get("/user/:userId", ensureLoggedIn, ensurePropertyAccess({ scope: "user", param: "userId" }), async function (req, res, next) {
  try {
    const viewer = res.locals.user;
    let inviteeEmail = viewer?.email ?? null;
    const targetUserId = String(req.params.userId);
    const isPlatformAdmin = viewer?.role === "super_admin" || viewer?.role === "admin";
    if (isPlatformAdmin && String(viewer.id) !== targetUserId) {
      const targetUser = await User.getById(req.params.userId);
      inviteeEmail = targetUser?.email ?? null;
    }

    /* Assistants are tethered to an agent and are not copied onto every
       property_users row — list the agent's portfolio for them. */
    const listUserId = await resolvePropertiesListUserId(req.params.userId);
    const [properties, rawPending] = await Promise.all([
      Property.getPropertiesByUserId(listUserId),
      inviteeEmail
        ? Property.getPropertiesWithPendingInvitations(inviteeEmail)
        : Promise.resolve([]),
    ]);

    const ownedIds = new Set(properties.map(p => p.id));
    const filtered = rawPending.filter(p => !ownedIds.has(p.id));

    const [propertiesWithUrls, pendingWithUrls] = await Promise.all([
      addPresignedUrlsToItems(properties, "main_photo", "main_photo_url"),
      addPresignedUrlsToItems(filtered, "main_photo", "main_photo_url"),
    ]);

    const pendingProperties = pendingWithUrls.map(p => ({
      ...p,
      _pendingInvitation: true,
      _invitationId: p._invitation_id,
      _invitationRole: p._invitation_role,
      _invitationExpiresAt: p._invitation_expires_at,
    }));

    return res.json({ properties: [...propertiesWithUrls, ...pendingProperties] });
  } catch (err) {
    return next(err);
  }
});

/** GET /team/:uid - Get property team members (including pending invitations). Requires property access. */
router.get("/team/:uid", ensureLoggedIn, ensurePropertyAccess(), async function (req, res, next) {
  try {
    const uid = req.params.uid;
    if (uid == null || uid === "null" || uid === "undefined" || String(uid).trim() === "") {
      throw new BadRequestError("Valid property uid required");
    }
    /* Middleware already resolved (and cached) uid → id; reuse it instead of
       re-querying the properties table. */
    const propertyId = res.locals.resolvedPropertyId;

    /* Team rows + pending invitations are independent — fetch in parallel. */
    const [teamRows, pendingInvitations] = await Promise.all([
      Property.getPropertyTeam(propertyId),
      Invitation.getByProperty(propertyId, { status: "pending" }),
    ]);

    const property_users_with_avatars = await addUserAvatarUrlsToItems(teamRows);

    /* Look up existing platform users by email so pending invitations can
       carry the invitee's actual platform role (e.g. an agent invited from
       the Agent tab keeps `role: "agent"` after a refresh, instead of being
       miscategorized as a homeowner). */
    const inviteeEmailsLower = [
      ...new Set(
        pendingInvitations
          .map((inv) => (inv.inviteeEmail || "").trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
    const userRoleByEmailLower = new Map();
    if (inviteeEmailsLower.length > 0) {
      const userRolesRes = await db.query(
        `SELECT LOWER(TRIM(email)) AS email_lower, role, name
         FROM users
         WHERE LOWER(TRIM(email)) = ANY($1::text[])`,
        [inviteeEmailsLower],
      );
      for (const row of userRolesRes.rows) {
        userRoleByEmailLower.set(row.email_lower, {
          role: row.role,
          name: row.name,
        });
      }
    }

    const pendingMembers = pendingInvitations.map((inv) => {
      const emailLower = (inv.inviteeEmail || "").trim().toLowerCase();
      const matchedUser = userRoleByEmailLower.get(emailLower) || null;
      /* Prefer the explicit invitation category captured at invite time, then
         fall back to the invitee's existing platform role (covers older
         invitations created before intended_property_role was stored), then
         finally to the access-level intended_role. */
      const role = resolvePendingInvitationTeamRole(inv, matchedUser);
      return {
        email: inv.inviteeEmail,
        name: matchedUser?.name || inv.inviteeEmail,
        role,
        property_role: inv.intendedRole,
        /* Per-section access restrictions captured at invite time so the
           share-property modal can rehydrate them after refresh. */
        permissions: inv.permissions ?? null,
        _pending: true,
        invitationId: inv.id,
      };
    });

    const allMembers = [...property_users_with_avatars, ...pendingMembers];
    const viewerRole = res.locals.user?.role;
    const filtered = filterPropertyTeamForViewer(allMembers, viewerRole);
    const property_users = await enrichTeamWithAgentAgencies(filtered);
    return res.json({ property_users });
  } catch (err) {
    return next(err);
  }
});

/** POST /ownership-transfer-requests/:requestId/accept — Proposed new owner accepts; roles update in DB. */
router.post(
  "/ownership-transfer-requests/:requestId/accept",
  ensureLoggedIn,
  async function (req, res, next) {
    try {
      const result = await PropertyOwnershipTransferRequest.accept(
        req.params.requestId,
        res.locals.user.id
      );
      clearPropertyAccessCache(result.propertyId);
      return res.json({ ok: true, propertyId: result.propertyId });
    } catch (err) {
      return next(err);
    }
  }
);

/** POST /ownership-transfer-requests/:requestId/decline — Proposed new owner declines. */
router.post(
  "/ownership-transfer-requests/:requestId/decline",
  ensureLoggedIn,
  async function (req, res, next) {
    try {
      await PropertyOwnershipTransferRequest.decline(req.params.requestId, res.locals.user.id);
      return res.json({ ok: true });
    } catch (err) {
      return next(err);
    }
  }
);

/** POST /:propertyId/ownership-transfer-request — Current owner requests transfer. Body: { toUserId }. */
router.post(
  "/:propertyId/ownership-transfer-request",
  ensureLoggedIn,
  ensurePropertyAccess({ param: "propertyId" }),
  ensurePropertyOwner("propertyId"),
  async function (req, res, next) {
    try {
      const raw = req.body?.toUserId ?? req.body?.to_user_id;
      if (raw == null || raw === "") {
        throw new BadRequestError("toUserId is required");
      }
      const toUserId = parseInt(String(raw), 10);
      if (!Number.isFinite(toUserId)) {
        throw new BadRequestError("toUserId must be a valid user id");
      }
      const request = await PropertyOwnershipTransferRequest.create({
        propertyId: req.params.propertyId,
        fromUserId: res.locals.user.id,
        toUserId,
      });
      return res.status(201).json({ request });
    } catch (err) {
      return next(err);
    }
  }
);

/** GET /agent/account/:accountId - Get agents for account. */
router.get("/agent/account/:accountId", ensureLoggedIn, ensureUserCanAccessAccountByParam("accountId"), async function (req, res, next) {
  try {
    const users = await Property.getAgentByAccountId(req.params.accountId);
    return res.json({ users });
  } catch (err) {
    return next(err);
  }
});

/** GET /account/:accountId/homeowners - Accepted homeowners with linked properties (one query). */
router.get(
  "/account/:accountId/homeowners",
  ensureLoggedIn,
  ensureUserCanAccessAccountByParam("accountId"),
  async function (req, res, next) {
    try {
      const viewer = res.locals.user;
      let agentUserId = viewer?.role === "agent" ? viewer.id : null;
      if (!agentUserId && viewer?.role === "assistant" && viewer?.id) {
        agentUserId = await resolveAssistantAgentUserId(viewer.id);
      }
      const rows = await Property.getAcceptedHomeownersByAccountId(
        req.params.accountId,
        { agentUserId },
      );

      const homeownersMap = new Map();
      for (const row of rows) {
        const userId = row.user_id;
        if (!homeownersMap.has(userId)) {
          homeownersMap.set(userId, {
            id: userId,
            name: row.user_name || row.user_email || "Homeowner",
            email: row.user_email || "",
            image: row.user_image,
            avatar_url: row.user_avatar_url,
            properties: [],
          });
        }
        homeownersMap.get(userId).properties.push({
          property_uid: row.property_uid,
          property_name: row.property_name,
          passport_id: row.passport_id,
          main_photo: row.main_photo,
          address: row.address,
          city: row.city,
          state: row.state,
          zip: row.zip,
        });
      }

      let homeowners = [...homeownersMap.values()];
      homeowners = await addUserAvatarUrlsToItems(homeowners);

      const allProperties = homeowners.flatMap((h) => h.properties);
      const propertiesWithUrls = await addPresignedUrlsToItems(
        allProperties,
        "main_photo",
        "main_photo_url",
      );
      const photoUrlByUid = new Map(
        propertiesWithUrls.map((p) => [p.property_uid, p.main_photo_url ?? null]),
      );

      const payload = homeowners.map((h) => ({
        id: h.id,
        name: h.name,
        email: h.email,
        image_url: h.image_url,
        properties: h.properties.map((p) => ({
          property_uid: p.property_uid,
          property_name: p.property_name,
          passport_id: p.passport_id,
          address: p.address,
          city: p.city,
          state: p.state,
          zip: p.zip,
          main_photo_url: photoUrlByUid.get(p.property_uid) ?? null,
        })),
      }));

      return res.json({ homeowners: payload });
    } catch (err) {
      return next(err);
    }
  },
);

/** GET /:uid - Get single property by uid. Requires property access. */
router.get("/:uid", ensureLoggedIn, ensurePropertyAccess(), async function (req, res, next) {
  try {
    const property = await Property.get(req.params.uid);
    const propertyWithUrl = await addPresignedUrlToItem(property, "main_photo", "main_photo_url");
    return res.json({ property: propertyWithUrl });
  } catch (err) {
    return next(err);
  }
});

/** Resolve property_uid (8 digits) or numeric primary-key id to numeric id. */
async function resolvePropertyIdForInspection(req, res, next) {
  try {
    const raw = req.params.propertyId;
    if (!raw) return next();
    const rawStr = String(raw);
    if (isPropertyUid(rawStr)) {
      const propRes = await db.query(
        `SELECT id FROM properties WHERE property_uid = $1`,
        [rawStr]
      );
      if (propRes.rows.length === 0) throw new ForbiddenError("Property not found.");
      req.params.propertyId = propRes.rows[0].id;
      return next();
    }
    if (/^\d+$/.test(rawStr)) {
      req.params.propertyId = parseInt(rawStr, 10);
      return next();
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

/** POST /:propertyId/inspection-report/analyze - Start inspection report analysis. Body: { s3Key, fileName?, mimeType? }. */
router.post(
  "/:propertyId/inspection-report/analyze",
  ensureLoggedIn,
  resolvePropertyIdForInspection,
  ensurePropertyAccess({ param: "propertyId" }),
  async function (req, res, next) {
    try {
      assertDemoAiAllowed();
      const propertyId = req.params.propertyId;
      const userId = res.locals.user.id;
      const userRole = res.locals.user?.role;
      const { s3Key, fileName, mimeType } = req.body || {};

      if (userRole !== "super_admin" && userRole !== "admin") {
        const aiAllowed = await checkAiFeaturesAllowed(userId, userRole, { propertyId });
        if (!aiAllowed.allowed) {
          throw new ForbiddenError(aiAllowed.message || "AI inspection analysis is not available on your plan.");
        }
        const quotaCheck = await checkAiTokenQuota(userId, userRole, { propertyId });
        if (!quotaCheck.allowed) {
          throw new ForbiddenError(
            `AI token quota exceeded (${quotaCheck.used}/${quotaCheck.quota} this month). Upgrade your plan for more.`
          );
        }
      }

      if (!s3Key || typeof s3Key !== "string") {
        throw new BadRequestError("s3Key is required");
      }
      const trimmedKey = s3Key.trim();
      if (!isAllowedInspectionAnalysisS3Key(trimmedKey)) {
        throw new BadRequestError("Invalid s3Key");
      }

      const completedRuns = await InspectionAnalysisJob.countCompletedByProperty(propertyId);
      if (completedRuns >= MAX_INSPECTION_ANALYSIS_RUNS_PER_PROPERTY) {
        throw new ForbiddenError(
          `Inspection analysis can be run at most ${MAX_INSPECTION_ANALYSIS_RUNS_PER_PROPERTY} times per property.`
        );
      }

      const job = await InspectionAnalysisJob.create({
        property_id: propertyId,
        user_id: userId,
        s3_key: trimmedKey,
        file_name: fileName || null,
        mime_type: mimeType || null,
      });

      enqueue(job.id);

      return res.status(202).json({ jobId: job.id });
    } catch (err) {
      return next(err);
    }
  }
);

/** GET /:propertyId/inspection-analysis - Get latest inspection analysis result for property. */
router.get(
  "/:propertyId/inspection-analysis",
  ensureLoggedIn,
  resolvePropertyIdForInspection,
  ensurePropertyAccess({ param: "propertyId" }),
  async function (req, res, next) {
    try {
      const propertyId = req.params.propertyId;
      const reportS3Key = (req.query.reportS3Key || "").trim();
      const completedRunCount = await InspectionAnalysisJob.countCompletedByProperty(
        propertyId
      );
      const runLimitPayload = {
        completedRunCount,
        maxAnalysisRuns: MAX_INSPECTION_ANALYSIS_RUNS_PER_PROPERTY,
      };
      const result = await InspectionAnalysisResult.getByPropertyId(propertyId);
      if (!result) {
        let pendingJob = null;
        let row = null;
        if (reportS3Key) {
          row = await InspectionAnalysisJob.getActiveForPropertyReport(
            propertyId,
            reportS3Key
          );
        } else {
          row = await InspectionAnalysisJob.getLatestActiveForProperty(
            propertyId
          );
        }
        if (row) {
          pendingJob = {
            jobId: row.id,
            status: row.status,
            progress: row.progress,
            s3Key: row.s3_key,
            fileName: row.file_name,
            mimeType: row.mime_type,
          };
        }
        return res.json({ analysis: null, reviewStatus: null, pendingJob, ...runLimitPayload });
      }

      // Review gate: until a Super Admin approves, the analysis stays hidden from the
      // customer. We still report `reviewStatus` so the UI can show the progress tracker.
      if (result.review_status !== "approved") {
        return res.json({
          analysis: null,
          reviewStatus: result.review_status,
          reviewSubmittedAt: result.review_submitted_at,
          pendingJob: null,
          ...runLimitPayload,
        });
      }

      const payload = {
        analysis: {
          conditionRating: result.condition_rating,
          conditionConfidence: result.condition_confidence,
          conditionRationale: result.condition_rationale,
          systemsDetected: result.systems_detected,
          needsAttention: result.needs_attention,
          suggestedSystemsToAdd: result.suggested_systems_to_add,
          maintenanceSuggestions: result.maintenance_suggestions,
          summary: result.summary,
          citations: result.citations,
          createdAt: result.created_at,
        },
        reviewStatus: "approved",
        reviewedAt: result.reviewed_at,
        pendingJob: null,
        ...runLimitPayload,
      };
      return res.json(payload);
    } catch (err) {
      return next(err);
    }
  }
);

/** POST /attom-lookup/statuses — Batch latest-ATTOM-job lookup for the given property ids.
 *
 * Body: { account_id: number|string, ids: Array<number|string> }
 *
 * Used by the bulk-import "Review & confirm" screen to poll per-row ATTOM
 * progress without making one HTTP request per property. We scope the query to
 * a single account (checked via middleware) and only return rows whose
 * `account_id` matches, so the caller cannot exfiltrate jobs from other
 * accounts by listing ids they don't own.
 *
 * Response shape: { statuses: Record<propertyId, JobSummary | null> } where
 * JobSummary matches the single-property endpoint's `job` shape; properties
 * with no ATTOM job yet return `null`. */
router.post(
  "/attom-lookup/statuses",
  ensureLoggedIn,
  ensureUserCanAccessAccountFromBody(),
  async function (req, res, next) {
    try {
      const accountId = req.body?.account_id;
      const rawIds = Array.isArray(req.body?.ids) ? req.body.ids : [];
      const ids = rawIds
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0);

      if (ids.length === 0) {
        return res.json({ statuses: {} });
      }

      const rows = await AttomLookupJob.getLatestForProperties(ids);
      const scoped = rows.filter(
        (r) => String(r.account_id) === String(accountId)
      );

      const statuses = {};
      for (const id of ids) statuses[id] = null;

      for (const job of scoped) {
        let populatedKeys = [];
        if (Array.isArray(job.populated_keys)) {
          populatedKeys = job.populated_keys;
        } else if (
          typeof job.populated_keys === "string" &&
          job.populated_keys.trim() !== ""
        ) {
          try {
            const parsed = JSON.parse(job.populated_keys);
            if (Array.isArray(parsed)) populatedKeys = parsed;
          } catch {
            populatedKeys = [];
          }
        }
        statuses[job.property_id] = {
          id: job.id,
          status: job.status,
          trigger: job.trigger,
          attempts: job.attempts,
          maxAttempts: job.max_attempts,
          errorCode: job.error_code,
          errorMessage: job.error_message,
          populatedKeys,
          runAfter: job.run_after,
          createdAt: job.created_at,
          updatedAt: job.updated_at,
        };
      }

      return res.json({ statuses });
    } catch (err) {
      return next(err);
    }
  }
);

/** POST /:propertyId/attom-lookup — Enqueue a manual ATTOM refresh for this property.
 *
 * Returns 202 with the new job id. Processing is serial and throttled by
 * services/attomLookupQueue.js; clients should poll GET
 * /:propertyId/attom-lookup/latest for status. If there's already an active
 * job (queued/processing), reuses it instead of creating a duplicate. */
router.post(
  "/:propertyId/attom-lookup",
  ensureLoggedIn,
  resolvePropertyIdForInspection,
  ensurePropertyAccess({ param: "propertyId" }),
  async function (req, res, next) {
    try {
      const propertyId = req.params.propertyId;
      const userId = res.locals.user?.id || null;
      const lookupLimit = AttomLookupJob.getLookupLimitForRole(
        res.locals.user?.role
      );

      const existing = await AttomLookupJob.getLatestActiveForProperty(propertyId);
      if (existing) {
        const lookupCount = await AttomLookupJob.countForProperty(propertyId);
        return res.status(202).json({
          job: {
            id: existing.id,
            status: existing.status,
            attempts: existing.attempts,
            maxAttempts: existing.max_attempts,
            runAfter: existing.run_after,
            createdAt: existing.created_at,
          },
          reused: true,
          lookupCount,
          lookupLimit,
        });
      }

      const lookupCount = await AttomLookupJob.countForProperty(propertyId);
      if (lookupLimit != null && lookupCount >= lookupLimit) {
        throw new ForbiddenError(
          `ATTOM lookup limit reached (${lookupLimit} per property). Contact support if you need another refresh.`
        );
      }

      const propRes = await db.query(
        `SELECT account_id FROM properties WHERE id = $1`,
        [propertyId]
      );
      if (propRes.rows.length === 0) {
        throw new BadRequestError("Property not found.");
      }
      const accountId = propRes.rows[0].account_id;

      const job = await AttomLookupJob.create({
        property_id: propertyId,
        account_id: accountId,
        user_id: userId,
        trigger: "manual_refresh",
      });
      enqueueAttomLookup(job.id);

      return res.status(202).json({
        job: {
          id: job.id,
          status: job.status,
          attempts: job.attempts,
          maxAttempts: job.max_attempts,
          runAfter: job.run_after,
          createdAt: job.created_at,
        },
        reused: false,
        lookupCount: lookupCount + 1,
        lookupLimit,
      });
    } catch (err) {
      return next(err);
    }
  }
);

/** GET /:propertyId/attom-lookup/latest — Latest ATTOM lookup job status for UI polling.
 *
 * Returns `{ job: null }` if no job has ever been created. Used by the
 * IdentityTab "Refresh property data" button to show Queued / Looking up /
 * Updated / Failed chips. */
router.get(
  "/:propertyId/attom-lookup/latest",
  ensureLoggedIn,
  resolvePropertyIdForInspection,
  ensurePropertyAccess({ param: "propertyId" }),
  async function (req, res, next) {
    try {
      const propertyId = req.params.propertyId;
      const lookupLimit = AttomLookupJob.getLookupLimitForRole(
        res.locals.user?.role
      );
      const [job, lookupCount] = await Promise.all([
        AttomLookupJob.getLatestForProperty(propertyId),
        AttomLookupJob.countForProperty(propertyId),
      ]);
      if (!job) {
        return res.json({
          job: null,
          lookupCount,
          lookupLimit,
        });
      }

      let populatedKeys = [];
      if (Array.isArray(job.populated_keys)) {
        populatedKeys = job.populated_keys;
      } else if (
        typeof job.populated_keys === "string" &&
        job.populated_keys.trim() !== ""
      ) {
        try {
          const parsed = JSON.parse(job.populated_keys);
          if (Array.isArray(parsed)) populatedKeys = parsed;
        } catch {
          populatedKeys = [];
        }
      }

      return res.json({
        job: {
          id: job.id,
          status: job.status,
          trigger: job.trigger,
          attempts: job.attempts,
          maxAttempts: job.max_attempts,
          errorCode: job.error_code,
          errorMessage: job.error_message,
          populatedKeys,
          runAfter: job.run_after,
          createdAt: job.created_at,
          updatedAt: job.updated_at,
        },
        lookupCount,
        lookupLimit,
      });
    } catch (err) {
      return next(err);
    }
  }
);

/** GET /:propertyId/contractors - Unified contractors (contacts + saved professionals) for scheduling. Query: query (optional search). */
router.get(
  "/:propertyId/contractors",
  ensureLoggedIn,
  resolvePropertyIdForInspection,
  ensurePropertyAccess({ param: "propertyId" }),
  async function (req, res, next) {
    try {
      const propertyId = req.params.propertyId;
      const query = (req.query.query || "").trim().toLowerCase();
      const userId = res.locals.user.id;

      const propRes = await db.query(
        `SELECT account_id FROM properties WHERE id = $1`,
        [propertyId]
      );
      if (propRes.rows.length === 0) {
        throw new ForbiddenError("Property not found.");
      }
      const accountId = propRes.rows[0].account_id;
      const userRole = res.locals.user.role;

      const [contacts, savedProfessionals] = await Promise.all([
        Contact.getByAccountIdForUser(accountId, userId, userRole),
        SavedProfessional.getByUserId(userId),
      ]);

      const contactItems = (contacts || []).map((c) => ({
        id: `contact-${c.id}`,
        sourceId: c.id,
        name: c.name || "Contact",
        source: "contact",
        phone: c.phone,
        email: c.email,
      }));

      const proDisplayName = (p) =>
        p.company_name || p.contact_name || "Professional";

      const professionalItems = (savedProfessionals || []).map((p) => ({
        id: `pro-${p.id}`,
        sourceId: p.id,
        name: proDisplayName(p),
        source: "professional",
        phone: p.phone,
        email: p.email,
        categoryName: p.category_name,
      }));

      let combined = [...contactItems, ...professionalItems];

      if (query) {
        combined = combined.filter(
          (item) =>
            item.name?.toLowerCase().includes(query) ||
            item.phone?.includes(query) ||
            item.email?.toLowerCase().includes(query) ||
            item.categoryName?.toLowerCase().includes(query)
        );
      }

      return res.json({ contractors: combined });
    } catch (err) {
      return next(err);
    }
  }
);

/** POST /:propertyId/users - Add users to property. Body: array of { id, role }. */
router.post("/:propertyId/users", ensureLoggedIn, ensurePropertyAccess({ param: "propertyId" }), async function (req, res, next) {
  try {
    const propertyId = req.params.propertyId;
    const users = Array.isArray(req.body) ? req.body : (req.body.users || []);
    if (!Array.isArray(users)) throw new BadRequestError("Provide users array with id and role");
    /* Only one agent per property — reject before any insert. */
    await assertAtMostOneAgentOnProperty(
      propertyId,
      users.map((u) => u?.id).filter((id) => id != null),
      { isSync: false }
    );
    /* Enforce per-plan view-only user limit on additive adds (admins bypass). */
    const addRoleUserRole = res.locals.user?.role;
    const viewerAdds = users.filter(
      (u) => (u?.role || "").toLowerCase() === "viewer" && u.id != null
    );
    if (
      viewerAdds.length > 0 &&
      addRoleUserRole !== "admin" &&
      addRoleUserRole !== "super_admin"
    ) {
      const property = await Property.get(propertyId);
      if (property?.account_id) {
        const limits = await getAccountLimits(property.account_id);
        const max = limits.maxViewers;
        if (max != null) {
          const cntRes = await db.query(
            `SELECT
               (SELECT COUNT(*)::int FROM property_users
                  WHERE property_id = $1 AND role = 'viewer'
                    AND user_id NOT IN (SELECT UNNEST($2::int[])))
               +
               (SELECT COUNT(*)::int FROM invitations
                  WHERE property_id = $1 AND status = 'pending' AND intended_role = 'viewer')
               AS count`,
            [property.id, viewerAdds.map((u) => Number(u.id)).filter(Number.isInteger)]
          );
          const existing = cntRes.rows[0]?.count ?? 0;
          const total = existing + viewerAdds.length;
          if (total > max) {
            throw new ForbiddenError(
              `View-only user limit reached (${total}/${max}) for this property. Remove a view-only member or upgrade the plan.`
            );
          }
        }
      }
    }
    const property_users = [];
    for (const { id, role } of users) {
      if (id == null) throw new BadRequestError("Each user must have id and role");
      const row = await Property.addUserToProperty({
        property_id: propertyId,
        user_id: id,
        role: role || "editor",
      });
      property_users.push(row);
    }
    try {
      await syncPropertyMissingAgentAdminNotifications(propertyId);
    } catch (missingAgentErr) {
      console.error("[propertyMissingAgent] POST users:", missingAgentErr.message);
    }
    return res.status(201).json({ property: { added: property_users.length, property_users } });
  } catch (err) {
    return next(err);
  }
});

/** PATCH /:propertyId - Update property. */
router.patch("/:propertyId", ensureLoggedIn, ensurePropertyAccess({ param: "propertyId" }), async function (req, res, next) {
  try {
    const t0 = Date.now();
    const property = await Property.updateProperty(req.params.propertyId, req.body);
    if (Object.prototype.hasOwnProperty.call(req.body, "last_sale_date")) {
      try {
        await ensureHomeAnniversaryEvents(property.id, {
          createdByUserId: res.locals.user?.id,
        });
      } catch (annivErr) {
        console.error("[homeAnniversary] property updated:", annivErr?.message);
      }
    }
    const tDb = Date.now();
    const propertyWithUrl = await addPresignedUrlToItem(property, "main_photo", "main_photo_url");
    if (process.env.NODE_ENV !== "production") {
      console.log(`[perf] PATCH /properties/${req.params.propertyId}: db ${tDb - t0}ms | presign ${Date.now() - tDb}ms | total ${Date.now() - t0}ms`);
    }
    return res.json({ property: propertyWithUrl });
  } catch (err) {
    return next(err);
  }
});

/** PATCH /:propertyId/team - Sync property team. Body: array of { id, role }. */
router.patch("/:propertyId/team", ensureLoggedIn, ensurePropertyAccess({ param: "propertyId" }), async function (req, res, next) {
  try {
    const propertyId = req.params.propertyId;
    let previousTeamUserIds = new Set();
    if (Array.isArray(req.body)) {
      const currentTeam = await db.query(
        `SELECT user_id FROM property_users WHERE property_id = $1`,
        [propertyId]
      );
      previousTeamUserIds = new Set(currentTeam.rows.map((r) => r.user_id));
    }
    /* Only one agent per property — reject before sync. */
    if (Array.isArray(req.body)) {
      await assertAtMostOneAgentOnProperty(
        propertyId,
        req.body.map((u) => u?.id).filter((id) => id != null),
        { isSync: true }
      );
    }
    /* Enforce per-plan view-only user limit on team sync (admins bypass). */
    const userRole = res.locals.user?.role;
    if (
      Array.isArray(req.body) &&
      userRole !== "admin" &&
      userRole !== "super_admin"
    ) {
      const viewerIds = req.body
        .filter((u) => (u?.role || "").toLowerCase() === "viewer")
        .map((u) => u.id)
        .filter((id) => id != null);
      const property = await Property.get(propertyId);
      if (property?.account_id) {
        const limits = await getAccountLimits(property.account_id);
        const max = limits.maxViewers;
        if (max != null) {
          const pendingRes = await db.query(
            `SELECT COUNT(*)::int AS count FROM invitations
             WHERE property_id = $1 AND status = 'pending' AND intended_role = 'viewer'`,
            [property.id]
          );
          const pendingViewerInvites = pendingRes.rows[0]?.count ?? 0;
          const total = viewerIds.length + pendingViewerInvites;
          if (total > max) {
            throw new ForbiddenError(
              `View-only user limit reached (${total}/${max}) for this property. Remove a view-only member or upgrade the plan.`
            );
          }
        }
      }
    }
    if (Array.isArray(req.body)) {
      const newTeamUserIds = new Set(
        req.body.map((u) => u?.id).filter((id) => id != null)
      );
      const ownerUserId = await getPropertyOwnerUserId(propertyId);
      await transferOwnershipBeforeOwnerRemoval({
        propertyId,
        ownerUserId,
        actingAdminUserId: res.locals.user.id,
        actingAdminRole: userRole,
        newTeamUserIds,
      });
    }
    const property_users = await Property.updatePropertyUsers(propertyId, req.body);
    clearPropertyAccessCache(propertyId);
    if (Array.isArray(req.body)) {
      const newIds = new Set(
        req.body.map((u) => u?.id).filter((id) => id != null)
      );
      const removedUserIds = [...previousTeamUserIds].filter((id) => !newIds.has(id));
      for (const uid of removedUserIds) {
        customerIoLifecycleService
          .syncCustomerIoUserPropertyState({
            userId: uid,
            context: {
              reason: "removed_from_team",
              lastPropertyId: propertyId,
            },
          })
          .catch((e) =>
            console.error("[customerIo] sync property state team remove:", e.message)
          );
      }
      for (const uid of newIds) {
        customerIoLifecycleService
          .syncCustomerIoUserPropertyState({ userId: uid })
          .catch((e) =>
            console.error("[customerIo] sync property state team update:", e.message)
          );
      }
    }
    try {
      await syncPropertyMissingAgentAdminNotifications(propertyId);
    } catch (missingAgentErr) {
      console.error("[propertyMissingAgent] PATCH team:", missingAgentErr.message);
    }
    /* If the sponsoring agent was removed from the team, end the sponsorship. */
    try {
      await propertySponsorshipService.reconcileForProperty(propertyId);
    } catch (sponsorshipErr) {
      console.error("[sponsorship] PATCH team reconcile:", sponsorshipErr.message);
    }
    return res.status(201).json({ property_users });
  } catch (err) {
    return next(err);
  }
});

/** DELETE /:propertyId - Delete property. Requires property owner role. */
router.delete(
  "/:propertyId",
  ensureLoggedIn,
  ensurePropertyOwner(
    "propertyId",
    "Only property owners can delete properties. Agents and other team members do not have permission.",
  ),
  async function (req, res, next) {
  try {
    const deletedMeta = await customerIoProvider.notifyCustomerIoPropertyDeleted(
      req.params.propertyId
    );
    await Property.remove(req.params.propertyId);
    if (deletedMeta?.memberUserIds?.length) {
      customerIoLifecycleService
        .syncCustomerIoUsersPropertyState(deletedMeta.memberUserIds, {
          reason: "property_deleted",
          lastPropertyId: deletedMeta.propertyId,
          lastPropertyUid: deletedMeta.propertyUid,
        })
        .catch((e) =>
          console.error("[customerIo] sync property state delete:", e.message)
        );
    }
    return res.json({ deleted: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
