/**
 * Schema for property bulk import.
 * Matches core create fields (propertyNew.json: address, city, state, zip required).
 * Image fields (e.g. main_photo) are not included in the download template or parsing.
 */
export const PROPERTY_IMPORT_FIELDS = [
  { key: "property_name", label: "Property Name", required: false, type: "string" },
  { key: "address", label: "Address", required: true, type: "string" },
  { key: "city", label: "City", required: true, type: "string" },
  { key: "state", label: "State", required: true, type: "string" },
  { key: "zip", label: "Zip", required: true, type: "string" },
];

export const PROPERTY_IMPORT_KEYS = PROPERTY_IMPORT_FIELDS.map((f) => f.key);

const LABEL_TO_KEY = new Map();
PROPERTY_IMPORT_FIELDS.forEach(({ key, label }) => {
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
LABEL_TO_KEY.set("zip code", "zip");
LABEL_TO_KEY.set("postal code", "zip");
LABEL_TO_KEY.set("property", "property_name");

export function normalizeHeader(header) {
  if (header == null || typeof header !== "string") return null;
  const trimmed = String(header).trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  return LABEL_TO_KEY.get(trimmed) ?? LABEL_TO_KEY.get(lower) ?? null;
}

export function getTemplateRow() {
  return PROPERTY_IMPORT_KEYS.reduce((acc, key) => {
    acc[key] = "";
    return acc;
  }, {});
}

export function getTemplateHeaders() {
  return PROPERTY_IMPORT_FIELDS.map((f) => f.label);
}

export default PROPERTY_IMPORT_FIELDS;
