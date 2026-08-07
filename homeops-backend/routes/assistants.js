"use strict";

/**
 * Assistants routes — agents invite team assistants tethered to their account.
 * Admins/super_admins can create assistants for any agent.
 */

const express = require("express");
const crypto = require("crypto");
const { ensureLoggedIn } = require("../middleware/auth");
const { BadRequestError, ForbiddenError, NotFoundError } = require("../expressError");
const db = require("../db");
const User = require("../models/user");
const Account = require("../models/account");
const Invitation = require("../models/invitation");
const {
  createAccountInvitation,
  sendAccountInvitationEmailInBackground,
  resendInvitation,
} = require("../services/invitationService");
const { canCreateAssistant, countAssistantsForAgent } = require("../services/tierService");
const { isAdminRole, isAgentRole, isAssistantRole } = require("../helpers/roles");

const router = express.Router();

function requireAgentOrAdmin(user) {
  if (!user?.id) throw new ForbiddenError("Authentication required.");
  if (isAssistantRole(user.role)) {
    throw new ForbiddenError("Assistants cannot manage other assistants.");
  }
  if (isAdminRole(user.role) || isAgentRole(user.role)) return;
  throw new ForbiddenError("Only agents and administrators can manage assistants.");
}

async function resolveAgentAccountId(agentUserId) {
  const owned = await db.query(
    `SELECT id FROM accounts WHERE owner_user_id = $1 ORDER BY created_at ASC LIMIT 1`,
    [agentUserId]
  );
  if (owned.rows[0]?.id) return owned.rows[0].id;
  const accounts = await Account.getUserAccounts(agentUserId);
  return accounts?.[0]?.id || null;
}

async function getAssistantRow(id) {
  const res = await db.query(
    `SELECT u.id, u.email, u.name, u.phone, u.role, u.is_active AS "isActive",
            u.onboarding_completed AS "onboardingCompleted",
            u.assistant_of_user_id AS "assistantOfUserId",
            u.created_at AS "createdAt",
            a.id AS "agentId", a.name AS "agentName", a.email AS "agentEmail",
            (
              SELECT i.id FROM invitations i
              WHERE LOWER(TRIM(i.invitee_email)) = LOWER(TRIM(u.email))
                AND i.status = 'pending'
              ORDER BY i.created_at DESC
              LIMIT 1
            ) AS "pendingInvitationId"
     FROM users u
     LEFT JOIN users a ON a.id = u.assistant_of_user_id
     WHERE u.id = $1 AND u.role = 'assistant'`,
    [id]
  );
  return res.rows[0] || null;
}

function assertCanManageAssistant(actor, assistant) {
  if (isAdminRole(actor.role)) return;
  if (isAgentRole(actor.role) && Number(assistant.assistantOfUserId) === Number(actor.id)) {
    return;
  }
  throw new ForbiddenError("You can only manage assistants tethered to your account.");
}

/** GET /assistants — list assistants (admin: all; agent: own). */
router.get("/", ensureLoggedIn, async function (req, res, next) {
  try {
    requireAgentOrAdmin(res.locals.user);
    const actor = res.locals.user;
    const params = [];
    let where = `u.role = 'assistant' AND u.assistant_of_user_id IS NOT NULL`;
    if (isAgentRole(actor.role)) {
      params.push(actor.id);
      where += ` AND u.assistant_of_user_id = $${params.length}`;
    }
    const result = await db.query(
      `SELECT u.id, u.email, u.name, u.phone, u.role, u.is_active AS "isActive",
              u.onboarding_completed AS "onboardingCompleted",
              u.assistant_of_user_id AS "assistantOfUserId",
              u.created_at AS "createdAt",
              a.id AS "agentId", a.name AS "agentName", a.email AS "agentEmail",
              (
                SELECT i.id FROM invitations i
                WHERE LOWER(TRIM(i.invitee_email)) = LOWER(TRIM(u.email))
                  AND i.status = 'pending'
                ORDER BY i.created_at DESC
                LIMIT 1
              ) AS "pendingInvitationId"
       FROM users u
       LEFT JOIN users a ON a.id = u.assistant_of_user_id
       WHERE ${where}
       ORDER BY u.created_at DESC`,
      params
    );
    const usage = isAgentRole(actor.role)
      ? {
          current: await countAssistantsForAgent(actor.id),
        }
      : null;
    return res.json({ assistants: result.rows, usage });
  } catch (err) {
    return next(err);
  }
});

/** POST /assistants — create pending assistant + send invite. */
router.post("/", ensureLoggedIn, async function (req, res, next) {
  try {
    requireAgentOrAdmin(res.locals.user);
    const actor = res.locals.user;
    const { name, email, phone, agentUserId } = req.body || {};

    if (!name || !String(name).trim()) throw new BadRequestError("Name is required.");
    if (!email || !String(email).trim()) throw new BadRequestError("Email is required.");

    let targetAgentId;
    if (isAgentRole(actor.role)) {
      targetAgentId = actor.id;
    } else {
      targetAgentId = Number(agentUserId);
      if (!Number.isInteger(targetAgentId) || targetAgentId < 1) {
        throw new BadRequestError("agentUserId is required when creating an assistant as an admin.");
      }
      const agent = await User.getById(targetAgentId);
      if (!agent || agent.role !== "agent") {
        throw new BadRequestError("agentUserId must reference an agent user.");
      }
    }

    const capacity = await canCreateAssistant(targetAgentId);
    if (!capacity.allowed) {
      throw new ForbiddenError(capacity.message || "Cannot create assistant under current plan limits.");
    }

    const accountId = await resolveAgentAccountId(targetAgentId);
    if (!accountId) {
      throw new BadRequestError("Target agent does not have an account to tether the assistant to.");
    }

    const tempPassword = crypto.randomBytes(24).toString("base64url");
    const newUser = await User.register({
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      password: tempPassword,
      phone: phone || null,
      role: "assistant",
      is_active: false,
      onboarding_completed: true,
      role_locked: true,
      assistant_of_user_id: targetAgentId,
    });

    await db.query(
      `UPDATE users
       SET welcome_modal_dismissed = true,
           affiliation_onboarding_skipped = true,
           updated_at = NOW()
       WHERE id = $1`,
      [newUser.id]
    );

    const inviteResult = await createAccountInvitation({
      inviterUserId: actor.id,
      inviteeEmail: newUser.email,
      accountId,
      intendedRole: "member",
      skipEmail: true,
    });

    let invitationEmailQueued = false;
    if (inviteResult?.invitation && inviteResult?.token) {
      invitationEmailQueued = true;
      sendAccountInvitationEmailInBackground({
        invitation: inviteResult.invitation,
        token: inviteResult.token,
        inviterUserId: actor.id,
      }).catch((emailErr) => {
        console.error("[assistants.create] background invitation email:", emailErr.message);
      });
    }

    const assistant = await getAssistantRow(newUser.id);
    return res.status(201).json({
      assistant,
      invitation: inviteResult?.invitation || null,
      invitationEmailQueued,
      usage: {
        current: await countAssistantsForAgent(targetAgentId),
        max: capacity.max,
      },
    });
  } catch (err) {
    return next(err);
  }
});

/** GET /assistants/:id */
router.get("/:id", ensureLoggedIn, async function (req, res, next) {
  try {
    requireAgentOrAdmin(res.locals.user);
    const assistant = await getAssistantRow(Number(req.params.id));
    if (!assistant) throw new NotFoundError("Assistant not found.");
    assertCanManageAssistant(res.locals.user, assistant);
    return res.json({ assistant });
  } catch (err) {
    return next(err);
  }
});

/** PATCH /assistants/:id — update name/phone */
router.patch("/:id", ensureLoggedIn, async function (req, res, next) {
  try {
    requireAgentOrAdmin(res.locals.user);
    const assistant = await getAssistantRow(Number(req.params.id));
    if (!assistant) throw new NotFoundError("Assistant not found.");
    assertCanManageAssistant(res.locals.user, assistant);

    const fields = [];
    const values = [];
    let i = 1;
    if (req.body?.name !== undefined) {
      const name = String(req.body.name || "").trim();
      if (!name) throw new BadRequestError("Name cannot be empty.");
      fields.push(`name = $${i++}`);
      values.push(name);
    }
    if (req.body?.phone !== undefined) {
      fields.push(`phone = $${i++}`);
      values.push(req.body.phone || null);
    }
    if (fields.length === 0) throw new BadRequestError("No data to update.");
    values.push(assistant.id);
    await db.query(
      `UPDATE users SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $${i}`,
      values
    );
    return res.json({ assistant: await getAssistantRow(assistant.id) });
  } catch (err) {
    return next(err);
  }
});

/** DELETE /assistants/:id — revoke: deactivate, clear tether, remove membership, revoke invites */
router.delete("/:id", ensureLoggedIn, async function (req, res, next) {
  try {
    requireAgentOrAdmin(res.locals.user);
    const assistant = await getAssistantRow(Number(req.params.id));
    if (!assistant) throw new NotFoundError("Assistant not found.");
    assertCanManageAssistant(res.locals.user, assistant);

    const agentUserId = assistant.assistantOfUserId;
    const accountId = agentUserId ? await resolveAgentAccountId(agentUserId) : null;

    await db.query(
      `UPDATE users
       SET is_active = false,
           assistant_of_user_id = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [assistant.id]
    );

    if (accountId) {
      try {
        await Account.removeUserFromAccount({ userId: assistant.id, accountId });
      } catch (e) {
        console.warn("[assistants.revoke] remove membership:", e.message);
      }
    }

    const pending = await db.query(
      `SELECT id FROM invitations
       WHERE LOWER(TRIM(invitee_email)) = LOWER(TRIM($1))
         AND status = 'pending'`,
      [assistant.email]
    );
    for (const row of pending.rows) {
      try {
        await Invitation.revoke(row.id);
      } catch (e) {
        console.warn("[assistants.revoke] invite revoke:", e.message);
      }
    }

    return res.json({
      revoked: true,
      id: assistant.id,
      usage: agentUserId
        ? { current: await countAssistantsForAgent(agentUserId) }
        : null,
    });
  } catch (err) {
    return next(err);
  }
});

/** POST /assistants/:id/resend-invite */
router.post("/:id/resend-invite", ensureLoggedIn, async function (req, res, next) {
  try {
    requireAgentOrAdmin(res.locals.user);
    const assistant = await getAssistantRow(Number(req.params.id));
    if (!assistant) throw new NotFoundError("Assistant not found.");
    assertCanManageAssistant(res.locals.user, assistant);
    if (assistant.isActive) {
      throw new BadRequestError("Assistant is already active; no invitation to resend.");
    }

    let invitationId = assistant.pendingInvitationId;
    if (!invitationId) {
      const accountId = await resolveAgentAccountId(assistant.assistantOfUserId);
      if (!accountId) throw new BadRequestError("Agent account not found.");
      const inviteResult = await createAccountInvitation({
        inviterUserId: res.locals.user.id,
        inviteeEmail: assistant.email,
        accountId,
        intendedRole: "member",
        skipEmail: true,
      });
      invitationId = inviteResult?.invitation?.id;
      if (inviteResult?.token) {
        sendAccountInvitationEmailInBackground({
          invitation: inviteResult.invitation,
          token: inviteResult.token,
          inviterUserId: res.locals.user.id,
        }).catch((e) => console.error("[assistants.resend] email:", e.message));
        return res.json({ resent: true, invitation: inviteResult.invitation });
      }
    }

    if (!invitationId) throw new BadRequestError("No pending invitation found.");
    const result = await resendInvitation(invitationId, res.locals.user.id);
    return res.json({ resent: true, invitation: result.invitation });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
