"use strict";

/**
 * Canonical S3 key prefixes for uploads and presigned GET access.
 * Top-level folder names match the bucket layout (e.g. professionals/, property_documents/).
 */

const S3_ALLOWED_PREFIXES = [
  "documents/",
  "property_documents/",
  "property_photos/",
  "professionals/",
  "user_photos/",
  /** Existing bucket content / admin uploads */
  "config/",
];

const S3_UPLOAD_FOLDER_TO_PREFIX = {
  documents: "documents",
  property_documents: "property_documents",
  property_photos: "property_photos",
  professionals: "professionals",
  user_photos: "user_photos",
};

const VALID_UPLOAD_FOLDERS = new Set(Object.keys(S3_UPLOAD_FOLDER_TO_PREFIX));

/**
 * @param {string} key
 * @returns {boolean}
 */
function isAllowedS3KeyPrefix(key) {
  if (!key || typeof key !== "string") return false;
  const trimmed = key.trim();
  if (!trimmed || trimmed.length > 512) return false;
  if (trimmed.includes("..") || trimmed.includes("//") || trimmed.startsWith("/")) return false;
  return S3_ALLOWED_PREFIXES.some((p) => trimmed.startsWith(p));
}

/**
 * Normalize multipart field `upload_folder` (or `uploadFolder`) to a top-level prefix name (no slash).
 * Defaults to `documents` when missing or empty.
 * @param {Record<string, unknown>} body - e.g. req.body after multer
 * @returns {string|null} prefix segment or null if invalid
 */
function resolveUploadFolderPrefix(body) {
  const raw = (body?.upload_folder ?? body?.uploadFolder ?? "documents").toString().trim();
  if (!VALID_UPLOAD_FOLDERS.has(raw)) return null;
  return S3_UPLOAD_FOLDER_TO_PREFIX[raw];
}

/**
 * Property inspection analysis accepts PDFs uploaded as property documents (or legacy documents/).
 * @param {string} key
 * @returns {boolean}
 */
function isAllowedInspectionAnalysisS3Key(key) {
  if (!key || typeof key !== "string") return false;
  const t = key.trim();
  if (t.includes("..") || t.includes("//") || t.startsWith("/")) return false;
  return t.startsWith("documents/") || t.startsWith("property_documents/");
}

module.exports = {
  S3_ALLOWED_PREFIXES,
  VALID_UPLOAD_FOLDERS,
  isAllowedS3KeyPrefix,
  resolveUploadFolderPrefix,
  isAllowedInspectionAnalysisS3Key,
};
