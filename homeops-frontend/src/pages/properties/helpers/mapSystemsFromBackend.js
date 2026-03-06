/** Standard field names used across all systems (material, installDate, etc.) */
export const STANDARD_SYSTEM_FIELDS = [
  "material",
  "installDate",
  "installer",
  "age",
  "condition",
  "warranty",
  "lastInspection",
  "nextInspection",
  "issues",
  "notes",
  "type",
  "systemType",
  "supplyMaterials",
  "serviceAmperage",
  "smokeCOCoverage",
  "gfciStatus",
];

/** system_key -> form field prefix (exterior uses "siding") */
const SYSTEM_PREFIX = {
  roof: "roof",
  gutters: "gutter",
  foundation: "foundation",
  exterior: "siding",
  windows: "window",
  heating: "heating",
  ac: "ac",
  waterHeating: "waterHeating",
  electrical: "electrical",
  plumbing: "plumbing",
  safety: "safety",
  inspections: "",
};

/** system_key -> next inspection form field */
const NEXT_INSPECTION_FIELD = {
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

/** snake_case -> camelCase */
function toCamelCase(str) {
  if (!str || typeof str !== "string") return str;
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/** Convert ISO or other date string to YYYY-MM-DD. Use UTC to avoid off-by-one day. */
function toDateOnly(val) {
  if (!val || typeof val !== "string") return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const date = new Date(trimmed);
  if (isNaN(date.getTime())) return null;
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Map backend key to form key. Backend may send gutter_material (full) or material (suffix). installer_id -> prefixInstaller. */
function toFormKey(snakeKey, prefix) {
  if (snakeKey === "installer_id") return prefix ? prefix + "Installer" : "installer";
  const prefixSnake = prefix ? prefix.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`) : "";
  if (prefix && (snakeKey.startsWith(prefixSnake + "_") || snakeKey === prefixSnake)) {
    return toCamelCase(snakeKey);
  }
  if (prefix) {
    const camel = toCamelCase(snakeKey);
    return prefix + camel.charAt(0).toUpperCase() + camel.slice(1);
  }
  return toCamelCase(snakeKey);
}

/** Parse custom system name from slug (custom-solar-panels -> Solar Panels) */
function parseCustomSystemName(systemKey) {
  if (!systemKey?.startsWith("custom-")) return null;
  const slug = systemKey.replace(/^custom-/, "");
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Map one system's data to form keys. Each system has standard fields: material, installDate, installer, etc. */
function mapSystemData(systemKey, data, nextServiceDate) {
  if (!data || typeof data !== "object") return {};
  const prefix = SYSTEM_PREFIX[systemKey];
  const out = {};
  for (const [snakeKey, value] of Object.entries(data)) {
    if (value == null || value === "") continue;
    // Map known_issues -> issues for backward compatibility
    const keyToUse = snakeKey === "known_issues" ? "issues" : snakeKey;
    const formKey = toFormKey(keyToUse, prefix);
    const isDateField = snakeKey === "last_inspection" || snakeKey.includes("_date");
    if (isDateField && typeof value === "string") {
      const dateOnly = toDateOnly(value);
      if (dateOnly) out[formKey] = dateOnly;
    } else {
      out[formKey] = typeof value === "string" ? value.trim() : value;
    }
  }
  if (nextServiceDate && typeof nextServiceDate === "string") {
    const dateOnly = toDateOnly(nextServiceDate);
    const nextField = NEXT_INSPECTION_FIELD[systemKey];
    if (nextField && dateOnly) out[nextField] = dateOnly;
  }
  return out;
}

/** Map custom system data to standard camelCase fields */
function mapCustomSystemData(data, nextServiceDate) {
  if (!data || typeof data !== "object") return {};
  const out = {};
  for (const [snakeKey, value] of Object.entries(data)) {
    if (value == null || value === "") continue;
    const key =
      snakeKey === "installer_id"
        ? "installer"
        : snakeKey === "known_issues"
          ? "issues"
          : toCamelCase(snakeKey);
    out[key] = typeof value === "string" ? value.trim() : value;
  }
  if (nextServiceDate && typeof nextServiceDate === "string") {
    const dateOnly = toDateOnly(nextServiceDate);
    if (dateOnly) out.nextInspection = dateOnly;
  }
  return out;
}

/**
 * Maps backend systems array to form data.
 * Each system identified by id with standard fields: material, installDate, installer, etc.
 *
 * @param {Array} systems - [{ system_key, data, next_service_date }, ...]
 * @returns {Object} Flat form keys + customSystemsData (for form compatibility)
 */
export function mapSystemsFromBackend(systems) {
  if (!Array.isArray(systems) || systems.length === 0) return {};

  const includedSystems = systems.filter((s) => s.included !== false);
  const flatFormKeys = {};
  const customSystemsData = {};

  for (const sys of includedSystems) {
    const id = sys.system_key ?? sys.systemKey;
    const data = sys.data ?? {};
    const nextService = sys.next_service_date ?? sys.nextServiceDate;

    if (!id) continue;

    if (id.startsWith("custom-")) {
      const name = parseCustomSystemName(id);
      if (name) {
        customSystemsData[name] = mapCustomSystemData(data, nextService);
      }
    } else {
      Object.assign(flatFormKeys, mapSystemData(id, data, nextService));
    }
  }

  const out = { ...flatFormKeys };
  if (Object.keys(customSystemsData).length > 0) {
    out.customSystemsData = customSystemsData;
  }
  return out;
}
