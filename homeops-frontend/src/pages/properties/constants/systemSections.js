import { STANDARD_CUSTOM_SYSTEM_FIELDS } from "./propertySystems";

/**
 * System sections and their tracked fields.
 * Used to calculate completion percentage for each system.
 */
export const SYSTEM_SECTIONS = {
  roof: {
    id: "roof",
    label: "Roof",
    fields: [
      "roofMaterial",
      "roofInstallDate",
      "roofInstaller",
      "roofCondition",
      "roofWarranty",
      "roofLastInspection",
      "roofNextInspection",
      "roofIssues",
    ],
  },
  gutters: {
    id: "gutters",
    label: "Gutters",
    fields: [
      "gutterMaterial",
      "gutterInstallDate",
      "gutterInstaller",
      "gutterCondition",
      "gutterWarranty",
      "gutterLastInspection",
      "gutterNextInspection",
      "gutterIssues",
    ],
  },
  foundation: {
    id: "foundation",
    label: "Foundation",
    fields: [
      "foundationType",
      "foundationCondition",
      "foundationLastInspection",
      "foundationNextInspection",
      "foundationIssues",
    ],
  },
  exterior: {
    id: "exterior",
    label: "Exterior / Siding",
    fields: [
      "sidingType",
      "sidingInstallDate",
      "sidingInstaller",
      "sidingCondition",
      "sidingLastInspection",
      "sidingNextInspection",
      "sidingIssues",
    ],
  },
  windows: {
    id: "windows",
    label: "Windows",
    fields: [
      "windowType",
      "windowInstallDate",
      "windowInstaller",
      "windowCondition",
      "windowWarranty",
      "windowLastInspection",
      "windowNextInspection",
      "windowIssues",
    ],
  },
  heating: {
    id: "heating",
    label: "Heating",
    fields: [
      "heatingSystemType",
      "heatingInstallDate",
      "heatingInstaller",
      "heatingCondition",
      "heatingWarranty",
      "heatingLastInspection",
      "heatingNextInspection",
      "heatingIssues",
    ],
  },
  ac: {
    id: "ac",
    label: "Air Conditioning",
    fields: [
      "acSystemType",
      "acInstallDate",
      "acInstaller",
      "acCondition",
      "acWarranty",
      "acLastInspection",
      "acNextInspection",
      "acIssues",
    ],
  },
  waterHeating: {
    id: "waterHeating",
    label: "Water Heating",
    fields: [
      "waterHeatingSystemType",
      "waterHeatingInstallDate",
      "waterHeatingInstaller",
      "waterHeatingCondition",
      "waterHeatingWarranty",
      "waterHeatingLastInspection",
      "waterHeatingNextInspection",
      "waterHeatingIssues",
    ],
  },
  electrical: {
    id: "electrical",
    label: "Electrical",
    fields: [
      "electricalServiceAmperage",
      "electricalInstallDate",
      "electricalInstaller",
      "electricalCondition",
      "electricalWarranty",
      "electricalLastInspection",
      "electricalNextInspection",
      "electricalIssues",
    ],
  },
  plumbing: {
    id: "plumbing",
    label: "Plumbing",
    fields: [
      "plumbingSupplyMaterials",
      "plumbingInstallDate",
      "plumbingInstaller",
      "plumbingCondition",
      "plumbingWarranty",
      "plumbingLastInspection",
      "plumbingNextInspection",
      "plumbingIssues",
    ],
  },
  safety: {
    id: "safety",
    label: "Safety Systems",
    fields: [
      "safetySmokeCOCoverage",
      "safetyGFCIStatus",
    ],
  },
  inspections: {
    id: "inspections",
    label: "Inspections",
    fields: [
      "generalInspection",
      "roofInspection",
      "termiteInspection",
    ],
  },
};

/** systemId -> form field name for isNewInstall */
export const IS_NEW_INSTALL_FIELD_BY_SYSTEM = {
  roof: "roofIsNewInstall",
  gutters: "gutterIsNewInstall",
  foundation: "foundationIsNewInstall",
  exterior: "exteriorIsNewInstall",
  windows: "windowIsNewInstall",
  heating: "heatingIsNewInstall",
  ac: "acIsNewInstall",
  waterHeating: "waterHeatingIsNewInstall",
  electrical: "electricalIsNewInstall",
  plumbing: "plumbingIsNewInstall",
};

/** systemId -> lastInspection field name (excluded from score when isNewInstall) */
export const LAST_INSPECTION_FIELD_BY_SYSTEM = {
  roof: "roofLastInspection",
  gutters: "gutterLastInspection",
  foundation: "foundationLastInspection",
  exterior: "sidingLastInspection",
  windows: "windowLastInspection",
  heating: "heatingLastInspection",
  ac: "acLastInspection",
  waterHeating: "waterHeatingLastInspection",
  electrical: "electricalLastInspection",
  plumbing: "plumbingLastInspection",
};

/** Age fields derived from their corresponding install date field */
export const AGE_FROM_INSTALL_DATE = {
  roofAge: "roofInstallDate",
  gutterAge: "gutterInstallDate",
  sidingAge: "sidingInstallDate",
  windowAge: "windowInstallDate",
  heatingAge: "heatingInstallDate",
  acAge: "acInstallDate",
  waterHeatingAge: "waterHeatingInstallDate",
  electricalAge: "electricalInstallDate",
  plumbingAge: "plumbingInstallDate",
};

/**
 * Compute age (years and months) from an install date string.
 * @param {string} installDate - Date string (YYYY-MM-DD or YYYY-MM)
 * @returns {{ years: number, months: number }|null} Age, or null if invalid
 */
export function getAgeFromInstallDate(installDate) {
  if (!installDate || typeof installDate !== "string") return null;
  const install = new Date(installDate);
  if (isNaN(install.getTime())) return null;
  const now = new Date();
  let totalMonths =
    (now.getFullYear() - install.getFullYear()) * 12 +
    (now.getMonth() - install.getMonth());
  if (now.getDate() < install.getDate()) totalMonths--;
  if (totalMonths < 0) return null;
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  return { years, months };
}

/**
 * Format age for display (e.g. "2 years, 3 months").
 * @param {{ years: number, months: number }|null} age - From getAgeFromInstallDate
 * @returns {string} Formatted string or "—" if null
 */
export function formatAgeFromInstallDate(age) {
  if (!age) return "—";
  const { years, months } = age;
  const parts = [];
  if (years > 0) parts.push(`${years} year${years !== 1 ? "s" : ""}`);
  if (months > 0) parts.push(`${months} month${months !== 1 ? "s" : ""}`);
  return parts.length > 0 ? parts.join(", ") : "0 months";
}

/**
 * Check if a field value is filled (non-empty).
 */
export function isFilled(value) {
  if (value == null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (typeof value === "number") return true;
  if (typeof value === "boolean") return true;
  return true;
}

/**
 * Check if a field is filled, including derived fields (e.g. age from install date).
 */
function isFieldFilled(propertyData, field) {
  if (isFilled(propertyData[field])) return true;
  const installDateField = AGE_FROM_INSTALL_DATE[field];
  if (installDateField && isFilled(propertyData[installDateField])) {
    return getAgeFromInstallDate(propertyData[installDateField]) !== null;
  }
  return false;
}

/**
 * Get progress for a system section.
 * Age is computed from install date (not included in score).
 * Last inspection is excluded from score when "New Install" is selected.
 *
 * @param {Object} propertyData - Property form data
 * @param {string} systemId - System ID (e.g., "roof", "gutters")
 * @returns {{ filled: number, total: number, percent: number }}
 */
export function getSystemProgress(propertyData, systemId) {
  const section = SYSTEM_SECTIONS[systemId];
  if (!section) return { filled: 0, total: 0, percent: 0 };

  let fields = section.fields;

  // Exclude last inspection from score when "New Install" is selected
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
  const filled = fields.filter((field) =>
    isFieldFilled(propertyData, field),
  ).length;
  const percent = total > 0 ? (filled / total) * 100 : 0;

  return { filled, total, percent };
}

/**
 * Check if a system section is complete (all fields filled).
 * @param {Object} propertyData - Property form data
 * @param {string} systemId - System ID
 * @returns {boolean}
 */
export function isSystemComplete(propertyData, systemId) {
  const { percent } = getSystemProgress(propertyData, systemId);
  return percent >= 100;
}

/**
 * Count how many of the visible systems are complete.
 * @param {Object} propertyData - Property form data
 * @param {string[]} visibleSystemIds - Array of system IDs that are visible/selected
 * @returns {number}
 */
export function countCompletedSystems(propertyData, visibleSystemIds) {
  return visibleSystemIds.filter((id) =>
    isSystemComplete(propertyData, id),
  ).length;
}

/**
 * Check if a custom system is complete (all trackable fields filled).
 * Age is computed from install date (not included in score).
 * Last inspection is excluded when "New Install" is selected.
 *
 * @param {Object} customSystemsData - Custom system data keyed by system name
 * @param {string} systemName - Custom system name
 * @returns {boolean}
 */
export function isCustomSystemComplete(customSystemsData, systemName) {
  const systemData = customSystemsData?.[systemName] ?? {};
  const trackableFields = STANDARD_CUSTOM_SYSTEM_FIELDS.filter(
    (f) =>
      f.type !== "computed-age" &&
      f.key !== "issues" &&
      f.key !== "lastInspection",
  );
  return trackableFields.every((field) => {
    const val = systemData[field.key];
    return val != null && String(val).trim() !== "";
  });
}

/**
 * Count completed systems including both predefined and custom systems.
 * Used by ScoreCard for accurate systems completion display.
 * @param {Object} propertyData - Property form data (includes customSystemsData)
 * @param {string[]} visibleSystemIds - Predefined system IDs (from selectedSystemIds or DEFAULT_SYSTEM_IDS)
 * @param {string[]} customSystemNames - Custom system names
 * @returns {number}
 */
export function countCompletedSystemsWithCustom(
  propertyData,
  visibleSystemIds,
  customSystemNames = [],
) {
  const customSystemsData = propertyData.customSystemsData ?? {};
  const predefinedCount = visibleSystemIds.filter((id) =>
    isSystemComplete(propertyData, id),
  ).length;
  const customCount = customSystemNames.filter((name) =>
    isCustomSystemComplete(customSystemsData, name),
  ).length;
  return predefinedCount + customCount;
}
