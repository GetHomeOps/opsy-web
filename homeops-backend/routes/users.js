"use strict";

/**
 * Users Routes
 *
 * CRUD and listing endpoints for users. Supports account-scoped and
 * agent-scoped queries with role-based access control.
 *
 * Endpoints:
 * - GET /: List all users (platform admin)
 * - GET /account/:accountId: Users in account (platform admin)
 * - GET /agent/:agentId: Users sharing accounts with agent (platform admin)
 * - GET /user-accounts: Current user's account IDs
 * - GET /:email: Single user by email (self or platform admin)
 * - PATCH /:id: Update user profile (self or platform admin)
 * - DELETE /:id: Remove user (super admin)
 * - POST /activate/:userId: Activate user (super admin)
 */

const express = require("express");
const jsonschema = require("jsonschema");
const {
  ensureSuperAdmin,
  ensurePlatformAdmin,
  ensureLoggedIn,
} = require("../middleware/auth");
const { BadRequestError, ForbiddenError } = require("../expressError");
const User = require("../models/user");
const Account = require("../models/account");
const userUpdateSchema = require("../schemas/userUpdate.json");
const { addPresignedUrlToItem, addPresignedUrlsToItems } = require("../helpers/presignedUrls");
const db = require("../db");
const { notifyNewUserAccount } = require("../services/opsTeamNotifyService");
const { createAccountInvitation } = require("../services/invitationService");
const { assertDemoResetAllowed, isDemoEnvironment } = require("../helpers/demoEnvironment");
const { provisionDemoAccount } = require("../services/demoAccountProvisioner");

const router = express.Router();
const DEMO_HOMEOWNER_RESET_EMAIL = "hello-homeowner@heyopsy.com";

/** POST / - Admin-created user. Creates user as pending (is_active=false,
 *  onboarding_completed=false) and, by default, immediately sends an invitation
 *  email so the invitee can set a password and run through the onboarding /
 *  payment workflow on their own. Account linking, activation, and onboarding
 *  completion happen when the user accepts the invitation and finishes picking
 *  a plan.
 *
 *  Pass `sendInvite: false` (or `sendInvitationEmail: false`) in the body to
 *  skip the invitation email — useful when bulk-creating users who shouldn't be
 *  contacted yet. The invitation can still be sent later via the existing
 *  "Resend invitation email" action in the user form. */
router.post("/", ensureLoggedIn, ensurePlatformAdmin, async function (req, res, next) {
  try {
    if (isDemoEnvironment() && res.locals.user?.role !== "super_admin") {
      throw new ForbiddenError("User creation is restricted to super admins on the demo site.");
    }

    const {
      name,
      email,
      password,
      phone,
      role,
      contact,
      image,
      accountId,
      sendInvite,
      sendInvitationEmail,
      provisionDemoAccount: provisionDemoAccountFlag,
    } = req.body;

    const wantsProvision =
      provisionDemoAccountFlag === true || provisionDemoAccountFlag === "true";

    if (wantsProvision) {
      if (!isDemoEnvironment()) {
        throw new BadRequestError("Demo account provisioning is only available on the demo site.");
      }
      if (res.locals.user?.role !== "super_admin") {
        throw new ForbiddenError("Only super admins can provision demo accounts.");
      }
      if (role !== "homeowner" && role !== "agent") {
        throw new BadRequestError("Demo provisioning supports homeowner and agent roles only.");
      }
    }

    const shouldSendInvite =
      wantsProvision || sendInvite === false || sendInvitationEmail === false ? false : true;

    /* Lock the role for admin-created homeowner/agent users so they can
       only see plans matching the role the admin chose during onboarding,
       and so the role can't be tampered with via the API. Internal roles
       (admin/super_admin) don't need locking. */
    const isLockableRole = role === "homeowner" || role === "agent";
    const newUser = await User.register({
      name,
      email,
      password,
      phone,
      role,
      contact,
      is_active: wantsProvision ? true : false,
      onboarding_completed: wantsProvision ? undefined : false,
      role_locked: isLockableRole,
    });

    if (image) {
      await User.update({ id: newUser.id, image });
    }

    if (!isDemoEnvironment()) {
      notifyNewUserAccount({
        userId: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role || "homeowner",
        source: "admin_created_user",
      }).catch((e) => console.error("[opsTeamNotify] admin create user:", e.message));
    }

    let demoSummary = null;
    if (wantsProvision) {
      demoSummary = await provisionDemoAccount({
        userId: newUser.id,
        role,
        name,
        email,
        phone,
      });
    }

    const inviterUserId = res.locals.user?.id;
    let resolvedAccountId = accountId ? Number(accountId) : null;
    if (!resolvedAccountId && inviterUserId && !wantsProvision) {
      try {
        const inviterAccounts = await Account.getUserAccounts(inviterUserId);
        resolvedAccountId = inviterAccounts?.[0]?.id || null;
      } catch (acctErr) {
        console.error("[users.create] inviter account lookup:", acctErr.message);
      }
    }

    let invitation = null;
    let invitationEmailSent = false;
    let invitationSkipped = false;
    if (!shouldSendInvite) {
      invitationSkipped = true;
      if (!wantsProvision) {
        console.info(
          `[users.create] sendInvite=false; skipping invitation email for ${newUser.email}.`
        );
      }
    } else if (resolvedAccountId) {
      try {
        const inviteResult = await createAccountInvitation({
          inviterUserId,
          inviteeEmail: newUser.email,
          accountId: resolvedAccountId,
          intendedRole: "member",
        });
        invitation = inviteResult?.invitation || null;
        invitationEmailSent = !!invitation;
      } catch (inviteErr) {
        console.error("[users.create] failed to send invitation email:", inviteErr.message);
      }
    } else if (!wantsProvision) {
      console.warn(
        `[users.create] No accountId resolved for invitation to ${newUser.email}; skipping auto-invite.`
      );
    }

    const user = await User.getById(newUser.id);
    return res.status(201).json({
      user,
      invitation,
      invitationEmailSent,
      invitationSkipped,
      provisioned: wantsProvision,
      demoSummary,
    });
  } catch (err) {
    return next(err);
  }
});

router.get("/", ensureLoggedIn, ensurePlatformAdmin, async function (req, res, next) {
  try {
    const users = await User.getAll();
    const usersWithUrls = await addPresignedUrlsToItems(users, "image", "image_url");
    return res.json({ users: usersWithUrls });
  } catch (err) {
    return next(err);
  }
});

router.get("/account/:accountId", ensureLoggedIn, ensurePlatformAdmin, async function (req, res, next) {
  try {
    const users = await User.getByAccountId(req.params.accountId);
    const usersWithUrls = await addPresignedUrlsToItems(users, "image", "image_url");
    return res.json({ users: usersWithUrls });
  } catch (err) {
    return next(err);
  }
});

router.get("/agent/:agentId", ensureLoggedIn, ensurePlatformAdmin, async function (req, res, next) {
  try {
    const users = await User.getUsersBySharedAccounts(req.params.agentId);
    const usersWithUrls = await addPresignedUrlsToItems(users, "image", "image_url");
    return res.json({ users: usersWithUrls });
  } catch (err) {
    return next(err);
  }
});

router.get("/agents", ensureLoggedIn, async function (req, res, next) {
  try {
    const agents = await User.getAgents();
    const agentsWithUrls = await addPresignedUrlsToItems(agents, "image", "image_url");
    return res.json({ agents: agentsWithUrls });
  } catch (err) {
    return next(err);
  }
});

router.get("/user-accounts", ensureLoggedIn, async function (req, res, next) {
  try {
    const userId = res.locals.user?.id;
    if (!userId) throw new ForbiddenError("User authentication required.");
    const result = await User.userHasAccount(userId);
    return res.json({ accountIds: result ? [result.account_id] : [] });
  } catch (err) {
    return next(err);
  }
});

/** GET /onboarding-status - Lightweight check for welcome modal: has calendar integrations + saved professionals. */
router.get("/onboarding-status", ensureLoggedIn, async function (req, res, next) {
  try {
    const userId = res.locals.user?.id;
    if (!userId) return res.status(401).json({ error: { message: "Unauthorized" } });
    const [calResult, proResult] = await Promise.all([
      db.query(`SELECT EXISTS(SELECT 1 FROM calendar_integrations WHERE user_id = $1) AS has`, [userId]),
      db.query(`SELECT EXISTS(SELECT 1 FROM saved_professionals WHERE user_id = $1) AS has`, [userId]),
    ]);
    return res.json({
      hasCalendarIntegrations: calResult.rows[0]?.has ?? false,
      hasSavedProfessionals: proResult.rows[0]?.has ?? false,
    });
  } catch (err) {
    return next(err);
  }
});

/** POST /users/demo/reset-homeowner-profile
 * Reset only hello-homeowner@heyopsy.com to a clean "new homeowner" state while preserving
 * account, credentials, role, and base property.
 */
router.post("/demo/reset-homeowner-profile", ensureLoggedIn, async function (req, res, next) {
  const requestedBy = res.locals.user;
  if (!requestedBy?.id || !requestedBy?.email) {
    return res.status(401).json({ error: { message: "Unauthorized" } });
  }
  try {
    assertDemoResetAllowed(req);
    if (requestedBy.email.toLowerCase() !== DEMO_HOMEOWNER_RESET_EMAIL) {
      throw new ForbiddenError("Only the demo homeowner account can reset this profile.");
    }

    const userCheck = await db.query(
      `SELECT id, email FROM users WHERE id = $1 AND LOWER(email) = LOWER($2)`,
      [requestedBy.id, DEMO_HOMEOWNER_RESET_EMAIL],
    );
    if (userCheck.rows.length === 0) {
      throw new ForbiddenError("Only the demo homeowner account can reset this profile.");
    }

    const client = await db.connect();
    const audit = {};
    try {
      await client.query("BEGIN");

      const targetUserRes = await client.query(
        `SELECT id FROM users WHERE LOWER(email) = LOWER($1) FOR UPDATE`,
        [DEMO_HOMEOWNER_RESET_EMAIL],
      );
      const targetUserId = targetUserRes.rows[0]?.id;
      if (!targetUserId) throw new BadRequestError("Demo user not found.");

      const ownedPropertyRes = await client.query(
        `SELECT property_id
         FROM property_users
         WHERE user_id = $1 AND role = 'owner'`,
        [targetUserId],
      );
      const ownedPropertyIds = ownedPropertyRes.rows.map((r) => r.property_id);
      if (ownedPropertyIds.length === 0) {
        throw new BadRequestError("Demo user has no owned properties to reset.");
      }

      async function runUserDelete(label, table, whereSql) {
        const result = await client.query(
          `DELETE FROM ${table} WHERE ${whereSql}`,
          [targetUserId],
        );
        audit[label] = result.rowCount || 0;
      }

      async function runPropertyDelete(label, table, whereSql = "property_id = ANY($1::int[])") {
        const result = await client.query(
          `DELETE FROM ${table} WHERE ${whereSql}`,
          [ownedPropertyIds],
        );
        audit[label] = result.rowCount || 0;
      }

      await runPropertyDelete(
        "eventCalendarSyncsDeleted",
        "event_calendar_syncs",
        `maintenance_event_id IN (
           SELECT id FROM maintenance_events WHERE property_id = ANY($1::int[])
         )`,
      );
      await runPropertyDelete("maintenanceEventsDeleted", "maintenance_events");
      await runPropertyDelete("contractorReportTokensDeleted", "contractor_report_tokens");
      await runPropertyDelete("documentChunksDeleted", "document_chunks");
      await runPropertyDelete("propertyDocumentsDeleted", "property_documents");
      await runPropertyDelete("stagedDocumentsDeleted", "staged_documents");
      await runPropertyDelete("inspectionChecklistItemsDeleted", "inspection_checklist_items");
      await runPropertyDelete("inspectionAnalysisResultsDeleted", "inspection_analysis_results");
      await runPropertyDelete("inspectionAnalysisJobsDeleted", "inspection_analysis_jobs");
      await runPropertyDelete("aiActionDraftsDeleted", "ai_action_drafts");
      await runPropertyDelete("aiConversationsDeleted", "ai_conversations");
      await runPropertyDelete("propertyAiReanalysisAuditDeleted", "property_ai_reanalysis_audit");
      await runPropertyDelete("propertyAiSummaryStateDeleted", "property_ai_summary_state");
      await runPropertyDelete("propertyAiProfilesDeleted", "property_ai_profiles");
      await runPropertyDelete("propertyMaintenanceDeleted", "property_maintenance");
      await runPropertyDelete("propertySystemsDeleted", "property_systems");
      await runPropertyDelete("attomLookupJobsDeleted", "attom_lookup_jobs");
      await runPropertyDelete("homeownerAgentInquiriesDeleted", "homeowner_agent_inquiries");
      await runPropertyDelete("conversationsDeleted", "conversations");
      await runPropertyDelete(
        "notificationsByPropertyDeleted",
        "notifications",
        "property_id = ANY($1::int[])",
      );

      await runUserDelete("savedProfessionalsDeleted", "saved_professionals", "user_id = $1");
      await runUserDelete("calendarIntegrationsDeleted", "calendar_integrations", "user_id = $1");
      await runUserDelete("platformEngagementEventsDeleted", "platform_engagement_events", "user_id = $1");
      await runUserDelete(
        "notificationsByUserDeleted",
        "notifications",
        "user_id = $1 AND property_id IS NULL",
      );

      const resetUserRes = await client.query(
        `UPDATE users
         SET image = NULL,
             avatar_url = NULL,
             welcome_modal_dismissed = false,
             updated_at = NOW()
         WHERE id = $1`,
        [targetUserId],
      );
      audit.userProfileReset = resetUserRes.rowCount || 0;

      await client.query("COMMIT");

      console.info(
        "[demo-profile-reset] completed",
        JSON.stringify({
          email: DEMO_HOMEOWNER_RESET_EMAIL,
          userId: targetUserId,
          ownedPropertyIds,
          ...audit,
        }),
      );

      return res.json({
        success: true,
        message: "Demo profile reset completed.",
        audit: {
          email: DEMO_HOMEOWNER_RESET_EMAIL,
          ownedPropertyIds,
          ...audit,
        },
      });
    } catch (txErr) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    return next(err);
  }
});

router.get("/:email", ensureLoggedIn, async function (req, res, next) {
  try {
    const role = res.locals.user.role;
    const isSelfLookup = res.locals.user.email === req.params.email;
    if (role !== "super_admin" && role !== "admin" && !isSelfLookup) {
      throw new ForbiddenError("You can only view your own profile.");
    }
    const user = await User.get(req.params.email);
    const userWithUrl = await addPresignedUrlToItem(user, "image", "image_url");

    if (isSelfLookup && !user.welcomeModalDismissed) {
      const [calResult, proResult] = await Promise.all([
        db.query(`SELECT EXISTS(SELECT 1 FROM calendar_integrations WHERE user_id = $1) AS has`, [user.id]),
        db.query(`SELECT EXISTS(SELECT 1 FROM saved_professionals WHERE user_id = $1) AS has`, [user.id]),
      ]);
      userWithUrl.hasCalendarIntegrations = calResult.rows[0]?.has ?? false;
      userWithUrl.hasSavedProfessionals = proResult.rows[0]?.has ?? false;
    }

    let impersonation = null;
    if (res.locals.impersonator?.id) {
      const impersonator = await User.getById(res.locals.impersonator.id);
      if (impersonator) {
        impersonation = {
          active: true,
          impersonatorId: impersonator.id,
          impersonatorName: impersonator.name,
          impersonatorEmail: impersonator.email,
        };
      }
    }

    return res.json({ user: userWithUrl, impersonation });
  } catch (err) {
    return next(err);
  }
});

router.patch("/:id", ensureLoggedIn, async function (req, res, next) {
  try {
    const requestingUserId = res.locals.user.id;
    const targetUserId = parseInt(req.params.id, 10);
    const role = res.locals.user.role;

    if (role !== "super_admin" && role !== "admin" && requestingUserId !== targetUserId) {
      throw new ForbiddenError("You can only update your own profile.");
    }

    const validator = jsonschema.validate(req.body, userUpdateSchema);
    if (!validator.valid) {
      const errs = validator.errors.map(e => e.stack);
      throw new BadRequestError(errs);
    }
    const user = await User.update({ id: req.params.id, ...req.body });
    const userWithUrl = await addPresignedUrlToItem(user, "image", "image_url");
    return res.json({ user: userWithUrl });
  } catch (err) {
    return next(err);
  }
});

router.delete("/:id", ensureSuperAdmin, async function (req, res, next) {
  try {
    await User.remove(req.params.id);
    return res.json({ deleted: req.params.id });
  } catch (err) {
    return next(err);
  }
});

router.post("/activate/:userId", ensureSuperAdmin, async function (req, res, next) {
  try {
    const { userId } = req.params;
    const result = await User.activateUser(userId);
    return res.json({ result });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
