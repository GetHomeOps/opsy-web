/**
 * Schema for user bulk import.
 * Non-relational fields only (name, email, phone, role). Password is generated on import.
 * No image or avatar column on the template.
 * Used for template generation, header normalization, and validation.
 *
 * Values must be valid Postgres `user_role` labels (opsy-schema.sql). Bulk import
 * intentionally omits super_admin and admin — assign those outside the spreadsheet.
 */
export const USER_IMPORT_ROLE_VALUES = [
  "agent",
  "homeowner",
  "insurance",
  "lender",
  "attorney",
];

export const USER_IMPORT_ROLE_SET = new Set(USER_IMPORT_ROLE_VALUES);

/** Normalize a spreadsheet role for comparison and API (enums are lowercase in DB). */
export function normalizeUserImportRole(value) {
  if (value == null) return "";
  return String(value).trim().toLowerCase();
}

/**
 * @returns {string|undefined} Normalized role for the API, or undefined for server default
 */
export function toApiUserImportRole(value) {
  const n = normalizeUserImportRole(value);
  return n || undefined;
}

export const USER_IMPORT_FIELDS = [
  { key: "name", label: "Name", required: true, type: "string" },
  { key: "email", label: "Email", required: true, type: "email" },
  { key: "phone", label: "Phone", required: false, type: "string" },
  { key: "role", label: "Role", required: false, type: "string" },
];

/** 1-based column index in the .xlsx template (for role dropdown range). */
export const USER_IMPORT_ROLE_COLUMN_1_BASED =
  USER_IMPORT_FIELDS.findIndex((f) => f.key === "role") + 1;

/** Canonical keys only. */
export const USER_IMPORT_KEYS = USER_IMPORT_FIELDS.map((f) => f.key);

const LABEL_TO_KEY = new Map();
USER_IMPORT_FIELDS.forEach(({ key, label }) => {
  const variants = [
    key,
    label,
    key.replace(/_/g, " "),
    label.toLowerCase(),
    key.toLowerCase(),
  ];
  variants.forEach((v) => {
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
  return USER_IMPORT_KEYS.reduce((acc, key) => {
    acc[key] = "";
    return acc;
  }, {});
}

export function getTemplateHeaders() {
  return USER_IMPORT_FIELDS.map((f) => f.label);
}

export default USER_IMPORT_FIELDS;
