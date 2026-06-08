"use strict";

const db = require("../db");
const System = require("../models/system");
const { mapSystemsFromBackend, toCamelCase } = require("../utils/mapSystemsFromBackend");
const {
  IDENTITY_SECTIONS,
  FIELD_ALIASES,
  SYSTEM_SECTIONS,
  IS_NEW_INSTALL_FIELD_BY_SYSTEM,
  LAST_INSPECTION_FIELD_BY_SYSTEM,
  AGE_FROM_INSTALL_DATE,
  DEFAULT_SYSTEM_IDS,
  SYSTEM_LABELS,
  MAX_GAP_ITEMS,
} = require("../constants/propertyDataGapRules");

const EMPTY_MISSING_DATA_MERGE = {
  propertyStreet: "",
  missingDataCount: 0,
  missingDataSummary: "",
  missingDataHtml: "",
  missingDataItem1Title: "",
  missingDataItem1Body: "",
  missingDataItem2Title: "",
  missingDataItem2Body: "",
  missingDataItem3Title: "",
  missingDataItem3Body: "",
};

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isFilled(value) {
  if (value == null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (typeof value === "number") return true;
  if (typeof value === "boolean") return true;
  return true;
}

function getFieldValue(propertyData, key) {
  const val = propertyData?.[key];
  if (val != null && (typeof val !== "string" || String(val).trim() !== "")) {
    return val;
  }
  if (key === "address") {
    const fullAddr = propertyData?.fullAddress;
    if (fullAddr != null && String(fullAddr).trim()) return fullAddr;
    const line1 = propertyData?.addressLine1;
    const city = propertyData?.city;
    const state = propertyData?.state;
    const zip = propertyData?.zip;
    if (
      line1 &&
      String(line1).trim() &&
      city &&
      String(city).trim() &&
      state &&
      String(state).trim() &&
      zip &&
      String(zip).trim()
    ) {
      return [line1, city, state, zip].filter(Boolean).join(", ");
    }
  }
  const aliases = FIELD_ALIASES[key];
  if (!aliases) return val;
  for (const alt of aliases) {
    const altVal = propertyData[alt];
    if (altVal != null) return altVal;
  }
  return undefined;
}

function isSectionComplete(propertyData, section) {
  return section.fields.every((key) => isFilled(getFieldValue(propertyData, key)));
}

function getAgeFromInstallDate(installDate) {
  if (!installDate || typeof installDate !== "string") return null;
  const install = new Date(installDate);
  if (Number.isNaN(install.getTime())) return null;
  const now = new Date();
  let totalMonths =
    (now.getFullYear() - install.getFullYear()) * 12 +
    (now.getMonth() - install.getMonth());
  if (now.getDate() < install.getDate()) totalMonths--;
  if (totalMonths < 0) return null;
  return { years: Math.floor(totalMonths / 12), months: totalMonths % 12 };
}

function isFieldFilled(propertyData, field) {
  if (isFilled(propertyData[field])) return true;
  const installDateField = AGE_FROM_INSTALL_DATE[field];
  if (installDateField && isFilled(propertyData[installDateField])) {
    return getAgeFromInstallDate(propertyData[installDateField]) !== null;
  }
  return false;
}

function getSystemProgress(propertyData, systemId) {
  const section = SYSTEM_SECTIONS[systemId];
  if (!section) return { filled: 0, total: 0, percent: 0 };

  let fields = section.fields;
  const isNewInstallField = IS_NEW_INSTALL_FIELD_BY_SYSTEM[systemId];
  const lastInspectionField = LAST_INSPECTION_FIELD_BY_SYSTEM[systemId];
  if (
    lastInspectionField &&
    isNewInstallField &&
    isFilled(propertyData[isNewInstallField])
  ) {
    fields = fields.filter((f) => f !== lastInspectionField);
  }

  const total = fields.length;
  const filled = fields.filter((field) => isFieldFilled(propertyData, field)).length;
  const percent = total > 0 ? (filled / total) * 100 : 0;
  return { filled, total, percent };
}

function isSystemComplete(propertyData, systemId) {
  return getSystemProgress(propertyData, systemId).percent >= 100;
}

function propertyRowToFormData(row) {
  if (!row || typeof row !== "object") return {};
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    out[toCamelCase(key)] = value;
  }
  if (!out.addressLine1 && out.address) {
    const first = String(out.address).split(",")[0]?.trim();
    if (first) out.addressLine1 = first;
  }
  return out;
}

function derivePropertyStreet(row) {
  const line1 = row?.address_line_1 ?? row?.addressLine1;
  if (line1 && String(line1).trim()) return String(line1).trim();
  const address = row?.address;
  if (address && String(address).trim()) {
    return String(address).split(",")[0]?.trim() || String(address).trim();
  }
  return "";
}

function buildFlatPropertyData(propertyRow, systemsRows) {
  const identity = propertyRowToFormData(propertyRow);
  const fromSystems = mapSystemsFromBackend(systemsRows);
  const included = (systemsRows || []).filter((s) => s.included !== false);
  const selectedSystemIds = included
    .map((s) => s.system_key ?? s.systemKey)
    .filter((k) => k && !String(k).startsWith("custom-"));
  const customSystemNames = Object.keys(fromSystems.customSystemsData || {});

  return {
    ...identity,
    ...fromSystems,
    selectedSystemIds:
      selectedSystemIds.length > 0 ? selectedSystemIds : DEFAULT_SYSTEM_IDS,
    customSystemNames,
  };
}

/**
 * @param {Object} propertyData - Flat merged property + systems form data
 * @param {{ documentCount: number, maintenanceRecordCount: number }} stats
 * @returns {Array<{ title: string, body: string }>}
 */
function findPropertyDataGaps(propertyData, stats = {}) {
  const documentGaps = [];
  const systemGaps = [];
  const identityGaps = [];
  const maintenanceGaps = [];
  const { documentCount = 0, maintenanceRecordCount = 0 } = stats;

  if (documentCount === 0) {
    documentGaps.push({
      title: "Documents",
      body: "Inspection reports, warranties, and closing paperwork are not attached yet.",
    });
  }

  const visibleSystemIds =
    (propertyData.selectedSystemIds?.length ?? 0) > 0
      ? propertyData.selectedSystemIds
      : DEFAULT_SYSTEM_IDS;

  for (const systemId of visibleSystemIds) {
    if (!SYSTEM_SECTIONS[systemId]) continue;
    if (!isSystemComplete(propertyData, systemId)) {
      const label = SYSTEM_LABELS[systemId] || SYSTEM_SECTIONS[systemId].label;
      const { filled, total } = getSystemProgress(propertyData, systemId);
      systemGaps.push({
        title: label,
        body:
          total > 0
            ? `${filled} of ${total} key ${label.toLowerCase()} details are filled in so far.`
            : `${label} details are still incomplete.`,
      });
    }
  }

  for (const section of IDENTITY_SECTIONS) {
    if (!isSectionComplete(propertyData, section)) {
      identityGaps.push({
        title: section.label,
        body: `Some ${section.label.toLowerCase()} details are still blank in your home profile.`,
      });
    }
  }

  if (maintenanceRecordCount === 0) {
    maintenanceGaps.push({
      title: "Maintenance history",
      body: "Past service visits and tune-ups have not been recorded yet.",
    });
  }

  return [...documentGaps, ...systemGaps, ...maintenanceGaps, ...identityGaps].slice(
    0,
    MAX_GAP_ITEMS
  );
}

function gapsToEmailMerge(gaps, propertyRow) {
  if (!gaps.length) {
    return {
      ...EMPTY_MISSING_DATA_MERGE,
      propertyStreet: derivePropertyStreet(propertyRow),
    };
  }

  const items = gaps.slice(0, MAX_GAP_ITEMS);
  const merge = {
    propertyStreet: derivePropertyStreet(propertyRow),
    missingDataCount: gaps.length,
    missingDataSummary: items.map((g) => g.title).join(", "),
    missingDataHtml: buildMissingDataHtml(items),
    missingDataItem1Title: "",
    missingDataItem1Body: "",
    missingDataItem2Title: "",
    missingDataItem2Body: "",
    missingDataItem3Title: "",
    missingDataItem3Body: "",
  };

  items.forEach((item, i) => {
    const n = i + 1;
    merge[`missingDataItem${n}Title`] = item.title;
    merge[`missingDataItem${n}Body`] = item.body;
  });

  return merge;
}

function buildMissingDataHtml(items) {
  if (!items.length) return "";
  return items
    .map(
      (item) =>
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
        `<td valign="top" style="padding-bottom:14px; font-size:13px; line-height:19px; color:#3a4a42;">` +
        `<strong style="color:#2f4a3d;">${escapeHtml(item.title)}</strong><br>` +
        `${escapeHtml(item.body)}</td></tr></table>`
    )
    .join("");
}

/**
 * Load property + systems and return Customer.io merge fields for invitation follow-ups.
 * @param {number|string} propertyId
 */
async function buildPropertyInvitationMissingDataMerge(propertyId) {
  const id = Number(propertyId);
  if (!id || Number.isNaN(id)) return { ...EMPTY_MISSING_DATA_MERGE };

  try {
    const [propRes, systemsRows, docRes, maintRes] = await Promise.all([
      db.query(
        `SELECT address, address_line_1, city, state, zip, county, tax_id,
                property_name, owner_name, owner_name_2, owner_city,
                occupant_name, occupant_type, owner_phone,
                property_type, sub_type, year_built,
                sq_ft_total, sq_ft_finished, garage_sq_ft, total_dwelling_sq_ft, lot_size
         FROM properties WHERE id = $1`,
        [id]
      ),
      System.get(id),
      db.query(
        `SELECT COUNT(*)::int AS count FROM property_documents WHERE property_id = $1`,
        [id]
      ),
      db.query(
        `SELECT COUNT(*)::int AS count FROM property_maintenance WHERE property_id = $1`,
        [id]
      ),
    ]);

    const propertyRow = propRes.rows[0];
    if (!propertyRow) return { ...EMPTY_MISSING_DATA_MERGE };

    const propertyData = buildFlatPropertyData(propertyRow, systemsRows);
    const gaps = findPropertyDataGaps(propertyData, {
      documentCount: docRes.rows[0]?.count ?? 0,
      maintenanceRecordCount: maintRes.rows[0]?.count ?? 0,
    });

    return gapsToEmailMerge(gaps, propertyRow);
  } catch (err) {
    console.error(
      "[propertyInvitationDataGaps] buildPropertyInvitationMissingDataMerge:",
      err.message
    );
    return { ...EMPTY_MISSING_DATA_MERGE };
  }
}

module.exports = {
  EMPTY_MISSING_DATA_MERGE,
  buildFlatPropertyData,
  findPropertyDataGaps,
  gapsToEmailMerge,
  buildPropertyInvitationMissingDataMerge,
  derivePropertyStreet,
};
