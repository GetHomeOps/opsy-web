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
const { sendInvitationEmail } = require("./emailService");
const { APP_BASE_URL } = require("../config");
const { canAddContact } = require("./tierService");

const VALID_ACCOUNT_ROLES = new Set(["owner", "admin", "member", "view_only"]);

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

async function createPropertyInvitation({
  inviterUserId,
  inviteeEmail,
  inviteeName,
  accountId,
  propertyId,
  intendedRole,
  inviterUserRole,
}) {
  const emailLower = (inviteeEmail || "").trim().toLowerCase();
  if (!emailLower) throw new BadRequestError("inviteeEmail is required");
  const trimmedInviteeName = (inviteeName || "").trim();

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

  // Auto-create contact in My Contacts if invitee email doesn't exist
  const existingContact = await db.query(
    `SELECT c.id FROM contacts c
     JOIN account_contacts ac ON ac.contact_id = c.id
     WHERE LOWER(TRIM(c.email)) = $1 AND ac.account_id = $2
     LIMIT 1`,
    [emailLower, accountId]
  );
  if (existingContact.rows.length === 0) {
    const tierCheck = await canAddContact(accountId, inviterUserRole);
    if (tierCheck.allowed) {
      try {
        const localPart = (inviteeEmail || "").trim().split("@")[0];
        const contactName =
          trimmedInviteeName || localPart || (inviteeEmail || "").trim();
        const contact = await Contact.create({
          name: contactName,
          email: inviteeEmail.trim(),
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
  }

  const { token, tokenHash } = generateInvitationToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 48);

  const invitation = await Invitation.create({
    type: 'property',
    inviterUserId,
    inviteeEmail,
    accountId,
    propertyId,
    intendedRole: intendedRole || 'editor',
    tokenHash,
    expiresAt,
  });

  // If invitee is an existing user, create in-app notification for bell icon
  const existingUser = await db.query(
    `SELECT id FROM users WHERE LOWER(TRIM(email)) = $1 AND is_active = true`,
    [emailLower]
  );
  const inviteeUserId = existingUser.rows[0]?.id ?? null;
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

  try {
    await sendInvitationEmailForInvitation({
      invitation,
      token,
      inviterUserId,
      type: "property",
      inviteeUserId,
    });
  } catch (err) {
    console.error("[invitationService] Failed to send invitation email:", err.message);
  }

  return { invitation, token };
}

async function createAccountInvitation({ inviterUserId, inviteeEmail, accountId, intendedRole }) {
  const { token, tokenHash } = generateInvitationToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 48);

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

  try {
    await sendInvitationEmailForInvitation({ invitation, token, inviterUserId, type: "account" });
  } catch (err) {
    console.error("[invitationService] Failed to send invitation email:", err.message);
  }

  return { invitation, token };
}

/** Build invite URL and send email. Used after create and resend. */
async function sendInvitationEmailForInvitation({ invitation, token, inviterUserId, type, inviteeUserId }) {
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

  let inviteUrl;
  if (hasExistingAccount && propertyUid) {
    inviteUrl = `${baseUrl}/${accountUrl}/properties/${propertyUid}?invitation=${encodeURIComponent(String(invitation.id))}`;
  } else if (hasExistingAccount) {
    const q = new URLSearchParams();
    q.set("email", invitation.inviteeEmail.trim());
    const linked = await Account.isUserLinkedToAccount(resolvedInviteeUserId, invitation.accountId);
    if (linked) {
      q.set("returnTo", `/${accountUrl}/invitations`);
    }
    inviteUrl = `${baseUrl}/signin?${q.toString()}`;
  } else {
    inviteUrl = `${baseUrl}/${accountUrl}/invite/confirm?token=${encodeURIComponent(token)}&email=${encodeURIComponent(invitation.inviteeEmail)}`;
  }

  let inviterName = null;
  if (inviterUserId) {
    const inviter = await db.query(`SELECT name FROM users WHERE id = $1`, [inviterUserId]);
    inviterName = inviter.rows[0]?.name || null;
  }
  const emailType = type === "property" ? "invitation_property" : "invitation_account";
  await sendInvitationEmail({
    to: invitation.inviteeEmail,
    inviteUrl,
    inviterName,
    inviteeName: null,
    type,
    propertyAddress,
    inviteeHasAccount: hasExistingAccount,
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
          await db.query(
            `UPDATE users SET password_hash = $1, is_active = true WHERE id = $2`,
            [hashedPassword, user.id]
          );
        }

        const hasAccount = await User.userHasAccount(user.id);
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
      const newUser = await User.register({
        name,
        email: invitation.inviteeEmail,
        password,
        role: 'homeowner',
        is_active: true,
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

    if (accepted.type === 'property' && accepted.propertyId) {
      await Property.addUserToProperty({
        property_id: accepted.propertyId,
        user_id: user.id,
        role: accepted.intendedRole || 'editor',
      });
    }

    if (accepted.accountId) {
      const isLinked = await Account.isUserLinkedToAccount(user.id, accepted.accountId);
      if (!isLinked) {
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

    if (accepted.type === "property") {
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
        accepted.propertyId
      ) {
        try {
          const propRes = await db.query(
            `SELECT address FROM properties WHERE id = $1`,
            [accepted.propertyId]
          );
          const address = propRes.rows[0]?.address;
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
  return { invitation, token };
}

module.exports = {
  createPropertyInvitation,
  createAccountInvitation,
  acceptInvitation,
  acceptInvitationForLoggedInUser,
  resendInvitation,
};
