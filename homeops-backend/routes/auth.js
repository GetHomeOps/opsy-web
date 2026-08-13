"use strict";

/**
 * Auth Routes
 *
 * Handles authentication and account lifecycle endpoints.
 *
 * Endpoints:
 * - POST /token: Authenticate with email/password, returns access + refresh tokens
 * - POST /register: Create user, account, contact (no JWT; sends verification email)
 * - POST /verify-email: Confirm email token, returns access + refresh tokens
 * - POST /resend-verification: Resend verification email (rate limited)
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
const {
  createAccessToken,
  createRefreshToken,
  getRefreshTokenExpiresAt,
  impersonatorFromPayload,
} = require("../helpers/tokens");
const { createMfaTicket, verifyMfaTicket } = require("../helpers/mfaTicket");
const { buildAuthUrl, exchangeCodeForTokens, verifyIdToken } = require("../helpers/googleOAuth");
const { ensureLoggedIn, ensurePlatformAdmin, ensureNotImpersonating } = require("../middleware/auth");
const {
  SECRET_KEY,
  GOOGLE_CLIENT_ID,
  GOOGLE_REDIRECT_URI_SIGNIN,
  GOOGLE_REDIRECT_URI_SIGNUP,
  AUTH_SUCCESS_REDIRECT,
  BILLING_MOCK_MODE,
} = require("../config");
const userAuthSchema = require("../schemas/userAuth.json");
const userRegisterSchema = require("../schemas/userRegister.json");
const { BadRequestError, UnauthorizedError, ForbiddenError } = require("../expressError");
const { acceptInvitation } = require("../services/invitationService");
const { syncGoogleAvatar } = require("../services/avatarService");
const { addUserAvatarUrlToItem } = require("../helpers/presignedUrls");
const { requestPasswordReset, resetPasswordWithToken } = require("../services/passwordResetService");
const {
  createAndSendVerificationEmail,
  verifyEmailWithToken,
  requestResendVerification,
} = require("../services/emailVerificationService");
const { onUserCreated } = require("../services/resourceAutoSend");
const commAutoSend = require("../services/commAutoSend");
const { trySendWelcomeEmailForUser } = require("../services/emailService");
const { notifyNewUserAccount } = require("../services/opsTeamNotifyService");
const { notifyPlanSelected } = require("../services/planSelectedNotifyService");
const stripeService = require("../services/stripeService");
const Account = require("../models/account");
const Contact = require("../models/contact");
const Subscription = require("../models/subscription");
const PlatformEngagement = require("../models/platformEngagement");
const RefreshToken = require("../models/refreshToken");
const ImpersonationAudit = require("../models/impersonationAudit");
const customerIoProvider = require("../services/emailProviders/customerIoProvider");
const customerIoLifecycleService = require("../services/customerIoLifecycleService");
const db = require("../db");
const {
  assertPublicSignupAllowed,
  isDemoEnvironment,
  assertDemoAccountAccessAllowed,
} = require("../helpers/demoEnvironment");
const { recordDemoFirstLogin } = require("../helpers/demoFirstLogin");

function getClientMeta(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const ipAddress =
    (typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : null) ||
    req.ip ||
    null;
  return {
    ipAddress,
    userAgent: req.headers["user-agent"] || null,
  };
}

const OAUTH_STATE_MAX_AGE = 10 * 60; // 10 minutes

/** Catalog / Stripe success URL may send plan `code`; DB stores short tier slug. */
const PLAN_CODE_TO_SUBSCRIPTION_TIER = {
  homeowner_free: "free",
  homeowner_maintain: "maintain",
  homeowner_growth: "growth",
  homeowner_win: "win",
  homeowner_beta: "homeowner_beta",
  /** @deprecated Legacy alias; normalize to homeowner_beta */
  beta_homeowner: "homeowner_beta",
  agent_free: "free",
  agent_beta: "agent_beta",
  agent_basic: "basic",
  agent_pro: "pro",
  agent_growth: "growth",
  agent_premium: "premium",
  agent_enterprise: "enterprise",
};
const SUBSCRIPTION_TIER_TO_DEFAULT_PLAN_CODE = Object.entries(
  PLAN_CODE_TO_SUBSCRIPTION_TIER
).reduce((acc, [planCode, tier]) => {
  if (!acc[tier]) acc[tier] = planCode;
  return acc;
}, {});

/** Resolve whether a plan is effectively free for the selected interval. */
async function isPlanCodeZeroCost(planCode, billingInterval = "month") {
  if (!planCode) return false;
  const normalizedInterval = billingInterval === "year" ? "year" : "month";
  const result = await db.query(
    `SELECT sp.price::numeric AS "basePrice",
            pp.unit_amount AS "unitAmount"
     FROM subscription_products sp
     LEFT JOIN plan_prices pp
       ON pp.subscription_product_id = sp.id
      AND pp.billing_interval = $2
     WHERE sp.code = $1
       AND (sp.is_active IS NULL OR sp.is_active = true)
     LIMIT 1`,
    [planCode, normalizedInterval]
  );
  const row = result.rows[0];
  if (!row) return false;

  if (typeof row.unitAmount === "number") {
    return row.unitAmount <= 0;
  }
  const basePrice = Number(row.basePrice);
  return Number.isFinite(basePrice) && basePrice <= 0;
}

/** Strict auth: JWT only when email is verified and user may use the app (active or onboarding). */
function userMayReceiveAuthTokens(user) {
  const verified = user?.emailVerified === true || user?.role === "super_admin";
  if (!user || !verified) return false;
  if (!(user.isActive || user.onboardingCompleted === false)) return false;
  return true;
}

/** Sync login to Customer.io for journey exit and engagement segments. */
function syncCustomerIoLogin(user, source = "password") {
  if (!user?.email) return;
  customerIoProvider
    .trackUserLoggedIn({
      userEmail: user.email,
      userName: user.name,
      userId: user.id,
      source,
    })
    .catch((err) =>
      console.error("[customerIo] trackUserLoggedIn:", err.message)
    );
  customerIoLifecycleService
    .syncCustomerIoUserPropertyState({
      userId: user.id,
      userEmail: user.email,
      fireExitEvent: false,
    })
    .catch((err) =>
      console.error("[customerIo] sync property state login:", err.message)
    );
}

async function issueTokenPair(user, impersonator = null) {
  const accessToken = createAccessToken(user, impersonator);
  const refreshToken = createRefreshToken(user, impersonator);

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

    const canProceed = userMayReceiveAuthTokens(user);
    if (!canProceed) {
      throw new UnauthorizedError("User account is inactive or not found");
    }

    const fullUser = await User.getById(user.id);
    assertDemoAccountAccessAllowed(fullUser);

    if (user.mfaEnabled) {
      const mfaTicket = createMfaTicket(user.id, user.email);
      return res.json({ mfaRequired: true, mfaTicket, mfaPendingToken: mfaTicket });
    }

    const tokens = await issueTokenPair(user);

    try {
      await PlatformEngagement.logEvent({ userId: user.id, eventType: "login", eventData: {} });
    } catch (logErr) { /* don't block login */ }
    await recordDemoFirstLogin(user.id);
    syncCustomerIoLogin(user, "password");

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
  assertPublicSignupAllowed();
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
    try {
      await commAutoSend.onUserCreated({
        userId: newUser.id,
        role: "homeowner",
        accountId: account.id,
      });
    } catch (commErr) {
      console.error("[commAutoSend] register:", commErr.message);
    }

    notifyNewUserAccount({
      userId: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: "homeowner",
      source: "email_password_signup",
    }).catch((e) => console.error("[opsTeamNotify] register:", e.message));

    let sendFailed = false;
    try {
      await createAndSendVerificationEmail(newUser.id);
    } catch (verifySendErr) {
      sendFailed = true;
      console.error("[auth/register] verification email:", verifySendErr.message);
    }

    return res.status(201).json({
      verificationRequired: true,
      email: normalized.email,
      message: sendFailed
        ? 'Account created, but we could not send the verification email. Use "Resend verification" on the sign-in page.'
        : "Check your email to verify your account before signing in.",
    });
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
    const stored = await RefreshToken.consumeByHash(tokenHash);
    if (!stored) {
      throw new UnauthorizedError("Refresh token has been revoked or is invalid");
    }

    const user = await User.getById(payload.id);
    const impersonator = impersonatorFromPayload(payload);
    const canProceed = impersonator || userMayReceiveAuthTokens(user);
    if (!canProceed) {
      throw new UnauthorizedError("User account is inactive or not found");
    }

    if (!impersonator) {
      assertDemoAccountAccessAllowed(user);
    }

    const tokens = await issueTokenPair(user, impersonator);

    RefreshToken.cleanupExpired().catch(() => { });

    return res.json(tokens);
  } catch (err) {
    return next(err);
  }
});

const impersonationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: "Too many impersonation attempts. Please try again later.",
      status: 429,
    },
  },
});

/** POST /auth/impersonate/:userId — Admin or super admin views the app as another user. */
router.post(
  "/impersonate/:userId",
  impersonationLimiter,
  ensureLoggedIn,
  ensureNotImpersonating,
  ensurePlatformAdmin,
  async function (req, res, next) {
    try {
      const adminId = res.locals.user.id;
      const targetUserId = parseInt(req.params.userId, 10);
      if (!Number.isFinite(targetUserId)) {
        throw new BadRequestError("Invalid user id");
      }
      if (targetUserId === adminId) {
        throw new BadRequestError("You cannot impersonate yourself");
      }

      const targetUser = await User.getById(targetUserId);
      if (!targetUser) {
        throw new BadRequestError("User not found");
      }
      if (targetUser.role === "super_admin") {
        throw new ForbiddenError("Cannot impersonate another super admin");
      }

      const adminUser = await User.getById(adminId);
      const tokens = await issueTokenPair(targetUser, adminUser);

      const { ipAddress, userAgent } = getClientMeta(req);
      await ImpersonationAudit.logStart({
        impersonatorId: adminId,
        targetUserId: targetUser.id,
        ipAddress,
        userAgent,
      });

      return res.json(tokens);
    } catch (err) {
      return next(err);
    }
  }
);

/** POST /auth/stop-impersonating — Restore the admin or super admin session. */
router.post(
  "/stop-impersonating",
  impersonationLimiter,
  ensureLoggedIn,
  async function (req, res, next) {
    try {
      const impersonatorId = res.locals.user?.impersonatorId;
      const targetUserId = res.locals.user?.id;
      if (!impersonatorId) {
        throw new BadRequestError("Not currently impersonating a user");
      }

      const impersonator = await User.getById(impersonatorId);
      const impersonatorIsPlatformAdmin =
        impersonator?.role === "super_admin" || impersonator?.role === "admin";
      if (!impersonator || !impersonatorIsPlatformAdmin) {
        throw new ForbiddenError("Invalid impersonation session");
      }

      await ImpersonationAudit.logEnd({ impersonatorId, targetUserId });

      const tokens = await issueTokenPair(impersonator);
      return res.json(tokens);
    } catch (err) {
      return next(err);
    }
  }
);

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

router.post("/change-password", ensureLoggedIn, ensureNotImpersonating, async function (req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = res.locals.user?.id;
    if (!userId) throw new BadRequestError("User authentication required");
    if (!currentPassword || !newPassword) {
      throw new BadRequestError("Current password and new password are required");
    }
    if (newPassword.length < 8) {
      throw new BadRequestError("New password must be at least 8 characters");
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
    const canProceed = userMayReceiveAuthTokens(user);
    if (!canProceed) {
      throw new UnauthorizedError("User not found or inactive");
    }

    assertDemoAccountAccessAllowed(user);

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
    await recordDemoFirstLogin(user.id);
    syncCustomerIoLogin(user, "mfa");

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

router.post("/verify-email", async function (req, res, next) {
  try {
    const rawToken = req.body?.token;
    const user = await verifyEmailWithToken(rawToken);
    if (!userMayReceiveAuthTokens(user)) {
      throw new UnauthorizedError("Your account cannot start a session. Please contact support.");
    }
    const tokens = await issueTokenPair(user);
    try {
      await PlatformEngagement.logEvent({ userId: user.id, eventType: "email_verified_login", eventData: {} });
    } catch (logErr) { /* don't block */ }
    syncCustomerIoLogin(user, "email_verified");

    return res.json({ ...tokens, emailVerified: true });
  } catch (err) {
    return next(err);
  }
});

const resendVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Too many resend requests. Please try again later.", status: 429 } },
});

router.post("/resend-verification", resendVerificationLimiter, async function (req, res, next) {
  try {
    const result = await requestResendVerification(req.body?.email);
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
    let accountUrl = null;
    if (result?.user?.role === "assistant" && result?.user?.id) {
      try {
        const Account = require("../models/account");
        const accounts = await Account.getUserAccounts(result.user.id);
        accountUrl = accounts?.[0]?.url || null;
      } catch (_) {
        accountUrl = null;
      }
    }
    return res.json({
      success: true,
      message: "Account activated successfully",
      role: result?.user?.role || null,
      onboardingCompleted: result?.user?.role === "assistant" ? true : undefined,
      accountUrl,
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

    const userWithAvatar = await addUserAvatarUrlToItem(user);
    return res.json({ user: { ...userWithAvatar, accounts } });
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
  if (isDemoEnvironment()) {
    return res.redirect(redirectWithError("oauth_disabled"));
  }
  if (!GOOGLE_CLIENT_ID) {
    return res.status(503).json({ error: { message: "Google sign-in is not configured" } });
  }
  try {
    const state = jwt.sign(
      { purpose: "auth-signin", nonce: crypto.randomBytes(24).toString("hex"), exp: Math.floor(Date.now() / 1000) + OAUTH_STATE_MAX_AGE },
      SECRET_KEY
    );
    const url = buildAuthUrl({ redirectUri: GOOGLE_REDIRECT_URI_SIGNIN, state });
    return res.redirect(url);
  } catch (err) {
    console.error("Google signin start error:", err.message);
    return next(err);
  }
});

router.get("/google/signup", function (req, res, next) {
  if (isDemoEnvironment()) {
    return res.redirect(redirectWithError("signup_disabled"));
  }
  if (!GOOGLE_CLIENT_ID) {
    return res.status(503).json({ error: { message: "Google sign-up is not configured" } });
  }
  try {
    const state = jwt.sign(
      { purpose: "auth-signup", nonce: crypto.randomBytes(24).toString("hex"), exp: Math.floor(Date.now() / 1000) + OAUTH_STATE_MAX_AGE },
      SECRET_KEY
    );
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

  let payload;
  try {
    payload = jwt.verify(state, SECRET_KEY);
  } catch {
    return res.redirect(redirectWithError("invalid_state"));
  }
  const expectedPurpose = `auth-${intent}`;
  if (payload.purpose !== expectedPurpose) {
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
            user = await User.linkGoogle(userByEmail.id, sub, email_verified);
          } else {
            return res.redirect(redirectWithError("account_exists"));
          }
        } else {
          return res.redirect(redirectWithError("account_exists"));
        }
      }
      if (!user) {
        assertPublicSignupAllowed();
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
          notifyNewUserAccount({
            userId: newUser.id,
            email: newUser.email,
            name: newUser.name,
            role: newUser.role || "homeowner",
            source: "google_signup",
          }).catch((e) => console.error("[opsTeamNotify] Google signup:", e.message));
        } catch (err) {
          await db.query("ROLLBACK");
          throw err;
        }
      }
    } else {
      if (user) {
        // Sign in OK — user already set from findByGoogleSub
      } else if (userByEmail && !userByEmail.googleSub) {
        user = await User.linkGoogle(userByEmail.id, sub, email_verified);
      } else {
        return res.redirect(redirectWithError("no_account"));
      }
    }

    user = await User.getById(user.id);
    const canProceed = userMayReceiveAuthTokens(user);
    if (!canProceed) {
      if (user && user.emailVerified !== true) {
        return res.redirect(redirectWithError("google_email_unverified"));
      }
      return res.redirect(redirectWithError("inactive"));
    }

    await syncGoogleAvatar(user, picture).catch((err) =>
      console.warn("[avatar] Google avatar sync failed:", err.message)
    );
    user = await User.getById(user.id);

    const { accessToken, refreshToken } = await issueTokenPair(user);
    PlatformEngagement.logEvent({ userId: user.id, eventType: "login", eventData: { provider: "google" } })
      .catch(() => { });
    recordDemoFirstLogin(user.id).catch(() => { });
    syncCustomerIoLogin(user, intent === "signup" ? "google_signup" : "google");

    return res.redirect(redirectWithToken(accessToken, refreshToken));
  } catch (err) {
    console.error("Google callback error:", err.message);
    if (err instanceof ForbiddenError) {
      return res.redirect(redirectWithError("signup_disabled"));
    }
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

    const {
      role: requestedRole,
      subscriptionTier: rawSubscriptionTier,
      planCode: rawPlanCode,
      billingInterval = "month",
      stripeSessionId,
    } = req.body;
    let subscriptionTier = rawSubscriptionTier;
    if (typeof subscriptionTier === "string") {
      subscriptionTier =
        PLAN_CODE_TO_SUBSCRIPTION_TIER[subscriptionTier]
        ?? subscriptionTier.replace(/^(homeowner|agent)_/, "");
    }
    const planCode = typeof rawPlanCode === "string" && rawPlanCode.trim()
      ? rawPlanCode.trim()
      : SUBSCRIPTION_TIER_TO_DEFAULT_PLAN_CODE[subscriptionTier] || null;
    /* When admins create users, the role is set deliberately and the user
       record is marked role_locked. In that case we ignore any role in the
       request body and force the existing DB role so the client can't escape
       the homeowner/agent tier the admin chose. Self-signups (role_locked
       false) keep the existing behavior of letting the user pick a role in
       the onboarding wizard. */
    const currentRoleRow = await db.query(
      `SELECT role, COALESCE(role_locked, false) AS role_locked
       FROM users WHERE id = $1`,
      [userId]
    );
    const currentDbRole = currentRoleRow.rows[0]?.role || null;
    const isRoleLocked = currentRoleRow.rows[0]?.role_locked === true;
    let role = requestedRole;
    if (
      isRoleLocked &&
      (currentDbRole === "homeowner" || currentDbRole === "agent")
    ) {
      if (
        requestedRole &&
        requestedRole !== currentDbRole
      ) {
        throw new ForbiddenError(
          `Your account is registered as ${currentDbRole}. Please contact support to change roles.`
        );
      }
      role = currentDbRole;
    }
    if (!role || !["homeowner", "agent"].includes(role)) {
      throw new BadRequestError("Valid role (homeowner or agent) is required");
    }
    if (!subscriptionTier) {
      throw new BadRequestError("subscriptionTier is required");
    }
    // Validate tier against actual subscription products in the database
    const tierCheckRes = await db.query(
      `SELECT 1 FROM subscription_products
       WHERE (code = $1 OR code = $2)
         AND (is_active IS NULL OR is_active = true)
       LIMIT 1`,
      [
        `${role}_${subscriptionTier}`,
        subscriptionTier,
      ]
    );
    const ALWAYS_VALID_TIERS = ["free", "homeowner_beta", "agent_beta"];
    if (tierCheckRes.rows.length === 0 && !ALWAYS_VALID_TIERS.includes(subscriptionTier)) {
      throw new BadRequestError(`Invalid subscriptionTier "${subscriptionTier}" for role "${role}"`);
    }
    if (planCode) {
      const expectedTierForPlanCode = PLAN_CODE_TO_SUBSCRIPTION_TIER[planCode];
      if (expectedTierForPlanCode && expectedTierForPlanCode !== subscriptionTier) {
        throw new BadRequestError(
          `planCode "${planCode}" does not match subscriptionTier "${subscriptionTier}"`
        );
      }
    }

    /** Tiers that can complete onboarding without Stripe. If checkout returns a session_id, we still verify below. */
    const FREE_TIERS = ["free", "homeowner_beta", "agent_beta"];
    let isPaidTier = !FREE_TIERS.includes(subscriptionTier);
    if (isPaidTier && planCode) {
      const isZeroCost = await isPlanCodeZeroCost(planCode, billingInterval);
      if (isZeroCost) isPaidTier = false;
    }

    if (stripeSessionId) {
      // Fetch the session (with subscription + price expanded) once and reuse for verify + sync.
      // Avoids 2-3 redundant Stripe round-trips on the post-checkout redirect (~500-1200ms).
      let prefetchedSession = null;
      if (!BILLING_MOCK_MODE && stripeService.stripe) {
        try {
          prefetchedSession = await stripeService.stripe.checkout.sessions.retrieve(
            stripeSessionId,
            {
              expand: [
                "subscription.items.data.price",
                "subscription.discount",
                "subscription.discounts",
                "subscription.discounts.promotion_code",
                "total_details.breakdown.discounts.discount",
              ],
            }
          );
        } catch (retrieveErr) {
          console.warn(`[complete-onboarding] Stripe session retrieve failed for user ${userId}: ${retrieveErr.message}`);
          throw new ForbiddenError("Payment could not be verified. Please complete checkout or contact support.");
        }
      }

      const verification = await stripeService.verifyCheckoutSession(stripeSessionId, { userId, prefetchedSession });
      if (!verification.valid) {
        console.warn(`[complete-onboarding] Stripe session verification failed for user ${userId}: ${verification.reason}`);
        throw new ForbiddenError("Payment could not be verified. Please complete checkout or contact support.");
      }
      const syncResult = await stripeService.syncCheckoutSessionSubscription(stripeSessionId, {
        userId,
        prefetchedSession: prefetchedSession || verification.session,
      });
      if (!syncResult?.synced) {
        console.warn(`[complete-onboarding] Stripe sync failed for user ${userId}: ${syncResult?.reason || "unknown_reason"}`);
        throw new ForbiddenError("Payment was verified but subscription activation is incomplete. Please retry in a moment or contact support.");
      }
    } else if (isPaidTier) {
      throw new ForbiddenError("Payment verification required for paid plans");
    }

    const existingUser = await User.getById(userId);
    const hadNoRole = !existingUser?.role;
    const completingOnboarding = existingUser?.onboardingCompleted === false;
    const user = await User.completeOnboarding(userId, { role, subscriptionTier });

    const accountResult = await db.query(
      `SELECT account_id FROM account_users WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    if (
      completingOnboarding &&
      (role === "homeowner" || role === "agent") &&
      accountResult.rows[0]?.account_id
    ) {
      try {
        await trySendWelcomeEmailForUser({
          userId,
          accountId: accountResult.rows[0].account_id,
        });
      } catch (welcomeErr) {
        console.error("[welcomeEmail] complete-onboarding:", welcomeErr.message);
      }
    }

    if (hadNoRole) {
      try {
        await onUserCreated({ userId, role });
      } catch (autoErr) {
        console.error("[resourceAutoSend] complete-onboarding:", autoErr.message);
      }
      if (
        (role === "homeowner" || role === "agent") &&
        accountResult.rows[0]?.account_id
      ) {
        try {
          await commAutoSend.onUserCreated({
            userId,
            role,
            accountId: accountResult.rows[0].account_id,
          });
        } catch (commErr) {
          console.error("[commAutoSend] complete-onboarding:", commErr.message);
        }
      }
    }

    // Create/ensure default subscription for FREE tier (idempotent); paid tiers get subscription from Stripe webhook
    const SKIP_SUBSCRIPTION_ROLES = ["super_admin", "admin"];
    const userRole = existingUser?.role || role;
    if (accountResult.rows[0] && !isPaidTier && !SKIP_SUBSCRIPTION_ROLES.includes(userRole)) {
      try {
        let selectedFreePlanCode = planCode;
        if (!selectedFreePlanCode) {
          if (subscriptionTier === "homeowner_beta") {
            selectedFreePlanCode = "homeowner_beta";
          } else if (subscriptionTier === "agent_beta") {
            selectedFreePlanCode = "agent_beta";
          } else if (role === "agent") {
            selectedFreePlanCode = "agent_free";
          } else {
            selectedFreePlanCode = "homeowner_free";
          }
        }
        await Subscription.ensureAccountOnPlanCode(
          accountResult.rows[0].account_id,
          selectedFreePlanCode
        );
        // Free/zero-cost only (paid path notifies from Stripe webhook).
        // Only on first completion so retries do not re-alert ops.
        if (completingOnboarding) {
          void notifyPlanSelected({
            userId,
            accountId: accountResult.rows[0].account_id,
            planCode: selectedFreePlanCode,
            isPaid: false,
            billingInterval,
            source: "onboarding",
          }).catch((err) =>
            console.error("[planSelectedNotify] complete-onboarding:", err.message)
          );
        }
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
