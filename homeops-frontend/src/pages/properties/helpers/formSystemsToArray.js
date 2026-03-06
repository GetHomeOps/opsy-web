import {SYSTEM_SECTIONS} from "../constants/systemSections";
import {STANDARD_CUSTOM_SYSTEM_FIELDS} from "../constants/propertySystems";
import {
  slugifyCustomSystemName,
  ensureUniqueSystemKey,
  MAX_SYSTEM_KEY_LENGTH,
} from "./systemKeyUtils";

/** Fields that map to next_service_date per system */
const NEXT_SERVICE_FIELD_BY_SYSTEM = {
  roof: "roofNextInspection",
  gutters: "gutterNextInspection",
  foundation: "foundationNextInspection",
  exterior: "sidingNextInspection",
  windows: "windowNextInspection",
  heating: "heatingNextInspection",
  ac: "acNextInspection",
  waterHeating: "waterHeatingNextInspection",
  electrical: "electricalNextInspection",
  plumbing: "plumbingNextInspection",
};

/** Fields that map to last_inspection in data object per system (exterior has no Last Inspection in form) */
const LAST_INSPECTION_FIELD_BY_SYSTEM = {
  roof: "roofLastInspection",
  gutters: "gutterLastInspection",
  foundation: "foundationLastInspection",
  windows: "windowLastInspection",
  heating: "heatingLastInspection",
  ac: "acLastInspection",
  waterHeating: "waterHeatingLastInspection",
  electrical: "electricalLastInspection",
  plumbing: "plumbingLastInspection",
};

/** Convert camelCase to snake_case for PostgreSQL */
function toSnakeCase(str) {
  if (!str || typeof str !== "string") return str;
  return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

function coerceInt(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

/**
 * Extracts data for a predefined system. Returns snake_case keys for PostgreSQL.
 * Installer fields map to installer_id. Includes last_inspection from LAST_INSPECTION_FIELD_BY_SYSTEM.
 */
function getPredefinedSystemData(formData, systemId) {
  const section = SYSTEM_SECTIONS[systemId];
  if (!section) return {};

  const prefix = section.id;
  const data = {};
  for (const field of section.fields) {
    const val = formData[field];
    if (val == null || val === "") continue;

    const suffix = field.startsWith(prefix)
      ? field.slice(prefix.length).replace(/^./, (c) => c.toLowerCase())
      : field;
    const snakeKey = toSnakeCase(suffix || field);

    if (field.endsWith("Installer")) {
      const idVal = coerceInt(val);
      if (idVal !== null) data.installer_id = idVal;
    } else {
      data[snakeKey] = typeof val === "string" ? val.trim() : val;
    }
  }
  const lastField = LAST_INSPECTION_FIELD_BY_SYSTEM[systemId];
  if (lastField) {
    const lastVal = toValidDateString(formData[lastField]);
    if (lastVal) data.last_inspection = lastVal;
  }
  return data;
}

/**
 * Extracts data for a custom system. Returns snake_case keys for PostgreSQL.
 * Installer field maps to installer_id.
 */
function getCustomSystemData(customSystemsData, systemName) {
  const raw = customSystemsData?.[systemName] ?? {};
  const data = {};
  for (const {key} of STANDARD_CUSTOM_SYSTEM_FIELDS) {
    const val = raw[key];
    if (val == null || val === "") continue;

    if (key === "installer") {
      const idVal = coerceInt(val);
      if (idVal !== null) data.installer_id = idVal;
    } else {
      data[toSnakeCase(key)] = typeof val === "string" ? val.trim() : val;
    }
  }
  return data;
}

/** Returns YYYY-MM-DD if valid, otherwise null. Pass-through for YYYY-MM-DD to avoid timezone shift. */
function toValidDateString(val) {
  if (!val || typeof val !== "string") return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const date = new Date(trimmed);
  if (isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getNextServiceDate(systemsForm, systemId) {
  const field = NEXT_SERVICE_FIELD_BY_SYSTEM[systemId];
  if (!field) return null;
  const val = systemsForm[field];
  return toValidDateString(val);
}

function getCustomNextServiceDate(customSystemsData, systemName) {
  const raw = customSystemsData?.[systemName] ?? {};
  const val = raw.nextInspection;
  return toValidDateString(val);
}

/**
 * Converts form data into an array of system payloads ready for PostgreSQL.
 * Each element has property_id, system_key, included, data (snake_case keys), and optional next_service_date.
 * Deselected systems (in existingSystems but not in form selection) are included with included: false.
 *
 * @param {Object} formData - Merged form data (from mergeFormDataFromTabs). Next inspection fields
 *   (roofNextInspection, gutterNextInspection, etc.) live in the flat structure, not in systems.
 * @param {number} propertyId - Property ID for the backend
 * @param {Array} [existingSystems] - Systems currently on the property (from backend). Used to add deselected systems with included: false.
 * @returns {Array<{ property_id: number, system_key: string, included: boolean, data: Object, next_service_date?: string }>}
 */
export function formSystemsToArray(formData, propertyId, existingSystems = []) {
  if (!formData || typeof formData !== "object") return [];

  const selectedIds = formData.selectedSystemIds ?? [];
  const customNames = formData.customSystemNames ?? [];
  const customData = formData.customSystemsData ?? {};
  const usedKeys = new Set();
  const selectedCustomKeys = new Set();

  const result = [];

  for (const systemId of selectedIds) {
    const data = getPredefinedSystemData(formData, systemId);
    const nextServiceDate = getNextServiceDate(formData, systemId);
    const systemKey = ensureUniqueSystemKey(
      systemId.slice(0, MAX_SYSTEM_KEY_LENGTH),
      usedKeys
    );

    result.push({
      property_id: propertyId,
      system_key: systemKey,
      included: true,
      data: Object.keys(data).length > 0 ? data : {},
      ...(nextServiceDate && {next_service_date: nextServiceDate}),
    });
  }

  for (const systemName of customNames) {
    const data = getCustomSystemData(customData, systemName);
    const nextServiceDate = getCustomNextServiceDate(customData, systemName);
    const systemKey = ensureUniqueSystemKey(
      slugifyCustomSystemName(systemName),
      usedKeys
    );
    selectedCustomKeys.add(systemKey);

    result.push({
      property_id: propertyId,
      system_key: systemKey,
      included: true,
      data: Object.keys(data).length > 0 ? data : {},
      ...(nextServiceDate && {next_service_date: nextServiceDate}),
    });
  }

  for (const sys of existingSystems ?? []) {
    const key = sys.system_key ?? sys.systemKey;
    if (!key) continue;
    const isPredefined = !key.startsWith("custom-");
    const isSelected = isPredefined
      ? selectedIds.includes(key)
      : selectedCustomKeys.has(key);
    if (!isSelected) {
      result.push({
        property_id: propertyId,
        system_key: key.slice(0, MAX_SYSTEM_KEY_LENGTH),
        included: false,
        data: {},
      });
    }
  }

  return result;
}
