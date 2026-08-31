"use strict";

/**
 * Invitation Tokens Helper
 *
 * Generates secure invitation tokens. Returns raw token (for email) and
 * SHA-256 hash (for database storage). Used by invitation service.
 *
 * Exports: generateInvitationToken, INVITATION_EXPIRY_HOURS, invitationExpiresAt
 */

const crypto = require("crypto");

/** Hours until invitation links stop working (creation, resend, and acceptance). */
const INVITATION_EXPIRY_HOURS = 168;

function generateInvitationToken() {
  const token = crypto.randomBytes(32).toString("hex");

  const tokenHash = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  return { token, tokenHash };
}

/** Expiry timestamp `hours` (default 168) after `from`. */
function invitationExpiresAt(from = new Date(), hours = INVITATION_EXPIRY_HOURS) {
  const expiresAt = new Date(from);
  expiresAt.setHours(expiresAt.getHours() + hours);
  return expiresAt;
}

module.exports = {
  generateInvitationToken,
  INVITATION_EXPIRY_HOURS,
  invitationExpiresAt,
};
