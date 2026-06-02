import {usStates} from "./states";

/**
 * Schema for super-admin agency bulk import.
 * Each row creates an approved agency and a default main office.
 */

export const AGENCY_IMPORT_FIELDS = [
  { key: "name", label: "Agency Name", required: true, type: "string" },
  { key: "website", label: "Website", required: false, type: "string" },
  { key: "city", label: "City", required: false, type: "string" },
  { key: "state", label: "State", required: false, type: "state" },
  { key: "phone", label: "Phone", required: false, type: "string" },
];

export const AGENCY_IMPORT_KEYS = AGENCY_IMPORT_FIELDS.map((f) => f.key);

export const AGENCY_IMPORT_STATE_VALUES = usStates.map((s) => s.code);

const LABEL_TO_KEY = new Map();
AGENCY_IMPORT_FIELDS.forEach(({ key, label }) => {
  [key, label, key.replace(/_/g, " "), label.toLowerCase(), key.toLowerCase()].forEach((v) => {
    if (v && !LABEL_TO_KEY.has(v)) LABEL_TO_KEY.set(v, key);
  });
});

export function normalizeHeader(header) {
  if (header == null || typeof header !== "string") return null;
  const trimmed = String(header).trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  return LABEL_TO_KEY.get(trimmed) ?? LABEL_TO_KEY.get(lower) ?? null;
}

export function getTemplateRow() {
  return AGENCY_IMPORT_KEYS.reduce((acc, key) => {
    acc[key] = "";
    return acc;
  }, {});
}

export function getTemplateHeaders() {
  return AGENCY_IMPORT_FIELDS.map((f) => f.label);
}

export function normalizeImportState(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  const byCode = usStates.find(
    (s) => s.code.toLowerCase() === trimmed.toLowerCase(),
  );
  if (byCode) return byCode.code;
  const byName = usStates.find(
    (s) => s.name.toLowerCase() === trimmed.toLowerCase(),
  );
  return byName?.code || trimmed.slice(0, 2).toUpperCase();
}

export function rowToAgencyImportPayload(row) {
  const state = normalizeImportState(row.state);
  return {
    name: (row.name || "").trim(),
    website: (row.website || "").trim() || null,
    city: (row.city || "").trim() || null,
    state: state || null,
    phone: (row.phone || "").trim() || null,
  };
}
