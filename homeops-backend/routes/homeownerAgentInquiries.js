"use strict";

const express = require("express");
const { ensureLoggedIn, ensureAdminOrSuperAdmin } = require("../middleware/auth");
const HomeownerAgentInquiry = require("../models/homeownerAgentInquiry");
const Conversation = require("../models/conversation");
const ConversationMessage = require("../models/conversationMessage");
const Property = require("../models/property");
const User = require("../models/user");
const Notification = require("../models/notification");

const router = express.Router();

function notificationTitle(kind, senderName) {
  const who = senderName || "A homeowner";
  if (kind === "message") return `${who} sent you a message`;
  if (kind === "referral_request") return `${who} requested a professional referral`;
  return `${who} submitted a refer-agent lead`;
}

/** POST / — Homeowner submits message / referral / refer-agent (logged-in, must be on property team). */
router.post("/", ensureLoggedIn, async (req, res, next) => {
  try {
    const senderUserId = res.locals.user.id;
    const { propertyUid, agentUserId, kind, accountId: bodyAccountId } = req.body || {};
    if (!propertyUid || agentUserId == null || !kind) {
      return res.status(400).json({ error: { message: "propertyUid, agentUserId, and kind are required" } });
    }
    if (bodyAccountId == null) {
      return res.status(400).json({ error: { message: "accountId is required" } });
    }
    const property = await Property.get(propertyUid);
    if (Number(property.account_id) !== Number(bodyAccountId)) {
      return res.status(400).json({ error: { message: "accountId does not match this property" } });
    }
    await HomeownerAgentInquiry.verifySenderAndAgentOnProperty(property.id, senderUserId, agentUserId);
    HomeownerAgentInquiry.assertKind(kind);
    const payload = HomeownerAgentInquiry.normalizePayload(kind, req.body);
    const row = await HomeownerAgentInquiry.create({
      accountId: property.account_id,
      propertyId: property.id,
      senderUserId,
      agentUserId,
      kind,
      payload,
    });

    // Dual-write: also insert into the new conversations system
    try {
      const conv = await Conversation.findOrCreate({
        accountId: property.account_id,
        propertyId: property.id,
        homeownerUserId: senderUserId,
        agentUserId,
      });
      const convKind = kind === "message" ? "text" : kind;
      await ConversationMessage.create({
        conversationId: conv.id,
        senderUserId,
        kind: convKind,
        payload,
      });
      await Conversation.updateLastMessageAt(conv.id);
    } catch (dualWriteErr) {
      console.error("[dual-write] conversation write failed:", dualWriteErr.message);
    }

    const sender = await User.getById(senderUserId);
    const senderName = sender?.name || sender?.email || "Homeowner";
    await Notification.create({
      userId: agentUserId,
      type: "homeowner_inquiry",
      title: notificationTitle(kind, senderName),
      homeownerInquiryId: row.id,
    });
    return res.status(201).json({ inquiry: row });
  } catch (err) {
    return next(err);
  }
});

/** GET / — List inquiries for current account (agents: own only; admins: all in account). */
router.get("/", ensureLoggedIn, ensureAdminOrSuperAdmin, async (req, res, next) => {
  try {
    const accountId = req.query.accountId;
    if (!accountId) return res.status(400).json({ error: { message: "accountId required" } });
    const limit = req.query.limit;
    const inquiries = await HomeownerAgentInquiry.listForAccountViewer({
      accountId,
      viewerUserId: res.locals.user.id,
      viewerRole: res.locals.user.role,
      limit,
    });
    return res.json({ inquiries });
  } catch (err) {
    return next(err);
  }
});

/** POST /:id/read — Mark inquiry read (agent or account admin). */
router.post("/:id/read", ensureLoggedIn, ensureAdminOrSuperAdmin, async (req, res, next) => {
  try {
    await HomeownerAgentInquiry.markAgentRead(
      req.params.id,
      res.locals.user.id,
      res.locals.user.role,
    );
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
