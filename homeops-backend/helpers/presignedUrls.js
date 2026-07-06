"use strict";

/**
 * Presigned URLs Helper
 *
 * Adds temporary S3 presigned URLs to objects (single or array) for a given
 * key field. Used to enrich API responses with preview URLs for images/docs.
 *
 * Includes an in-memory TTL cache so repeated requests for the same S3 key
 * (e.g. property list refreshes) reuse a warm URL instead of hitting S3 each time.
 *
 * Exports: addPresignedUrlToItem, addPresignedUrlsToItems, isSafeS3Key
 */

const { getPresignedUrl } = require("../services/s3Service");

/** Cache: S3 key → { url, expiresAt }. TTL = 4 min (URLs expire at 5 min). */
const _urlCache = new Map();
const CACHE_TTL_MS = 4 * 60 * 1000;
const CACHE_MAX_SIZE = 500;

function getCachedUrl(s3Key) {
  const entry = _urlCache.get(s3Key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _urlCache.delete(s3Key);
    return null;
  }
  return entry.url;
}

function setCachedUrl(s3Key, url) {
  if (_urlCache.size >= CACHE_MAX_SIZE) {
    const oldest = _urlCache.keys().next().value;
    _urlCache.delete(oldest);
  }
  _urlCache.set(s3Key, { url, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 * Check if an S3 key is safe to use (basic path traversal prevention).
 * @param {string} key
 * @returns {boolean}
 */
function isSafeS3Key(key) {
  if (!key || typeof key !== "string") return false;
  const trimmed = key.trim();
  if (!trimmed || trimmed.length > 512) return false;
  if (trimmed.includes("..") || trimmed.includes("//") || trimmed.startsWith("/")) return false;
  return true;
}

/**
 * Add a presigned URL to a single item for a given key field.
 * Uses the same presigned logic as documents/presigned-preview (~5 min expiry).
 *
 * @param {Object} item - Object that may have a key field (e.g. { image: "uploads/contacts/abc.jpg" })
 * @param {string} keyField - Field name containing the S3 key
 * @param {string} [urlField] - Output field name (default: `${keyField}_url`)
 * @returns {Promise<Object>} Copy of item with urlField added (null if key missing/invalid)
 */
async function addPresignedUrlToItem(item, keyField, urlField = null) {
  const urlFieldName = urlField || `${keyField}_url`;
  const key = item[keyField];

  if (typeof key === "string" && (key.startsWith("https://") || key.startsWith("http://"))) {
    return { ...item, [urlFieldName]: key };
  }

  if (!isSafeS3Key(key)) {
    return { ...item, [urlFieldName]: null };
  }

  const trimmedKey = key.trim();
  const cached = getCachedUrl(trimmedKey);
  if (cached) {
    return { ...item, [urlFieldName]: cached };
  }

  try {
    const url = await getPresignedUrl(trimmedKey);
    setCachedUrl(trimmedKey, url);
    return { ...item, [urlFieldName]: url };
  } catch (err) {
    return { ...item, [urlFieldName]: null };
  }
}

/**
 * Add presigned URLs to multiple items for a given key field.
 *
 * @param {Array<Object>} items - Array of objects
 * @param {string} keyField - Field name containing the S3 key
 * @param {string} [urlField] - Output field name (default: `${keyField}_url`)
 * @returns {Promise<Array<Object>>}
 */
async function addPresignedUrlsToItems(items, keyField, urlField = null) {
  if (!Array.isArray(items) || items.length === 0) return items;
  return Promise.all(items.map((item) => addPresignedUrlToItem({ ...item }, keyField, urlField)));
}

/** OAuth avatar URL stored on the user row (Google picture, etc.). */
function getOAuthAvatarUrl(user) {
  const url = user?.avatarUrl ?? user?.avatar_url;
  if (typeof url === "string" && /^https?:\/\//i.test(url.trim())) {
    return url.trim();
  }
  return null;
}

/** Prefer presigned S3 image_url; fall back to OAuth avatar URL for display. */
function mergeOAuthAvatarImageUrl(item) {
  const imageUrl = item.image_url ?? getOAuthAvatarUrl(item) ?? null;
  return { ...item, image_url: imageUrl };
}

/** Add presigned image_url to a user and merge OAuth avatar fallback. */
async function addUserAvatarUrlToItem(item) {
  const withPresigned = await addPresignedUrlToItem(item, "image", "image_url");
  return mergeOAuthAvatarImageUrl(withPresigned);
}

/** Batch variant of addUserAvatarUrlToItem. */
async function addUserAvatarUrlsToItems(items) {
  if (!Array.isArray(items) || items.length === 0) return items;
  return Promise.all(items.map((item) => addUserAvatarUrlToItem({ ...item })));
}

module.exports = {
  addPresignedUrlToItem,
  addPresignedUrlsToItems,
  addUserAvatarUrlToItem,
  addUserAvatarUrlsToItems,
  getOAuthAvatarUrl,
  mergeOAuthAvatarImageUrl,
  isSafeS3Key,
};
