"use strict";

const jwt = require("jsonwebtoken");
const { SECRET_KEY } = require("../config");
const { UnauthorizedError, ForbiddenError } = require("../expressError");
const Account = require("../models/account");
const User = require("../models/user");
const db = require("../db");
const { isPropertyUid } = require("../helpers/properties");

/** Verify Bearer token, set res.locals.user (optional). Ignores invalid tokens. */
function authenticateJWT(req, res, next) {
  const authHeader = req.headers?.authorization;
  if (authHeader) {
    const token = authHeader.replace(/^[Bb]earer /, "").trim();
    try {
      res.locals.user = jwt.verify(token, SECRET_KEY);
    } catch (err) {
      /* ignore invalid tokens */
    }
  }
  return next();
}

/** Require super_admin role. Re-fetches user from DB if JWT role is stale. */
async function ensureSuperAdmin(req, res, next) {
  try {
    if (res.locals.user?.role === "super_admin") return next();
    const userId = res.locals.user?.id;
    if (!userId) throw new UnauthorizedError();
    const user = await User.getById(userId);
    if (user?.role === "super_admin") {
      res.locals.user.role = user.role;
      return next();
    }
    throw new UnauthorizedError();
  } catch (err) {
    next(err);
  }
}

/** Require super_admin or admin role. */
function ensurePlatformAdmin(req, res, next) {
  const role = res.locals.user?.role;
  if (role === 'super_admin' || role === 'admin') return next();
  throw new UnauthorizedError();
}

/** Require authenticated user (res.locals.user.email must exist). */
function shouldSkipSubscriptionGate(req) {
  const baseUrl = req.baseUrl || "";
  const path = req.path || "";

  // Keep billing endpoints accessible so users can recover from failed activation.
  if (baseUrl === "/billing") return true;

  // Allow onboarding completion and auth maintenance endpoints.
  if (baseUrl === "/auth") {
    return (
      path === "/complete-onboarding" ||
      path === "/refresh" ||
      path === "/logout" ||
      path === "/change-password"
    );
  }

  return false;
}

async function fetchUserAuthInfo(userId) {
  const userRes = await db.query(
    `SELECT role, subscription_tier AS "subscriptionTier", onboarding_completed AS "onboardingCompleted"
     FROM users
     WHERE id = $1`,
    [userId]
  );
  return userRes.rows[0] || null;
}

function userRequiresPaidSubscriptionFromInfo(user) {
  if (!user) return false;
  if (user.onboardingCompleted === false) return false;
  if (user.role === "super_admin" || user.role === "admin") return false;

  if (user.role === "agent") return true;
  if (
    user.role === "homeowner" &&
    user.subscriptionTier &&
    !["free", "homeowner_beta", "beta_homeowner"].includes(user.subscriptionTier)
  ) {
    return true;
  }

  return false;
}

async function hasActivePaidSubscription(userId) {
  const subRes = await db.query(
    `SELECT 1
     FROM account_users au
     JOIN account_subscriptions asub ON asub.account_id = au.account_id
     JOIN subscription_products sp ON sp.id = asub.subscription_product_id
     WHERE au.user_id = $1
       AND asub.status IN ('active', 'trialing')
     LIMIT 1`,
    [userId]
  );
  return subRes.rows.length > 0;
}

async function ensureLoggedIn(req, res, next) {
  try {
    if (!res.locals.user?.email) throw new UnauthorizedError();

    const userId = res.locals.user?.id;
    if (!userId) throw new UnauthorizedError();

    const dbUser = await fetchUserAuthInfo(userId);
    if (dbUser?.role) {
      res.locals.user.role = dbUser.role;
    }

    if (!shouldSkipSubscriptionGate(req)) {
      if (userRequiresPaidSubscriptionFromInfo(dbUser)) {
        const hasPaidSubscription = await hasActivePaidSubscription(userId);
        if (!hasPaidSubscription) {
          throw new ForbiddenError("Active paid subscription required.");
        }
      }
    }

    return next();
  } catch (err) {
    return next(err);
  }
}

/** Require current user matches params.email. */
async function ensureCorrectUser(req, res, next) {
  const currentUser = res.locals.user?.email;
  if (currentUser && currentUser === req.params.email) return next();
  throw new UnauthorizedError();
}

const _uidToIdCache = new Map();
const _accessGrantCache = new Map();
const _ACCESS_TTL_MS = 30_000;

function _cacheKey(userId, propertyId) { return `${userId}:${propertyId}`; }

function _pruneCache(cache) {
  const now = Date.now();
  for (const [k, v] of cache) {
    if (v.expiresAt <= now) cache.delete(k);
  }
}

setInterval(() => { _pruneCache(_uidToIdCache); _pruneCache(_accessGrantCache); }, 60_000).unref();

/** Require property_users membership or admin. Options: scope, param, fromBody. */
function ensurePropertyAccess(options = {}) {
  const scope = options.scope === "user" ? "user" : "property";
  const param = options.param ?? (scope === "user" ? "userId" : "uid");

  if (scope === "user") {
    return function _ensurePropertyAccessByUser(req, res, next) {
      const user = res.locals.user;
      if (!user?.id) throw new UnauthorizedError();
      if (user.role === "super_admin" || user.role === "admin") return next();
      if (String(user.id) === String(req.params[param])) return next();
      throw new ForbiddenError("You may only access properties for your own user.");
    };
  }

  const fromBody = options.fromBody;

  return async function _ensurePropertyAccessByProperty(req, res, next) {
    try {
      const user = res.locals.user;
      if (!user?.id) throw new UnauthorizedError();

      const raw = (fromBody && req.body && req.body[fromBody] != null)
        ? req.body[fromBody]
        : (req.params[param] || req.params.uid || req.params.propertyId || req.params.PropertyId);
      if (!raw) throw new ForbiddenError("Property identifier missing.");

      let propertyId;
      const rawStr = String(raw);
      const paramExpectsNumericId = param === "propertyId" || param === "PropertyId";

      if (isPropertyUid(rawStr)) {
        const cached = _uidToIdCache.get(rawStr);
        if (cached && cached.expiresAt > Date.now()) {
          propertyId = cached.value;
        } else {
          const propRes = await db.query(
            `SELECT id FROM properties WHERE property_uid = $1`,
            [rawStr],
          );
          if (propRes.rows.length === 0) throw new ForbiddenError("Property not found.");
          propertyId = propRes.rows[0].id;
          _uidToIdCache.set(rawStr, { value: propertyId, expiresAt: Date.now() + _ACCESS_TTL_MS });
        }
      } else if (/^\d+$/.test(rawStr)) {
        propertyId = parseInt(rawStr, 10);
      } else {
        throw new ForbiddenError("Property not found.");
      }
      if (paramExpectsNumericId) {
        req.params[param] = propertyId;
        res.locals.resolvedPropertyId = propertyId;
      }

      if (user.role === "super_admin" || user.role === "admin") return next();

      const ck = _cacheKey(user.id, propertyId);
      const cachedGrant = _accessGrantCache.get(ck);
      if (cachedGrant && cachedGrant.expiresAt > Date.now()) return next();

      const result = await db.query(
        `SELECT 1 FROM property_users WHERE property_id = $1 AND user_id = $2`,
        [propertyId, user.id],
      );

      if (result.rows.length > 0) {
        _accessGrantCache.set(ck, { expiresAt: Date.now() + _ACCESS_TTL_MS });
        return next();
      }

      const invResult = await db.query(
        `SELECT 1 FROM invitations i
         JOIN users u ON LOWER(u.email) = LOWER(i.invitee_email) AND u.id = $2
         WHERE i.property_id = $1 AND i.status = 'pending' AND i.expires_at > NOW()`,
        [propertyId, user.id],
      );
      if (invResult.rows.length > 0) {
        _accessGrantCache.set(ck, { expiresAt: Date.now() + _ACCESS_TTL_MS });
        return next();
      }

      throw new ForbiddenError("You do not have access to this property.");
    } catch (err) {
      return next(err);
    }
  };
}

/** Require owner role on property. */
function ensurePropertyOwner(paramName = "propertyId") {
  return async function _ensurePropertyOwner(req, res, next) {
    try {
      const user = res.locals.user;
      if (!user?.id) throw new UnauthorizedError();
      if (user.role === "super_admin") return next();

      const raw = req.params[paramName];
      if (!raw) throw new ForbiddenError("Property identifier missing.");

      let propertyId;
      const rawStr = String(raw);
      if (isPropertyUid(rawStr)) {
        const propRes = await db.query(
          `SELECT id FROM properties WHERE property_uid = $1`, [rawStr]
        );
        if (propRes.rows.length === 0) throw new ForbiddenError("Property not found.");
        propertyId = propRes.rows[0].id;
      } else if (/^\d+$/.test(rawStr)) {
        propertyId = parseInt(rawStr, 10);
      } else {
        throw new ForbiddenError("Property not found.");
      }

      const result = await db.query(
        `SELECT 1 FROM property_users WHERE property_id = $1 AND user_id = $2 AND role = 'owner'`,
        [propertyId, user.id]
      );
      if (result.rows.length > 0) return next();
      throw new ForbiddenError("Only the property owner can perform this action.");
    } catch (err) {
      return next(err);
    }
  };
}

/** Require account_users membership for the account in params. */
function ensureUserCanAccessAccountByParam(paramName = "accountId") {
  return async function _ensureUserCanAccessAccountByParam(req, res, next) {
    try {
      const userId = res.locals.user?.id;
      if (!userId) throw new UnauthorizedError("Authentication required.");
      if (res.locals.user.role === "super_admin" || res.locals.user.role === "admin") return next();
      const accountId = req.params[paramName];
      if (!accountId) throw new UnauthorizedError("Account identifier required.");
      const isAuthorized = await Account.isUserLinkedToAccount(userId, accountId);
      if (!isAuthorized) throw new UnauthorizedError("Not authorized to access this account.");
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

/** Require account_users membership for the account in req.body. Used for POST routes. */
function ensureUserCanAccessAccountFromBody(bodyKey = "account_id") {
  return async function _ensureUserCanAccessAccountFromBody(req, res, next) {
    try {
      const userId = res.locals.user?.id;
      if (!userId) throw new UnauthorizedError("Authentication required.");
      if (res.locals.user.role === "super_admin" || res.locals.user.role === "admin") return next();
      const accountId = req.body?.[bodyKey];
      if (!accountId) throw new UnauthorizedError("Account identifier required.");
      const isAuthorized = await Account.isUserLinkedToAccount(userId, accountId);
      if (!isAuthorized) throw new UnauthorizedError("Not authorized to access this account.");
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

/** Require agent or self for agent-scoped routes. */
function ensureAgentOrSelf(paramName = "agentId") {
  return function _ensureAgentOrSelf(req, res, next) {
    const user = res.locals.user;
    if (!user?.id) throw new UnauthorizedError("Authentication required.");
    if (user.role === "super_admin" || user.role === "admin") return next();
    if (String(user.id) === String(req.params[paramName])) return next();
    throw new ForbiddenError("You may only access your own profile.");
  };
}

/** Require shared account to view user. */
function ensureCanViewUser(paramName = "email") {
  return async function _ensureCanViewUser(req, res, next) {
    try {
      const user = res.locals.user;
      if (!user?.id) throw new UnauthorizedError("Authentication required.");
      if (user.role === "super_admin" || user.role === "admin") return next();
      const targetUser = await User.get(req.params[paramName]);
      if (!targetUser?.id) throw new ForbiddenError("User not found.");
      const shared = await db.query(
        `SELECT 1 FROM account_users a
         JOIN account_users b ON a.account_id = b.account_id
         WHERE a.user_id = $1 AND b.user_id = $2 LIMIT 1`,
        [user.id, targetUser.id]
      );
      if (shared.rows.length === 0) throw new ForbiddenError("You may only view users in your accounts.");
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

/** Require super_admin, admin, or agent role. */
function ensureAdminOrSuperAdmin(req, res, next) {
  const userRole = res.locals.user?.role;
  if (userRole === 'super_admin' || userRole === 'admin' || userRole === 'agent') {
    return next();
  }
  // After ensureLoggedIn, 403 distinguishes “signed in, not allowed” from 401 “no valid session”.
  throw new ForbiddenError("This action requires an agent or administrator account.");
}

/**
 * Require that the requesting user is a member of the same account as the
 * target resource (contact or database), identified by :id in params.
 * Admins and super_admins bypass the check.
 */
function ensureContactBelongsToUserAccount(paramName = "id") {
  return async function _ensureContactOwnership(req, res, next) {
    try {
      const user = res.locals.user;
      if (!user?.id) throw new UnauthorizedError();
      if (user.role === "super_admin" || user.role === "admin") return next();
      const contactId = req.params[paramName];
      if (!contactId) throw new ForbiddenError("Contact identifier missing.");
      const result = await db.query(
        `SELECT 1 FROM account_contacts ac
         JOIN account_users au ON ac.account_id = au.account_id
         WHERE ac.contact_id = $1 AND au.user_id = $2
         LIMIT 1`,
        [contactId, user.id]
      );
      if (result.rows.length === 0) throw new ForbiddenError("You do not have access to this contact.");
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

/** Require that the requesting user owns or shares an account with the target user. */
function ensureSelfOrAdmin(paramName = "userId") {
  return function _ensureSelfOrAdmin(req, res, next) {
    const user = res.locals.user;
    if (!user?.id) throw new UnauthorizedError();
    if (user.role === "super_admin" || user.role === "admin") return next();
    if (String(user.id) === String(req.params[paramName])) return next();
    throw new ForbiddenError("You may only access your own data.");
  };
}

function clearPropertyAccessCache(propertyId, userId) {
  if (propertyId && userId) {
    _accessGrantCache.delete(_cacheKey(userId, propertyId));
  } else if (propertyId) {
    const prefix = `:${propertyId}`;
    for (const k of _accessGrantCache.keys()) {
      if (k.endsWith(prefix)) _accessGrantCache.delete(k);
    }
  }
}

module.exports = {
  authenticateJWT,
  ensureLoggedIn,
  ensureCorrectUser,
  ensureSuperAdmin,
  ensurePlatformAdmin,
  ensureAdminOrSuperAdmin,
  ensurePropertyAccess,
  ensurePropertyOwner,
  ensureUserCanAccessAccountByParam,
  ensureUserCanAccessAccountFromBody,
  ensureAgentOrSelf,
  ensureCanViewUser,
  ensureContactBelongsToUserAccount,
  ensureSelfOrAdmin,
  clearPropertyAccessCache,
};
