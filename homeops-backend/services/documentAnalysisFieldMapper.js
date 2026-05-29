"use strict";

/**
 * Maps AI-extracted field keys to property_systems.data snake_case keys
 * and optional next_service_date updates.
 */

const FIELD_TO_SYSTEM_DATA = {
  brand: "material",
  model: "material",
  material: "material",
  installDate: "install_date",
  installer: "notes",
  vendor: "notes",
  cost: "notes",
  warranty: "warranty",
  condition: "condition",
  reportDate: "last_inspection",
  nextServiceDate: "__next_service_date__",
  maintenanceScheduleRecommendation: "notes",
  technician: "notes",
  totalPrice: "notes",
  termsAndConditions: "notes",
  scope: "notes",
  validUntil: "notes",
  summary: "notes",
  findings: "issues",
  suggestedNextDates: "notes",
  lineItems: "notes",
  keyDates: "notes",
  notes: "notes",
};

const CATEGORY_LABELS = {
  installation_invoice: "Installation / Invoice",
  maintenance_report: "Maintenance Report",
  inspection_report: "Inspection Report",
  bid: "Bid / Quote",
  other: "General",
};

const FIELD_KEY_LABELS = {
  totalPrice: "Total price",
  lineItems: "Line items",
  termsAndConditions: "Terms & conditions",
  validUntil: "Valid until",
  installDate: "Install date",
  reportDate: "Report date",
  nextServiceDate: "Next service date",
  maintenanceScheduleRecommendation: "Maintenance schedule",
  suggestedNextDates: "Suggested next dates",
  keyDates: "Key dates",
  brand: "Brand",
  model: "Model",
  material: "Material",
  installer: "Installer",
  vendor: "Vendor",
  cost: "Cost",
  warranty: "Warranty",
  condition: "Condition",
  technician: "Technician",
  scope: "Scope",
  summary: "Summary",
  findings: "Findings",
  notes: "Notes",
};

function formatFieldLabel(fieldKey, label) {
  if (label && label !== fieldKey) return label;
  if (FIELD_KEY_LABELS[fieldKey]) return FIELD_KEY_LABELS[fieldKey];
  if (!fieldKey) return "Field";
  return fieldKey
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

function formatValueForStorage(value) {
  if (value == null || value === "") return "";
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item == null) return "";
        if (typeof item === "string") return item;
        if (typeof item === "number" || typeof item === "boolean") return String(item);
        if (typeof item === "object") {
          const parts = [];
          const desc = item.description || item.name || item.item || item.service || item.text || item.label;
          if (desc) parts.push(String(desc));
          const qty = item.quantity ?? item.qty;
          if (qty != null) parts.push(`Qty: ${qty}`);
          const price = item.price ?? item.unitPrice ?? item.amount ?? item.total ?? item.cost;
          if (price != null) parts.push(String(price));
          if (parts.length) return parts.join(" · ");
          if (typeof item.value === "string") return item.value;
          return JSON.stringify(item);
        }
        return String(item);
      })
      .filter(Boolean)
      .join("; ");
  }
  if (typeof value === "object") {
    if (typeof value.value === "string") return value.value;
    return JSON.stringify(value);
  }
  return String(value);
}

function normalizeFindings(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object" && Array.isArray(raw.items)) return raw.items;
  return [];
}

/**
 * Build review rows with current system values for the UI.
 *
 * @param {string} systemKey
 * @param {Array} findings - [{ fieldKey, label, value, confidence, evidence }]
 * @param {Object|null} systemRow - property_systems row
 * @returns {Array<{ fieldKey, label, proposedValue, confidence, evidence, systemDataKey, currentValue, formFieldHint }>}
 */
function buildReviewFields(systemKey, findings, systemRow) {
  const existingData =
    systemRow?.data && typeof systemRow.data === "object" ? systemRow.data : {};
  const existingNextDate = systemRow?.next_service_date || null;

  return normalizeFindings(findings).map((item) => {
    const fieldKey = item.fieldKey || item.key || "unknown";
    const systemDataKey = FIELD_TO_SYSTEM_DATA[fieldKey] || "notes";
    let currentValue = null;
    if (systemDataKey === "__next_service_date__") {
      currentValue = existingNextDate;
    } else {
      currentValue = existingData[systemDataKey] ?? null;
    }

    return {
      fieldKey,
      label: formatFieldLabel(fieldKey, item.label),
      proposedValue: item.value,
      confidence: item.confidence ?? null,
      evidence: item.evidence ?? null,
      systemDataKey,
      currentValue,
      formFieldHint: `${systemKey}.${systemDataKey}`,
    };
  });
}

/**
 * Merge selected findings into property_systems.data.
 *
 * @returns {{ data: Object, next_service_date: string|null, applied: Array }}
 */
function mergeSelectedFields(findings, selectedFieldKeys, systemRow) {
  const existingData =
    systemRow?.data && typeof systemRow.data === "object"
      ? { ...systemRow.data }
      : {};
  let nextServiceDate = systemRow?.next_service_date || null;
  const applied = [];
  const selected = new Set(selectedFieldKeys || []);
  const items = normalizeFindings(findings);

  for (const item of items) {
    const fieldKey = item.fieldKey || item.key;
    if (!fieldKey || !selected.has(fieldKey)) continue;

    const systemDataKey = FIELD_TO_SYSTEM_DATA[fieldKey] || "notes";
    const value = item.value;
    if (value == null || value === "") continue;

    if (systemDataKey === "__next_service_date__") {
      const dateVal = coerceDate(value);
      if (dateVal) {
        nextServiceDate = dateVal;
        applied.push({
          fieldKey,
          label: formatFieldLabel(fieldKey, item.label),
          systemDataKey: "next_service_date",
          value: dateVal,
        });
      }
      continue;
    }

    if (systemDataKey === "issues" && Array.isArray(value)) {
      const text = formatValueForStorage(value);
      existingData.issues = appendText(existingData.issues, text);
      applied.push({
        fieldKey,
        label: formatFieldLabel(fieldKey, item.label),
        systemDataKey: "issues",
        value: text,
      });
      continue;
    }

    if (systemDataKey === "notes") {
      const text = formatValueForStorage(value);
      existingData.notes = appendText(existingData.notes, text);
      applied.push({
        fieldKey,
        label: formatFieldLabel(fieldKey, item.label),
        systemDataKey: "notes",
        value: text,
      });
      continue;
    }

    existingData[systemDataKey] = typeof value === "string" ? value.trim() : value;
    applied.push({
      fieldKey,
      label: formatFieldLabel(fieldKey, item.label),
      systemDataKey,
      value: existingData[systemDataKey],
    });
  }

  return { data: existingData, next_service_date: nextServiceDate, applied };
}

function sanitizeStoredNotes(text) {
  if (typeof text !== "string") return text;
  let cleaned = text
    .replace(/\s*\[object Object\]\s*(?:,\s*\[object Object\])*\s*/gi, " ")
    .replace(/;\s*;+/g, "; ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!cleaned) return cleaned;

  const segments = cleaned
    .split(/;\s+|\n+/)
    .map((part) => part.trim().replace(/[.;,\s]+$/, ""))
    .filter(Boolean);
  const seen = new Set();
  const unique = [];
  for (const segment of segments) {
    const key = segment.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(segment);
  }
  return unique.length ? unique.join("; ") : cleaned;
}

function appendText(existing, addition) {
  const baseRaw = existing != null && existing !== "" ? String(existing) : "";
  const addRaw =
    addition != null && addition !== ""
      ? typeof addition === "string"
        ? addition
        : formatValueForStorage(addition)
      : "";
  const base = baseRaw ? sanitizeStoredNotes(baseRaw) : "";
  const add = addRaw ? sanitizeStoredNotes(addRaw) : "";
  if (!add) return base || null;
  if (!base) return add;
  if (base.includes(add)) return base;
  return sanitizeStoredNotes(`${base}\n${add}`);
}

function coerceDate(val) {
  if (!val) return null;
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatResultForApi(row, systemRow) {
  const findings = normalizeFindings(row.findings);
  return {
    id: row.id,
    jobId: row.job_id,
    propertyId: row.property_id,
    propertyDocumentId: row.property_document_id,
    systemKey: row.system_key,
    detectedCategory: row.detected_category,
    categoryLabel: CATEGORY_LABELS[row.detected_category] || row.detected_category,
    findings,
    reviewFields: buildReviewFields(row.system_key, findings, systemRow),
    reviewStatus: row.review_status,
    appliedFields: row.applied_fields || [],
    documentName: row.document_name || null,
    documentDate: row.document_date || null,
    documentKey: row.document_key || null,
    documentType: row.document_type || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = {
  CATEGORY_LABELS,
  buildReviewFields,
  mergeSelectedFields,
  formatResultForApi,
  normalizeFindings,
};
