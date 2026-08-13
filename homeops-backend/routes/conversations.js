"use strict";

const express = require("express");
const { ensureLoggedIn, ensureAdminOrSuperAdmin } = require("../middleware/auth");
const { ForbiddenError, BadRequestError } = require("../expressError");
const Conversation = require("../models/conversation");
const ConversationMessage = require("../models/conversationMessage");
const Contact = require("../models/contact");
const Property = require("../models/property");
const User = require("../models/user");
const Account = require("../models/account");
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

/** POST / — Create or find a conversation. */
router.post("/", ensureLoggedIn, async (req, res, next) => {
  try {
    const userId = res.locals.user.id;
    const role = String(res.locals.user.role || "").toLowerCase();
    const { propertyUid, agentUserId, homeownerUserId, accountId, otherUserId } = req.body || {};

    if (role === "admin" || role === "super_admin") {
      if (!accountId || otherUserId == null) {
        throw new BadRequestError("accountId and otherUserId are required");
      }
      if (Number(otherUserId) === Number(userId)) {
        throw new BadRequestError("Cannot message yourself.");
      }
      if (role === "admin") {
        const linked = await Account.isUserLinkedToAccount(userId, accountId);
        if (!linked) throw new ForbiddenError("Not authorized to start a conversation on this account.");
        const belongs = await Conversation.userBelongsToAccount(otherUserId, accountId);
        if (!belongs) {
          throw new ForbiddenError("That user is not on this account.");
        }
      } else {
        const other = await User.getById(otherUserId);
        if (!other || other.isActive === false) {
          throw new BadRequestError("That user is not available.");
        }
      }
      const conv = await Conversation.findOrCreateDirect({
        accountId,
        userAId: userId,
        userBId: otherUserId,
      });
      return res.status(200).json({ conversation: conv });
    }

    if (!propertyUid || !accountId) {
      throw new BadRequestError("propertyUid and accountId are required");
    }

    let resolvedHomeownerId;
    let resolvedAgentId;

    if (role === "homeowner") {
      if (agentUserId == null) {
        throw new BadRequestError("agentUserId is required");
      }
      resolvedHomeownerId = userId;
      resolvedAgentId = agentUserId;
    } else if (role === "agent") {
      if (homeownerUserId == null) {
        throw new BadRequestError("homeownerUserId is required");
      }
      resolvedHomeownerId = homeownerUserId;
      resolvedAgentId = userId;
    } else {
      throw new ForbiddenError("Only homeowners, agents, admins, and super admins can start a conversation.");
    }

    const property = await Property.get(propertyUid);
    if (Number(property.account_id) !== Number(accountId)) {
      throw new BadRequestError("accountId does not match this property");
    }

    await Conversation.verifyParticipantsOnProperty(
      property.id,
      resolvedHomeownerId,
      resolvedAgentId
    );

    const conv = await Conversation.findOrCreate({
      accountId: property.account_id,
      propertyId: property.id,
      homeownerUserId: resolvedHomeownerId,
      agentUserId: resolvedAgentId,
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

/** GET /as-agent — List conversations across all client accounts for the current agent. */
router.get("/as-agent", ensureLoggedIn, async (req, res, next) => {
  try {
    const user = res.locals.user;
    if (user.role !== "agent") {
      return res.status(403).json({ error: { message: "Only agents can use this endpoint." } });
    }
    const conversations = await Conversation.listForAgent({
      agentUserId: user.id,
      limit: req.query.limit,
    });
    return res.json({ conversations });
  } catch (err) {
    return next(err);
  }
});

/** GET /partners — Related people the current user can start a conversation with. */
router.get("/partners", ensureLoggedIn, async (req, res, next) => {
  try {
    const user = res.locals.user;
    const role = String(user.role || "").toLowerCase();
    if (
      role !== "homeowner" &&
      role !== "agent" &&
      role !== "admin" &&
      role !== "super_admin"
    ) {
      return res.status(403).json({ error: { message: "You cannot list messaging partners." } });
    }
    const accountId = req.query.accountId;
    if (role === "admin") {
      if (!accountId) {
        throw new BadRequestError("accountId is required");
      }
      const linked = await Account.isUserLinkedToAccount(user.id, accountId);
      if (!linked) throw new ForbiddenError("Not authorized to view this account.");
    }
    const partners = await Conversation.listPartners({
      userId: user.id,
      role,
      accountId,
    });
    return res.json({ partners });
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
    const hydrated = await ConversationMessage.hydrateShareContactPayloads(messages);
    return res.json({ messages: hydrated });
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
    let payload = ConversationMessage.normalizePayload(kind, req.body);

    if (kind === "share_contact") {
      const allowed = await Contact.userCanAccess(
        payload.contactId,
        senderUserId,
        res.locals.user.role
      );
      if (!allowed) throw new ForbiddenError("You do not have access to this contact.");
      const contact = await Contact.get(payload.contactId);
      payload = {
        ...payload,
        ...ConversationMessage.snapshotFromContact(contact),
      };
    }

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
