"use strict";

const db = require("../db");
const Tag = require("../models/tag");
const Contact = require("../models/contact");

const HOMEOWNER_TAG_NAME = "Homeowner";
const PROFESSIONAL_TAG_NAME = "Professional";
const INSTALLER_TAG_NAME = "Installer";
const CONTACT_SHARE_SOURCE = "contact_share";

const DEFAULT_ACCOUNT_TAG_NAMES = [HOMEOWNER_TAG_NAME, PROFESSIONAL_TAG_NAME];

function resolveDeps(deps = {}) {
  return {
    Tag: deps.Tag || Tag,
    Contact: deps.Contact || Contact,
    query: deps.query || ((sql, params) => db.query(sql, params)),
  };
}

function installerIdFromData(data) {
  if (!data || typeof data !== "object") return null;
  const raw = data.installer_id;
  if (raw == null || String(raw).trim() === "") return null;
  const id = Number(raw);
  return Number.isNaN(id) ? null : id;
}

function systemTagsForInvitationRole(intendedPropertyRole) {
  const role = String(intendedPropertyRole || "").trim().toLowerCase();
  return role === "homeowner" ? [HOMEOWNER_TAG_NAME] : [];
}

function systemTagsForContactSource(source) {
  return String(source || "").trim() === CONTACT_SHARE_SOURCE
    ? [PROFESSIONAL_TAG_NAME]
    : [];
}

/**
 * Ensure the account has a named tag and assign it to the contact.
 * Additive — does not remove other tags.
 */
async function ensureContactTag(contactId, accountId, tagName, deps) {
  if (contactId == null || accountId == null) return null;
  const trimmed = String(tagName ?? "").trim();
  if (!trimmed) return null;
  const { Tag: TagModel, Contact: ContactModel } = resolveDeps(deps);
  const tag = await TagModel.findOrCreate({
    accountId,
    name: trimmed,
  });
  await ContactModel.addTag(contactId, tag.id);
  return tag;
}

async function ensureHomeownerTag(contactId, accountId, deps) {
  return ensureContactTag(contactId, accountId, HOMEOWNER_TAG_NAME, deps);
}

async function ensureProfessionalTag(contactId, accountId, deps) {
  return ensureContactTag(contactId, accountId, PROFESSIONAL_TAG_NAME, deps);
}

/**
 * Contacts linked as system installers are identifiable professionals.
 * Applies Professional only — Installer is a job title, not a classification tag.
 */
async function ensureInstallerTag(contactId, accountId, deps) {
  return ensureProfessionalTag(contactId, accountId, deps);
}

async function ensureDefaultAccountTags(accountId, deps) {
  if (accountId == null) return [];
  const { Tag: TagModel } = resolveDeps(deps);
  const tags = [];
  for (const name of DEFAULT_ACCOUNT_TAG_NAMES) {
    tags.push(await TagModel.findOrCreate({ accountId, name }));
  }
  return tags;
}

async function applyInvitationContactTag(
  contactId,
  accountId,
  intendedPropertyRole,
  deps
) {
  const names = systemTagsForInvitationRole(intendedPropertyRole);
  const tags = [];
  for (const name of names) {
    const tag = await ensureContactTag(contactId, accountId, name, deps);
    if (tag) tags.push(tag);
  }
  return tags;
}

async function applyContactSourceTags(contactId, accountId, source, deps) {
  const names = systemTagsForContactSource(source);
  const tags = [];
  for (const name of names) {
    const tag = await ensureContactTag(contactId, accountId, name, deps);
    if (tag) tags.push(tag);
  }
  return tags;
}

async function accountIdForProperty(propertyId, deps) {
  if (propertyId == null) return null;
  const { query } = resolveDeps(deps);
  const res = await query(`SELECT account_id FROM properties WHERE id = $1`, [
    propertyId,
  ]);
  return res.rows[0]?.account_id || null;
}

/** Tag the contact stored as installer_id on a system data object, if any. */
async function ensureInstallerTagForSystemData(propertyId, data, deps) {
  const contactId = installerIdFromData(data);
  if (contactId == null) return null;
  const accountId = await accountIdForProperty(propertyId, deps);
  if (!accountId) return null;
  return ensureInstallerTag(contactId, accountId, deps);
}

/** Tag every distinct installer_id present on saved system rows. */
async function ensureInstallerTagsForSystems(propertyId, systems, deps) {
  const ids = new Set();
  for (const sys of systems || []) {
    const contactId = installerIdFromData(sys?.data);
    if (contactId != null) ids.add(contactId);
  }
  if (ids.size === 0) return;
  const accountId = await accountIdForProperty(propertyId, deps);
  if (!accountId) return;
  await Promise.all(
    [...ids].map((contactId) => ensureInstallerTag(contactId, accountId, deps))
  );
}

/**
 * Drop the legacy Installer classification tag after those contacts have
 * Professional. Installer remains a job title on contacts.role.
 */
async function retireInstallerSystemTags(deps) {
  const { query } = resolveDeps(deps);
  await query(
    `DELETE FROM contact_tags
      WHERE tag_id IN (SELECT id FROM tags WHERE name = $1)`,
    [INSTALLER_TAG_NAME]
  );
  const removed = await query(`DELETE FROM tags WHERE name = $1 RETURNING id`, [
    INSTALLER_TAG_NAME,
  ]);
  return (removed.rows || []).length;
}

/**
 * Idempotent backfill: Homeowner from homeowner invitations; Professional
 * from existing Installer tags and system installer_id refs. Then retire
 * the Installer classification tag.
 */
async function backfillContactSystemTags(deps) {
  const { query } = resolveDeps(deps);

  const homeownerRes = await query(
    `SELECT DISTINCT c.id AS contact_id, ac.account_id
       FROM contacts c
       JOIN account_contacts ac ON ac.contact_id = c.id
       JOIN invitations i ON i.account_id = ac.account_id
        AND c.email IS NOT NULL AND TRIM(c.email) != ''
        AND LOWER(TRIM(i.invitee_email)) = LOWER(TRIM(c.email))
      WHERE LOWER(TRIM(COALESCE(i.intended_property_role, ''))) = 'homeowner'`
  );

  const installerTaggedRes = await query(
    `SELECT DISTINCT ct.contact_id, t.account_id
       FROM contact_tags ct
       JOIN tags t ON t.id = ct.tag_id
      WHERE t.name = $1`,
    [INSTALLER_TAG_NAME]
  );

  const installerIdRes = await query(
    `SELECT DISTINCT p.account_id,
            NULLIF(TRIM(ps.data->>'installer_id'), '') AS installer_id
       FROM property_systems ps
       JOIN properties p ON p.id = ps.property_id
      WHERE ps.data ? 'installer_id'
        AND NULLIF(TRIM(ps.data->>'installer_id'), '') IS NOT NULL`
  );

  let homeownerCount = 0;
  for (const row of homeownerRes.rows || []) {
    await ensureHomeownerTag(row.contact_id, row.account_id, deps);
    homeownerCount += 1;
  }

  const professionalSeen = new Set();
  function professionalKey(contactId, accountId) {
    return `${contactId}:${accountId}`;
  }

  let professionalCount = 0;
  for (const row of installerTaggedRes.rows || []) {
    const key = professionalKey(row.contact_id, row.account_id);
    if (professionalSeen.has(key)) continue;
    professionalSeen.add(key);
    await ensureProfessionalTag(row.contact_id, row.account_id, deps);
    professionalCount += 1;
  }

  for (const row of installerIdRes.rows || []) {
    const contactId = Number(row.installer_id);
    if (!Number.isInteger(contactId) || contactId <= 0) continue;
    const key = professionalKey(contactId, row.account_id);
    if (!professionalSeen.has(key)) {
      professionalSeen.add(key);
      professionalCount += 1;
    }
    await ensureProfessionalTag(contactId, row.account_id, deps);
  }

  const retiredInstallerTags = await retireInstallerSystemTags(deps);

  return { homeownerCount, professionalCount, retiredInstallerTags };
}

module.exports = {
  HOMEOWNER_TAG_NAME,
  PROFESSIONAL_TAG_NAME,
  INSTALLER_TAG_NAME,
  CONTACT_SHARE_SOURCE,
  DEFAULT_ACCOUNT_TAG_NAMES,
  installerIdFromData,
  systemTagsForInvitationRole,
  systemTagsForContactSource,
  ensureContactTag,
  ensureHomeownerTag,
  ensureProfessionalTag,
  ensureInstallerTag,
  ensureDefaultAccountTags,
  applyInvitationContactTag,
  applyContactSourceTags,
  ensureInstallerTagForSystemData,
  ensureInstallerTagsForSystems,
  retireInstallerSystemTags,
  backfillContactSystemTags,
};
