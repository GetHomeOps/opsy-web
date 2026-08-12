"use strict";

/**
 * Invitation Service
 *
 * Orchestrates invitation creation and acceptance. Creates property or
 * account invitations with token hashing, expiry, and full acceptance
 * flow (user creation, account linking, subscription, contact).
 *
 * Exports: createPropertyInvitation, createAccountInvitation, acceptInvitation, acceptInvitationForLoggedInUser
 */

const db = require("../db");
const crypto = require("crypto");
const { generateInvitationToken } = require("../helpers/invitationTokens");
const Invitation = require("../models/invitation");
const Account = require("../models/account");
const Contact = require("../models/contact");
const Property = require("../models/property");
const User = require("../models/user");
const bcrypt = require("bcrypt");
const { BadRequestError, ForbiddenError } = require("../expressError");
const { BCRYPT_WORK_FACTOR } = require("../config");
const Subscription = require("../models/subscription");
const { onUserCreated } = require("./resourceAutoSend");
const Notification = require("../models/notification");
const { syncPropertyMissingAgentAdminNotifications } = require("./propertyMissingAgentNotifications");
const { notifyNewUserAccount } = require("./opsTeamNotifyService");
const { sendInvitationEmail, sendBulkPropertyInvitationEmail, sendBulkPropertyAddedEmail } = require("./emailService");
const {
  buildPropertyInvitationMissingDataMerge,
  EMPTY_MISSING_DATA_MERGE,
} = require("./propertyInvitationDataGaps");
const customerIoProvider = require("./emailProviders/customerIoProvider");
const customerIoLifecycleService = require("./customerIoLifecycleService");
const { initialsFromFullName } = require("../utils/nameInitials");
const { isSafeS3Key } = require("../helpers/presignedUrls");
const AgentAffiliation = require("../models/agentAffiliation");
const { APP_BASE_URL, BACKEND_URL } = require("../config");

/** Stable Opsy mark for account invitation emails when the inviter has no photo. */
function getAccountInvitationBrandMarkUrl() {
  const base = (APP_BASE_URL || process.env.APP_WEB_ORIGIN || "https://app.heyopsy.com").replace(
    /\/$/,
    ""
  );
  return (
    process.env.EMAIL_ACCOUNT_INVITATION_MARK_URL || `${base}/opsy_favicon.png`
  );
}
const {
  canAddContact,
  getTeamMemberInviteEligibilityByProperty,
  getViewerInviteEligibilityByProperty,
  getAccountLimits,
} = require("./tierService");
const {
  assertPropertyCanAcceptAgentInvite,
  isEmailAnActiveAgentUser,
  propertyHasAgentMemberOrPendingAgentInvitation,
} = require("./propertyAgentPolicy");
const { isDemoEnvironment } = require("../helpers/demoEnvironment");
const {
  shouldAutoTransferOwnershipOnHomeownerInvite,
  transferPropertyOwnership,
} = require("./propertyOwnershipService");

const VALID_ACCOUNT_ROLES = new Set(["owner", "admin", "member", "view_only"]);

/** Hours until invitation links stop working (creation + acceptance). */
const INVITATION_EXPIRY_HOURS = 168;

/** Allowed values for invitations.intended_property_role — the invitation
 *  category (which tab the invitee will appear under in the property team
 *  modal). Decoupled from intended_role, which only carries the access level
 *  (editor / viewer). */
const VALID_INTENDED_PROPERTY_ROLES = new Set([
  "agent",
  "homeowner",
  "insurance",
  "mortgage",
]);

function normalizeIntendedPropertyRole(value) {
  if (value == null) return null;
  const v = String(value).trim().toLowerCase();
  if (!v) return null;
  return VALID_INTENDED_PROPERTY_ROLES.has(v) ? v : null;
}

function firstNameFromFullName(name) {
  if (!name || typeof name !== "string") return "";
  const trimmed = name.trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0] || "";
}

/** Ensure avatar/logo URLs work in external email clients. */
function toAbsoluteMediaUrl(url) {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const base = (APP_BASE_URL || process.env.APP_WEB_ORIGIN || "").replace(/\/$/, "");
  if (!base) return trimmed;
  return `${base}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}

/** True when the user has a usable avatar source (uploaded S3 photo or an OAuth avatar URL). */
function userHasUsableAvatar(image, avatarUrl) {
  if (typeof image === "string" && isSafeS3Key(image)) return true;
  if (typeof avatarUrl === "string" && /^https?:\/\//i.test(avatarUrl.trim())) return true;
  return false;
}

/**
 * Stable, public avatar URL for embedding in emails. Resolves the user's photo
 * (private S3 object) at view time, or a branded initials image as fallback —
 * so the email <img> never renders broken regardless of when it's opened.
 */
function buildPublicAvatarUrl(userId, fullName) {
  if (!userId) return "";
  const base = (BACKEND_URL || APP_BASE_URL || process.env.APP_WEB_ORIGIN || "").replace(
    /\/$/,
    ""
  );
  if (!base) return "";
  const q = new URLSearchParams();
  if (fullName) q.set("name", fullName);
  const query = q.toString();
  return `${base}/public/avatar/users/${userId}${query ? `?${query}` : ""}`;
}

async function resolveInviteeFirstName(emailLower, accountId) {
  if (!emailLower) return "";

  const userRes = await db.query(
    `SELECT name FROM users WHERE LOWER(TRIM(email)) = $1 LIMIT 1`,
    [emailLower]
  );
  const fromUser = firstNameFromFullName(userRes.rows[0]?.name);
  if (fromUser) return fromUser;

  if (accountId == null) return "";
  const contactRes = await db.query(
    `SELECT c.name FROM contacts c
     JOIN account_contacts ac ON ac.contact_id = c.id
     WHERE LOWER(TRIM(c.email)) = $1 AND ac.account_id = $2
     LIMIT 1`,
    [emailLower, accountId]
  );
  return firstNameFromFullName(contactRes.rows[0]?.name);
}

/** Platform role of invitee (agent, homeowner, admin) for Customer.io journey branching. */
async function resolveInviteePlatformRole(emailLower) {
  if (!emailLower) return "";
  const userRes = await db.query(
    `SELECT role FROM users WHERE LOWER(TRIM(email)) = $1 LIMIT 1`,
    [emailLower]
  );
  return (userRes.rows[0]?.role || "").trim().toLowerCase();
}

/** Customer.io merge fields for account (agent/admin) invitations. */
async function buildAccountInvitationInviterMergeData(inviterUserId) {
  const brandMarkUrl = getAccountInvitationBrandMarkUrl();
  if (!inviterUserId) {
    return {
      senderFirstName: "",
      avatarUrl: brandMarkUrl,
    };
  }

  const inviterRes = await db.query(
    `SELECT name, image, avatar_url FROM users WHERE id = $1`,
    [inviterUserId]
  );
  const inviter = inviterRes.rows[0] || {};
  const inviterFullName = inviter.name || "";
  const hasPhoto = userHasUsableAvatar(inviter.image, inviter.avatar_url);

  return {
    senderFirstName: firstNameFromFullName(inviterFullName),
    avatarUrl: hasPhoto
      ? buildPublicAvatarUrl(inviterUserId, inviterFullName)
      : brandMarkUrl,
  };
}

/** Customer.io merge fields for agent → homeowner property invitations. */
async function buildPropertyInvitationAgentMergeData(inviterUserId, invitation) {
  if (!inviterUserId || !invitation) {
    return {
      invitedByAgent: false,
      agentFirstName: "",
      agentFullName: "",
      agentRole: "",
      agentPhotoUrl: "",
      agentAvatarUrl: "",
      agentInitials: "",
      hasAgentPhoto: false,
      teamName: "",
      brokerageName: "",
      brokerageLogoUrl: "",
    };
  }

  const inviterRes = await db.query(
    `SELECT name, role, image, avatar_url FROM users WHERE id = $1`,
    [inviterUserId]
  );
  const inviter = inviterRes.rows[0] || {};
  const intendedPropertyRole = (invitation.intendedPropertyRole || "")
    .trim()
    .toLowerCase();
  const invitedByAgent =
    (inviter.role || "").toLowerCase() === "agent" &&
    intendedPropertyRole === "homeowner";

  const agentFullName = inviter.name || "";
  const affiliation = await AgentAffiliation.getActiveForUser(inviterUserId);

  /* Stable public URL that resolves the agent's photo (private S3 object) at
     view time, or a branded initials image as fallback. Used for the email
     <img> so it loads whenever the recipient opens the message. */
  const agentAvatarUrl = buildPublicAvatarUrl(inviterUserId, agentFullName);
  const hasAgentPhoto = userHasUsableAvatar(inviter.image, inviter.avatar_url);

  return {
    invitedByAgent,
    agentFirstName: firstNameFromFullName(agentFullName),
    agentFullName,
    agentRole: "real estate advisor",
    // agentPhotoUrl: photo-only (empty when no photo) for templates that branch on it.
    agentPhotoUrl: hasAgentPhoto ? agentAvatarUrl : "",
    // agentAvatarUrl: always renders (photo or initials) — preferred for the email <img>.
    agentAvatarUrl,
    agentInitials: initialsFromFullName(agentFullName),
    hasAgentPhoto,
    teamName: affiliation?.team?.name || "",
    brokerageName: affiliation?.agency?.name || "",
    brokerageLogoUrl: toAbsoluteMediaUrl(affiliation?.agency?.logoUrl || ""),
  };
}

/** Allowed values for each per-section access restriction (Systems / Maintenance / Docs). */
const VALID_PERMISSION_VALUES = new Set(["edit", "view", "none"]);

/** Sanitize the per-section permissions object the client sends with an
 *  invitation. Returns null if the input is empty or not an object so the DB
 *  column stores NULL (meaning "no overrides"). */
function normalizeInvitationPermissions(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out = {};
  for (const [rawKey, rawVal] of Object.entries(value)) {
    if (typeof rawKey !== "string") continue;
    const key = rawKey.trim();
    if (!key) continue;
    const valStr = String(rawVal ?? "").trim().toLowerCase();
    if (!VALID_PERMISSION_VALUES.has(valStr)) continue;
    out[key] = valStr;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Map invitation intendedRole to account_role. Property invitations use editor/viewer; account uses owner/admin/member/view_only. */
function mapToAccountRole(intendedRole, invitationType) {
  const r = (intendedRole || "").toLowerCase();
  if (VALID_ACCOUNT_ROLES.has(r)) return r;
  if (invitationType === "property") {
    if (r === "viewer") return "view_only";
    return "member";
  }
  return "member";
}

/** True when the account is the internal platform account (owned by a super_admin).
 *  Invitees (e.g. homeowners invited to demo properties) must still get property
 *  access, but should NOT become members of this account — its properties would
 *  otherwise count against the invitee's plan limit and pollute their account list. */
async function isInternalPlatformAccount(accountId) {
  if (!accountId) return false;
  const res = await db.query(
    `SELECT 1
       FROM accounts a
       JOIN users u ON u.id = a.owner_user_id
      WHERE a.id = $1 AND u.role = 'super_admin'
      LIMIT 1`,
    [accountId]
  );
  return res.rows.length > 0;
}

function buildPropertyInviteUrl({
  baseUrl,
  accountUrl,
  invitation,
  token,
  propertyUid,
  hasExistingAccount,
  isLinkedToAccount,
}) {
  if (hasExistingAccount && propertyUid) {
    return `${baseUrl}/${accountUrl}/properties/${propertyUid}?invitation=${encodeURIComponent(String(invitation.id))}`;
  }
  if (hasExistingAccount) {
    const q = new URLSearchParams();
    q.set("email", invitation.inviteeEmail.trim());
    if (isLinkedToAccount) {
      q.set("returnTo", `/${accountUrl}/invitations`);
    }
    return `${baseUrl}/signin?${q.toString()}`;
  }
  return `${baseUrl}/${accountUrl}/invite/confirm?token=${encodeURIComponent(token)}&email=${encodeURIComponent(invitation.inviteeEmail)}`;
}

/** Resolve the same URL used in invitation emails (in-app property link, sign-in, or confirm flow). */
async function resolvePropertyInvitationInviteUrl(invitation, token) {
  const baseUrl = (APP_BASE_URL || process.env.APP_WEB_ORIGIN || "http://localhost:5173").replace(
    /\/$/,
    "",
  );
  const account = await Account.get(invitation.accountId);
  const accountUrl = String(account?.url || account?.name || "home").replace(/^\/+/, "");
  const emailNorm = (invitation.inviteeEmail || "").trim().toLowerCase();

  const r = await db.query(
    `SELECT id FROM users WHERE LOWER(TRIM(email)) = $1 AND is_active = true`,
    [emailNorm],
  );
  const resolvedInviteeUserId = r.rows[0]?.id ?? null;
  const hasExistingAccount = resolvedInviteeUserId != null;

  let propertyUid = null;
  if (invitation.propertyId) {
    const prop = await db.query(`SELECT property_uid FROM properties WHERE id = $1`, [
      invitation.propertyId,
    ]);
    propertyUid = prop.rows[0]?.property_uid || null;
  }

  let isLinkedToAccount = false;
  if (hasExistingAccount && !propertyUid) {
    isLinkedToAccount = await Account.isUserLinkedToAccount(
      resolvedInviteeUserId,
      invitation.accountId,
    );
  }

  return buildPropertyInviteUrl({
    baseUrl,
    accountUrl,
    invitation,
    token,
    propertyUid,
    hasExistingAccount,
    isLinkedToAccount,
  });
}

async function ensureInviteeContactAutoCreated({
  emailLower,
  inviteeEmailTrimmed,
  trimmedInviteeName,
  accountId,
  inviterUserRole,
}) {
  const existingContact = await db.query(
    `SELECT c.id, c.name FROM contacts c
     JOIN account_contacts ac ON ac.contact_id = c.id
     WHERE LOWER(TRIM(c.email)) = $1 AND ac.account_id = $2
     LIMIT 1`,
    [emailLower, accountId]
  );
  if (existingContact.rows.length > 0) {
    const existingName = (existingContact.rows[0].name || "").trim();
    if (!existingName && trimmedInviteeName) {
      try {
        await Contact.update(existingContact.rows[0].id, {
          name: trimmedInviteeName,
        });
      } catch (contactErr) {
        console.error(
          "[invitationService] Failed to update contact name for invitee:",
          contactErr.message
        );
      }
    }
    return;
  }
  const tierCheck = await canAddContact(accountId, inviterUserRole);
  if (!tierCheck.allowed) return;
  try {
    const localPart = inviteeEmailTrimmed.split("@")[0];
    const contactName =
      trimmedInviteeName || localPart || inviteeEmailTrimmed;
    const contact = await Contact.create({
      name: contactName,
      email: inviteeEmailTrimmed,
    });
    await Contact.addToAccount({
      contactId: contact.id,
      accountId,
    });
  } catch (contactErr) {
    console.error(
      "[invitationService] Failed to auto-create contact for invitee:",
      contactErr.message
    );
  }
}

async function createPropertyInvitation({
  inviterUserId,
  inviteeEmail,
  inviteeName,
  accountId,
  propertyId,
  intendedRole,
  intendedPropertyRole,
  permissions,
  inviterUserRole,
  skipInviteEmail = false,
  invitationEmailNote = null,
  invitationEmailMainPlain = null,
  invitationEmailCc = null,
}) {
  const emailLower = (inviteeEmail || "").trim().toLowerCase();
  if (!emailLower) throw new BadRequestError("inviteeEmail is required");
  const trimmedInviteeName = (inviteeName || "").trim();
  const inviteeEmailTrimmed = inviteeEmail.trim();

  // Prevent duplicate: user already in property team
  const existingMember = await db.query(
    `SELECT 1 FROM property_users pu
     JOIN users u ON u.id = pu.user_id
     WHERE pu.property_id = $1 AND LOWER(TRIM(u.email)) = $2`,
    [propertyId, emailLower]
  );
  if (existingMember.rows.length > 0) {
    throw new BadRequestError("This person is already on the property team.");
  }

  // Prevent duplicate: pending invitation already exists for this email
  const pendingInv = await db.query(
    `SELECT 1 FROM invitations
     WHERE property_id = $1 AND status = 'pending' AND LOWER(TRIM(invitee_email)) = $2`,
    [propertyId, emailLower]
  );
  if (pendingInv.rows.length > 0) {
    throw new BadRequestError("An invitation has already been sent to this email address.");
  }

  /* Only one agent per property (platform role `agent` only — admin and
     super_admin are HomeOps internal users and don't occupy the agent slot). */
  await assertPropertyCanAcceptAgentInvite(propertyId, emailLower);

  await ensureInviteeContactAutoCreated({
    emailLower,
    inviteeEmailTrimmed,
    trimmedInviteeName,
    accountId,
    inviterUserRole,
  });

  const { token, tokenHash } = generateInvitationToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + INVITATION_EXPIRY_HOURS);

  const invitation = await Invitation.create({
    type: 'property',
    inviterUserId,
    inviteeEmail,
    accountId,
    propertyId,
    intendedRole: intendedRole || 'editor',
    intendedPropertyRole: normalizeIntendedPropertyRole(intendedPropertyRole),
    permissions: normalizeInvitationPermissions(permissions),
    tokenHash,
    expiresAt,
  });

  /* Pending invitees (is_active=false, e.g. agents not yet onboarded) still
     get an in-app notification queued so it's waiting on first login. The
     email URL flow needs the new-account confirm path though, so the email
     side treats only is_active=true users as "has existing account". */
  const existingUserAny = await db.query(
    `SELECT id, is_active FROM users WHERE LOWER(TRIM(email)) = $1`,
    [emailLower]
  );
  const inviteeUserRow = existingUserAny.rows[0] ?? null;
  const inviteeUserId = inviteeUserRow?.id ?? null;
  const inviteeUserIsActive = inviteeUserRow?.is_active === true;
  if (inviteeUserId != null) {
    try {
      await Notification.create({
        userId: inviteeUserId,
        type: 'property_invitation',
        title: "You've been invited to join a property",
        invitationId: invitation.id,
      });
    } catch (notifErr) {
      console.error("[invitationService] Failed to create notification for invitee:", notifErr.message);
    }
  }

  if (!skipInviteEmail) {
    try {
      await sendInvitationEmailForInvitation({
        invitation,
        token,
        inviterUserId,
        type: "property",
        inviteeUserId: inviteeUserIsActive ? inviteeUserId : null,
        inviteeName: trimmedInviteeName || null,
        personalNote: invitationEmailMainPlain ? null : invitationEmailNote,
        mainPlainOverride: invitationEmailMainPlain || null,
        cc: invitationEmailCc,
      });
      await Invitation.markEmailSent(invitation.id);
    } catch (err) {
      console.error("[invitationService] Failed to send invitation email:", err.message);
    }
  }

  return { invitation, token };
}

/**
 * Create property invitations for many properties for one invitee; sends a single consolidated email.
 * Returns per-property success/failure (partial success allowed). Does not throw for per-property errors.
 */
async function createBulkPropertyInvitations({
  inviterUserId,
  inviteeEmail,
  inviteeName,
  accountId,
  propertyIds,
  intendedRole,
  intendedPropertyRole,
  permissions,
  inviterUserRole,
  requireApproval = true,
}) {
  const emailLower = (inviteeEmail || "").trim().toLowerCase();
  if (!emailLower) throw new BadRequestError("inviteeEmail is required");
  if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
    throw new BadRequestError("propertyIds must be a non-empty array");
  }

  const rawIds = [
    ...new Set(
      propertyIds
        .map((id) => Number(id))
        .filter((n) => Number.isInteger(n) && n > 0)
    ),
  ];
  if (rawIds.length === 0) {
    throw new BadRequestError("propertyIds must contain valid property ids");
  }

  const succeeded = [];
  const failed = [];

  const accountProps = await db.query(
    `SELECT id FROM properties WHERE account_id = $1 AND id = ANY($2::int[])`,
    [accountId, rawIds]
  );
  const validInAccount = new Set(accountProps.rows.map((r) => r.id));

  for (const pid of rawIds) {
    if (!validInAccount.has(pid)) {
      failed.push({ propertyId: pid, message: "Property not found in this account." });
    }
  }

  const toCheck = rawIds.filter((pid) => validInAccount.has(pid));
  if (toCheck.length === 0) {
    return { succeeded, failed, autoAccepted: [] };
  }

  const [membersRes, pendingRes] = await Promise.all([
    db.query(
      `SELECT pu.property_id FROM property_users pu
       JOIN users u ON u.id = pu.user_id
       WHERE pu.property_id = ANY($1::int[]) AND LOWER(TRIM(u.email)) = $2`,
      [toCheck, emailLower]
    ),
    db.query(
      `SELECT property_id FROM invitations
       WHERE property_id = ANY($1::int[]) AND status = 'pending' AND LOWER(TRIM(invitee_email)) = $2`,
      [toCheck, emailLower]
    ),
  ]);

  const blockedMember = new Set(membersRes.rows.map((r) => r.property_id));
  const blockedPending = new Set(pendingRes.rows.map((r) => r.property_id));

  /* If the invitee is an agent-role user, block any property that already has
     another agent-role user (accepted or pending invitation). */
  const inviteeIsAgent = await isEmailAnActiveAgentUser(emailLower);
  const blockedAgentExists = new Set();
  if (inviteeIsAgent) {
    for (const pid of toCheck) {
      if (blockedMember.has(pid) || blockedPending.has(pid)) continue;
      if (await propertyHasAgentMemberOrPendingAgentInvitation(pid)) {
        blockedAgentExists.add(pid);
      }
    }
  }

  const intents = intendedRole || "editor";

  const notBlockedForTier = toCheck.filter(
    (pid) => !blockedMember.has(pid) && !blockedPending.has(pid)
  );
  const tierByProperty =
    intents === "viewer"
      ? await getViewerInviteEligibilityByProperty(accountId, notBlockedForTier, inviterUserRole)
      : await getTeamMemberInviteEligibilityByProperty(accountId, notBlockedForTier, inviterUserRole);

  const eligible = [];
  for (const pid of toCheck) {
    if (blockedMember.has(pid)) {
      failed.push({ propertyId: pid, message: "This person is already on the property team." });
      continue;
    }
    if (blockedPending.has(pid)) {
      failed.push({
        propertyId: pid,
        message: "An invitation has already been sent to this email address.",
      });
      continue;
    }
    if (blockedAgentExists.has(pid)) {
      failed.push({
        propertyId: pid,
        message:
          "An agent has already been added or invited to this property. Only one agent is allowed per property.",
      });
      continue;
    }
    const tier = tierByProperty.get(pid);
    if (!tier?.allowed) {
      failed.push({
        propertyId: pid,
        message:
          intents === "viewer"
            ? `Viewer limit reached (${tier?.current ?? 0}/${tier?.max ?? 0}). Upgrade your plan.`
            : `Team member limit reached (${tier?.current ?? 0}/${tier?.max ?? 0}). Upgrade your plan.`,
      });
      continue;
    }
    eligible.push(pid);
  }

  if (eligible.length === 0) {
    return { succeeded, failed, autoAccepted: [] };
  }

  const trimmedInviteeName = (inviteeName || "").trim();
  const inviteeEmailTrimmed = inviteeEmail.trim();
  await ensureInviteeContactAutoCreated({
    emailLower,
    inviteeEmailTrimmed,
    trimmedInviteeName,
    accountId,
    inviterUserRole,
  });

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + INVITATION_EXPIRY_HOURS);

  const normalizedIntendedPropertyRole =
    normalizeIntendedPropertyRole(intendedPropertyRole);
  const normalizedPermissions = normalizeInvitationPermissions(permissions);

  const createdRows = [];
  for (const propertyId of eligible) {
    const { token, tokenHash } = generateInvitationToken();
    const invitation = await Invitation.create({
      type: "property",
      inviterUserId,
      inviteeEmail,
      accountId,
      propertyId,
      intendedRole: intents,
      intendedPropertyRole: normalizedIntendedPropertyRole,
      permissions: normalizedPermissions,
      tokenHash,
      expiresAt,
    });
    createdRows.push({ invitation, token, propertyId });
  }

  /* Look up the existing user (active or pending). Pending agents
     (is_active=false because they haven't accepted their account invite yet,
     or active agents whose subscription isn't paid) still get in-app
     notifications queued so they're waiting in the bell on first login —
     but the email link must still be the new-account confirm flow because
     they don't have a usable session yet, so we surface them as "no existing
     account" to buildPropertyInviteUrl. */
  const existingUserAny = await db.query(
    `SELECT id, is_active FROM users WHERE LOWER(TRIM(email)) = $1`,
    [emailLower]
  );
  const inviteeUserRow = existingUserAny.rows[0] ?? null;
  const inviteeUserId = inviteeUserRow?.id ?? null;
  const inviteeUserIsActive = inviteeUserRow?.is_active === true;
  const shouldAutoAccept = requireApproval === false && inviteeUserIsActive && inviteeUserId != null;
  const autoAccepted = [];

  if (inviteeUserId != null && !shouldAutoAccept) {
    await Promise.all(
      createdRows.map(({ invitation }) =>
        Notification.create({
          userId: inviteeUserId,
          type: "property_invitation",
          title: "You've been invited to join a property",
          invitationId: invitation.id,
        }).catch((notifErr) => {
          console.error("[invitationService] Failed to create notification for invitee:", notifErr.message);
        })
      )
    );
  }

  if (shouldAutoAccept) {
    const autoAcceptedRows = [];
    for (const row of createdRows) {
      try {
        await acceptInvitation({ invitation: row.invitation, userId: inviteeUserId });
        autoAccepted.push({ propertyId: row.propertyId, invitation: row.invitation });
        succeeded.push({
          invitation: row.invitation,
          propertyId: row.propertyId,
          autoAccepted: true,
        });
        autoAcceptedRows.push(row);
      } catch (err) {
        console.error(
          "[invitationService] Bulk auto-accept failed for property",
          row.propertyId,
          err.message
        );
        try {
          await Invitation.revoke(row.invitation.id);
        } catch (revokeErr) {
          console.error("[invitationService] Failed to revoke after auto-accept failure:", revokeErr.message);
        }
        failed.push({
          propertyId: row.propertyId,
          message: err.message || "Failed to add agent to property.",
        });
      }
    }

    if (autoAcceptedRows.length > 0) {
      try {
        await sendBulkPropertyAddedEmailForInvites({
          invitationsWithTokens: autoAcceptedRows.map(({ invitation, token }) => ({ invitation, token })),
          inviterUserId,
          inviteeUserId,
          inviteeName: trimmedInviteeName || null,
        });
        await Invitation.markEmailSentMany(autoAcceptedRows.map(({ invitation }) => invitation.id));
      } catch (err) {
        console.error("[invitationService] Failed to send bulk property-added email:", err.message);
      }
    }
  } else {
    try {
      await sendBulkInvitationEmailForPropertyInvites({
        invitationsWithTokens: createdRows.map(({ invitation, token }) => ({ invitation, token })),
        inviterUserId,
        inviteeUserId: inviteeUserIsActive ? inviteeUserId : null,
        inviteeName: trimmedInviteeName || null,
      });
      await Invitation.markEmailSentMany(createdRows.map(({ invitation }) => invitation.id));
    } catch (err) {
      console.error("[invitationService] Failed to send bulk invitation email:", err.message);
    }

    for (const row of createdRows) {
      succeeded.push({ invitation: row.invitation, propertyId: row.propertyId });
    }
  }

  return { succeeded, failed, autoAccepted };
}

async function createAccountInvitation({
  inviterUserId,
  inviteeEmail,
  accountId,
  intendedRole,
  skipEmail = false,
}) {
  const { token, tokenHash } = generateInvitationToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + INVITATION_EXPIRY_HOURS);

  const invitation = await Invitation.create({
    type: 'account',
    inviterUserId,
    inviteeEmail,
    accountId,
    propertyId: null,
    intendedRole: intendedRole || 'member',
    tokenHash,
    expiresAt,
  });

  if (skipEmail) {
    return { invitation, token, emailSent: false, emailQueued: false };
  }

  let emailSent = false;
  try {
    await sendInvitationEmailForInvitation({ invitation, token, inviterUserId, type: "account" });
    await Invitation.markEmailSent(invitation.id);
    emailSent = true;
  } catch (err) {
    console.error("[invitationService] Failed to send invitation email:", err.message);
  }

  return { invitation, token, emailSent, emailQueued: false };
}

/** Send account invitation email without blocking the caller (e.g. admin user create). */
function sendAccountInvitationEmailInBackground({ invitation, token, inviterUserId }) {
  if (!invitation || !token) return Promise.resolve({ emailSent: false });

  return sendInvitationEmailForInvitation({
    invitation,
    token,
    inviterUserId,
    type: "account",
  })
    .then(async () => {
      await Invitation.markEmailSent(invitation.id);
      return { emailSent: true };
    })
    .catch((err) => {
      console.error("[invitationService] Background invitation email failed:", err.message);
      return { emailSent: false };
    });
}

/** Build invite URL and send email. Used after create and resend. */
async function sendInvitationEmailForInvitation({
  invitation,
  token,
  inviterUserId,
  type,
  inviteeUserId,
  inviteeName = null,
  personalNote = null,
  mainPlainOverride = null,
  cc = null,
}) {
  const baseUrl = (APP_BASE_URL || process.env.APP_WEB_ORIGIN || "http://localhost:5173").replace(/\/$/, "");
  const account = await Account.get(invitation.accountId);
  const accountUrl = String(account?.url || account?.name || "home").replace(/^\/+/, "");
  const emailNorm = (invitation.inviteeEmail || "").trim().toLowerCase();

  let resolvedInviteeUserId = inviteeUserId;
  if (type === "property" && resolvedInviteeUserId === undefined) {
    const r = await db.query(
      `SELECT id FROM users WHERE LOWER(TRIM(email)) = $1 AND is_active = true`,
      [emailNorm]
    );
    resolvedInviteeUserId = r.rows[0]?.id ?? null;
  }

  const hasExistingAccount = type === "property" && resolvedInviteeUserId != null;

  let propertyAddress = null;
  let propertyUid = null;
  if (type === "property" && invitation.propertyId) {
    const prop = await db.query(
      `SELECT address, property_uid FROM properties WHERE id = $1`,
      [invitation.propertyId]
    );
    propertyAddress = prop.rows[0]?.address || null;
    propertyUid = prop.rows[0]?.property_uid || null;
  }

  let isLinkedToAccount = false;
  if (hasExistingAccount && !propertyUid) {
    isLinkedToAccount = await Account.isUserLinkedToAccount(
      resolvedInviteeUserId,
      invitation.accountId
    );
  }

  const inviteUrl = buildPropertyInviteUrl({
    baseUrl,
    accountUrl,
    invitation,
    token,
    propertyUid,
    hasExistingAccount,
    isLinkedToAccount,
  });

  let inviterName = null;
  let agentMergeData = {};
  let accountInviterMergeData = {};
  let missingDataMerge = { ...EMPTY_MISSING_DATA_MERGE };
  let recipientFirstName = "";
  if (type === "property") {
    recipientFirstName =
      firstNameFromFullName(inviteeName) ||
      (await resolveInviteeFirstName(emailNorm, invitation.accountId));
    agentMergeData = await buildPropertyInvitationAgentMergeData(
      inviterUserId,
      invitation
    );
    inviterName = agentMergeData.agentFullName || null;
    if (invitation.propertyId) {
      missingDataMerge = await buildPropertyInvitationMissingDataMerge(
        invitation.propertyId
      );
    }
  } else {
    recipientFirstName =
      firstNameFromFullName(inviteeName) ||
      (await resolveInviteeFirstName(emailNorm, invitation.accountId));
    accountInviterMergeData = await buildAccountInvitationInviterMergeData(
      inviterUserId
    );
    if (inviterUserId) {
      const inviter = await db.query(`SELECT name FROM users WHERE id = $1`, [
        inviterUserId,
      ]);
      inviterName = inviter.rows[0]?.name || null;
    }
  }
  const userRole =
    type === "property" ? "" : await resolveInviteePlatformRole(emailNorm);
  const emailType = type === "property" ? "invitation_property" : "invitation_account";
  await sendInvitationEmail({
    to: invitation.inviteeEmail,
    inviteUrl,
    inviterName,
    inviteeName: recipientFirstName || null,
    type,
    userRole,
    propertyAddress,
    invitationId: type === "property" ? invitation.id : undefined,
    propertyId: type === "property" ? invitation.propertyId : undefined,
    inviteeHasAccount: hasExistingAccount,
    personalNote: type === "property" ? personalNote : null,
    mainPlainOverride: type === "property" ? mainPlainOverride : null,
    cc: type === "property" && Array.isArray(cc) && cc.length > 0 ? cc : null,
    recipientFirstName,
    ...agentMergeData,
    ...accountInviterMergeData,
    ...missingDataMerge,
    usage:
      invitation.accountId && inviterUserId
        ? {
          accountId: invitation.accountId,
          userId: inviterUserId,
          emailType,
        }
        : undefined,
  });
}

/** One SES send for multiple property rows; shared lookups (account, inviter, properties). */
async function sendBulkInvitationEmailForPropertyInvites({
  invitationsWithTokens,
  inviterUserId,
  inviteeUserId,
  inviteeName = null,
}) {
  if (!invitationsWithTokens?.length) return;

  const baseUrl = (APP_BASE_URL || process.env.APP_WEB_ORIGIN || "http://localhost:5173").replace(/\/$/, "");
  const firstInv = invitationsWithTokens[0].invitation;
  const account = await Account.get(firstInv.accountId);
  const accountUrl = String(account?.url || account?.name || "home").replace(/^\/+/, "");
  const emailNorm = (firstInv.inviteeEmail || "").trim().toLowerCase();

  let resolvedInviteeUserId = inviteeUserId;
  if (resolvedInviteeUserId === undefined) {
    const r = await db.query(
      `SELECT id FROM users WHERE LOWER(TRIM(email)) = $1 AND is_active = true`,
      [emailNorm]
    );
    resolvedInviteeUserId = r.rows[0]?.id ?? null;
  }
  const hasExistingAccount = resolvedInviteeUserId != null;

  const propertyIds = [
    ...new Set(invitationsWithTokens.map(({ invitation }) => invitation.propertyId).filter(Boolean)),
  ];
  const propRes = await db.query(
    `SELECT id, address, property_uid FROM properties WHERE id = ANY($1::int[])`,
    [propertyIds]
  );
  const propById = new Map(propRes.rows.map((row) => [row.id, row]));

  let isLinkedToAccount = false;
  if (hasExistingAccount) {
    const needsAccountLinkFlag = invitationsWithTokens.some(({ invitation }) => {
      const row = propById.get(invitation.propertyId);
      return !row?.property_uid;
    });
    if (needsAccountLinkFlag) {
      isLinkedToAccount = await Account.isUserLinkedToAccount(
        resolvedInviteeUserId,
        firstInv.accountId
      );
    }
  }

  let inviterName = null;
  if (inviterUserId) {
    const inviter = await db.query(`SELECT name FROM users WHERE id = $1`, [inviterUserId]);
    inviterName = inviter.rows[0]?.name || null;
  }

  const items = invitationsWithTokens.map(({ invitation, token }) => {
    const row = propById.get(invitation.propertyId);
    const propertyAddress = row?.address || null;
    const propertyUid = row?.property_uid || null;
    const inviteUrl = buildPropertyInviteUrl({
      baseUrl,
      accountUrl,
      invitation,
      token,
      propertyUid,
      hasExistingAccount,
      isLinkedToAccount,
    });
    return { propertyAddress, inviteUrl };
  });

  const recipientFirstName =
    firstNameFromFullName(inviteeName) ||
    (await resolveInviteeFirstName(emailNorm, firstInv.accountId));

  const emailType = "invitation_property";
  await sendBulkPropertyInvitationEmail({
    to: firstInv.inviteeEmail,
    inviterName,
    inviteeName: recipientFirstName || null,
    items,
    inviteeHasAccount: hasExistingAccount,
    usage:
      firstInv.accountId && inviterUserId
        ? {
          accountId: firstInv.accountId,
          userId: inviterUserId,
          emailType,
        }
        : undefined,
  });
}

/** One email listing properties the invitee was added to directly (no accept step). */
async function sendBulkPropertyAddedEmailForInvites({
  invitationsWithTokens,
  inviterUserId,
  inviteeUserId,
  inviteeName = null,
}) {
  if (!invitationsWithTokens?.length) return;

  const baseUrl = (APP_BASE_URL || process.env.APP_WEB_ORIGIN || "http://localhost:5173").replace(/\/$/, "");
  const firstInv = invitationsWithTokens[0].invitation;
  const account = await Account.get(firstInv.accountId);
  const accountUrl = String(account?.url || account?.name || "home").replace(/^\/+/, "");
  const emailNorm = (firstInv.inviteeEmail || "").trim().toLowerCase();

  const propertyIds = [
    ...new Set(invitationsWithTokens.map(({ invitation }) => invitation.propertyId).filter(Boolean)),
  ];
  const propRes = await db.query(
    `SELECT id, address, property_uid FROM properties WHERE id = ANY($1::int[])`,
    [propertyIds]
  );
  const propById = new Map(propRes.rows.map((row) => [row.id, row]));

  let inviterName = null;
  if (inviterUserId) {
    const inviter = await db.query(`SELECT name FROM users WHERE id = $1`, [inviterUserId]);
    inviterName = inviter.rows[0]?.name || null;
  }

  const items = invitationsWithTokens.map(({ invitation }) => {
    const row = propById.get(invitation.propertyId);
    const propertyAddress = row?.address || null;
    const propertyUid = row?.property_uid || null;
    const propertyUrl = propertyUid
      ? `${baseUrl}/${accountUrl}/properties/${propertyUid}`
      : `${baseUrl}/${accountUrl}/properties`;
    return { propertyAddress, propertyUrl };
  });

  const recipientFirstName =
    firstNameFromFullName(inviteeName) ||
    (await resolveInviteeFirstName(emailNorm, firstInv.accountId));

  const emailType = "invitation_property";
  await sendBulkPropertyAddedEmail({
    to: firstInv.inviteeEmail,
    inviterName,
    inviteeName: recipientFirstName || null,
    items,
    usage:
      firstInv.accountId && inviterUserId
        ? {
          accountId: firstInv.accountId,
          userId: inviterUserId,
          emailType,
        }
        : undefined,
  });
}

async function acceptInvitation({ rawToken, password, name, invitation: preFetchedInvitation, userId: preFetchedUserId }) {
  let invitation;
  let user;
  if (preFetchedInvitation && preFetchedUserId) {
    invitation = preFetchedInvitation;
    const existingUser = await db.query(
      `SELECT id, email, name, role, is_active FROM users WHERE id = $1`,
      [preFetchedUserId]
    );
    if (existingUser.rows.length === 0) throw new BadRequestError("User not found");
    user = existingUser.rows[0];
  } else {
    invitation = await Invitation.validateToken(rawToken);
  }

  /* Re-check plan capacity at acceptance time to prevent pending
     invitations issued before an upgrade/downgrade or before sibling invites
     from pushing the property over its plan limit. */
  if (
    invitation?.type === "property" &&
    invitation.propertyId &&
    invitation.accountId
  ) {
    const limits = await getAccountLimits(invitation.accountId);
    const intendedRole = (invitation.intendedRole || "editor").toLowerCase();
    const isViewerInvite = intendedRole === "viewer";
    const max = isViewerInvite ? limits.maxViewers : limits.maxTeamMembers;
    if (max != null) {
      const memberRolePredicate = isViewerInvite ? "role = 'viewer'" : "role != 'viewer'";
      const inviteRolePredicate = isViewerInvite
        ? "COALESCE(intended_role, 'editor') = 'viewer'"
        : "COALESCE(intended_role, 'editor') != 'viewer'";
      const cntRes = await db.query(
        `SELECT
           (SELECT COUNT(*)::int FROM property_users
              WHERE property_id = $1 AND ${memberRolePredicate})
           +
           (SELECT COUNT(*)::int FROM invitations
              WHERE property_id = $1
                AND status = 'pending'
                AND ${inviteRolePredicate}
                AND id != $2)
           AS count`,
        [invitation.propertyId, invitation.id]
      );
      const current = cntRes.rows[0].count;
      if (current >= max) {
        const label = isViewerInvite ? "View-only user" : "Home owner";
        throw new ForbiddenError(
          `${label} limit reached (${current}/${max}) for this property. Ask the property owner to upgrade the plan before accepting.`
        );
      }
    }
  }

  await db.query("BEGIN");
  try {
    let createdNewUserViaInvite = false;
    if (!user) {
      const existingUser = await db.query(
        `SELECT id, email, name, role, is_active FROM users WHERE email = $1`,
        [invitation.inviteeEmail]
      );

      if (existingUser.rows.length > 0) {
        user = existingUser.rows[0];
        if (!user.is_active && password) {
          const hashedPassword = await bcrypt.hash(password, BCRYPT_WORK_FACTOR);
          const nameUpdate = name && user.role === "assistant" ? name : null;
          if (nameUpdate) {
            await db.query(
              `UPDATE users
               SET password_hash = $1, is_active = true, name = $2,
                   onboarding_completed = true, email_verified = true
               WHERE id = $3`,
              [hashedPassword, nameUpdate, user.id]
            );
            user.name = nameUpdate;
          } else if (user.role === "assistant") {
            await db.query(
              `UPDATE users
               SET password_hash = $1, is_active = true,
                   onboarding_completed = true, email_verified = true
               WHERE id = $2`,
              [hashedPassword, user.id]
            );
          } else {
            await db.query(
              `UPDATE users SET password_hash = $1, is_active = true WHERE id = $2`,
              [hashedPassword, user.id]
            );
          }
        }

        /* Assistants are tethered to an agent's account — never create a
           personal account/subscription for them. */
        const hasAccount = user.role === "assistant"
          ? true
          : await User.userHasAccount(user.id);
        if (!hasAccount) {
          const userName = name || user.name || invitation.inviteeEmail;
          const newAccount = await Account.linkNewUserToAccount({ name: userName, userId: user.id });

          const role = user.role || "homeowner";
          if (role !== "super_admin" && role !== "admin") {
            try {
              await Subscription.ensureDefaultForAccount(newAccount.id, role);
            } catch (subErr) {
              console.error("Warning: failed to auto-create subscription for existing user account", newAccount.id, subErr.message);
            }
          }

          const existingContact = await Contact.getByEmailAndAccount(
            invitation.inviteeEmail,
            newAccount.id
          );
          if (!existingContact) {
            const contact = await Contact.create({
              name: userName,
              email: invitation.inviteeEmail,
            });
            await Contact.addToAccount({ contactId: contact.id, accountId: newAccount.id });
            await User.update({ id: user.id, contact: contact.id });
          }
        }
      } else {
        if (!password || !name) {
          throw new BadRequestError("Name and password are required for new users");
        }
        if (isDemoEnvironment()) {
          throw new ForbiddenError("Account registration is disabled on the demo site.");
        }
        /* Force invited new users through onboarding so they must pick a plan,
           exactly like self-signup. Without onboarding_completed=false the row
           falls back to the DB default (true) and ProtectedRoute would let them
           into the app on the auto-created free subscription without choosing a
           plan. role_locked pins them to the homeowner plans they were created
           with so onboarding skips the role picker and goes straight to plan
           selection. */
        const newUser = await User.register({
          name,
          email: invitation.inviteeEmail,
          password,
          role: 'homeowner',
          is_active: true,
          onboarding_completed: false,
          role_locked: true,
        });
        user = newUser;
        createdNewUserViaInvite = true;
        const newAccount = await Account.linkNewUserToAccount({ name, userId: user.id });

        // New invited users get homeowner role; only create subscription for non-internal roles
        if (user.role !== "super_admin" && user.role !== "admin") {
          try {
            await Subscription.ensureDefaultForAccount(newAccount.id, user.role || "homeowner");
          } catch (subErr) {
            console.error("Warning: failed to auto-create subscription for invited user account", newAccount.id, subErr.message);
          }
        }

        const contact = await Contact.create({
          name,
          email: invitation.inviteeEmail,
        });
        await Contact.addToAccount({ contactId: contact.id, accountId: newAccount.id });
        await User.update({ id: user.id, contact: contact.id });

        try {
          await onUserCreated({ userId: user.id, role: user.role || "homeowner" });
        } catch (autoErr) {
          console.error("[resourceAutoSend] acceptInvitation new user:", autoErr.message);
        }
      }
    }

    const accepted = await Invitation.accept(invitation.id, user.id);

    let didAutoTransferOwnership = false;

    if (accepted.type === 'property' && accepted.propertyId) {
      await Property.addUserToProperty({
        property_id: accepted.propertyId,
        user_id: user.id,
        role: accepted.intendedRole || 'editor',
        permissions: accepted.permissions || null,
      });

      const autoTransfer = await shouldAutoTransferOwnershipOnHomeownerInvite({
        invitation: {
          ...invitation,
          type: accepted.type,
          propertyId: accepted.propertyId,
          intendedPropertyRole: accepted.intendedPropertyRole ?? invitation.intendedPropertyRole,
          intendedRole: accepted.intendedRole ?? invitation.intendedRole,
          inviterUserId: invitation.inviterUserId,
        },
        inviteeUserId: user.id,
        inviteeUserRole: user.role,
      });

      if (autoTransfer) {
        await transferPropertyOwnership({
          propertyId: autoTransfer.propertyId,
          fromUserId: autoTransfer.fromUserId,
          toUserId: autoTransfer.toUserId,
          reason: "homeowner_invite",
          sendNotifications: true,
        });
        didAutoTransferOwnership = true;
      }
    }

    if (accepted.accountId) {
      const isLinked = await Account.isUserLinkedToAccount(user.id, accepted.accountId);
      // Never auto-add invitees to the internal platform account (owned by a
      // super_admin). They still receive property access via property_users above;
      // making them an account member would count that account's properties
      // (e.g. demo data) against their own plan limit.
      const internalPlatformAccount = await isInternalPlatformAccount(accepted.accountId);
      if (!isLinked && !internalPlatformAccount) {
        const accountRole = mapToAccountRole(accepted.intendedRole, accepted.type);
        await Account.addUserToAccount({
          userId: user.id,
          accountId: accepted.accountId,
          role: accountRole,
        });
      }

      const existingContact = await Contact.getByEmailAndAccount(
        invitation.inviteeEmail,
        accepted.accountId
      );
      if (!existingContact) {
        const inviterContact = await Contact.create({
          name: user.name || invitation.inviteeEmail,
          email: invitation.inviteeEmail,
        });
        await Contact.addToAccount({ contactId: inviterContact.id, accountId: accepted.accountId });
      }
    }

    await User.setEmailVerified(user.id, true);

    await db.query("COMMIT");

    if (createdNewUserViaInvite) {
      notifyNewUserAccount({
        userId: user.id,
        email: user.email || invitation.inviteeEmail,
        name: user.name || name || invitation.inviteeEmail,
        role: user.role || "homeowner",
        source: "invitation_signup",
      }).catch((e) => console.error("[opsTeamNotify] invitation new user:", e.message));
    }

    if (accepted.type === "property") {
      let propertyAddress = "";
      let propertyUid = "";
      let propertyState = "";
      let propertyCity = "";
      if (accepted.propertyId) {
        try {
          const propRes = await db.query(
            `SELECT address, property_uid, state, city FROM properties WHERE id = $1`,
            [accepted.propertyId]
          );
          propertyAddress = propRes.rows[0]?.address || "";
          propertyUid = propRes.rows[0]?.property_uid || "";
          propertyState = propRes.rows[0]?.state || "";
          propertyCity = propRes.rows[0]?.city || "";
        } catch (propErr) {
          console.error(
            "[invitationService] Failed to load property for acceptance:",
            propErr.message
          );
        }
      }

      customerIoProvider.trackPropertyInvitationAccepted({
        inviteeEmail: invitation.inviteeEmail,
        invitationId: invitation.id,
        propertyId: accepted.propertyId,
        propertyAddress,
        inviteeName: user.name || invitation.inviteeEmail,
      });

      const inviteeEmail = user.email || invitation.inviteeEmail;
      if (inviteeEmail && accepted.propertyId) {
        let isFirstPropertyForUser = false;
        try {
          const countRes = await db.query(
            `SELECT COUNT(*)::int AS c FROM property_users WHERE user_id = $1`,
            [user.id]
          );
          isFirstPropertyForUser = (countRes.rows[0]?.c ?? 0) === 1;
        } catch (countErr) {
          console.error(
            "[invitationService] property count for Customer.io:",
            countErr.message
          );
        }
        customerIoProvider.trackPropertyAdded({
          userEmail: inviteeEmail,
          userName: user.name || invitation.inviteeEmail,
          propertyId: accepted.propertyId,
          propertyAddress,
          propertyUid,
          propertyState,
          propertyCity,
          accountId: accepted.accountId,
          isFirstPropertyForUser,
          source: "invitation_accept",
        });
        customerIoLifecycleService
          .syncCustomerIoUserPropertyState({
            userId: user.id,
            userEmail: inviteeEmail,
          })
          .catch((e) =>
            console.error("[customerIo] sync property state invite accept:", e.message)
          );
      }

      try {
        await Notification.deletePropertyInvitationNotifications(invitation.id);
      } catch (notifErr) {
        console.error(
          "[invitationService] Failed to remove invitation notification:",
          notifErr.message
        );
      }

      const inviterId = invitation.inviterUserId;
      if (
        inviterId &&
        inviterId !== user.id &&
        accepted.propertyId &&
        !didAutoTransferOwnership
      ) {
        try {
          const address = propertyAddress;
          const placeLabel =
            address && String(address).trim() ? String(address).trim() : "the property";
          const acceptorName =
            (user.name && String(user.name).trim()) ||
            invitation.inviteeEmail ||
            "Someone";
          await Notification.create({
            userId: inviterId,
            type: "property_invitation_accepted",
            title: `${acceptorName} accepted your invitation to join ${placeLabel}`,
            invitationId: invitation.id,
          });
        } catch (inviterNotifErr) {
          console.error(
            "[invitationService] Failed to notify inviter of acceptance:",
            inviterNotifErr.message
          );
        }
      }

      if (accepted.propertyId) {
        try {
          await syncPropertyMissingAgentAdminNotifications(accepted.propertyId);
        } catch (syncErr) {
          console.error("[invitationService] propertyMissingAgent sync:", syncErr.message);
        }
      }
    }

    try {
      const commAutoSend = require("./commAutoSend");
      const acceptedRole = user.role || "homeowner";
      if (
        accepted.accountId &&
        (acceptedRole === "homeowner" || acceptedRole === "agent")
      ) {
        if (createdNewUserViaInvite) {
          commAutoSend
            .onUserCreated({
              userId: user.id,
              role: acceptedRole,
              accountId: accepted.accountId,
            })
            .catch((e) => console.error("[commAutoSend] acceptInvitation user_created:", e.message));
        }
        if (accepted.type === "property") {
          commAutoSend
            .onPropertyInvitationAccepted({
              userId: user.id,
              accountId: accepted.accountId,
              role: acceptedRole,
            })
            .catch((e) =>
              console.error("[commAutoSend] acceptInvitation property_invitation:", e.message)
            );
        }
      }
    } catch (commErr) {
      console.error("[commAutoSend] acceptInvitation:", commErr.message);
    }

    return { user, invitation: accepted };
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  }
}

/** Accept invitation for logged-in user (no token). Used when invitee is already in the platform. */
async function acceptInvitationForLoggedInUser(invitationId, userId, userEmail) {
  const invitation = await Invitation.get(invitationId);
  if (invitation.status !== 'pending') {
    throw new BadRequestError("Invitation is no longer pending");
  }
  if (new Date(invitation.expiresAt) <= new Date()) {
    throw new BadRequestError("Invitation has expired");
  }
  if (invitation.inviteeEmail.toLowerCase() !== (userEmail || '').toLowerCase()) {
    throw new ForbiddenError("This invitation was sent to a different email address");
  }
  return acceptInvitation({ invitation, userId });
}

/** Resend invitation email. Generates new token and sends email. */
async function resendInvitation(invitationId, inviterUserId) {
  const { invitation, token } = await Invitation.regenerateToken(invitationId);
  const type = invitation.type || 'account';
  await sendInvitationEmailForInvitation({ invitation, token, inviterUserId, type });
  await Invitation.markEmailSent(invitation.id);
  return { invitation, token };
}

/**
 * Send emails for pending invitations that have never been emailed.
 * Partial success allowed. Only property/account invites with status=pending
 * and email_sent_at IS NULL are eligible.
 *
 * @param {{ invitationIds: string[], actorUserId: number, actorRole: string, accountId?: number }} opts
 */
async function sendPendingInvitations({ invitationIds, actorUserId, actorRole, accountId }) {
  if (!Array.isArray(invitationIds) || invitationIds.length === 0) {
    throw new BadRequestError("invitationIds must be a non-empty array");
  }
  const uniqueIds = [...new Set(invitationIds.map((id) => String(id).trim()).filter(Boolean))];
  if (uniqueIds.length === 0) {
    throw new BadRequestError("invitationIds must be a non-empty array");
  }

  const isPlatformAdmin = actorRole === "admin" || actorRole === "super_admin";
  if (!isPlatformAdmin) {
    throw new ForbiddenError("Only platform admins can send pending invitations in bulk");
  }

  const sent = [];
  const failed = [];

  for (const id of uniqueIds) {
    try {
      const invitation = await Invitation.get(id);
      if (invitation.status !== "pending") {
        failed.push({ id, error: "Invitation is no longer pending" });
        continue;
      }
      if (invitation.emailSentAt) {
        failed.push({ id, error: "Invitation email was already sent" });
        continue;
      }
      if (accountId != null && Number(invitation.accountId) !== Number(accountId)) {
        failed.push({ id, error: "Invitation does not belong to this account" });
        continue;
      }
      if (new Date(invitation.expiresAt) <= new Date()) {
        failed.push({ id, error: "Invitation has expired" });
        continue;
      }

      const { invitation: refreshed, token } = await Invitation.regenerateToken(id);
      const type = refreshed.type || "account";
      await sendInvitationEmailForInvitation({
        invitation: refreshed,
        token,
        inviterUserId: actorUserId,
        type,
      });
      await Invitation.markEmailSent(refreshed.id);
      sent.push({ id: refreshed.id, inviteeEmail: refreshed.inviteeEmail });
    } catch (err) {
      failed.push({ id, error: err.message || "Failed to send invitation" });
    }
  }

  return { sent, failed };
}

module.exports = {
  createPropertyInvitation,
  createBulkPropertyInvitations,
  createAccountInvitation,
  sendAccountInvitationEmailInBackground,
  acceptInvitation,
  acceptInvitationForLoggedInUser,
  resendInvitation,
  sendPendingInvitations,
  resolvePropertyInvitationInviteUrl,
};
