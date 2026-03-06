/**
 * Schema for user bulk import.
 * Non-relational fields only (name, email, phone, role). Password is generated on import.
 * Used for template generation, header normalization, and validation.
 */
export const USER_IMPORT_FIELDS = [
  { key: "name", label: "Name", required: true, type: "string" },
  { key: "email", label: "Email", required: true, type: "email" },
  { key: "phone", label: "Phone", required: false, type: "string" },
  { key: "role", label: "Role", required: false, type: "string" },
];

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
