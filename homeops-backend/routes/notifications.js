"use strict";

const express = require("express");
const { ensureLoggedIn } = require("../middleware/auth");
const Notification = require("../models/notification");
const HomeownerAgentInquiry = require("../models/homeownerAgentInquiry");
const db = require("../db");

const router = express.Router();

/** GET / - List notifications for current user */
router.get("/", ensureLoggedIn, async function (req, res, next) {
  try {
    const userId = res.locals.user.id;
    const { limit } = req.query;
    const notifications = await Notification.listForUser(userId, {
      limit: limit ? parseInt(limit, 10) : 20,
    });
    const unreadCount = await Notification.countUnread(userId);
    return res.json({ notifications, unreadCount });
  } catch (err) {
    return next(err);
  }
});

/** POST /:id/read - Mark notification as read */
router.post("/:id/read", ensureLoggedIn, async function (req, res, next) {
  try {
    const userId = res.locals.user.id;
    const pre = await db.query(
      `SELECT type, homeowner_inquiry_id FROM notifications WHERE id = $1 AND user_id = $2`,
      [req.params.id, userId]
    );
    const row = pre.rows[0];
    await Notification.markRead(req.params.id, userId);
    if (row?.type === "homeowner_inquiry" && row.homeowner_inquiry_id) {
      try {
        await HomeownerAgentInquiry.markAgentRead(
          row.homeowner_inquiry_id,
          userId,
          res.locals.user.role,
        );
      } catch {
        /* inquiry may already be read or edge case; notification still marked read */
      }
    }
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

/** POST /read-all - Mark all as read */
router.post("/read-all", ensureLoggedIn, async function (req, res, next) {
  try {
    const userId = res.locals.user.id;
    await Notification.markAllRead(userId);
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

/** POST /clear-all - Remove all notifications for current user */
router.post("/clear-all", ensureLoggedIn, async function (req, res, next) {
  try {
    const userId = res.locals.user.id;
    await Notification.deleteAllForUser(userId);
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
