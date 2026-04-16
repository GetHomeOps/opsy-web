"use strict";

const express = require("express");
const { ensureLoggedIn, ensurePlatformAdmin } = require("../middleware/auth");
const { BadRequestError, UnauthorizedError, ForbiddenError } = require("../expressError");
const SupportTicket = require("../models/supportTicket");
const User = require("../models/user");
const Account = require("../models/account");
const { notifyNewSupportOrFeedbackTicket } = require("../services/opsTeamNotifyService");
const {
  postAutomatedInitialReply,
  notifyUserTicketCreated,
  notifyUserAdminReply,
  generateAutomatedReplyText,
} = require("../services/ticketNotifyService");

const router = express.Router();

/** POST / - Create a new ticket. Authenticated users only. */
router.post("/", ensureLoggedIn, async function (req, res, next) {
  try {
    const userId = res.locals.user?.id;
    if (!userId) throw new BadRequestError("Authentication required");

    const {
      type,
      subject,
      description,
      accountId,
      attachmentKeys,
      propertyId,
      dataSource,
      fieldKey,
      currentValue,
      requestedValue,
    } = req.body;
    if (!accountId) throw new BadRequestError("accountId is required");

    const hasAccess = await Account.isUserLinkedToAccount(userId, Number(accountId));
    if (!hasAccess) {
      throw new UnauthorizedError("You do not have access to this account");
    }

    const ticket = await SupportTicket.create({
      type: type || "support",
      subject,
      description,
      createdBy: userId,
      accountId: Number(accountId),
      attachmentKeys: attachmentKeys || null,
      propertyId: propertyId ?? undefined,
      dataSource: dataSource ?? undefined,
      fieldKey: fieldKey ?? undefined,
      currentValue: currentValue ?? undefined,
      requestedValue: requestedValue ?? undefined,
    });
    notifyNewSupportOrFeedbackTicket(ticket).catch((e) =>
      console.error("[opsTeamNotify] support ticket:", e.message)
    );

    // Post the automated acknowledgment reply in-thread, then email the creator.
    // Both are best-effort: never block ticket creation on notification failures.
    let ticketForResponse = ticket;
    const autoText = generateAutomatedReplyText(ticket);
    if (["support", "feedback"].includes(ticket.type)) {
      try {
        const autoResult = await postAutomatedInitialReply(ticket);
        if (autoResult?.ticket) ticketForResponse = autoResult.ticket;
      } catch (e) {
        console.error("[ticketNotify] auto-reply:", e.message);
      }
      notifyUserTicketCreated(ticketForResponse, { autoResponseText: autoText }).catch(
        (e) => console.error("[ticketNotify] user created email:", e.message)
      );
    }

    return res.status(201).json({ ticket: ticketForResponse });
  } catch (err) {
    return next(err);
  }
});

/** GET /my - List tickets created by the current user. */
router.get("/my", ensureLoggedIn, async function (req, res, next) {
  try {
    const userId = res.locals.user?.id;
    if (!userId) throw new BadRequestError("Authentication required");

    const tickets = await SupportTicket.listForUser(userId);
    return res.json({ tickets });
  } catch (err) {
    return next(err);
  }
});

/** GET / - List all tickets. Admin/super_admin only. */
router.get("/", ensureLoggedIn, ensurePlatformAdmin, async function (req, res, next) {
  try {
    const tickets = await SupportTicket.listForAdmin();
    return res.json({ tickets });
  } catch (err) {
    return next(err);
  }
});

/** GET /assignment-admins - List admin users for assignment. Admin only. */
router.get("/assignment-admins", ensureLoggedIn, ensurePlatformAdmin, async function (req, res, next) {
  try {
    const users = await User.getAll();
    const admins = (users || []).filter(
      (u) => u.role === "admin" || u.role === "super_admin"
    );
    return res.json({ admins: admins.map((u) => ({ id: u.id, name: u.name, email: u.email })) });
  } catch (err) {
    return next(err);
  }
});

/** GET /:id - Get a single ticket. */
router.get("/:id", ensureLoggedIn, async function (req, res, next) {
  try {
    const ticket = await SupportTicket.get(Number(req.params.id));
    const userId = res.locals.user?.id;
    const isAdmin = ["super_admin", "admin"].includes(res.locals.user?.role);

    if (!isAdmin && ticket.createdBy !== userId) {
      throw new ForbiddenError("You can only view your own tickets");
    }

    return res.json({ ticket });
  } catch (err) {
    return next(err);
  }
});

/** POST /:id/replies - Add a reply to a ticket. Admin adds as admin reply; user adds as user reply. */
router.post("/:id/replies", ensureLoggedIn, async function (req, res, next) {
  try {
    const ticketId = Number(req.params.id);
    const ticket = await SupportTicket.get(ticketId);
    const userId = res.locals.user?.id;
    const isAdmin = ["super_admin", "admin"].includes(res.locals.user?.role);

    const { body } = req.body;
    if (!body?.trim()) throw new BadRequestError("Reply body is required");

    const role = isAdmin ? "admin" : "user";
    if (role === "user" && ticket.createdBy !== userId) {
      throw new ForbiddenError("You can only reply to your own tickets");
    }

    const updated = await SupportTicket.addReply(ticketId, {
      authorId: userId,
      role,
      body: body.trim(),
    });

    // Notify the ticket creator by email when an agent replies (skip user→self replies).
    if (role === "admin") {
      const latestReply = (updated.replies || [])
        .slice()
        .reverse()
        .find((r) => !r.isAutomated && r.role === "admin");
      if (latestReply) {
        notifyUserAdminReply(updated, latestReply).catch((e) =>
          console.error("[ticketNotify] admin reply email:", e.message)
        );
      }
    }

    return res.status(201).json({ ticket: updated });
  } catch (err) {
    return next(err);
  }
});

/** PATCH /:id - Update ticket (status, assignedTo, internalNotes). Admin only for admin fields. */
router.patch("/:id", ensureLoggedIn, async function (req, res, next) {
  try {
    const ticketId = Number(req.params.id);
    const ticket = await SupportTicket.get(ticketId);
    const userId = res.locals.user?.id;
    const isAdmin = ["super_admin", "admin"].includes(res.locals.user?.role);

    const { status, assignedTo, internalNotes } = req.body;
    const updates = {};

    if (isAdmin) {
      if (status !== undefined) updates.status = status;
      if (assignedTo !== undefined) updates.assignedTo = assignedTo || null;
      if (internalNotes !== undefined) updates.internalNotes = internalNotes;
    } else if (ticket.createdBy === userId) {
      throw new ForbiddenError("You cannot update tickets. Contact support.");
    } else {
      throw new ForbiddenError("Not authorized to update this ticket");
    }

    const updated = await SupportTicket.update(ticketId, updates);
    return res.json({ ticket: updated });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
