/**
 * Schema for professional bulk import.
 * Non-relational fields from professionals table. Images (profile_photo) cannot be imported via template.
 * Used for template generation, header normalization, and validation.
 */
export const PROFESSIONAL_IMPORT_FIELDS = [
  { key: "company_name", label: "Company Name", required: true, type: "string" },
  { key: "contact_name", label: "Contact Name", required: false, type: "string" },
  { key: "category_id", label: "Category ID", required: false, type: "integer" },
  { key: "subcategory_id", label: "Subcategory ID", required: false, type: "integer" },
  { key: "description", label: "Description", required: false, type: "string" },
  { key: "phone", label: "Phone", required: false, type: "string" },
  { key: "email", label: "Email", required: false, type: "email" },
  { key: "website", label: "Website", required: false, type: "string" },
  { key: "street1", label: "Street 1", required: false, type: "string" },
  { key: "street2", label: "Street 2", required: false, type: "string" },
  { key: "city", label: "City", required: false, type: "string" },
  { key: "state", label: "State", required: false, type: "string" },
  { key: "zip_code", label: "Zip Code", required: false, type: "string" },
  { key: "country", label: "Country", required: false, type: "string" },
  { key: "service_area", label: "Service Area", required: false, type: "string" },
  { key: "budget_level", label: "Budget Level", required: false, type: "string" },
  { key: "languages", label: "Languages", required: false, type: "string" },
  { key: "years_in_business", label: "Years In Business", required: false, type: "integer" },
  { key: "is_verified", label: "Is Verified", required: false, type: "boolean" },
  { key: "license_number", label: "License Number", required: false, type: "string" },
];

/** Canonical keys only. */
export const PROFESSIONAL_IMPORT_KEYS = PROFESSIONAL_IMPORT_FIELDS.map((f) => f.key);

const LABEL_TO_KEY = new Map();
PROFESSIONAL_IMPORT_FIELDS.forEach(({ key, label }) => {
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
  return PROFESSIONAL_IMPORT_KEYS.reduce((acc, key) => {
    acc[key] = "";
    return acc;
  }, {});
}

export function getTemplateHeaders() {
  return PROFESSIONAL_IMPORT_FIELDS.map((f) => f.label);
}

export default PROFESSIONAL_IMPORT_FIELDS;
