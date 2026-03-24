"use strict";

const express = require("express");
const { ensureLoggedIn, ensureAdminOrSuperAdmin } = require("../middleware/auth");
const Conversation = require("../models/conversation");
const ConversationMessage = require("../models/conversationMessage");
const Property = require("../models/property");
const User = require("../models/user");
const Notification = require("../models/notification");

const router = express.Router();

function messageNotificationTitle(kind, senderName) {
  const who = senderName || "Someone";
  if (kind === "text") return `${who} sent you a message`;
  if (kind === "referral_request") return `${who} requested a professional referral`;
  if (kind === "refer_agent") return `${who} submitted a refer-agent lead`;
  if (kind === "share_contact") return `${who} shared a contact with you`;
  if (kind === "share_professional") return `${who} shared a professional with you`;
  return `${who} sent you a message`;
}

/** POST / — Create or find a conversation (any logged-in user on the property). */
router.post("/", ensureLoggedIn, async (req, res, next) => {
  try {
    const userId = res.locals.user.id;
    const { propertyUid, agentUserId, accountId } = req.body || {};
    if (!propertyUid || agentUserId == null || !accountId) {
      return res.status(400).json({ error: { message: "propertyUid, agentUserId, and accountId are required" } });
    }

    const property = await Property.get(propertyUid);
    if (Number(property.account_id) !== Number(accountId)) {
      return res.status(400).json({ error: { message: "accountId does not match this property" } });
    }

    const conv = await Conversation.findOrCreate({
      accountId: property.account_id,
      propertyId: property.id,
      homeownerUserId: userId,
      agentUserId,
    });

    return res.status(200).json({ conversation: conv });
  } catch (err) {
    return next(err);
  }
});

/** GET / — List conversations for the current account (agents see own, admins see all). */
router.get("/", ensureLoggedIn, ensureAdminOrSuperAdmin, async (req, res, next) => {
  try {
    const accountId = req.query.accountId;
    if (!accountId) return res.status(400).json({ error: { message: "accountId required" } });
    const conversations = await Conversation.listForAccountViewer({
      accountId,
      viewerUserId: res.locals.user.id,
      viewerRole: res.locals.user.role,
      limit: req.query.limit,
    });
    return res.json({ conversations });
  } catch (err) {
    return next(err);
  }
});

/** GET /mine — List conversations where the current user is the homeowner. */
router.get("/mine", ensureLoggedIn, async (req, res, next) => {
  try {
    const conversations = await Conversation.listForHomeowner({
      homeownerUserId: res.locals.user.id,
      limit: req.query.limit,
    });
    return res.json({ conversations });
  } catch (err) {
    return next(err);
  }
});

/** GET /:id/messages — Paginated message history for a conversation. */
router.get("/:id/messages", ensureLoggedIn, async (req, res, next) => {
  try {
    await Conversation.ensureAccess(req.params.id, res.locals.user.id, res.locals.user.role);
    const messages = await ConversationMessage.listByConversation(req.params.id, {
      limit: req.query.limit,
      before: req.query.before,
    });
    return res.json({ messages });
  } catch (err) {
    return next(err);
  }
});

/** POST /:id/messages — Send a message in a conversation. */
router.post("/:id/messages", ensureLoggedIn, async (req, res, next) => {
  try {
    const conv = await Conversation.ensureAccess(req.params.id, res.locals.user.id, res.locals.user.role);
    const senderUserId = res.locals.user.id;
    const { kind } = req.body;

    ConversationMessage.assertKind(kind);
    const payload = ConversationMessage.normalizePayload(kind, req.body);

    const msg = await ConversationMessage.create({
      conversationId: conv.id,
      senderUserId,
      kind,
      payload,
    });

    await Conversation.updateLastMessageAt(conv.id);

    // Notify the other participant
    const recipientUserId =
      Number(senderUserId) === Number(conv.homeownerUserId)
        ? conv.agentUserId
        : conv.homeownerUserId;

    const sender = await User.getById(senderUserId);
    const senderName = sender?.name || sender?.email || "Someone";

    await Notification.create({
      userId: recipientUserId,
      type: "conversation_message",
      title: messageNotificationTitle(kind, senderName),
      conversationMessageId: msg.id,
    });

    return res.status(201).json({ message: msg });
  } catch (err) {
    return next(err);
  }
});

/** POST /:id/read — Mark conversation as read for the current user. */
router.post("/:id/read", ensureLoggedIn, async (req, res, next) => {
  try {
    await Conversation.markRead(req.params.id, res.locals.user.id, res.locals.user.role);
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
