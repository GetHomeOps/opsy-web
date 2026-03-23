"use strict";

/**
 * Email verification for local (password) sign-up. Strict mode: no JWT until verified.
 */

const crypto = require("crypto");
const db = require("../db");
const User = require("../models/user");
const { BadRequestError, UnauthorizedError } = require("../expressError");
const { sendEmailVerificationEmail } = require("./emailService");

const TOKEN_EXPIRY_HOURS = 48;

function generateVerificationToken() {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, tokenHash };
}

/**
 * Create a new verification token for user, invalidate previous unused tokens, send email.
 */
async function createAndSendVerificationEmail(userId) {
  const user = await User.getById(userId);
  if (!user) {
    throw new BadRequestError("User not found");
  }
  if (user.emailVerified === true) {
    return { alreadyVerified: true };
  }

  const { token, tokenHash } = generateVerificationToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + TOKEN_EXPIRY_HOURS);

  await db.query(`DELETE FROM email_verification_tokens WHERE user_id = $1 AND used_at IS NULL`, [userId]);

  await db.query(
    `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );

  const { APP_WEB_ORIGIN, APP_BASE_URL } = require("../config");
  const baseUrl = (APP_BASE_URL || APP_WEB_ORIGIN || "http://localhost:5173").replace(/\/$/, "");
  const verifyUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`;

  let verificationUsage;
  try {
    const acctRes = await db.query(
      `SELECT account_id FROM account_users WHERE user_id = $1 ORDER BY id ASC LIMIT 1`,
      [userId]
    );
    const aid = acctRes.rows[0]?.account_id;
    if (aid) {
      verificationUsage = { accountId: aid, userId, emailType: "email_verification" };
    }
  } catch (_) {
    // omit usage if lookup fails
  }

  try {
    await sendEmailVerificationEmail({
      to: user.email,
      verifyUrl,
      userName: user.name,
      usage: verificationUsage,
    });
  } catch (err) {
    console.error("[emailVerificationService] Failed to send email:", err.message);
    if (process.env.NODE_ENV !== "production") {
      console.log("\n--- Email verification link (dev, email may not be sent) ---");
      console.log(verifyUrl);
      console.log("---\n");
    }
    throw err;
  }

  return { alreadyVerified: false };
}

/**
 * Mark email verified, consume token. Returns user row for token issuance.
 */
async function verifyEmailWithToken(rawToken) {
  if (!rawToken || typeof rawToken !== "string" || !rawToken.trim()) {
    throw new BadRequestError("Verification token is required");
  }

  const tokenHash = crypto.createHash("sha256").update(rawToken.trim()).digest("hex");

  const result = await db.query(
    `SELECT evt.id, evt.user_id, evt.expires_at, evt.used_at
     FROM email_verification_tokens evt
     WHERE evt.token_hash = $1`,
    [tokenHash]
  );

  const row = result.rows[0];
  if (!row) {
    throw new UnauthorizedError("Invalid or expired verification link. Please request a new one from the sign-in page.");
  }

  if (row.used_at) {
    throw new UnauthorizedError("This verification link has already been used. You can sign in if your account is active.");
  }

  if (new Date(row.expires_at) <= new Date()) {
    throw new UnauthorizedError("This verification link has expired. Please request a new one from the sign-in page.");
  }

  await db.query("BEGIN");
  try {
    await db.query(
      `UPDATE users SET email_verified = true, updated_at = NOW() WHERE id = $1`,
      [row.user_id]
    );
    await db.query(
      `UPDATE email_verification_tokens SET used_at = NOW() WHERE id = $1`,
      [row.id]
    );
    await db.query("COMMIT");
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  }

  const user = await User.getById(row.user_id);
  if (!user) {
    throw new BadRequestError("User not found");
  }

  return user;
}

/**
 * Resend verification email. Same response whether or not user exists (anti-enumeration).
 */
async function requestResendVerification(email) {
  const emailLower = (email || "").trim().toLowerCase();
  if (!emailLower) {
    throw new BadRequestError("Email is required");
  }

  const user = await User.findByEmailOrNull(emailLower);
  if (!user || user.emailVerified === true || user.authProvider === "google") {
    return {
      success: true,
      message: "If that account exists and still needs verification, you will receive an email shortly.",
    };
  }

  try {
    await createAndSendVerificationEmail(user.id);
  } catch (err) {
    console.error("[emailVerificationService] resend:", err.message);
  }

  return {
    success: true,
    message: "If that account exists and still needs verification, you will receive an email shortly.",
  };
}

module.exports = {
  createAndSendVerificationEmail,
  verifyEmailWithToken,
  requestResendVerification,
};
