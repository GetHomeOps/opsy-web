"use strict";

/**
 * Public Avatar Routes (PUBLIC — no JWT required)
 *
 * Serves a stable, never-expiring URL for a user's avatar so it can be embedded
 * in outbound emails (Customer.io / SES) and other external contexts where the
 * recipient has no session.
 *
 * The actual S3 object stays private: this endpoint resolves a fresh presigned
 * URL at view time and 302-redirects to it. When the user has no uploaded photo
 * (or no usable OAuth avatar), it redirects to a branded initials avatar image
 * (ui-avatars) so the <img> in an email never renders broken.
 *
 * GET /public/avatar/users/:userId  — redirect to the user's avatar image
 */

const express = require("express");
const db = require("../db");
const { getPresignedUrlForImage } = require("../services/s3Service");
const { isSafeS3Key } = require("../helpers/presignedUrls");

const router = express.Router();

/** Opsy brand green used for the initials-avatar fallback background. */
const BRAND_AVATAR_BG = "456564";

/** Presigned URL lifetime for the redirect target. Short on purpose: the URL is
 *  re-resolved on every request, and email proxies (e.g. Gmail) cache the
 *  fetched image bytes rather than the redirect itself. */
const AVATAR_PRESIGN_SECONDS = 60 * 60;

/** Build a hosted initials-avatar image URL (renders as a real PNG in any email client). */
function buildInitialsAvatarUrl(name) {
  const label = (name || "").trim() || "Opsy";
  const params = new URLSearchParams({
    name: label,
    background: BRAND_AVATAR_BG,
    color: "ffffff",
    size: "256",
    bold: "true",
    format: "png",
  });
  return `https://ui-avatars.com/api/?${params.toString()}`;
}

router.get("/avatar/users/:userId", async (req, res, next) => {
  try {
    const userId = Number(req.params.userId);
    const nameHint =
      typeof req.query.name === "string" ? req.query.name.slice(0, 120) : "";

    let image = null;
    let avatarUrl = null;
    let name = nameHint;

    if (Number.isInteger(userId) && userId > 0) {
      const result = await db.query(
        `SELECT image, avatar_url, name FROM users WHERE id = $1`,
        [userId]
      );
      const row = result.rows[0];
      if (row) {
        image = row.image;
        avatarUrl = row.avatar_url;
        name = (row.name || "").trim() || nameHint;
      }
    }

    // Uploaded photo (S3 key) takes precedence, matching in-app avatar display.
    if (typeof image === "string" && isSafeS3Key(image)) {
      try {
        const presigned = await getPresignedUrlForImage(image, AVATAR_PRESIGN_SECONDS);
        res.set("Cache-Control", "no-store");
        return res.redirect(302, presigned);
      } catch (err) {
        // fall through to other sources
      }
    }

    // OAuth avatar (Google) is already a full, public URL.
    if (typeof avatarUrl === "string" && /^https?:\/\//i.test(avatarUrl.trim())) {
      res.set("Cache-Control", "public, max-age=86400");
      return res.redirect(302, avatarUrl.trim());
    }

    // Fallback: branded initials avatar (always renders).
    res.set("Cache-Control", "public, max-age=86400");
    return res.redirect(302, buildInitialsAvatarUrl(name));
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
