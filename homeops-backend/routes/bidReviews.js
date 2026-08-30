"use strict";

const express = require("express");
const db = require("../db");
const { ensureLoggedIn, ensurePropertyAccess } = require("../middleware/auth");
const { BadRequestError, ForbiddenError } = require("../expressError");
const InspectionChecklistItem = require("../models/inspectionChecklistItem");
const System = require("../models/system");
const Contact = require("../models/contact");
const Property = require("../models/property");
const { isPropertyUid } = require("../helpers/properties");
const { sendContractorBidInquiryEmail } = require("../services/emailService");
const {
  getSystemBidReviews,
  compareItem,
  getItemReview,
  updateQuestions,
  selectBid,
  markAwaitingClarification,
} = require("../services/bidReviewService");

const router = express.Router();

async function resolvePropertyId(req, res, next) {
  try {
    const raw = req.params.propertyId;
    if (!raw) return next();
    const rawStr = String(raw);
    if (isPropertyUid(rawStr)) {
      const propRes = await db.query(
        `SELECT id FROM properties WHERE property_uid = $1`,
        [rawStr],
      );
      if (propRes.rows.length === 0) throw new ForbiddenError("Property not found.");
      req.params.propertyId = propRes.rows[0].id;
      return next();
    }
    if (/^\d+$/.test(rawStr)) {
      req.params.propertyId = parseInt(rawStr, 10);
      return next();
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

async function loadItemForProperty(req, res, next) {
  try {
    const item = await InspectionChecklistItem.get(req.params.itemId);
    if (Number(item.property_id) !== Number(req.params.propertyId)) {
      throw new ForbiddenError("Action item does not belong to this property.");
    }
    req._checklistItem = item;
    return next();
  } catch (err) {
    return next(err);
  }
}

async function getPropertyContacts(propertyId) {
  const accRes = await db.query(`SELECT account_id FROM properties WHERE id = $1`, [
    propertyId,
  ]);
  const accountId = accRes.rows[0]?.account_id;
  if (!accountId) return [];
  try {
    return await Contact.getByAccountId(accountId);
  } catch {
    return [];
  }
}

/** GET /properties/:propertyId/systems/:systemKey/bid-reviews */
router.get(
  "/properties/:propertyId/systems/:systemKey/bid-reviews",
  ensureLoggedIn,
  resolvePropertyId,
  ensurePropertyAccess({ param: "propertyId" }),
  async function (req, res, next) {
    try {
      const propertyId = req.params.propertyId;
      const { systemKey } = req.params;
      const [contacts, property, systems] = await Promise.all([
        getPropertyContacts(propertyId),
        Property.get(propertyId).catch(() => null),
        System.get(propertyId).catch(() => []),
      ]);
      const systemRow =
        (systems || []).find(
          (s) => String(s.system_key).toLowerCase() === String(systemKey).toLowerCase(),
        ) || null;
      const payload = await getSystemBidReviews(propertyId, systemKey, {
        contacts,
        property,
        systemRow,
      });
      return res.json(payload);
    } catch (err) {
      return next(err);
    }
  },
);

/** GET /properties/:propertyId/checklist-items/:itemId/bid-review */
router.get(
  "/properties/:propertyId/checklist-items/:itemId/bid-review",
  ensureLoggedIn,
  resolvePropertyId,
  ensurePropertyAccess({ param: "propertyId" }),
  loadItemForProperty,
  async function (req, res, next) {
    try {
      const payload = await getItemReview(req._checklistItem);
      return res.json(payload);
    } catch (err) {
      return next(err);
    }
  },
);

/** POST /properties/:propertyId/checklist-items/:itemId/compare */
router.post(
  "/properties/:propertyId/checklist-items/:itemId/compare",
  ensureLoggedIn,
  resolvePropertyId,
  ensurePropertyAccess({ param: "propertyId" }),
  loadItemForProperty,
  async function (req, res, next) {
    try {
      const payload = await compareItem(req._checklistItem, {
        userId: res.locals.user?.id,
      });
      return res.json(payload);
    } catch (err) {
      return next(err);
    }
  },
);

/** POST /properties/:propertyId/checklist-items/:itemId/regenerate-questions */
router.post(
  "/properties/:propertyId/checklist-items/:itemId/regenerate-questions",
  ensureLoggedIn,
  resolvePropertyId,
  ensurePropertyAccess({ param: "propertyId" }),
  loadItemForProperty,
  async function (req, res, next) {
    try {
      const payload = await compareItem(req._checklistItem, {
        regenerateQuestions: true,
        userId: res.locals.user?.id,
      });
      return res.json(payload);
    } catch (err) {
      return next(err);
    }
  },
);

/** PATCH /properties/:propertyId/checklist-items/:itemId/questions */
router.patch(
  "/properties/:propertyId/checklist-items/:itemId/questions",
  ensureLoggedIn,
  resolvePropertyId,
  ensurePropertyAccess({ param: "propertyId" }),
  loadItemForProperty,
  async function (req, res, next) {
    try {
      const { questions } = req.body || {};
      if (!Array.isArray(questions)) {
        throw new BadRequestError("questions must be an array");
      }
      const payload = await updateQuestions(
        req._checklistItem,
        questions,
        res.locals.user?.id,
      );
      return res.json(payload);
    } catch (err) {
      return next(err);
    }
  },
);

/** POST /properties/:propertyId/checklist-items/:itemId/ask-contractor */
router.post(
  "/properties/:propertyId/checklist-items/:itemId/ask-contractor",
  ensureLoggedIn,
  resolvePropertyId,
  ensurePropertyAccess({ param: "propertyId" }),
  loadItemForProperty,
  async function (req, res, next) {
    try {
      const { to, contractorName, message, replyTo, documentId } = req.body || {};
      if (!to || !message) {
        throw new BadRequestError("to and message are required");
      }
      const user = res.locals.user || {};
      const senderName =
        [user.first_name, user.last_name].filter(Boolean).join(" ") ||
        user.email ||
        "A homeowner";
      const senderEmail = replyTo || user.email;
      const result = await sendContractorBidInquiryEmail({
        to,
        contractorName: contractorName || "there",
        actionItemTitle: req._checklistItem.title,
        message,
        senderName,
        senderEmail,
        replyToEmail: senderEmail,
      });
      const ActionItemBidReview = require("../models/actionItemBidReview");
      await ActionItemBidReview.appendActivity(req._checklistItem.id, {
        type: "questions_sent",
        at: new Date().toISOString(),
        by: user.id || null,
        payload: { to, contractorName, documentId: documentId || null },
      });
      const item = await markAwaitingClarification(req._checklistItem);
      return res.json({ result, item });
    } catch (err) {
      return next(err);
    }
  },
);

/** POST /properties/:propertyId/checklist-items/:itemId/select-bid */
router.post(
  "/properties/:propertyId/checklist-items/:itemId/select-bid",
  ensureLoggedIn,
  resolvePropertyId,
  ensurePropertyAccess({ param: "propertyId" }),
  loadItemForProperty,
  async function (req, res, next) {
    try {
      const documentId = req.body?.documentId;
      if (!documentId) throw new BadRequestError("documentId is required");
      const payload = await selectBid(
        req._checklistItem,
        documentId,
        res.locals.user?.id,
      );
      return res.json(payload);
    } catch (err) {
      return next(err);
    }
  },
);

module.exports = router;
