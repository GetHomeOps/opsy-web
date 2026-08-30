"use strict";

/**
 * Find properties whose Homeaversary is today (homeowners) or in 7 days
 * (agents), claim a send row, then deliver via the email provider router.
 */

const db = require("../db");
const {
  nextAnniversaryDate,
  agentPreviewDate,
  yearsOwned,
  formatAnniversaryDate,
  ownerLabel,
  propertyAddressLabel,
  toDateOnly,
} = require("./homeAnniversaryService");
const { buildPropertyUrl, normalizeAccountSlug } = require("./customerIoLifecycleService");
const emailService = require("./emailService");
const {
  loadYearInReview,
  toMergeFields,
  propertyStreetLabel,
} = require("./homeaversaryYearInReview");

const AUDIENCE_HOMEOWNER = "homeowner";
const AUDIENCE_AGENT = "agent";

function firstNameFromUser(userName) {
  if (!userName || typeof userName !== "string") return null;
  const trimmed = userName.trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0] || null;
}

function utcToday(todayStr) {
  return todayStr || new Date().toISOString().slice(0, 10);
}

function classifyProperty(property, todayStr) {
  const lastSale = toDateOnly(property.last_sale_date);
  const anniversary = nextAnniversaryDate(lastSale, todayStr);
  if (!lastSale || !anniversary) {
    return { sendHomeowner: false, sendAgent: false, reason: "invalid_date" };
  }
  const years = yearsOwned(lastSale, anniversary);
  if (years < 1) {
    return { sendHomeowner: false, sendAgent: false, reason: "year_zero", anniversary, years };
  }
  const preview = agentPreviewDate(anniversary);
  return {
    sendHomeowner: anniversary === todayStr,
    sendAgent: preview === todayStr,
    anniversary,
    preview,
    years,
    lastSale,
  };
}

async function loadPropertiesWithSaleDate(query) {
  const res = await query(
    `SELECT p.id, p.last_sale_date, p.owner_name, p.occupant_name, p.property_name,
            p.address, p.address_line_1, p.city, p.state, p.property_uid, p.account_id,
            a.url AS account_url, a.name AS account_name
       FROM properties p
       JOIN accounts a ON a.id = p.account_id
      WHERE p.last_sale_date IS NOT NULL`
  );
  return res.rows;
}

async function loadRecipients(query, propertyId, audience) {
  const role = audience === AUDIENCE_AGENT ? "agent" : "homeowner";
  const res = await query(
    `SELECT u.id, u.email, u.name, LOWER(u.role::text) AS role
       FROM property_users pu
       JOIN users u ON u.id = pu.user_id
      WHERE pu.property_id = $1
        AND u.is_active = true
        AND LOWER(u.role::text) = $2
        AND u.email IS NOT NULL
        AND TRIM(u.email) <> ''`,
    [propertyId, role]
  );
  return res.rows;
}

async function claimSend(query, { propertyId, userId, audience, anniversaryYear }) {
  const res = await query(
    `INSERT INTO homeaversary_sends (property_id, user_id, audience, anniversary_year)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (property_id, user_id, audience, anniversary_year) DO NOTHING
     RETURNING id`,
    [propertyId, userId, audience, anniversaryYear]
  );
  return res.rows[0]?.id || null;
}

async function releaseClaim(query, claimId) {
  if (!claimId) return;
  await query(`DELETE FROM homeaversary_sends WHERE id = $1`, [claimId]);
}

function buildMergeContext(property, classification, review = null, audience = "homeowner") {
  const accountSlug = normalizeAccountSlug(
    property.account_url || property.account_name || "home"
  );
  const yearInReview = toMergeFields(review, {
    audience,
    yearsOwned: classification.years,
    streetLabel: propertyStreetLabel(property),
  });
  return {
    propertyAddress: propertyAddressLabel(property),
    propertyUrl: buildPropertyUrl(accountSlug, property.property_uid),
    yearsOwned: classification.years,
    anniversaryDate: formatAnniversaryDate(classification.anniversary),
    lastSaleDate: classification.lastSale,
    ownerName: ownerLabel(property),
    accountId: property.account_id,
    ...yearInReview,
  };
}

async function sendToRecipient({
  audience,
  user,
  merge,
  sendHomeowner,
  sendAgent,
}) {
  const recipientFirstName = firstNameFromUser(user.name) || "there";
  const usage = {
    accountId: merge.accountId,
    userId: user.id,
  };
  const payload = {
    to: user.email,
    recipientFirstName,
    propertyAddress: merge.propertyAddress,
    propertyUrl: merge.propertyUrl,
    yearsOwned: merge.yearsOwned,
    anniversaryDate: merge.anniversaryDate,
    lastSaleDate: merge.lastSaleDate,
    tasksCompletedCount: merge.tasksCompletedCount,
    documentsUploadedCount: merge.documentsUploadedCount,
    systemsServicedCount: merge.systemsServicedCount,
    hasYearInReview: merge.hasYearInReview,
    yearInReviewHtml: merge.yearInReviewHtml,
    milestoneHtml: merge.milestoneHtml,
    milestone1Title: merge.milestone1Title,
    milestone1Body: merge.milestone1Body,
    milestone2Title: merge.milestone2Title,
    milestone2Body: merge.milestone2Body,
    milestone3Title: merge.milestone3Title,
    milestone3Body: merge.milestone3Body,
    usage,
  };
  if (audience === AUDIENCE_AGENT) {
    return sendAgent({ ...payload, ownerName: merge.ownerName });
  }
  return sendHomeowner(payload);
}

/**
 * Sweep properties and send due Homeaversary emails.
 * @param {string} [todayStr] YYYY-MM-DD for tests
 * @param {object} [deps]
 */
async function runHomeaversarySweep(todayStr, deps = {}) {
  const query = deps.queryFn || ((sql, params) => db.query(sql, params));
  const sendHomeowner = deps.sendHomeowner || emailService.sendHomeaversaryHomeownerEmail;
  const sendAgent = deps.sendAgent || emailService.sendHomeaversaryAgentEmail;
  const today = utcToday(todayStr);

  const properties = await loadPropertiesWithSaleDate(query);
  const result = {
    properties: properties.length,
    homeownerSent: 0,
    agentSent: 0,
    skipped: 0,
    failed: 0,
  };

  for (const property of properties) {
    const classification = classifyProperty(property, today);
    if (!classification.sendHomeowner && !classification.sendAgent) {
      result.skipped += 1;
      continue;
    }

    const review = await loadYearInReview(property.id, { query });
    const anniversaryYear = parseInt(classification.anniversary.slice(0, 4), 10);
    const audiences = [];
    if (classification.sendHomeowner) audiences.push(AUDIENCE_HOMEOWNER);
    if (classification.sendAgent) audiences.push(AUDIENCE_AGENT);

    for (const audience of audiences) {
      const merge = buildMergeContext(property, classification, review, audience);
      const recipients = await loadRecipients(query, property.id, audience);
      if (!recipients.length) {
        result.skipped += 1;
        continue;
      }
      for (const user of recipients) {
        const claimId = await claimSend(query, {
          propertyId: property.id,
          userId: user.id,
          audience,
          anniversaryYear,
        });
        if (!claimId) {
          result.skipped += 1;
          continue;
        }
        try {
          const sent = await sendToRecipient({
            audience,
            user,
            merge,
            sendHomeowner,
            sendAgent,
          });
          if (sent?.success === false) {
            await releaseClaim(query, claimId);
            result.failed += 1;
            continue;
          }
          if (audience === AUDIENCE_AGENT) result.agentSent += 1;
          else result.homeownerSent += 1;
        } catch (err) {
          await releaseClaim(query, claimId);
          result.failed += 1;
          console.warn(
            `[homeaversary] send failed property=${property.id} user=${user.id}:`,
            err?.message
          );
        }
      }
    }
  }

  return result;
}

module.exports = {
  AUDIENCE_HOMEOWNER,
  AUDIENCE_AGENT,
  classifyProperty,
  firstNameFromUser,
  buildMergeContext,
  runHomeaversarySweep,
  claimSend,
  releaseClaim,
};
