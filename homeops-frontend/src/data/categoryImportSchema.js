/**
 * Schema for professional category bulk import (spreadsheet rows).
 * Rows are flattened: one row per parent or child; hierarchy is built client-side.
 */

export const CATEGORY_IMPORT_FIELDS = [
  { key: "category_name", label: "Category Name", required: true, type: "string" },
  { key: "type", label: "Type", required: true, type: "string" },
  { key: "parent_name", label: "Parent Name", required: false, type: "string" },
  { key: "description", label: "Description", required: false, type: "string" },
  { key: "icon", label: "Icon", required: false, type: "string" },
  { key: "image_key", label: "Image Key", required: false, type: "string" },
  { key: "sort_order", label: "Sort Order", required: false, type: "integer" },
  { key: "is_active", label: "Is Active", required: false, type: "boolean" },
];

export const CATEGORY_IMPORT_KEYS = CATEGORY_IMPORT_FIELDS.map((f) => f.key);

const LABEL_TO_KEY = new Map();
CATEGORY_IMPORT_FIELDS.forEach(({ key, label }) => {
  [key, label, key.replace(/_/g, " "), label.toLowerCase(), key.toLowerCase()].forEach((v) => {
    if (v && !LABEL_TO_KEY.has(v)) LABEL_TO_KEY.set(v, key);
  });
});

[
  ["name", "category_name"],
  ["category", "category_name"],
  ["parent", "parent_name"],
  ["parent category", "parent_name"],
  ["s3 key", "image_key"],
  ["image s3 key", "image_key"],
  ["profile image key", "image_key"],
].forEach(([alias, key]) => {
  if (!LABEL_TO_KEY.has(alias)) LABEL_TO_KEY.set(alias, key);
});

export function normalizeCategoryHeader(header) {
  if (header == null || typeof header !== "string") return null;
  const trimmed = String(header).trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  return LABEL_TO_KEY.get(trimmed) ?? LABEL_TO_KEY.get(lower) ?? null;
}

export function getCategoryTemplateRow() {
  return CATEGORY_IMPORT_KEYS.reduce((acc, key) => {
    acc[key] = key === "type" ? "parent" : "";
    return acc;
  }, {});
}
