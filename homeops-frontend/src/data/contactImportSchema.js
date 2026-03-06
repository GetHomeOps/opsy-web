/**
 * Centralized schema for contact bulk import.
 * Matches non-relational fields from contacts table (pos-schema.sql).
 * Used for template generation, header normalization, and validation.
 */
export const CONTACT_IMPORT_FIELDS = [
  { key: "name", label: "Name", required: true, type: "string" },
  { key: "type", label: "Type", required: false, type: "number" },
  { key: "phone", label: "Phone", required: false, type: "string" },
  { key: "email", label: "Email", required: false, type: "email" },
  { key: "website", label: "Website", required: false, type: "string" },
  { key: "street1", label: "Street 1", required: false, type: "string" },
  { key: "street2", label: "Street 2", required: false, type: "string" },
  { key: "city", label: "City", required: false, type: "string" },
  { key: "state", label: "State", required: false, type: "string" },
  { key: "zip_code", label: "Zip Code", required: false, type: "string" },
  { key: "country", label: "Country", required: false, type: "string" },
  { key: "country_code", label: "Country Code", required: false, type: "string" },
  { key: "notes", label: "Notes", required: false, type: "string" },
  { key: "role", label: "Role", required: false, type: "string" },
];

/** Canonical keys only (for stripping unknown columns). */
export const CONTACT_IMPORT_KEYS = CONTACT_IMPORT_FIELDS.map((f) => f.key);

/** Map of possible header strings -> canonical key (for normalizing file headers). */
const LABEL_TO_KEY = new Map();
CONTACT_IMPORT_FIELDS.forEach(({ key, label }) => {
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
// Common aliases
LABEL_TO_KEY.set("email", "email");
LABEL_TO_KEY.set("e-mail", "email");
LABEL_TO_KEY.set("zip", "zip_code");
LABEL_TO_KEY.set("postal code", "zip_code");
LABEL_TO_KEY.set("address", "street1");
LABEL_TO_KEY.set("street", "street1");
LABEL_TO_KEY.set("address line 1", "street1");
LABEL_TO_KEY.set("address line 2", "street2");

/**
 * Normalize a header string to the canonical schema key, or null if unknown.
 */
export function normalizeHeader(header) {
  if (header == null || typeof header !== "string") return null;
  const trimmed = String(header).trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  return LABEL_TO_KEY.get(trimmed) ?? LABEL_TO_KEY.get(lower) ?? null;
}

/**
 * Get template row (object with only approved keys, empty strings).
 */
export function getTemplateRow() {
  return CONTACT_IMPORT_KEYS.reduce((acc, key) => {
    acc[key] = "";
    return acc;
  }, {});
}

/**
 * Get headers for template (labels in schema order).
 */
export function getTemplateHeaders() {
  return CONTACT_IMPORT_FIELDS.map((f) => f.label);
}

export default CONTACT_IMPORT_FIELDS;
