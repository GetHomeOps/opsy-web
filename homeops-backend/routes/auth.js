"use strict";

/**
 * Auth Routes
 *
 * Handles authentication and account lifecycle endpoints.
 *
 * Endpoints:
 * - POST /token: Authenticate with email/password, returns access + refresh tokens
 * - POST /register: Create user, account, contact, and default subscription
 * - POST /refresh: Exchange a valid refresh token for a new access + refresh pair
 * - POST /logout: Revoke a refresh token
 * - POST /change-password: Update password (requires current password)
 * - POST /confirm: Accept invitation token and activate account with password
 * - GET /google/signin, /google/signup: Start Google OAuth flow
 * - GET /google/callback/signin, /google/callback/signup: Google OAuth callbacks
 */

const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const jsonschema = require("jsonschema");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const express = require("express");
const router = new express.Router();
const { createAccessToken, createRefreshToken, getRefreshTokenExpiresAt } = require("../helpers/tokens");
const { createMfaTicket, verifyMfaTicket } = require("../helpers/mfaTicket");
const { buildAuthUrl, exchangeCodeForTokens, verifyIdToken } = require("../helpers/googleOAuth");
const { ensureLoggedIn } = require("../middleware/auth");
const {
  SECRET_KEY,
  GOOGLE_CLIENT_ID,
  GOOGLE_REDIRECT_URI_SIGNIN,
  GOOGLE_REDIRECT_URI_SIGNUP,
  AUTH_SUCCESS_REDIRECT,
} = require("../config");
const userAuthSchema = require("../schemas/userAuth.json");
const userRegisterSchema = require("../schemas/userRegister.json");
const { BadRequestError, UnauthorizedError, ForbiddenError } = require("../expressError");
const { acceptInvitation } = require("../services/invitationService");
const { requestPasswordReset, resetPasswordWithToken } = require("../services/passwordResetService");
const { onUserCreated } = require("../services/resourceAutoSend");
const stripeService = require("../services/stripeService");
const Account = require("../models/account");
const Contact = require("../models/contact");
const Subscription = require("../models/subscription");
const PlatformEngagement = require("../models/platformEngagement");
const RefreshToken = require("../models/refreshToken");
const db = require("../db");

const OAUTH_STATE_COOKIE = "oauth_state";
const OAUTH_STATE_MAX_AGE = 10 * 60; // 10 minutes

async function issueTokenPair(user) {
  const accessToken = createAccessToken(user);
  const refreshToken = createRefreshToken(user);

  const tokenHash = RefreshToken.hash(refreshToken);
  const expiresAt = getRefreshTokenExpiresAt();
  await RefreshToken.store({ userId: user.id, tokenHash, expiresAt });

  return { accessToken, refreshToken };
}

router.post("/token", async function (req, res, next) {
  const body = req.body || {};
  const validator = jsonschema.validate(body, userAuthSchema, { required: true });
  if (!validator.valid) {
    const errs = validator.errors.map(e => e.stack);
    throw new BadRequestError(errs);
  }
  try {
    const { email, password } = body;
    const user = await User.authenticate(email, password);

    // Allow active users or pending signups (incomplete onboarding) so they can complete it
    const canProceed = user && (user.isActive || user.onboardingCompleted === false);
    if (!canProceed) {
      throw new UnauthorizedError("User account is inactive or not found");
    }

    if (user.mfaEnabled) {
      const mfaTicket = createMfaTicket(user.id, user.email);
      return res.json({ mfaRequired: true, mfaTicket, mfaPendingToken: mfaTicket });
    }

    const tokens = await issueTokenPair(user);

    try {
      await PlatformEngagement.logEvent({ userId: user.id, eventType: "login", eventData: {} });
    } catch (logErr) { /* don't block login */ }

    return res.json(tokens);
  } catch (err) {
    return next(err);
  }
});

/** GET /auth/check-email?email=... - Check if a user exists for signup flow.
 * Returns { exists: boolean }. Used to redirect existing users to sign in. */
router.get("/check-email", async function (req, res, next) {
  const email = (req.query.email || "").trim();
  if (!email) {
    return res.json({ exists: false });
  }
  try {
    const user = await User.findByEmailOrNull(email);
    return res.json({ exists: !!user });
  } catch (err) {
    return next(err);
  }
});

router.post("/register", async function (req, res, next) {
  const userData = req.body.userData || req.body;
  if (!userData || typeof userData !== "object") {
    throw new BadRequestError("User data (name, email, password) is required");
  }
  const validator = jsonschema.validate(userData, userRegisterSchema, { required: true });
  if (!validator.valid) {
    const errs = validator.errors.map(e => e.stack);
    throw new BadRequestError(errs);
  }
  const normalized = {
    name: (userData.name || "").trim(),
    email: (userData.email || "").trim(),
    password: userData.password,
    phone: userData.phone || null,
    role: "homeowner",
    is_active: false,
    onboarding_completed: false,
  };

  await db.query("BEGIN");
  try {
    const newUser = await User.register(normalized);
    const account = await Account.linkNewUserToAccount({
      name: newUser.name,
      userId: newUser.id,
    });

    const contact = await Contact.create({
      name: newUser.name,
      email: newUser.email,
      phone: newUser.phone || null,
    });
    await Contact.addToAccount({ contactId: contact.id, accountId: account.id });
    await User.update({ id: newUser.id, contact: contact.id });

    await db.query("COMMIT");

    try {
      await onUserCreated({ userId: newUser.id, role: "homeowner" });
    } catch (autoErr) {
      console.error("[resourceAutoSend] register:", autoErr.message);
    }

    const tokens = await issueTokenPair(newUser);
    return res.status(201).json(tokens);
  } catch (err) {
    await db.query("ROLLBACK");
    return next(err);
  }
});

router.post("/refresh", async function (req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new BadRequestError("Refresh token is required");

    let payload;
    try {
      payload = jwt.verify(refreshToken, SECRET_KEY);
    } catch (err) {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }

    if (payload.type !== "refresh") {
      throw new UnauthorizedError("Invalid token type");
    }

    const tokenHash = RefreshToken.hash(refreshToken);
    const stored = await RefreshToken.findByHash(tokenHash);
    if (!stored) {
      throw new UnauthorizedError("Refresh token has been revoked or is invalid");
    }

    await RefreshToken.deleteByHash(tokenHash);

    const user = await User.getById(payload.id);
    // Allow active users or pending signups (incomplete onboarding) so they can complete it
    const canProceed = user && (user.isActive || user.onboardingCompleted === false);
    if (!canProceed) {
      throw new UnauthorizedError("User account is inactive or not found");
    }

    const tokens = await issueTokenPair(user);

    RefreshToken.cleanupExpired().catch(() => {});

    return res.json(tokens);
  } catch (err) {
    return next(err);
  }
});

router.post("/logout", async function (req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const tokenHash = RefreshToken.hash(refreshToken);
      await RefreshToken.deleteByHash(tokenHash);
    }
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

router.post("/change-password", ensureLoggedIn, async function (req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = res.locals.user?.id;
    if (!userId) throw new BadRequestError("User authentication required");
    if (!currentPassword || !newPassword) {
      throw new BadRequestError("Current password and new password are required");
    }
    if (newPassword.length < 4) {
      throw new BadRequestError("New password must be at least 4 characters");
    }
    await User.changePassword(userId, currentPassword, newPassword);
    return res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    return next(err);
  }
});

const mfaVerifyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Too many MFA attempts. Please try again later.", status: 429 } },
});

router.post("/mfa/verify", mfaVerifyLimiter, async function (req, res, next) {
  try {
    const authHeader = req.headers?.authorization;
    const bearerToken = authHeader?.replace(/^[Bb]earer /, "").trim();
    const { mfaTicket, codeOrBackupCode, tokenOrBackupCode } = req.body;
    const ticket = bearerToken || mfaTicket;
    const code = String(codeOrBackupCode || tokenOrBackupCode || "").trim();

    if (!ticket || !code) {
      throw new BadRequestError("MFA ticket and code are required");
    }

    let userId;
    try {
      const payload = verifyMfaTicket(ticket);
      userId = payload.id;
    } catch (err) {
      throw new UnauthorizedError("Invalid or expired MFA session. Please sign in again.");
    }

    const user = await User.getById(userId);
    // Allow active users or pending signups (incomplete onboarding) so they can complete it
    const canProceed = user && (user.isActive || user.onboardingCompleted === false);
    if (!canProceed) {
      throw new UnauthorizedError("User not found or inactive");
    }

    const MfaBackupCode = require("../models/mfaBackupCode");
    const speakeasy = require("speakeasy");

    const secret = await User.getMfaSecret(userId);
    if (!secret) throw new UnauthorizedError("Invalid code");

    let valid = false;

    if (code.length === 6 && /^\d+$/.test(code)) {
      valid = speakeasy.totp.verify({
        secret,
        encoding: "base32",
        token: code,
        window: 1,
      });
    }
    if (!valid) {
      valid = await MfaBackupCode.verifyAndConsume(userId, code);
    }

    if (!valid) {
      try {
        await PlatformEngagement.logEvent({ userId, eventType: "mfa_failure", eventData: {} });
      } catch (logErr) { /* don't block */ }
      throw new UnauthorizedError("Invalid code");
    }

    try {
      await PlatformEngagement.logEvent({ userId: user.id, eventType: "mfa_success", eventData: {} });
    } catch (logErr) { /* don't block */ }

    const tokens = await issueTokenPair(user);

    try {
      await PlatformEngagement.logEvent({ userId: user.id, eventType: "login", eventData: {} });
    } catch (logErr) { /* don't block login */ }

    return res.json(tokens);
  } catch (err) {
    return next(err);
  }
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Too many reset requests. Please try again later.", status: 429 } },
});

router.post("/forgot-password", forgotPasswordLimiter, async function (req, res, next) {
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      throw new BadRequestError("Email is required");
    }
    const result = await requestPasswordReset(email);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

router.post("/reset-password", async function (req, res, next) {
  try {
    const { token, newPassword } = req.body;
    const result = await resetPasswordWithToken(token, newPassword);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

router.post("/confirm", async function (req, res, next) {
  try {
    const { token, password, name } = req.body;
    if (!token || !password) {
      throw new BadRequestError("Token and password are required");
    }
    const result = await acceptInvitation({ rawToken: token, password, name });
    return res.json({
      success: true,
      message: "Account activated successfully",
    });
  } catch (err) {
    return next(err);
  }
});

/** GET /auth/bootstrap - Return authenticated user and their accounts in one response.
 * Used by OAuth callback to reduce round trips before redirecting into app routes. */
router.get("/bootstrap", ensureLoggedIn, async function (req, res, next) {
  try {
    const userId = res.locals.user?.id;
    if (!userId) {
      throw new BadRequestError("User authentication required");
    }

    const user = await User.getById(userId);
    let accounts = [];
    try {
      accounts = await Account.getUserAccounts(userId);
    } catch (err) {
      const message = err?.message || "";
      if (!message.includes("No accounts found")) {
        throw err;
      }
    }

    return res.json({ user: { ...user, accounts } });
  } catch (err) {
    return next(err);
  }
});

/* ----- Google OAuth ----- */

function redirectWithError(code) {
  const origin = process.env.APP_WEB_ORIGIN || "http://localhost:5173";
  const base = (AUTH_SUCCESS_REDIRECT || `${origin}/auth/callback`).replace(/\/$/, "");
  // BrowserRouter: /auth/callback?error=...
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}error=${encodeURIComponent(code)}`;
}

function redirectWithToken(accessToken, refreshToken) {
  const origin = process.env.APP_WEB_ORIGIN || "http://localhost:5173";
  const base = AUTH_SUCCESS_REDIRECT || `${origin}/auth/callback`;
  const params = new URLSearchParams({ token: accessToken, provider: "google" });
  if (refreshToken) params.set("refreshToken", refreshToken);
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}${params.toString()}`;
}

router.get("/google/signin", function (req, res, next) {
  if (!GOOGLE_CLIENT_ID) {
    return res.status(503).json({ error: { message: "Google sign-in is not configured" } });
  }
  try {
    const state = crypto.randomBytes(24).toString("hex");
    res.cookie(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: OAUTH_STATE_MAX_AGE * 1000,
      path: "/",
    });
    const url = buildAuthUrl({ redirectUri: GOOGLE_REDIRECT_URI_SIGNIN, state });
    return res.redirect(url);
  } catch (err) {
    console.error("Google signin start error:", err.message);
    return next(err);
  }
});

router.get("/google/signup", function (req, res, next) {
  if (!GOOGLE_CLIENT_ID) {
    return res.status(503).json({ error: { message: "Google sign-up is not configured" } });
  }
  try {
    const state = crypto.randomBytes(24).toString("hex");
    res.cookie(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: OAUTH_STATE_MAX_AGE * 1000,
      path: "/",
    });
    const url = buildAuthUrl({ redirectUri: GOOGLE_REDIRECT_URI_SIGNUP, state });
    return res.redirect(url);
  } catch (err) {
    console.error("Google signup start error:", err.message);
    return next(err);
  }
});

async function handleGoogleCallback(req, res, next, intent) {
  const redirectUri = intent === "signin" ? GOOGLE_REDIRECT_URI_SIGNIN : GOOGLE_REDIRECT_URI_SIGNUP;
  const { code, state } = req.query;

  if (!code || !state) {
    return res.redirect(redirectWithError("missing_params"));
  }

  const storedState = req.cookies?.[OAUTH_STATE_COOKIE];
  res.clearCookie(OAUTH_STATE_COOKIE, { path: "/" });
  if (!storedState || storedState !== state) {
    return res.redirect(redirectWithError("invalid_state"));
  }

  try {
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    const claims = await verifyIdToken(tokens.id_token);

    const { sub, email, email_verified, name, picture } = claims;
    if (!email) {
      return res.redirect(redirectWithError("no_email"));
    }

    const [userBySub, userByEmail] = await Promise.all([
      User.findByGoogleSub(sub),
      User.findByEmailOrNull(email),
    ]);
    let user = userBySub;

    if (intent === "signup") {
      const existing = user || userByEmail;
      if (existing) {
        // Resumable: if onboarding incomplete, let them continue instead of blocking
        if (existing.onboardingCompleted === false) {
          if (user) {
            // Same Google account — use as resume
          } else if (userByEmail && !userByEmail.googleSub) {
            user = await User.linkGoogle(userByEmail.id, sub);
          } else {
            return res.redirect(redirectWithError("account_exists"));
          }
        } else {
          return res.redirect(redirectWithError("account_exists"));
        }
      }
      if (!user) {
        await db.query("BEGIN");
        try {
          const newUser = await User.registerGoogle({
            email,
            name,
            avatarUrl: picture,
            emailVerified: email_verified,
            googleSub: sub,
          });
          const account = await Account.linkNewUserToAccount({
            name: newUser.name,
            userId: newUser.id,
          });
          const contact = await Contact.create({
            name: newUser.name,
            email: newUser.email,
            phone: null,
          });
          await Contact.addToAccount({ contactId: contact.id, accountId: account.id });
          await User.update({ id: newUser.id, contact: contact.id });
          await db.query("COMMIT");
          user = { ...newUser, contact: contact.id };
          onUserCreated({ userId: user.id, role: user.role || null })
            .catch((autoErr) => console.error("[resourceAutoSend] Google signup:", autoErr.message));
        } catch (err) {
          await db.query("ROLLBACK");
          throw err;
        }
      }
    } else {
      if (user) {
        // Sign in OK — user already set from findByGoogleSub
      } else if (userByEmail && !userByEmail.googleSub) {
        user = await User.linkGoogle(userByEmail.id, sub);
      } else {
        return res.redirect(redirectWithError("no_account"));
      }
    }
    // Allow active users or pending signups (incomplete onboarding) so they can complete it
    const canProceed = user && (user.isActive || user.onboardingCompleted === false);
    if (!canProceed) {
      return res.redirect(redirectWithError("inactive"));
    }

    const { accessToken, refreshToken } = await issueTokenPair(user);
    PlatformEngagement.logEvent({ userId: user.id, eventType: "login", eventData: { provider: "google" } })
      .catch(() => {});

    return res.redirect(redirectWithToken(accessToken, refreshToken));
  } catch (err) {
    console.error("Google callback error:", err.message);
    return res.redirect(redirectWithError("oauth_failed"));
  }
}

router.get("/google/callback/signin", function (req, res, next) {
  return handleGoogleCallback(req, res, next, "signin");
});

router.get("/google/callback/signup", function (req, res, next) {
  return handleGoogleCallback(req, res, next, "signup");
});

/** POST /auth/complete-onboarding - Complete onboarding.
 * Requires auth. Updates user with role and subscriptionTier, sets onboardingCompleted = true.
 * For paid tiers, requires stripeSessionId and verifies payment with Stripe before activating. */
router.post("/complete-onboarding", ensureLoggedIn, async function (req, res, next) {
  try {
    const userId = res.locals.user?.id;
    if (!userId) throw new BadRequestError("User authentication required");

    const { role, subscriptionTier, stripeSessionId } = req.body;
    if (!role || !["homeowner", "agent"].includes(role)) {
      throw new BadRequestError("Valid role (homeowner or agent) is required");
    }
    const HOMEOWNER_TIERS = ["free", "maintain", "win"];
    const AGENT_TIERS = ["basic", "pro", "premium"];
    const validTiersForRole = role === "agent" ? AGENT_TIERS : HOMEOWNER_TIERS;
    if (!subscriptionTier || !validTiersForRole.includes(subscriptionTier)) {
      throw new BadRequestError(`Invalid subscriptionTier "${subscriptionTier}" for role "${role}"`);
    }

    const FREE_TIERS = ["free"];
    const isPaidTier = !FREE_TIERS.includes(subscriptionTier);

    // For paid tiers, verify the Stripe checkout session actually completed with payment
    if (isPaidTier) {
      if (!stripeSessionId) {
        throw new ForbiddenError("Payment verification required for paid plans");
      }
      const verification = await stripeService.verifyCheckoutSession(stripeSessionId, { userId });
      if (!verification.valid) {
        console.warn(`[complete-onboarding] Stripe session verification failed for user ${userId}: ${verification.reason}`);
        throw new ForbiddenError("Payment could not be verified. Please complete checkout or contact support.");
      }
    }

    const existingUser = await User.getById(userId);
    const hadNoRole = !existingUser?.role;
    const user = await User.completeOnboarding(userId, { role, subscriptionTier });

    if (hadNoRole) {
      try {
        await onUserCreated({ userId, role });
      } catch (autoErr) {
        console.error("[resourceAutoSend] complete-onboarding:", autoErr.message);
      }
    }

    // Create/ensure default subscription for FREE tier (idempotent); paid tiers get subscription from Stripe webhook
    const SKIP_SUBSCRIPTION_ROLES = ["super_admin", "admin"];
    const accountResult = await db.query(
      `SELECT account_id FROM account_users WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    const userRole = existingUser?.role || role;
    if (accountResult.rows[0] && !isPaidTier && !SKIP_SUBSCRIPTION_ROLES.includes(userRole)) {
      try {
        await Subscription.ensureDefaultForAccount(accountResult.rows[0].account_id, role);
      } catch (subErr) {
        console.error("Warning: failed to create subscription after onboarding", subErr.message);
      }
    }

    return res.json({ user, success: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
