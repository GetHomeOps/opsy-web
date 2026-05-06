"use strict";

/**
 * S3 Service
 *
 * AWS S3 operations for file storage. Uploads files, deletes by key,
 * and generates presigned GET URLs for secure document preview.
 *
 * Exports: uploadFile, deleteFile, getPresignedUrl
 */

const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { AWS_REGION, AWS_S3_BUCKET } = require("../config");

const s3Client = new S3Client({
  region: AWS_REGION,
  followRegionRedirects: true, // Follow 301 redirects when bucket is in a different region
});

/**
 * Cache of S3Clients keyed by region. Used when reading from buckets that
 * live outside `AWS_REGION` (e.g. the SES-inbound mail bucket in us-east-1
 * while the main app bucket is in us-east-2). Always created with
 * `followRegionRedirects` so the wrong region still works, just slower.
 */
const _regionClientCache = new Map();
function getS3ClientForRegion(region) {
  if (!region || region === AWS_REGION) return s3Client;
  let client = _regionClientCache.get(region);
  if (!client) {
    client = new S3Client({ region, followRegionRedirects: true });
    _regionClientCache.set(region, client);
  }
  return client;
}

/** Presigned URL expiration in seconds (5 minutes). */
const PRESIGNED_EXPIRATION = 5 * 60;

/**
 * Upload a file buffer to S3.
 * @param {Buffer} fileBuffer - The file content
 * @param {string} key - S3 object key (path/filename)
 * @param {string} contentType - MIME type (e.g., application/pdf, image/jpeg)
 * @returns {Promise<{ key: string, url: string }>}
 */
async function uploadFile(fileBuffer, key, contentType) {
  const command = new PutObjectCommand({
    Bucket: AWS_S3_BUCKET,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
  });

  await s3Client.send(command);

  const url = `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;
  return { key, url };
}

/**
 * Delete a file from S3 by key.
 */
async function deleteFile(key) {
  const command = new DeleteObjectCommand({
    Bucket: AWS_S3_BUCKET,
    Key: key,
  });
  await s3Client.send(command);
}

/**
 * Infer image Content-Type from S3 key extension.
 * Used for ResponseContentType override to fix ORB (Opaque Response Blocking).
 */
function inferImageContentType(key) {
  const ext = (key || "").split(".").pop()?.toLowerCase();
  const map = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  };
  return map[ext] || null;
}

/**
 * Generate a presigned GET URL for secure document preview.
 * @param {string} key - S3 object key (path/filename)
 * @param {number} [expiresIn=300] - URL expiration in seconds (default 5 min)
 * @returns {Promise<string>} Presigned URL
 */
async function getPresignedUrl(key, expiresIn = PRESIGNED_EXPIRATION) {
  const command = new GetObjectCommand({
    Bucket: AWS_S3_BUCKET,
    Key: key,
  });
  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Generate a presigned GET URL for inline image display.
 * Sets ResponseContentType to the correct image MIME type to avoid ERR_BLOCKED_BY_ORB.
 * @param {string} key - S3 object key (path/filename)
 * @param {number} [expiresIn=300] - URL expiration in seconds (default 5 min)
 * @returns {Promise<string>} Presigned URL with Content-Type override
 */
async function getPresignedUrlForImage(key, expiresIn = PRESIGNED_EXPIRATION) {
  const contentType = inferImageContentType(key) || "image/jpeg";
  const command = new GetObjectCommand({
    Bucket: AWS_S3_BUCKET,
    Key: key,
    ResponseContentType: contentType,
  });
  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Download a file from S3 as a Buffer.
 *
 * Backwards compatible with `getFile(key)`; new callers may pass an options
 * object `{ key, bucket?, region? }` to read from a non-default bucket
 * (used by the SES inbound pipeline, whose bucket lives in us-east-1).
 *
 * @param {string|{ key: string, bucket?: string, region?: string }} keyOrOpts
 * @returns {Promise<Buffer>} File content
 */
async function getFile(keyOrOpts) {
  const opts =
    typeof keyOrOpts === "string" ? { key: keyOrOpts } : keyOrOpts || {};
  const { key, bucket, region } = opts;
  if (!key) throw new Error("getFile: key is required");

  const client = region ? getS3ClientForRegion(region) : s3Client;
  const command = new GetObjectCommand({
    Bucket: bucket || AWS_S3_BUCKET,
    Key: key,
  });
  const response = await client.send(command);
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

module.exports = { uploadFile, deleteFile, getPresignedUrl, getPresignedUrlForImage, getFile };