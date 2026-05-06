"use strict";

/**
 * Inbound Email Service (SES → S3 → SNS → /webhooks/ses-inbound)
 *
 * Pipeline:
 *   1. AWS SES receives mail addressed to `documents+{property_uid}@{INBOUND_EMAIL_DOMAIN}`
 *      and writes the raw MIME to `SES_INBOUND_BUCKET`, then publishes to
 *      `SES_INBOUND_SNS_TOPIC_ARN`. If the receipt rule ends with “Publish to SNS”,
 *      the notification’s `receipt.action.type` is `SNS`; we still locate the S3 object
 *      via `mail.messageId` + `SES_INBOUND_S3_PREFIX` (see `resolveInboundS3Location`).
 *   2. SNS POSTs the notification (JSON body, `Content-Type: text/plain`) to
 *      `POST /webhooks/ses-inbound` on this server.
 *   3. The route hands off to `verifyAndProcessSnsMessage` below, which:
 *        - validates SNS subscription confirmations / signatures,
 *        - fetches the raw MIME from S3,
 *        - parses it (mailparser `simpleParser`),
 *        - resolves recipient → property and sender → user,
 *        - applies the same authorization policy as the HTTP API
 *          (super_admin / admin OR property_users membership OR pending invite),
 *        - re-uploads each acceptable attachment to the main bucket under
 *          the `property_documents/` prefix and inserts a `staged_documents`
 *          row per file. The Documents-tab inbox renders these like any
 *          other staged document; the user drags them into a folder to file.
 *
 * Sender allow-list and MIME / size limits mirror the HTTP path, so the
 * security posture for emailed documents matches direct uploads.
 *
 * Exports:
 *   - verifyAndProcessSnsMessage(rawBody, headers): top-level entry point for
 *     /webhooks/ses-inbound. Handles SubscriptionConfirmation +
 *     UnsubscribeConfirmation in addition to Notification messages.
 *   - processInboundEmail({ bucket, key }): exposed for tests and reprocessing.
 */

const crypto = require("crypto");
const https = require("https");
const { simpleParser } = require("mailparser");
const { ulid } = require("ulid");

const db = require("../db");
const {
  SES_INBOUND_BUCKET,
  SES_INBOUND_S3_PREFIX,
  SES_INBOUND_BUCKET_REGION,
  SES_INBOUND_SNS_TOPIC_ARN,
  INBOUND_EMAIL_DOMAIN,
  INBOUND_EMAIL_LOCAL_PART,
} = require("../config");
const { getFile, uploadFile } = require("./s3Service");
const { isUserAuthorizedForProperty } = require("../helpers/propertyAccess");
const { isPropertyUid } = require("../helpers/properties");
const StagedDocument = require("../models/stagedDocuments");
const {
  MAX_DOCUMENT_UPLOAD_BYTES,
  MAX_DOCUMENT_UPLOAD_LABEL,
} = require("../constants/documentUpload");

/* ---------------------------------------------------------------------- */
/* Constants                                                              */
/* ---------------------------------------------------------------------- */

/** Same MIME allowlist as POST /documents/upload (routes/documents.js). */
const ACCEPTED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
]);

/** Map MIME → canonical extension for naming new S3 keys. */
const MIME_TO_EXT = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
};

/** Hard cap on attachments per email. SES currently delivers ~30MB/email. */
const MAX_ATTACHMENTS_PER_EMAIL = 50;

/** SES sets these headers; treat any FAIL as untrusted. */
const SES_VERDICT_HEADERS = [
  "x-ses-spam-verdict",
  "x-ses-virus-verdict",
  "x-ses-spf-verdict",
  // Skip DKIM / DMARC FAIL-closed: many legitimate forwarders fail DKIM.
];

/* ---------------------------------------------------------------------- */
/* SNS verification                                                       */
/* ---------------------------------------------------------------------- */

/**
 * Whitelist for the SNS signing-cert URL host. SNS only ever publishes
 * certificates from `sns.<region>.amazonaws.com` (or the China / GovCloud
 * partitions, which we don't run in). Without this check, an attacker could
 * trick us into trusting their own cert by spoofing `SigningCertURL`.
 */
const SNS_CERT_URL_PATTERN =
  /^https:\/\/sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?\/[\w.\-/]+\.pem$/;

/** GET an HTTPS URL as a Buffer. Used to fetch the SNS signing certificate. */
function httpsGetBuffer(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`SNS cert fetch failed: HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(5000, () => req.destroy(new Error("SNS cert fetch timed out")));
  });
}

/**
 * Tiny LRU-ish cache for SNS signing certs. Keyed by URL. Not bounded; the
 * key space is essentially "the AWS SNS cert filename per region" so a
 * handful of entries at most.
 */
const _certCache = new Map();
async function getSnsCert(url) {
  if (_certCache.has(url)) return _certCache.get(url);
  const pem = await httpsGetBuffer(url);
  _certCache.set(url, pem);
  return pem;
}

/**
 * Compute the canonical string to verify per the SNS docs.
 * https://docs.aws.amazon.com/sns/latest/dg/sns-verify-signature-of-message.html
 */
function buildStringToSign(message) {
  const fields =
    message.Type === "Notification"
      ? message.Subject != null
        ? ["Message", "MessageId", "Subject", "Timestamp", "TopicArn", "Type"]
        : ["Message", "MessageId", "Timestamp", "TopicArn", "Type"]
      : [
          "Message",
          "MessageId",
          "SubscribeURL",
          "Timestamp",
          "Token",
          "TopicArn",
          "Type",
        ];

  return fields
    .filter((k) => message[k] != null)
    .map((k) => `${k}\n${message[k]}\n`)
    .join("");
}

/** Verify the SNS message signature. Throws on failure. */
async function verifySnsSignature(message) {
  if (!message.SigningCertURL || !message.Signature) {
    throw new Error("SNS message missing signature fields");
  }
  if (!SNS_CERT_URL_PATTERN.test(message.SigningCertURL)) {
    throw new Error(
      `SNS signing cert URL not trusted: ${message.SigningCertURL}`,
    );
  }

  const cert = await getSnsCert(message.SigningCertURL);
  const algo =
    message.SignatureVersion === "2" ? "RSA-SHA256" : "RSA-SHA1";
  const stringToSign = buildStringToSign(message);

  const verifier = crypto.createVerify(algo);
  verifier.update(stringToSign, "utf8");
  const ok = verifier.verify(cert, message.Signature, "base64");
  if (!ok) throw new Error("SNS signature verification failed");
}

/** Auto-confirm an SNS subscription by GETting SubscribeURL. */
async function confirmSnsSubscription(message) {
  if (!message.SubscribeURL) return;
  if (!SNS_CERT_URL_PATTERN.test(message.SigningCertURL || "")) {
    throw new Error("Refusing to confirm SNS subscription: cert URL untrusted");
  }
  await httpsGetBuffer(message.SubscribeURL);
}

/* ---------------------------------------------------------------------- */
/* Address parsing                                                        */
/* ---------------------------------------------------------------------- */

/**
 * Extract the property_uid from a recipient like
 *   `documents+12345678@inbox.heyopsy.com`
 *
 * Returns the property_uid string, or null if the address doesn't match
 * the configured local-part / domain. Tolerates display names ("Name <addr>")
 * and is case-insensitive on the domain.
 */
function extractPropertyUidFromAddress(address) {
  if (!address || typeof address !== "string") return null;

  const angleMatch = address.match(/<([^>]+)>/);
  const bare = (angleMatch ? angleMatch[1] : address).trim().toLowerCase();

  const at = bare.lastIndexOf("@");
  if (at <= 0) return null;
  const local = bare.slice(0, at);
  const domain = bare.slice(at + 1);

  if (domain !== INBOUND_EMAIL_DOMAIN.toLowerCase()) return null;

  const expectedLocal = INBOUND_EMAIL_LOCAL_PART.toLowerCase();
  if (!local.startsWith(`${expectedLocal}+`)) return null;
  const tag = local.slice(expectedLocal.length + 1);
  if (!isPropertyUid(tag)) return null;
  return tag;
}

/**
 * Look at every plausible recipient (To + Cc + Bcc + the SES-supplied
 * `commonHeaders.to`) and return the first one that decodes to a property_uid.
 */
function findPropertyUidFromMessage(parsed, sesMail) {
  const candidates = [];
  const pushAddrs = (block) => {
    if (!block) return;
    if (Array.isArray(block)) {
      block.forEach(pushAddrs);
      return;
    }
    if (typeof block === "string") {
      candidates.push(block);
      return;
    }
    if (block.text) candidates.push(block.text);
    if (Array.isArray(block.value)) {
      block.value.forEach((v) => v?.address && candidates.push(v.address));
    }
  };

  pushAddrs(parsed.to);
  pushAddrs(parsed.cc);
  pushAddrs(parsed.bcc);
  if (sesMail?.commonHeaders?.to) pushAddrs(sesMail.commonHeaders.to);
  if (Array.isArray(sesMail?.destination)) pushAddrs(sesMail.destination);

  for (const candidate of candidates) {
    const uid = extractPropertyUidFromAddress(candidate);
    if (uid) return uid;
  }
  return null;
}

function extractSenderAddress(parsed) {
  const fromAddr = parsed?.from?.value?.[0]?.address;
  if (typeof fromAddr === "string" && fromAddr.includes("@")) {
    return fromAddr.toLowerCase().trim();
  }
  return null;
}

/* ---------------------------------------------------------------------- */
/* SES verdicts                                                           */
/* ---------------------------------------------------------------------- */

function failsAnySesVerdict(parsed) {
  const headers = parsed?.headers;
  if (!headers || typeof headers.get !== "function") return [];
  const failed = [];
  for (const name of SES_VERDICT_HEADERS) {
    const value = headers.get(name);
    if (!value) continue;
    // mailparser returns either a string or { value: string }
    const raw = typeof value === "string" ? value : value.value || "";
    let parsedVal;
    try {
      parsedVal = JSON.parse(raw);
    } catch (_) {
      parsedVal = { status: raw };
    }
    if (
      parsedVal &&
      typeof parsedVal.status === "string" &&
      parsedVal.status.toUpperCase() === "FAIL"
    ) {
      failed.push(name);
    }
  }
  return failed;
}

/* ---------------------------------------------------------------------- */
/* Document type heuristic                                                */
/* ---------------------------------------------------------------------- */

/**
 * Light heuristic to pre-fill `proposed_document_type` from the filename and
 * email subject. The Documents-tab inbox lets the user override before
 * filing, so a wrong guess here is harmless. Mirrors filenameHeuristics.js
 * on the frontend at a high level (without the system_key inference, which
 * the user can pick when they drag the card into a folder).
 */
function guessDocumentType({ filename, subject }) {
  const text = `${filename || ""} ${subject || ""}`.toLowerCase();
  if (/\binvoice|\binvoices\b|\binv\b/.test(text)) return "receipt";
  if (/receipt/.test(text)) return "receipt";
  if (/contract|agreement/.test(text)) return "contract";
  if (/warranty/.test(text)) return "warranty";
  if (/inspection/.test(text)) return "inspection";
  if (/permit/.test(text)) return "permit";
  if (/manual|guide/.test(text)) return "manual";
  if (/insurance|policy/.test(text)) return "insurance";
  if (/mortgage|loan/.test(text)) return "mortgage";
  return null;
}

/* ---------------------------------------------------------------------- */
/* Filename / sanitization                                                */
/* ---------------------------------------------------------------------- */

function safeBaseName(originalName) {
  const cleaned = (originalName || "attachment")
    .replace(/[\u0000-\u001f]/g, "")
    .trim();
  // Strip any directory components the sender may have included.
  const noPath = cleaned.split(/[\\/]/).pop() || "attachment";
  return noPath.slice(0, 250);
}

function pickExtension(filename, mimeType) {
  const dotIdx = filename.lastIndexOf(".");
  const ext = dotIdx >= 0 ? filename.slice(dotIdx + 1).toLowerCase() : "";
  if (ext && ext.length <= 6) return ext;
  return MIME_TO_EXT[mimeType] || "bin";
}

function nameWithoutExtension(filename) {
  const dotIdx = filename.lastIndexOf(".");
  if (dotIdx <= 0) return filename;
  return filename.slice(0, dotIdx);
}

/* ---------------------------------------------------------------------- */
/* Main pipeline                                                          */
/* ---------------------------------------------------------------------- */

/**
 * Resolve the incoming sender to a user row with a `users.email` match.
 * Case-insensitive on email. Returns the user row (id, email, role) or null.
 */
async function findUserByEmail(email) {
  if (!email) return null;
  const result = await db.query(
    `SELECT id, email, role FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [email],
  );
  return result.rows[0] || null;
}

async function findPropertyByUid(propertyUid) {
  const result = await db.query(
    `SELECT id, property_uid, account_id FROM properties WHERE property_uid = $1`,
    [propertyUid],
  );
  return result.rows[0] || null;
}

/**
 * Persist an audit-only row. Best-effort: never throws, never blocks ingest.
 * For now we just log; if `inbound_email_events` is added later the schema
 * change is local to this file.
 */
function logIngestion(reason, details) {
  if (process.env.NODE_ENV === "test") return;
  const safeDetails = { ...details };
  // Don't dump full MIME bodies to logs.
  delete safeDetails.body;
  console.info(
    `[inboundEmail] ${reason}`,
    JSON.stringify(safeDetails, null, 0),
  );
}

/**
 * Main worker. Takes a `{ bucket, key }` referring to the raw MIME object
 * SES wrote to S3, parses it, applies authorization, and inserts staged
 * documents. Idempotent on the per-email scale only insofar as it always
 * creates new staged rows; SES typically only delivers each message once.
 *
 * @param {{ bucket?: string, key: string, sesMail?: object }} args
 *   sesMail is the `mail` object from the SES notification (timestamp,
 *   commonHeaders, etc.) used as a fallback for header lookups.
 */
async function processInboundEmail({ bucket, key, sesMail } = {}) {
  if (!key) throw new Error("processInboundEmail: key is required");
  const effectiveBucket = bucket || SES_INBOUND_BUCKET;
  if (!effectiveBucket) {
    throw new Error(
      "Inbound mail bucket is not configured (SES_INBOUND_BUCKET).",
    );
  }

  const raw = await getFile({
    key,
    bucket: effectiveBucket,
    region: SES_INBOUND_BUCKET_REGION,
  });
  const parsed = await simpleParser(raw);

  /* 1. Reject anything SES marked as failing. */
  const failedVerdicts = failsAnySesVerdict(parsed);
  if (failedVerdicts.length) {
    logIngestion("rejected:ses_verdict", {
      key,
      verdicts: failedVerdicts,
      messageId: parsed.messageId,
    });
    return { status: "rejected", reason: "ses_verdict", verdicts: failedVerdicts };
  }

  /* 2. Resolve property from the recipient subaddress. */
  const propertyUid = findPropertyUidFromMessage(parsed, sesMail);
  if (!propertyUid) {
    logIngestion("rejected:no_property_uid", {
      key,
      messageId: parsed.messageId,
    });
    return { status: "rejected", reason: "no_property_uid" };
  }
  const property = await findPropertyByUid(propertyUid);
  if (!property) {
    logIngestion("rejected:property_not_found", { key, propertyUid });
    return { status: "rejected", reason: "property_not_found", propertyUid };
  }

  /* 3. Resolve sender → user, then run the same auth check as the API. */
  const senderEmail = extractSenderAddress(parsed);
  const senderUser = senderEmail ? await findUserByEmail(senderEmail) : null;
  if (!senderUser) {
    logIngestion("rejected:unknown_sender", {
      key,
      propertyUid,
      sender: senderEmail,
    });
    return {
      status: "rejected",
      reason: "unknown_sender",
      sender: senderEmail,
    };
  }
  const authorized = await isUserAuthorizedForProperty({
    userId: senderUser.id,
    propertyId: property.id,
    role: senderUser.role,
  });
  if (!authorized) {
    logIngestion("rejected:sender_not_authorized", {
      key,
      propertyUid,
      sender: senderEmail,
      userId: senderUser.id,
    });
    return {
      status: "rejected",
      reason: "sender_not_authorized",
      sender: senderEmail,
    };
  }

  /* 4. Walk attachments: validate, re-upload, stage. */
  const attachments = Array.isArray(parsed.attachments)
    ? parsed.attachments.slice(0, MAX_ATTACHMENTS_PER_EMAIL)
    : [];

  if (!attachments.length) {
    logIngestion("rejected:no_attachments", { key, propertyUid });
    return { status: "rejected", reason: "no_attachments" };
  }

  const subject = parsed.subject || null;
  const proposedDate =
    parsed.date && parsed.date instanceof Date && !Number.isNaN(parsed.date.getTime())
      ? parsed.date.toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

  const ingested = [];
  const skipped = [];

  for (const att of attachments) {
    // Filter out inline content with no clear filename + non-document MIME
    // (signatures, marketing pixels, etc.).
    const mime = (att.contentType || "").split(";")[0].trim().toLowerCase();
    const filename = safeBaseName(att.filename || `attachment.${MIME_TO_EXT[mime] || "bin"}`);
    const size = att.size || (att.content ? att.content.length : 0);

    if (!ACCEPTED_MIME_TYPES.has(mime)) {
      skipped.push({ filename, reason: "unsupported_mime", mime });
      continue;
    }
    if (size > MAX_DOCUMENT_UPLOAD_BYTES) {
      skipped.push({ filename, reason: "too_large", size });
      continue;
    }
    if (!Buffer.isBuffer(att.content) || size === 0) {
      skipped.push({ filename, reason: "empty" });
      continue;
    }

    const ext = pickExtension(filename, mime);
    const newKey =
      `property_documents/${senderUser.id}/${Date.now()}-${ulid().slice(-8)}.${ext}`;

    try {
      await uploadFile(att.content, newKey, mime);
    } catch (err) {
      skipped.push({
        filename,
        reason: "s3_upload_failed",
        message: err?.message,
      });
      continue;
    }

    const proposedName = nameWithoutExtension(filename) || filename;
    const proposedType = guessDocumentType({ filename, subject });

    try {
      const stagedRow = await StagedDocument.create({
        property_id: property.id,
        user_id: senderUser.id,
        document_key: newKey,
        original_name: filename,
        file_size_bytes: size,
        mime_type: mime,
        proposed_system_key: null, // user picks the folder by drag-drop
        proposed_document_type: proposedType,
        proposed_document_name: proposedName,
        proposed_document_date: proposedDate,
        upload_status: "uploaded",
        source: "email",
        source_metadata: {
          from: senderEmail,
          subject,
          sesMessageId: parsed.messageId || null,
          rawMimeKey: key,
          ingestedAt: new Date().toISOString(),
        },
      });
      ingested.push({ stagedDocumentId: stagedRow.id, key: newKey });
    } catch (err) {
      skipped.push({
        filename,
        reason: "stage_insert_failed",
        message: err?.message,
      });
    }
  }

  logIngestion("ingested", {
    key,
    propertyUid,
    propertyId: property.id,
    sender: senderEmail,
    ingestedCount: ingested.length,
    skippedCount: skipped.length,
  });

  return {
    status: "ingested",
    propertyId: property.id,
    propertyUid,
    senderUserId: senderUser.id,
    ingested,
    skipped,
    sizeLabel: MAX_DOCUMENT_UPLOAD_LABEL,
  };
}

/* ---------------------------------------------------------------------- */
/* SNS entry point                                                        */
/* ---------------------------------------------------------------------- */

/**
 * Normalize SES rule object key prefix (e.g. "raw", "raw/", "/raw/" → "raw/").
 */
function normalizeSesInboundKeyPrefix(prefix) {
  const raw = (prefix == null ? "" : String(prefix)).trim();
  if (!raw) return "";
  const noLeadingSlash = raw.replace(/^\/+/g, "");
  return noLeadingSlash.endsWith("/") ? noLeadingSlash : `${noLeadingSlash}/`;
}

/**
 * Resolve { bucket, key } for the raw MIME object SES wrote.
 *
 * SES sends different `receipt.action` shapes depending on which rule action
 * triggered the SNS publish:
 * - **S3-triggered** notification: `action.type === "S3"` includes bucketName + objectKey.
 * - **SNS action last** (common: Deliver to S3 → Publish to SNS): `action.type === "SNS"`.
 *   The payload has no bucket/key; AWS documents `mail.messageId` as the S3 object name
 *   when the message was saved to S3, prefixed by the rule’s object key prefix.
 *
 * @see https://docs.aws.amazon.com/ses/latest/dg/receiving-email-notifications-contents.html
 */
function resolveInboundS3Location(inner) {
  const receipt = inner?.receipt;
  const mail = inner?.mail;
  const action = receipt?.action;

  if (action?.type === "S3" && action.bucketName && action.objectKey) {
    return { bucket: action.bucketName, key: action.objectKey };
  }

  const actions = receipt?.actions;
  if (Array.isArray(actions)) {
    const s3 = actions.find(
      (a) => a?.type === "S3" && a.bucketName && a.objectKey,
    );
    if (s3) return { bucket: s3.bucketName, key: s3.objectKey };
  }

  const messageId = mail?.messageId;
  if (action?.type === "SNS" && messageId && SES_INBOUND_BUCKET) {
    const p = normalizeSesInboundKeyPrefix(SES_INBOUND_S3_PREFIX);
    return { bucket: SES_INBOUND_BUCKET, key: `${p}${messageId}` };
  }

  return null;
}

/**
 * Top-level entry point for `POST /webhooks/ses-inbound`. Handles every
 * SNS message type. Body is the raw request payload (string or Buffer).
 *
 * Returns a status object the route can serialize as JSON. Throws if the
 * payload is malformed or the signature can't be verified.
 */
async function verifyAndProcessSnsMessage(rawBody) {
  const text =
    Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody || "");
  if (!text.trim()) {
    throw new Error("Empty SNS body");
  }

  let message;
  try {
    message = JSON.parse(text);
  } catch (err) {
    throw new Error(`SNS body is not valid JSON: ${err.message}`);
  }

  if (
    SES_INBOUND_SNS_TOPIC_ARN &&
    message.TopicArn &&
    message.TopicArn !== SES_INBOUND_SNS_TOPIC_ARN
  ) {
    throw new Error(
      `SNS TopicArn mismatch: got ${message.TopicArn}, expected ${SES_INBOUND_SNS_TOPIC_ARN}`,
    );
  }

  await verifySnsSignature(message);

  if (
    message.Type === "SubscriptionConfirmation" ||
    message.Type === "UnsubscribeConfirmation"
  ) {
    await confirmSnsSubscription(message);
    return { status: "subscription_handled", type: message.Type };
  }

  if (message.Type !== "Notification") {
    return { status: "ignored", type: message.Type };
  }

  let inner;
  try {
    inner = JSON.parse(message.Message);
  } catch (err) {
    throw new Error(`SNS notification.Message is not valid JSON: ${err.message}`);
  }

  // SES delivers { receipt, mail, content? }. We fetch raw MIME from S3 when
  // the rule saved there (see resolveInboundS3Location — SNS-terminated receipts
  // still follow an earlier S3 write if configured).
  const loc = resolveInboundS3Location(inner);
  if (!loc) {
    const action = inner?.receipt?.action;
    return {
      status: "ignored",
      reason: "non_s3_action",
      actionType: action?.type || null,
    };
  }

  const result = await processInboundEmail({
    bucket: loc.bucket,
    key: loc.key,
    sesMail: inner.mail,
  });
  return result;
}

module.exports = {
  verifyAndProcessSnsMessage,
  processInboundEmail,
  // exported for unit tests:
  extractPropertyUidFromAddress,
  findPropertyUidFromMessage,
  guessDocumentType,
  ACCEPTED_MIME_TYPES,
  MAX_ATTACHMENTS_PER_EMAIL,
};
