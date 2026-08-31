"use strict";

/**
 * Authorize S3 object keys before issuing presigned GET URLs.
 * Prefix checks alone are not enough — keys are guessable.
 */

const { ForbiddenError } = require("../expressError");
const { isUserAuthorizedForProperty } = require("./propertyAccess");

/** Catalog / platform assets any logged-in user may preview. */
const SHARED_PREFIXES = ["email_assets/", "demo/", "professionals/", "agencies/"];

function isOwnUploadKey(key, userId) {
  if (!key || userId == null) return false;
  const slash = key.indexOf("/");
  if (slash < 0) return false;
  const rest = key.slice(slash + 1);
  const uid = String(userId);
  return rest === uid || rest.startsWith(`${uid}/`);
}

function startsWithSharedPrefix(key) {
  return SHARED_PREFIXES.some((prefix) => key.startsWith(prefix));
}

async function isLinkedToAnyAccount(userId, accountIds) {
  if (!accountIds.length) return false;
  const Account = require("../models/account");
  for (const accountId of accountIds) {
    if (await Account.isUserLinkedToAccount(userId, accountId)) return true;
  }
  return false;
}

async function userCanAccessS3Key(user, key, dbClient) {
  if (!user?.id || !key) return false;
  if (user.role === "super_admin" || user.role === "admin") return true;
  if (startsWithSharedPrefix(key)) return true;
  if (isOwnUploadKey(key, user.id)) return true;

  const db = dbClient || require("../db");
  const Account = require("../models/account");

  const propRes = await db.query(
    `SELECT property_id FROM property_documents WHERE document_key = $1
     UNION ALL
     SELECT property_id FROM staged_documents WHERE document_key = $1
     UNION ALL
     SELECT id AS property_id FROM properties WHERE main_photo = $1
     LIMIT 1`,
    [key],
  );
  if (propRes.rows[0]?.property_id) {
    return isUserAuthorizedForProperty(
      {
        userId: user.id,
        propertyId: propRes.rows[0].property_id,
        role: user.role,
      },
      db,
    );
  }

  const preRes = await db.query(
    `SELECT a.account_id
     FROM pre_purchase_documents d
     JOIN pre_purchase_analyses a ON a.id = d.analysis_id
     WHERE d.document_key = $1
     UNION ALL
     SELECT a.account_id
     FROM pre_purchase_notes n
     JOIN pre_purchase_analyses a ON a.id = n.analysis_id
     WHERE n.image_keys @> to_jsonb($1::text)
     LIMIT 1`,
    [key],
  );
  if (preRes.rows[0]?.account_id) {
    return Account.isUserLinkedToAccount(user.id, preRes.rows[0].account_id);
  }

  const brandRes = await db.query(
    `SELECT id AS account_id FROM accounts
     WHERE sidebar_icon_key = $1 OR agent_card_logo_key = $1
     LIMIT 1`,
    [key],
  );
  if (brandRes.rows[0]?.account_id) {
    return Account.isUserLinkedToAccount(user.id, brandRes.rows[0].account_id);
  }

  const commRes = await db.query(
    `SELECT c.account_id
     FROM communications c
     WHERE c.image_key = $1
     UNION ALL
     SELECT c.account_id
     FROM comm_attachments ca
     JOIN communications c ON c.id = ca.communication_id
     WHERE ca.file_key = $1
     LIMIT 1`,
    [key],
  );
  if (commRes.rows[0]?.account_id) {
    return Account.isUserLinkedToAccount(user.id, commRes.rows[0].account_id);
  }

  const ticketRes = await db.query(
    `SELECT account_id, created_by
     FROM support_tickets
     WHERE attachment_keys IS NOT NULL AND $1 = ANY(attachment_keys)
     LIMIT 1`,
    [key],
  );
  if (ticketRes.rows[0]) {
    if (Number(ticketRes.rows[0].created_by) === Number(user.id)) return true;
    return Account.isUserLinkedToAccount(user.id, ticketRes.rows[0].account_id);
  }

  const resourceRes = await db.query(
    `SELECT created_by, status FROM resources
     WHERE image_key = $1 OR pdf_key = $1
     LIMIT 1`,
    [key],
  );
  if (resourceRes.rows[0]) {
    if (Number(resourceRes.rows[0].created_by) === Number(user.id)) return true;
    if (resourceRes.rows[0].status === "sent") return true;
  }

  const contactRes = await db.query(
    `SELECT ac.account_id
     FROM contacts c
     JOIN account_contacts ac ON ac.contact_id = c.id
     WHERE c.image = $1
     LIMIT 8`,
    [key],
  );
  if (contactRes.rows.length) {
    return isLinkedToAnyAccount(
      user.id,
      contactRes.rows.map((row) => row.account_id),
    );
  }

  const userRes = await db.query(
    `SELECT id FROM users WHERE image = $1 OR avatar_url = $1 LIMIT 1`,
    [key],
  );
  if (userRes.rows[0]) {
    const targetId = userRes.rows[0].id;
    if (Number(targetId) === Number(user.id)) return true;
    const shared = await db.query(
      `SELECT 1 FROM account_users a
       JOIN account_users b ON a.account_id = b.account_id
       WHERE a.user_id = $1 AND b.user_id = $2
       LIMIT 1`,
      [user.id, targetId],
    );
    if (shared.rows.length) return true;
  }

  return false;
}

async function assertUserCanAccessS3Key(user, key, dbClient) {
  const allowed = await userCanAccessS3Key(user, key, dbClient);
  if (!allowed) {
    throw new ForbiddenError("You do not have access to this file.");
  }
}

module.exports = {
  isOwnUploadKey,
  startsWithSharedPrefix,
  userCanAccessS3Key,
  assertUserCanAccessS3Key,
};
