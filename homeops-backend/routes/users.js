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
const { BadRequestError, ForbiddenError, NotFoundError } = require("../expressError");
const User = require("../models/user");
const Account = require("../models/account");
const AgentAffiliation = require("../models/agentAffiliation");
const userUpdateSchema = require("../schemas/userUpdate.json");
const { addUserAvatarUrlToItem, addUserAvatarUrlsToItems } = require("../helpers/presignedUrls");
const db = require("../db");
const { notifyNewUserAccount } = require("../services/opsTeamNotifyService");
const {
  createAccountInvitation,
  sendAccountInvitationEmailInBackground,
} = require("../services/invitationService");
const { assertDemoResetAllowed, isDemoEnvironment, parseDemoExpiresAtInput } = require("../helpers/demoEnvironment");
const { ensureDemoUserSchema } = require("../helpers/demoUserSchema");
const { getPairedDemoHomeownerForAgent } = require("../helpers/demoUserCredentials");
const { resetDemoHomeownerProfileByUserId } = require("../services/demoHomeownerProfileResetService");
const {
  enqueueDemoProvision,
  getProvisionStatus,
} = require("../services/demoProvisionQueue");

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
  const t0 = Date.now();
  let registerMs = 0;
  let provisionMs = 0;
  let inviteMs = 0;

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
      includePairedHomeownerLogin: includePairedHomeownerLoginFlag,
      demoExpiresAt: demoExpiresAtInput,
      demo_expires_at: demoExpiresAtSnake,
    } = req.body;

    const wantsProvision =
      provisionDemoAccountFlag === true || provisionDemoAccountFlag === "true";

    const includePairedHomeownerLogin =
      role === "agent" &&
      wantsProvision &&
      includePairedHomeownerLoginFlag !== false &&
      includePairedHomeownerLoginFlag !== "false";

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
      await ensureDemoUserSchema();
    }

    const shouldSendInvite =
      wantsProvision || sendInvite === false || sendInvitationEmail === false ? false : true;

    /* Lock the role for admin-created homeowner/agent users so they can
       only see plans matching the role the admin chose during onboarding,
       and so the role can't be tampered with via the API. Internal roles
       (admin/super_admin) don't need locking. */
    const isLockableRole = role === "homeowner" || role === "agent";
    const registerStart = Date.now();
    const provisionedByUserId = wantsProvision ? res.locals.user?.id : null;
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
      ...(wantsProvision ? { demo_login_password: password, demo_provisioned_by_user_id: provisionedByUserId } : {}),
    });
    registerMs = Date.now() - registerStart;

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
    let provisionStatus = null;
    let resolvedDemoExpiresAt = null;
    if (wantsProvision) {
      resolvedDemoExpiresAt = parseDemoExpiresAtInput(
        demoExpiresAtInput ?? demoExpiresAtSnake
      );
      await User.updateDemoExpiry(newUser.id, resolvedDemoExpiresAt);

      const provisionStart = Date.now();
      enqueueDemoProvision({
        userId: newUser.id,
        role,
        name,
        email,
        phone,
        password,
        includePairedHomeownerLogin,
        demoExpiresAt: resolvedDemoExpiresAt,
        provisionedByUserId,
      });
      provisionMs = Date.now() - provisionStart;
      provisionStatus = "pending";
    }

    const inviterUserId = res.locals.user?.id;
    let resolvedAccountId = accountId ? Number(accountId) : null;
    /* Homeowner/agent invitees need an account scoped to them (not the admin's
       platform account) so the invitation email can always be created. */
    if (shouldSendInvite && isLockableRole && !wantsProvision) {
      try {
        const userAccount = await Account.linkNewUserToAccount({
          name: newUser.name || name,
          userId: newUser.id,
        });
        resolvedAccountId = userAccount.id;
      } catch (acctErr) {
        console.error("[users.create] failed to create invitee account:", acctErr.message);
      }
    } else if (!resolvedAccountId && inviterUserId && !wantsProvision) {
      try {
        const inviterAccounts = await Account.getUserAccounts(inviterUserId);
        resolvedAccountId = inviterAccounts?.[0]?.id || null;
      } catch (acctErr) {
        console.error("[users.create] inviter account lookup:", acctErr.message);
      }
    }

    let invitation = null;
    let invitationEmailSent = false;
    let invitationEmailQueued = false;
    let invitationSkipped = false;
    if (!shouldSendInvite) {
      invitationSkipped = true;
      if (!wantsProvision) {
        console.info(
          `[users.create] sendInvite=false; skipping invitation email for ${newUser.email}.`
        );
      }
    } else if (resolvedAccountId) {
      const inviteStart = Date.now();
      try {
        const inviteResult = await createAccountInvitation({
          inviterUserId,
          inviteeEmail: newUser.email,
          accountId: resolvedAccountId,
          intendedRole: "member",
          skipEmail: true,
        });
        invitation = inviteResult?.invitation || null;
        if (invitation && inviteResult?.token) {
          invitationEmailQueued = true;
          sendAccountInvitationEmailInBackground({
            invitation,
            token: inviteResult.token,
            inviterUserId,
          }).catch((emailErr) => {
            console.error("[users.create] background invitation email:", emailErr.message);
          });
        }
      } catch (inviteErr) {
        console.error("[users.create] failed to create invitation:", inviteErr.message);
      }
      inviteMs = Date.now() - inviteStart;
    } else if (!wantsProvision) {
      console.warn(
        `[users.create] No accountId resolved for invitation to ${newUser.email}; skipping auto-invite.`
      );
    }

    const user = await User.getById(newUser.id);
    const totalMs = Date.now() - t0;
    console.info("[users.create] timing", {
      email: newUser.email,
      role,
      wantsProvision,
      shouldSendInvite,
      resolvedAccountId,
      invitationEmailQueued,
      registerMs,
      provisionMs,
      inviteMs,
      totalMs,
    });

    return res.status(201).json({
      user,
      invitation,
      invitationEmailSent,
      invitationEmailQueued,
      invitationSkipped,
      provisioned: wantsProvision && provisionStatus === "complete",
      provisionStatus,
      demoSummary,
    });
  } catch (err) {
    return next(err);
  }
});

router.get("/", ensureLoggedIn, ensurePlatformAdmin, async function (req, res, next) {
  try {
    const users = await User.getAll();
    const usersWithUrls = await addUserAvatarUrlsToItems(users);
    return res.json({ users: usersWithUrls });
  } catch (err) {
    return next(err);
  }
});

router.get("/account/:accountId", ensureLoggedIn, ensurePlatformAdmin, async function (req, res, next) {
  try {
    const users = await User.getByAccountId(req.params.accountId);
    const usersWithUrls = await addUserAvatarUrlsToItems(users);
    return res.json({ users: usersWithUrls });
  } catch (err) {
    return next(err);
  }
});

router.get("/agent/:agentId", ensureLoggedIn, ensurePlatformAdmin, async function (req, res, next) {
  try {
    const users = await User.getUsersBySharedAccounts(req.params.agentId);
    const usersWithUrls = await addUserAvatarUrlsToItems(users);
    return res.json({ users: usersWithUrls });
  } catch (err) {
    return next(err);
  }
});

router.get("/agents", ensureLoggedIn, async function (req, res, next) {
  try {
    const agents = await User.getAgents();
    const agentsWithUrls = await addUserAvatarUrlsToItems(agents);
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
 * Reset a demo homeowner profile to a clean state while preserving account, credentials, role,
 * and base property. Available to hello-homeowner@heyopsy.com and provisioned paired homeowners.
 */
router.post("/demo/reset-homeowner-profile", ensureLoggedIn, async function (req, res, next) {
  const requestedBy = res.locals.user;
  if (!requestedBy?.id || !requestedBy?.email) {
    return res.status(401).json({ error: { message: "Unauthorized" } });
  }
  try {
    assertDemoResetAllowed(req);
    await ensureDemoUserSchema();

    const userRow = await db.query(
      `SELECT id, email, role, demo_paired_agent_id AS "demoPairedAgentId"
       FROM users WHERE id = $1`,
      [requestedBy.id]
    );
    const targetUser = userRow.rows[0];
    if (!targetUser) {
      throw new ForbiddenError("User not found.");
    }
    if (targetUser.role !== "homeowner") {
      throw new ForbiddenError("Only demo homeowner accounts can reset this profile.");
    }

    const isLegacyDemoHomeowner =
      targetUser.email.toLowerCase() === DEMO_HOMEOWNER_RESET_EMAIL;
    const isPairedDemoHomeowner = targetUser.demoPairedAgentId != null;
    if (!isLegacyDemoHomeowner && !isPairedDemoHomeowner) {
      throw new ForbiddenError("Only demo homeowner accounts can reset this profile.");
    }

    const { ownedPropertyIds, audit } = await resetDemoHomeownerProfileByUserId(targetUser.id);

    console.info(
      "[demo-profile-reset] completed",
      JSON.stringify({
        email: targetUser.email,
        userId: targetUser.id,
        ownedPropertyIds,
        ...audit,
      })
    );

    return res.json({
      success: true,
      message: "Demo profile reset completed.",
      audit: {
        email: targetUser.email,
        ownedPropertyIds,
        ...audit,
      },
    });
  } catch (err) {
    return next(err);
  }
});

/** GET /by-id/:userId — Platform admin user detail (includes demo login password on demo site). */
router.get("/by-id/:userId", ensureLoggedIn, ensurePlatformAdmin, async function (req, res, next) {
  try {
    if (isDemoEnvironment() && res.locals.user?.role === "super_admin") {
      await ensureDemoUserSchema();
    }
    const userId = parseInt(req.params.userId, 10);
    if (!Number.isFinite(userId)) {
      throw new BadRequestError("Invalid user id");
    }
    const user = await User.getById(userId);
    if (!user) {
      throw new NotFoundError(`No user: ${userId}`);
    }
    const userWithUrl = await addUserAvatarUrlToItem(user);
    if (!isDemoEnvironment() || res.locals.user?.role !== "super_admin") {
      delete userWithUrl.demoLoginPassword;
    }

    if (user.role === "agent") {
      userWithUrl.affiliation = await AgentAffiliation.getActiveForUser(userId);
    }

    let pairedHomeowner = null;
    if (isDemoEnvironment() && res.locals.user?.role === "super_admin" && user.role === "agent") {
      pairedHomeowner = await getPairedDemoHomeownerForAgent(userId);
    }

    return res.json({ user: userWithUrl, pairedHomeowner });
  } catch (err) {
    return next(err);
  }
});

/** GET /:userId/provision-status — Poll async demo account provisioning (demo site). */
router.get("/:userId/provision-status", ensureLoggedIn, ensurePlatformAdmin, async function (req, res, next) {
  try {
    if (!isDemoEnvironment()) {
      return res.json({ status: null, demoSummary: null });
    }
    const userId = parseInt(req.params.userId, 10);
    if (!Number.isFinite(userId)) {
      throw new BadRequestError("Invalid user id");
    }
    const status = getProvisionStatus(userId);
    if (!status) {
      return res.json({ status: null, demoSummary: null });
    }
    return res.json({
      status: status.status,
      demoSummary: status.demoSummary,
      error: status.error,
      startedAt: status.startedAt,
      completedAt: status.completedAt,
    });
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
    await ensureDemoUserSchema();
    const user = await User.get(req.params.email);
    const userWithUrl = await addUserAvatarUrlToItem(user);

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

    const {
      password,
      demoLoginPassword,
      demo_login_password,
      demoExpiresAt,
      demo_expires_at,
      ...profileBody
    } = req.body;

    const isPlatformAdmin = role === "super_admin" || role === "admin";
    if (!isPlatformAdmin) {
      delete profileBody.opsyScoutOverrideEnabled;
      delete profileBody.opsyScoutFreeAnalysesLimit;
      delete profileBody.opsy_scout_override_enabled;
      delete profileBody.opsy_scout_free_analyses_limit;
      delete profileBody.aiFeaturesOverrideEnabled;
      delete profileBody.aiFeaturesTokenMonthlyQuota;
      delete profileBody.ai_features_override_enabled;
      delete profileBody.ai_features_token_monthly_quota;
    } else {
      if (
        profileBody.opsyScoutOverrideEnabled !== undefined ||
        profileBody.opsyScoutFreeAnalysesLimit !== undefined
      ) {
        const enabled = profileBody.opsyScoutOverrideEnabled === true;
        if (enabled) {
          const limit = Number(profileBody.opsyScoutFreeAnalysesLimit);
          if (!Number.isInteger(limit) || limit < 1) {
            throw new BadRequestError(
              "opsyScoutFreeAnalysesLimit must be a positive integer when Opsy Scout override is enabled."
            );
          }
          profileBody.opsyScoutOverrideEnabled = true;
          profileBody.opsyScoutFreeAnalysesLimit = limit;
        } else if (profileBody.opsyScoutOverrideEnabled === false) {
          profileBody.opsyScoutOverrideEnabled = false;
          profileBody.opsyScoutFreeAnalysesLimit = null;
        }
      }
      if (
        profileBody.aiFeaturesOverrideEnabled !== undefined ||
        profileBody.aiFeaturesTokenMonthlyQuota !== undefined
      ) {
        const enabled = profileBody.aiFeaturesOverrideEnabled === true;
        if (enabled) {
          const quota = Number(profileBody.aiFeaturesTokenMonthlyQuota);
          if (!Number.isInteger(quota) || quota < 1) {
            throw new BadRequestError(
              "aiFeaturesTokenMonthlyQuota must be a positive integer when AI features override is enabled."
            );
          }
          profileBody.aiFeaturesOverrideEnabled = true;
          profileBody.aiFeaturesTokenMonthlyQuota = quota;
        } else if (profileBody.aiFeaturesOverrideEnabled === false) {
          profileBody.aiFeaturesOverrideEnabled = false;
          profileBody.aiFeaturesTokenMonthlyQuota = null;
        }
      }
    }

    const validator = jsonschema.validate(profileBody, userUpdateSchema);
    if (!validator.valid) {
      const errs = validator.errors.map(e => e.stack);
      throw new BadRequestError(errs);
    }

    let user;
    const nextPassword = password || demoLoginPassword || demo_login_password;
    const nextDemoExpiresAt = demoExpiresAt ?? demo_expires_at;
    const demoSuperAdminUpdatingOther =
      isDemoEnvironment() &&
      role === "super_admin" &&
      requestingUserId !== targetUserId;

    if (nextDemoExpiresAt !== undefined && demoSuperAdminUpdatingOther) {
      await ensureDemoUserSchema();
      const targetUser = await User.getById(targetUserId);
      if (!targetUser) throw new NotFoundError(`No user: ${targetUserId}`);
      if (!targetUser.demoLoginPassword) {
        throw new BadRequestError("demoExpiresAt can only be set on ready-to-use demo accounts.");
      }
      const parsedExpiry = parseDemoExpiresAtInput(nextDemoExpiresAt, { requireFuture: false });
      await User.updateDemoExpiry(targetUserId, parsedExpiry);
      if (targetUser.role === "agent") {
        await User.updatePairedDemoHomeownerExpiry(targetUserId, parsedExpiry);
      }
    } else if (nextDemoExpiresAt !== undefined && isDemoEnvironment() && role === "super_admin") {
      throw new BadRequestError("Only super admins can update demo account expiry for other users.");
    }

    if (nextPassword && demoSuperAdminUpdatingOther) {
      await ensureDemoUserSchema();
      await User.updateLoginPassword({
        id: targetUserId,
        password: nextPassword,
        demoLoginPassword: nextPassword,
      });
      const targetUser = await User.getById(targetUserId);
      if (targetUser?.role === "agent") {
        await User.updatePairedDemoHomeownerPasswords(targetUserId, nextPassword);
      }
    } else if (nextPassword && requestingUserId === targetUserId) {
      throw new BadRequestError("Use the change-password flow to update your own password.");
    }

    if (Object.keys(profileBody).length > 0) {
      user = await User.update({ id: targetUserId, ...profileBody });
    } else if (
      (nextPassword || nextDemoExpiresAt !== undefined) &&
      isDemoEnvironment() &&
      role === "super_admin"
    ) {
      user = await User.getById(targetUserId);
      if (!user) throw new NotFoundError(`No user: ${targetUserId}`);
    } else {
      throw new BadRequestError("No data to update");
    }

    if (isDemoEnvironment() && role === "super_admin") {
      user = await User.getById(targetUserId);
      if (!user) throw new NotFoundError(`No user: ${targetUserId}`);
    }

    const userWithUrl = await addUserAvatarUrlToItem(user);
    if (!isDemoEnvironment() || role !== "super_admin") {
      delete userWithUrl.demoLoginPassword;
    }

    let pairedHomeowner = null;
    if (isDemoEnvironment() && role === "super_admin" && user.role === "agent") {
      pairedHomeowner = await getPairedDemoHomeownerForAgent(targetUserId);
    }

    return res.json({ user: userWithUrl, pairedHomeowner });
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
