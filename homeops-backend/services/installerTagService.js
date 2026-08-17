"use strict";

const db = require("../db");
const Tag = require("../models/tag");
const Contact = require("../models/contact");

const INSTALLER_TAG_NAME = "Installer";

function installerIdFromData(data) {
  if (!data || typeof data !== "object") return null;
  const raw = data.installer_id;
  if (raw == null || String(raw).trim() === "") return null;
  const id = Number(raw);
  return Number.isNaN(id) ? null : id;
}

/**
 * Ensure the account has an "Installer" tag and assign it to the contact.
 * Additive — does not remove other tags or change job title.
 */
async function ensureInstallerTag(contactId, accountId) {
  if (contactId == null || accountId == null) return null;
  const tag = await Tag.findOrCreate({
    accountId,
    name: INSTALLER_TAG_NAME,
  });
  await Contact.addTag(contactId, tag.id);
  return tag;
}

async function accountIdForProperty(propertyId) {
  if (propertyId == null) return null;
  const res = await db.query(`SELECT account_id FROM properties WHERE id = $1`, [
    propertyId,
  ]);
  return res.rows[0]?.account_id || null;
}

/** Tag the contact stored as installer_id on a system data object, if any. */
async function ensureInstallerTagForSystemData(propertyId, data) {
  const contactId = installerIdFromData(data);
  if (contactId == null) return null;
  const accountId = await accountIdForProperty(propertyId);
  if (!accountId) return null;
  return ensureInstallerTag(contactId, accountId);
}

/** Tag every distinct installer_id present on saved system rows. */
async function ensureInstallerTagsForSystems(propertyId, systems) {
  const ids = new Set();
  for (const sys of systems || []) {
    const contactId = installerIdFromData(sys?.data);
    if (contactId != null) ids.add(contactId);
  }
  if (ids.size === 0) return;
  const accountId = await accountIdForProperty(propertyId);
  if (!accountId) return;
  await Promise.all(
    [...ids].map((contactId) => ensureInstallerTag(contactId, accountId)),
  );
}

module.exports = {
  INSTALLER_TAG_NAME,
  installerIdFromData,
  ensureInstallerTag,
  ensureInstallerTagForSystemData,
  ensureInstallerTagsForSystems,
};
