"use strict";

/**
 * Avatar Service
 *
 * Mirrors OAuth profile pictures (Google) into S3 so avatars remain stable
 * after external CDN URLs expire or are cleared.
 */

const User = require("../models/user");
const { uploadFile } = require("./s3Service");
const { isSafeS3Key } = require("../helpers/presignedUrls");

const FETCH_TIMEOUT_MS = 15_000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function isHttpUrl(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim());
}

function extensionForContentType(contentType) {
  const ct = (contentType || "").toLowerCase();
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  return "jpg";
}

function hasCustomUploadedImage(user) {
  const image = user?.image;
  return typeof image === "string" && isSafeS3Key(image.trim());
}

function resolveRemoteAvatarUrl(user, pictureUrl) {
  if (isHttpUrl(pictureUrl)) return pictureUrl.trim();
  const stored = user?.avatarUrl ?? user?.avatar_url;
  if (isHttpUrl(stored)) return stored.trim();
  return null;
}

/** Download a remote avatar image with timeout and basic validation. */
async function fetchRemoteImageBuffer(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { Accept: "image/*" },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const contentType = res.headers.get("content-type") || "";
    if (contentType && !contentType.toLowerCase().startsWith("image/")) {
      throw new Error(`Unexpected content-type: ${contentType}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      throw new Error("Empty image response");
    }
    if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
      throw new Error("Image exceeds size limit");
    }
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: contentType || "image/jpeg",
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Upload OAuth avatar bytes to S3 under user_photos/{userId}/. */
async function mirrorOAuthAvatarToS3(userId, remoteUrl) {
  const { buffer, contentType } = await fetchRemoteImageBuffer(remoteUrl);
  const ext = extensionForContentType(contentType);
  const key = `user_photos/${userId}/oauth-avatar-${Date.now()}.${ext}`;
  await uploadFile(buffer, key, contentType);
  return key;
}

/**
 * Persist a Google/OAuth avatar to S3 when the user has no custom upload.
 * Updates users.image and refreshes users.avatar_url when a new picture URL is provided.
 *
 * @returns {Promise<{ synced: boolean, image?: string }>}
 */
async function syncGoogleAvatar(user, pictureUrl) {
  if (!user?.id) return { synced: false };

  if (hasCustomUploadedImage(user)) {
    return { synced: false };
  }

  const remoteUrl = resolveRemoteAvatarUrl(user, pictureUrl);
  if (!remoteUrl) {
    return { synced: false };
  }

  const s3Key = await mirrorOAuthAvatarToS3(user.id, remoteUrl);
  const avatarUrlUpdate = isHttpUrl(pictureUrl) ? pictureUrl.trim() : remoteUrl;

  await User.update({
    id: user.id,
    image: s3Key,
    avatar_url: avatarUrlUpdate,
  });

  return { synced: true, image: s3Key };
}

module.exports = {
  fetchRemoteImageBuffer,
  mirrorOAuthAvatarToS3,
  syncGoogleAvatar,
  hasCustomUploadedImage,
  resolveRemoteAvatarUrl,
};
