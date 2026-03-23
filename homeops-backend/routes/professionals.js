"use strict";

const express = require("express");
const jsonschema = require("jsonschema");
const { ensureLoggedIn, ensurePlatformAdmin } = require("../middleware/auth");
const { BadRequestError, ExpressError } = require("../expressError");
const Professional = require("../models/professional");
const ProfessionalReview = require("../models/professionalReview");
const User = require("../models/user");
const db = require("../db");
const { sendProfessionalContactEmail } = require("../services/emailService");
const { addPresignedUrlToItem, addPresignedUrlsToItems } = require("../helpers/presignedUrls");
const professionalReviewNewSchema = require("../schemas/professionalReviewNew.json");

const router = express.Router();

async function enrichProfessional(pro) {
  let enriched = await addPresignedUrlToItem(pro, "profile_photo", "profile_photo_url");

  const photos = await Professional.getPhotos(pro.id);
  enriched.photos = await addPresignedUrlsToItems(photos, "photo_key", "photo_url");

  return enriched;
}

/** GET / - List professionals with optional filters. */
router.get("/", ensureLoggedIn, async function (req, res, next) {
  try {
    const filters = {};
    if (res.locals.user?.id) filters.user_id = res.locals.user.id;
    if (req.query.category_id) filters.category_id = req.query.category_id;
    if (req.query.subcategory_id) filters.subcategory_id = req.query.subcategory_id;
    if (req.query.city) filters.city = req.query.city;
    if (req.query.state) filters.state = req.query.state;
    if (req.query.budget_level) filters.budget_level = req.query.budget_level;
    if (req.query.min_rating) filters.min_rating = Number(req.query.min_rating);
    if (req.query.language) filters.language = req.query.language;
    if (req.query.is_verified === "true") filters.is_verified = true;
    if (req.query.search) filters.search = req.query.search.trim();

    const professionals = await Professional.getAll(filters);
    const enriched = await addPresignedUrlsToItems(professionals, "profile_photo", "profile_photo_url");
    return res.json({ professionals: enriched });
  } catch (err) {
    return next(err);
  }
});

/** GET /:id/reviews - List reviews for a professional. */
router.get("/:id/reviews", ensureLoggedIn, async function (req, res, next) {
  try {
    const professionalId = parseInt(req.params.id, 10);
    if (isNaN(professionalId)) throw new BadRequestError("Invalid professional ID");
    const reviews = await ProfessionalReview.getByProfessionalId(professionalId);
    const aggregate = await ProfessionalReview.getAggregate(professionalId);
    return res.json({
      reviews,
      aggregate: {
        count: aggregate.count,
        avgRating: parseFloat(aggregate.avgRating) || 0,
      },
    });
  } catch (err) {
    return next(err);
  }
});

/** GET /:id/review-eligibility - Check if current user can submit a review. */
router.get("/:id/review-eligibility", ensureLoggedIn, async function (req, res, next) {
  try {
    const userId = res.locals.user?.id;
    if (!userId) return res.status(401).json({ error: { message: "Unauthorized" } });
    const professionalId = parseInt(req.params.id, 10);
    if (isNaN(professionalId)) throw new BadRequestError("Invalid professional ID");
    const canReview = await ProfessionalReview.checkEligibility(userId, professionalId);
    const alreadyReviewed = await ProfessionalReview.hasUserReviewed(userId, professionalId);
    return res.json({
      canReview: canReview && !alreadyReviewed,
      alreadyReviewed,
      hasCompletedWork: canReview,
    });
  } catch (err) {
    return next(err);
  }
});

/** POST /:id/reviews - Create a review (validates eligibility and one-per-user on backend). */
router.post("/:id/reviews", ensureLoggedIn, async function (req, res, next) {
  try {
    const userId = res.locals.user?.id;
    if (!userId) return res.status(401).json({ error: { message: "Unauthorized" } });
    const professionalId = parseInt(req.params.id, 10);
    if (isNaN(professionalId)) throw new BadRequestError("Invalid professional ID");
    const validator = jsonschema.validate(req.body, professionalReviewNewSchema);
    if (!validator.valid) {
      const errs = validator.errors.map((e) => e.stack);
      throw new BadRequestError(errs);
    }
    const { rating, comment } = req.body;
    const review = await ProfessionalReview.create({
      professionalId,
      userId,
      rating,
      comment: comment || null,
    });
    return res.status(201).json({ review });
  } catch (err) {
    return next(err);
  }
});

const CONTACT_MESSAGE_MAX = 8000;

/** POST /:id/contact - Send a message to the professional via AWS SES (logged-in users). */
router.post("/:id/contact", ensureLoggedIn, async function (req, res, next) {
  try {
    const userId = res.locals.user?.id;
    if (!userId) return res.status(401).json({ error: { message: "Unauthorized" } });

    const professionalId = parseInt(req.params.id, 10);
    if (isNaN(professionalId)) throw new BadRequestError("Invalid professional ID");

    const raw = req.body?.message;
    if (typeof raw !== "string" || !raw.trim()) {
      throw new BadRequestError("message is required");
    }
    const message = raw.trim();
    if (message.length > CONTACT_MESSAGE_MAX) {
      throw new BadRequestError(`message must be at most ${CONTACT_MESSAGE_MAX} characters`);
    }

    const pro = await Professional.get(String(professionalId), userId);
    const toEmail = pro.email && String(pro.email).trim();
    if (!toEmail) {
      throw new BadRequestError("This professional does not have an email on file.");
    }

    const user = await User.getById(userId);
    const senderName = user?.name || null;
    const senderEmail = res.locals.user.email;

    let proContactUsage;
    try {
      const acctRes = await db.query(
        `SELECT account_id FROM account_users WHERE user_id = $1 ORDER BY id ASC LIMIT 1`,
        [userId]
      );
      const aid = acctRes.rows[0]?.account_id;
      if (aid) {
        proContactUsage = { accountId: aid, userId, emailType: "professional_contact" };
      }
    } catch (_) {
      // omit usage
    }

    try {
      await sendProfessionalContactEmail({
        to: toEmail,
        professionalCompanyName: pro.company_name || pro.contact_name || `${pro.first_name} ${pro.last_name}`.trim(),
        message,
        senderName,
        senderEmail,
        usage: proContactUsage,
      });
    } catch (e) {
      const msg = e?.message || "";
      if (msg.includes("SES not configured") || msg.includes("SES_FROM_EMAIL")) {
        return next(new ExpressError("Email delivery is not configured on this server.", 503));
      }
      throw e;
    }

    return res.status(200).json({ sent: true });
  } catch (err) {
    return next(err);
  }
});

/** GET /:id - Get single professional with photos. */
router.get("/:id", ensureLoggedIn, async function (req, res, next) {
  try {
    const userId = res.locals.user?.id;
    const pro = await Professional.get(req.params.id, userId);
    const enriched = await enrichProfessional(pro);
    return res.json({ professional: enriched });
  } catch (err) {
    return next(err);
  }
});

/** POST / - Create professional. Admin only. */
router.post("/", ensurePlatformAdmin, async function (req, res, next) {
  try {
    const { company_name } = req.body;
    if (!company_name?.trim()) {
      throw new BadRequestError("company_name is required");
    }

    const pro = await Professional.create(req.body);
    const enriched = await enrichProfessional(pro);
    return res.status(201).json({ professional: enriched });
  } catch (err) {
    return next(err);
  }
});

/** PATCH /:id - Update professional. Admin only. */
router.patch("/:id", ensurePlatformAdmin, async function (req, res, next) {
  try {
    const pro = await Professional.update(req.params.id, req.body);
    const enriched = await enrichProfessional(pro);
    return res.json({ professional: enriched });
  } catch (err) {
    return next(err);
  }
});

/** DELETE /:id - Remove professional. Admin only. */
router.delete("/:id", ensurePlatformAdmin, async function (req, res, next) {
  try {
    await Professional.remove(req.params.id);
    return res.json({ deleted: req.params.id });
  } catch (err) {
    return next(err);
  }
});

/** POST /:id/photos - Add project photo. Admin only. */
router.post("/:id/photos", ensurePlatformAdmin, async function (req, res, next) {
  try {
    const { photo_key, caption, sort_order } = req.body;
    if (!photo_key) throw new BadRequestError("photo_key is required");

    const photo = await Professional.addPhoto(req.params.id, photo_key, caption, sort_order);
    const enriched = await addPresignedUrlToItem(photo, "photo_key", "photo_url");
    return res.status(201).json({ photo: enriched });
  } catch (err) {
    return next(err);
  }
});

/** DELETE /:id/photos/:photoId - Remove project photo. Admin only. */
router.delete("/:id/photos/:photoId", ensurePlatformAdmin, async function (req, res, next) {
  try {
    await Professional.removePhoto(req.params.photoId);
    return res.json({ deleted: req.params.photoId });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
