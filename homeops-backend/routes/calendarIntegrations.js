"use strict";

const express = require("express");
const { ensureLoggedIn } = require("../middleware/auth");
const { BadRequestError } = require("../expressError");
const CalendarIntegration = require("../models/calendarIntegration");
const { buildCalendarAuthUrl, exchangeCalendarCodeForTokens } = require("../helpers/googleCalendarOAuth");
const { buildOutlookAuthUrl, exchangeOutlookCodeForTokens } = require("../helpers/outlookCalendarOAuth");
const { APP_WEB_ORIGIN, GOOGLE_CALENDAR_REDIRECT_URI, MICROSOFT_REDIRECT_URI } = require("../config");
const jwt = require("jsonwebtoken");
const { SECRET_KEY } = require("../config");

const router = express.Router();

const SETTINGS_RETURN_PATH = "/settings/configuration";

function buildReturnUrl(returnPath) {
  const base = (APP_WEB_ORIGIN || "http://localhost:5173").replace(/\/$/, "");
  const path = returnPath ? (returnPath.startsWith("/") ? returnPath : `/${returnPath}`) : `/${SETTINGS_RETURN_PATH.replace(/^\//, "")}`;
  return `${base}${path}`;
}

/** GET / - List current user's calendar integrations */
router.get("/", ensureLoggedIn, async function (req, res, next) {
  try {
    const userId = res.locals.user?.id;
    if (!userId) return res.status(401).json({ error: { message: "Unauthorized" } });
    const integrations = await CalendarIntegration.getByUserId(userId);
    return res.json({
      integrations: integrations.map((i) => ({
        id: i.id,
        provider: i.provider,
        calendarId: i.calendar_id,
        syncEnabled: i.sync_enabled,
        lastSyncedAt: i.last_synced_at,
        createdAt: i.created_at,
      })),
    });
  } catch (err) {
    return next(err);
  }
});

/** GET /oauth/:provider/url - Return OAuth URL as JSON (for frontend to redirect with auth) */
router.get("/oauth/:provider/url", ensureLoggedIn, async function (req, res, next) {
  try {
    const userId = res.locals.user?.id;
    if (!userId) return res.status(401).json({ error: { message: "Unauthorized" } });
    const provider = req.params.provider;
    const returnPath = req.query.returnTo || "";
    if (provider === "google") {
      const state = jwt.sign(
        { userId, purpose: "calendar-google", returnPath, exp: Math.floor(Date.now() / 1000) + 600 },
        SECRET_KEY
      );
      const url = buildCalendarAuthUrl({
        redirectUri: GOOGLE_CALENDAR_REDIRECT_URI,
        state,
      });
      return res.json({ url });
    }
    if (provider === "outlook") {
      const state = jwt.sign(
        { userId, purpose: "calendar-outlook", returnPath, exp: Math.floor(Date.now() / 1000) + 600 },
        SECRET_KEY
      );
      const url = await buildOutlookAuthUrl({
        redirectUri: MICROSOFT_REDIRECT_URI,
        state,
      });
      return res.json({ url });
    }
    throw new BadRequestError("Invalid provider");
  } catch (err) {
    if (err.message?.includes("not configured")) {
      return res.status(503).json({ error: { message: `${req.params.provider} integration is not configured` } });
    }
    return next(err);
  }
});

/** GET /oauth/google/connect - Redirect to Google Calendar OAuth (legacy; use /url + frontend redirect) */
router.get("/oauth/google/connect", ensureLoggedIn, async function (req, res, next) {
  try {
    const userId = res.locals.user?.id;
    if (!userId) return res.status(401).json({ error: { message: "Unauthorized" } });
    const returnPath = req.query.returnTo || "";
    const state = jwt.sign(
      { userId, purpose: "calendar-google", returnPath, exp: Math.floor(Date.now() / 1000) + 600 },
      SECRET_KEY
    );
    const url = buildCalendarAuthUrl({
      redirectUri: GOOGLE_CALENDAR_REDIRECT_URI,
      state,
    });
    return res.redirect(url);
  } catch (err) {
    if (err.message?.includes("not configured")) {
      return res.status(503).json({ error: { message: "Google Calendar integration is not configured" } });
    }
    return next(err);
  }
});

/** GET /oauth/google/callback - Handle Google OAuth callback */
router.get("/oauth/google/callback", async function (req, res, next) {
  try {
    const { code, state, error } = req.query;
    const returnBase = APP_WEB_ORIGIN || "http://localhost:5173";
    const returnUrl = `${returnBase.replace(/\/$/, "")}/${(req.query.returnTo || "").replace(/^\//, "")}`.replace(/\/+$/, "") || returnBase;

    if (error) {
      const redirect = `${returnUrl}?calendar=google&status=error&message=${encodeURIComponent(error)}`;
      return res.redirect(redirect);
    }
    if (!code || !state) {
      return res.redirect(`${returnUrl}?calendar=google&status=error&message=missing_params`);
    }

    let payload;
    try {
      payload = jwt.verify(state, SECRET_KEY);
    } catch {
      return res.redirect(`${returnUrl}?calendar=google&status=error&message=invalid_state`);
    }
    if (payload.purpose !== "calendar-google") {
      return res.redirect(`${returnUrl}?calendar=google&status=error&message=invalid_state`);
    }

    const tokens = await exchangeCalendarCodeForTokens(code);
    const tokenExpiresAt = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null;
    await CalendarIntegration.create({
      userId: payload.userId,
      provider: "google",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt,
      calendarId: "primary",
    });

    const finalReturn = buildReturnUrl(payload.returnPath);
    return res.redirect(`${finalReturn}?calendar=google&status=connected`);
  } catch (err) {
    console.error("[calendar] Google callback error:", err.message);
    const returnBase = APP_WEB_ORIGIN || "http://localhost:5173";
    return res.redirect(`${returnBase}?calendar=google&status=error&message=${encodeURIComponent(err.message)}`);
  }
});

/** GET /oauth/outlook/connect - Redirect to Microsoft OAuth */
router.get("/oauth/outlook/connect", ensureLoggedIn, async function (req, res, next) {
  try {
    const userId = res.locals.user?.id;
    if (!userId) return res.status(401).json({ error: { message: "Unauthorized" } });
    const returnPath = req.query.returnTo || "";
    const state = jwt.sign(
      { userId, purpose: "calendar-outlook", returnPath, exp: Math.floor(Date.now() / 1000) + 600 },
      SECRET_KEY
    );
    const url = await buildOutlookAuthUrl({
      redirectUri: MICROSOFT_REDIRECT_URI,
      state,
    });
    return res.redirect(url);
  } catch (err) {
    if (err.message?.includes("not configured")) {
      return res.status(503).json({ error: { message: "Microsoft Outlook integration is not configured" } });
    }
    return next(err);
  }
});

/** GET /oauth/outlook/callback - Handle Microsoft OAuth callback */
router.get("/oauth/outlook/callback", async function (req, res, next) {
  try {
    const { code, state, error } = req.query;
    const returnBase = APP_WEB_ORIGIN || "http://localhost:5173";

    if (error) {
      return res.redirect(`${returnBase}?calendar=outlook&status=error&message=${encodeURIComponent(error)}`);
    }
    if (!code || !state) {
      return res.redirect(`${returnBase}?calendar=outlook&status=error&message=missing_params`);
    }

    let payload;
    try {
      payload = jwt.verify(state, SECRET_KEY);
    } catch {
      return res.redirect(`${returnBase}?calendar=outlook&status=error&message=invalid_state`);
    }
    if (payload.purpose !== "calendar-outlook") {
      return res.redirect(`${returnBase}?calendar=outlook&status=error&message=invalid_state`);
    }

    const tokens = await exchangeOutlookCodeForTokens(code);
    await CalendarIntegration.create({
      userId: payload.userId,
      provider: "outlook",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: tokens.expires_at,
      calendarId: "primary",
    });

    const finalReturn = buildReturnUrl(payload.returnPath);
    return res.redirect(`${finalReturn}?calendar=outlook&status=connected`);
  } catch (err) {
    console.error("[calendar] Outlook callback error:", err.message);
    const returnBase = APP_WEB_ORIGIN || "http://localhost:5173";
    return res.redirect(`${returnBase}?calendar=outlook&status=error&message=${encodeURIComponent(err.message)}`);
  }
});

/** DELETE /:id - Disconnect a calendar integration */
router.delete("/:id", ensureLoggedIn, async function (req, res, next) {
  try {
    const userId = res.locals.user?.id;
    if (!userId) return res.status(401).json({ error: { message: "Unauthorized" } });
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new BadRequestError("Invalid integration ID");
    await CalendarIntegration.delete(id, userId);
    return res.json({ deleted: id });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
