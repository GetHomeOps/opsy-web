"use strict";

const express = require("express");
const { ensureLoggedIn, ensurePropertyOwner, ensurePropertyAccess, ensureUserCanAccessAccountByParam, ensurePlatformAdmin } = require("../middleware/auth");
const { BadRequestError, ForbiddenError } = require("../expressError");
const Invitation = require("../models/invitation");
const Notification = require("../models/notification");
const {
  createPropertyInvitation,
  createBulkPropertyInvitations,
  createAccountInvitation,
  acceptInvitation,
  acceptInvitationForLoggedInUser,
  resendInvitation,
  sendPendingInvitations,
  resolvePropertyInvitationInviteUrl,
  assertInviterAuthorized,
} = require("../services/invitationService");
const { canInviteViewer, canAddTeamMember, isHomeownerCapacityInvite } = require("../services/tierService");
const db = require("../db");
const { buildPropertyInvitationDefaultMainPlain } = require("../services/emailService");
const customerIoProvider = require("../services/emailProviders/customerIoProvider");
const customerIoLifecycleService = require("../services/customerIoLifecycleService");

const router = express.Router();

async function resolveInvitationPropertyAddress(propertyId) {
  if (!propertyId) return "";
  try {
    const res = await db.query(
      `SELECT address FROM properties WHERE id = $1`,
      [propertyId]
    );
    return String(res.rows[0]?.address || "").trim();
  } catch {
    return "";
  }
}

function syncCustomerIoInvitationCancelled(invitation, action) {
  if (!invitation?.inviteeEmail) return;
  const payload = {
    inviteeEmail: invitation.inviteeEmail,
    invitationId: invitation.id,
    propertyId: invitation.propertyId ?? null,
    propertyAddress: "",
    invitationType: invitation.type || "property",
  };
  resolveInvitationPropertyAddress(invitation.propertyId).then(async (propertyAddress) => {
    payload.propertyAddress = propertyAddress;
    const track =
      action === "declined"
        ? customerIoProvider.trackPropertyInvitationDeclined
        : customerIoProvider.trackPropertyInvitationRevoked;
    try {
      await track(payload);
    } catch (err) {
      console.error(`[customerIo] invitation ${action}:`, err.message);
    }
    try {
      const userRes = await db.query(
        `SELECT id FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM($1)) LIMIT 1`,
        [invitation.inviteeEmail]
      );
      const inviteeUserId = userRes.rows[0]?.id;
      if (inviteeUserId) {
        await customerIoLifecycleService.syncCustomerIoUserPropertyState({
          userId: inviteeUserId,
          userEmail: invitation.inviteeEmail,
          context: {
            reason:
              action === "declined"
                ? "invitation_declined"
                : "invitation_revoked",
            lastPropertyId: invitation.propertyId ?? null,
          },
        });
      }
    } catch (syncErr) {
      console.error(
        `[customerIo] sync property state invitation ${action}:`,
        syncErr.message
      );
    }
  });
}

const INVITE_NOTE_MAX = 4000;
const INVITE_MAIN_MAX = 10000;
const INVITE_CC_MAX = 10;
const CC_EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

function normalizeInvitationEmailNote(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (s.length > INVITE_NOTE_MAX) {
    throw new BadRequestError(
      `Personal message must be at most ${INVITE_NOTE_MAX} characters.`,
    );
  }
  return s;
}

function normalizeInvitationCc(raw, { superAdminOnly, primaryTo }) {
  const hasPayload = (() => {
    if (raw == null || raw === "") return false;
    if (Array.isArray(raw)) return raw.some((x) => String(x || "").trim());
    return String(raw).trim() !== "";
  })();
  if (!hasPayload) return [];
  if (!superAdminOnly) {
    throw new ForbiddenError(
      "Only super admins can add CC recipients to invitation emails.",
    );
  }
  const parts = Array.isArray(raw)
    ? raw.map((x) => String(x || "").trim()).filter(Boolean)
    : String(raw)
        .split(/[,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
  const primaryLower = (primaryTo || "").trim().toLowerCase();
  const seen = new Set();
  const out = [];
  for (const addr of parts) {
    if (!CC_EMAIL_RE.test(addr)) {
      throw new BadRequestError(`Invalid CC email address: ${addr}`);
    }
    const lower = addr.toLowerCase();
    if (lower === primaryLower) continue;
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(addr);
  }
  if (out.length > INVITE_CC_MAX) {
    throw new BadRequestError(`At most ${INVITE_CC_MAX} CC addresses are allowed.`);
  }
  return out;
}

function normalizeInvitationEmailMainPlain(raw) {
  if (raw == null || raw === "") return null;
  const t = String(raw).trim();
  if (!t) return null;
  if (t.length > INVITE_MAIN_MAX) {
    throw new BadRequestError(
      `Invitation email body must be at most ${INVITE_MAIN_MAX} characters.`,
    );
  }
  return t;
}

/** POST /property-invite-default-main — Plain-text default for the editable invitation body (before the button). */
router.post("/property-invite-default-main", ensureLoggedIn, async function (req, res, next) {
  try {
    const { inviteeEmail, propertyId, accountId, inviteeName } = req.body;
    if (!inviteeEmail || !propertyId || !accountId) {
      throw new BadRequestError("inviteeEmail, propertyId, and accountId are required");
    }
    const pid = Number(propertyId);
    if (!Number.isInteger(pid) || pid <= 0) {
      throw new BadRequestError("propertyId must be a positive integer");
    }
    const aid = Number(accountId);
    if (!Number.isInteger(aid) || aid <= 0) {
      throw new BadRequestError("accountId must be a positive integer");
    }

    await assertInviterAuthorized({
      inviterUserId: res.locals.user.id,
      inviterUserRole: res.locals.user.role,
      accountId: aid,
      propertyId: pid,
    });

    const propRes = await db.query(
      `SELECT id, address FROM properties WHERE id = $1 AND account_id = $2`,
      [pid, aid],
    );
    if (!propRes.rows[0]) {
      throw new BadRequestError("Property not found in this account.");
    }

    const inviterUserId = res.locals.user.id;
    const inviterRes = await db.query(`SELECT name FROM users WHERE id = $1`, [inviterUserId]);
    const inviterName = inviterRes.rows[0]?.name || null;

    const emailNorm = (inviteeEmail || "").trim().toLowerCase();
    const userRes = await db.query(
      `SELECT id FROM users WHERE LOWER(TRIM(email)) = $1 AND is_active = true`,
      [emailNorm],
    );
    const inviteeHasAccount = !!userRes.rows[0];

    const propertyAddress = propRes.rows[0].address || null;
    const displayInviteeName = (inviteeName || "").trim() || null;

    const defaultMainPlain = buildPropertyInvitationDefaultMainPlain({
      inviterName,
      inviteeName: displayInviteeName,
      propertyAddress,
      inviteeHasAccount,
    });

    return res.json({ defaultMainPlain, inviteeHasAccount });
  } catch (err) {
    return next(err);
  }
});

/** POST / - Create account or property invitation. Body: type, inviteeEmail, accountId, propertyId?, intendedRole, inviteeName? (property: saved on auto-created contact). */
router.post("/", ensureLoggedIn, async function (req, res, next) {
  try {
    const {
      type,
      inviteeEmail,
      inviteeName,
      accountId,
      propertyId,
      intendedRole,
      intendedPropertyRole,
      permissions,
      skipInviteEmail,
      invitationEmailNote,
      invitationEmailMainPlain,
      invitationEmailCc,
    } = req.body;
    if (!inviteeEmail || !accountId) {
      throw new BadRequestError("inviteeEmail and accountId are required");
    }

    const inviterUserId = res.locals.user.id;
    const userRole = res.locals.user?.role;
    const noteForEmail =
      type === "property" ? normalizeInvitationEmailNote(invitationEmailNote) : null;
    const mainPlainForEmail =
      type === "property"
        ? normalizeInvitationEmailMainPlain(invitationEmailMainPlain)
        : null;
    const ccForEmail =
      type === "property"
        ? normalizeInvitationCc(invitationEmailCc, {
            superAdminOnly: userRole === "super_admin",
            primaryTo: inviteeEmail,
          })
        : [];

    if (intendedRole === 'viewer' && propertyId) {
      const viewerCheck = await canInviteViewer(accountId, propertyId, userRole);
      if (!viewerCheck.allowed) {
        throw new ForbiddenError(`Viewer limit reached (${viewerCheck.current}/${viewerCheck.max}). Upgrade your plan.`);
      }
    }

    if (
      propertyId &&
      isHomeownerCapacityInvite({ intendedRole, intendedPropertyRole })
    ) {
      const teamCheck = await canAddTeamMember(accountId, propertyId, userRole);
      if (!teamCheck.allowed) {
        throw new ForbiddenError(`Home owner limit reached (${teamCheck.current}/${teamCheck.max}). Upgrade your plan.`);
      }
    }

    let result;
    if (type === 'account') {
      result = await createAccountInvitation({
        inviterUserId,
        inviteeEmail,
        accountId,
        intendedRole,
        inviterUserRole: userRole,
      });
    } else {
      if (!propertyId) throw new BadRequestError("propertyId is required for property invitations");
      result = await createPropertyInvitation({
        inviterUserId,
        inviteeEmail,
        inviteeName,
        accountId,
        propertyId,
        intendedRole,
        intendedPropertyRole,
        permissions,
        inviterUserRole: userRole,
        skipInviteEmail: skipInviteEmail === true,
        invitationEmailNote: mainPlainForEmail ? null : noteForEmail,
        invitationEmailMainPlain: mainPlainForEmail,
        invitationEmailCc: ccForEmail.length > 0 ? ccForEmail : null,
      });
    }

    let inviteUrl = null;
    if (type !== "account" && result?.invitation && result?.token) {
      inviteUrl = await resolvePropertyInvitationInviteUrl(result.invitation, result.token);
    }

    return res.status(201).json({
      invitation: result.invitation,
      token: result.token,
      ...(inviteUrl ? { inviteUrl } : {}),
    });
  } catch (err) {
    return next(err);
  }
});

/** POST /bulk-property — Invite one email to many properties in one request; one consolidated email. Body: inviteeEmail, accountId, propertyIds[], intendedRole?, inviteeName? */
router.post("/bulk-property", ensureLoggedIn, async function (req, res, next) {
  try {
    const { inviteeEmail, inviteeName, accountId, propertyIds, intendedRole, intendedPropertyRole, permissions, requireApproval, skipInviteEmail } = req.body;
    if (!inviteeEmail || !accountId) {
      throw new BadRequestError("inviteeEmail and accountId are required");
    }
    if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
      throw new BadRequestError("propertyIds must be a non-empty array");
    }

    const inviterUserId = res.locals.user.id;
    const userRole = res.locals.user?.role;

    const result = await createBulkPropertyInvitations({
      inviterUserId,
      inviteeEmail,
      inviteeName,
      accountId,
      propertyIds,
      intendedRole,
      intendedPropertyRole,
      permissions,
      inviterUserRole: userRole,
      requireApproval: requireApproval !== false,
      skipInviteEmail: skipInviteEmail === true,
    });

    const statusCode = result.succeeded.length > 0 ? 201 : 200;
    return res.status(statusCode).json(result);
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /send-pending — Send emails for never-sent pending invitations.
 * Body: { invitationIds: string[], accountId?: number }
 * Platform admin only. Partial success allowed.
 */
router.post("/send-pending", ensureLoggedIn, async function (req, res, next) {
  try {
    const { invitationIds, accountId } = req.body || {};
    const user = res.locals.user;
    const result = await sendPendingInvitations({
      invitationIds,
      actorUserId: user.id,
      actorRole: user.role,
      accountId: accountId != null ? Number(accountId) : undefined,
    });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

/** POST /:id/accept - Accept invitation. Body: token, password, name. Token required for email flow. */
router.post("/:id/accept", async function (req, res, next) {
  try {
    const { token, password, name } = req.body;
    if (!token) throw new BadRequestError("Invitation token is required");
    const result = await acceptInvitation({ rawToken: token, password, name });
    return res.json({ success: true, message: "Invitation accepted", userId: result.user.id });
  } catch (err) {
    return next(err);
  }
});

/** POST /:id/accept-in-app - Accept invitation for logged-in user (no token). Invitee email must match current user. */
router.post("/:id/accept-in-app", ensureLoggedIn, async function (req, res, next) {
  try {
    const invitationId = req.params.id?.trim?.() || req.params.id;
    const currentUser = res.locals.user;
    const result = await acceptInvitationForLoggedInUser(invitationId, currentUser.id, currentUser.email);
    return res.json({ success: true, message: "Invitation accepted", userId: result.user.id });
  } catch (err) {
    return next(err);
  }
});

/** POST /:id/decline - Decline invitation. Only the invitee can decline. */
router.post("/:id/decline", ensureLoggedIn, async function (req, res, next) {
  try {
    const invitation = await Invitation.get(req.params.id);
    if (!invitation) throw new BadRequestError("Invitation not found");
    if (invitation.inviteeEmail?.toLowerCase() !== res.locals.user.email?.toLowerCase()) {
      throw new ForbiddenError("You can only decline invitations sent to you.");
    }
    const result = await Invitation.decline(req.params.id);
    if (invitation.type === "property") {
      await Notification.deletePropertyInvitationNotifications(req.params.id);
      syncCustomerIoInvitationCancelled(invitation, "declined");
    }
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

/** POST /:id/revoke - Revoke pending invitation. Only the inviter or admin can revoke. */
router.post("/:id/revoke", ensureLoggedIn, async function (req, res, next) {
  try {
    const invitation = await Invitation.get(req.params.id);
    if (!invitation) throw new BadRequestError("Invitation not found");
    const user = res.locals.user;
    const isInviter = invitation.inviterUserId === user.id;
    const isAdmin = user.role === "super_admin" || user.role === "admin";
    if (!isInviter && !isAdmin) {
      throw new ForbiddenError("You can only revoke invitations you sent.");
    }
    const result = await Invitation.revoke(req.params.id);
    if (invitation.type === "property") {
      await Notification.deletePropertyInvitationNotifications(req.params.id);
      syncCustomerIoInvitationCancelled(invitation, "revoked");
    }
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

/** POST /:id/resend - Resend invitation email to invitee. */
router.post("/:id/resend", ensureLoggedIn, async function (req, res, next) {
  try {
    const invitationId = req.params.id?.trim?.() || req.params.id;
    const inviterUserId = res.locals.user.id;
    const result = await resendInvitation(invitationId, inviterUserId);
    return res.json({ success: true, message: "Invitation email sent", invitation: result.invitation });
  } catch (err) {
    return next(err);
  }
});

/** GET /sent - List invitations sent by current user. */
router.get("/sent", ensureLoggedIn, async function (req, res, next) {
  try {
    const invitations = await Invitation.getSentByUser(res.locals.user.id);
    return res.json({ invitations });
  } catch (err) {
    return next(err);
  }
});

/** GET /received - List invitations received by current user (invitee_email matches). */
router.get("/received", ensureLoggedIn, async function (req, res, next) {
  try {
    const { status } = req.query;
    const userEmail = res.locals.user.email;
    if (!userEmail) {
      return res.json({ invitations: [] });
    }
    const invitations = await Invitation.getReceivedByEmail(userEmail, {
      status: status || "pending",
    });
    return res.json({ invitations });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /pending-unsent — Platform admin: pending invitations that have never been emailed.
 * Query: type=account|property
 */
router.get("/pending-unsent", ensureLoggedIn, ensurePlatformAdmin, async function (req, res, next) {
  try {
    const type = typeof req.query.type === "string" ? req.query.type.trim() : "";
    if (type && type !== "account" && type !== "property") {
      throw new BadRequestError("type must be account or property");
    }
    const invitations = await Invitation.getPendingNeverSent({
      type: type || undefined,
    });
    return res.json({ invitations });
  } catch (err) {
    return next(err);
  }
});

/** GET /property/:propertyId - List invitations for property. Requires property access. */
router.get("/property/:propertyId", ensureLoggedIn, ensurePropertyAccess({ param: "propertyId" }), async function (req, res, next) {
  try {
    const { status } = req.query;
    const invitations = await Invitation.getByProperty(req.params.propertyId, { status });
    return res.json({ invitations });
  } catch (err) {
    return next(err);
  }
});

/** GET /account/:accountId - List invitations for account. Requires account membership. */
router.get("/account/:accountId", ensureLoggedIn, ensureUserCanAccessAccountByParam("accountId"), async function (req, res, next) {
  try {
    const { status } = req.query;
    const emailNeverSent =
      req.query.emailNeverSent === "true" || req.query.emailNeverSent === true;
    const invitations = await Invitation.getByAccount(req.params.accountId, {
      status,
      emailNeverSent: emailNeverSent || undefined,
    });
    return res.json({ invitations });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
