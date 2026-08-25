"use strict";

/**
 * Document classification helpers: category routing and display-type sync.
 */

const VALID_CATEGORIES = new Set([
  "installation_invoice",
  "maintenance_report",
  "inspection_report",
  "bid",
  "other",
]);

/** Categories the user can declare before analysis (non-inspection). */
const DECLARED_CATEGORIES = new Set([
  "bid",
  "installation_invoice",
  "other",
]);

const CATEGORY_TO_DOCUMENT_TYPE = {
  installation_invoice: "invoice",
  maintenance_report: "receipt",
  inspection_report: "inspection",
  bid: "bid",
  other: "other",
};

const DOCUMENT_TYPE_TO_CATEGORY = {
  invoice: "installation_invoice",
  receipt: "installation_invoice",
  bid: "bid",
  quote: "bid",
  estimate: "bid",
  contract: "bid",
  inspection: "inspection_report",
};

const SPECIALIZED_DOCUMENT_TYPES = new Set([
  "warranty",
  "permit",
  "manual",
  "insurance",
  "mortgage",
]);

function normalizeCategory(value) {
  const category = String(value || "").trim();
  return VALID_CATEGORIES.has(category) ? category : null;
}

function classifyCategoryFromHints({ documentType, fileName } = {}) {
  const type = String(documentType || "").trim().toLowerCase();
  if (DOCUMENT_TYPE_TO_CATEGORY[type]) {
    return DOCUMENT_TYPE_TO_CATEGORY[type];
  }

  const name = String(fileName || "").toLowerCase();
  if (/\bbid\b|\bquote\b|\bestimate\b|\bproposal\b/.test(name)) return "bid";
  if (/\binvoice\b|\binvoices\b|\breceipt\b/.test(name)) return "installation_invoice";
  if (/\binspection\b/.test(name)) return "inspection_report";
  if (/\bmaintenance\b|\bservice report\b/.test(name)) return "maintenance_report";
  return "other";
}

function resolveDetectedCategory(classifiedCategory, hints = {}) {
  return (
    normalizeCategory(classifiedCategory) ||
    classifyCategoryFromHints(hints)
  );
}

function canonicalDocumentTypeForCategory(category) {
  return CATEGORY_TO_DOCUMENT_TYPE[category] || null;
}

function shouldSyncDocumentType(currentType, category) {
  const canonical = canonicalDocumentTypeForCategory(category);
  if (!canonical || canonical === "other") return false;
  const current = String(currentType || "").trim().toLowerCase();
  if (current === canonical) return false;
  if (category === "other") return false;
  if (SPECIALIZED_DOCUMENT_TYPES.has(current) && canonical === "receipt") {
    return false;
  }
  return true;
}

function canProposePropertyIdentity(category) {
  return category === "installation_invoice";
}

function resolveDeclaredCategory(value) {
  const category = normalizeCategory(value);
  return DECLARED_CATEGORIES.has(category) ? category : null;
}

function shouldWriteExtractedFieldsToSystem(category) {
  return category !== "bid";
}

module.exports = {
  VALID_CATEGORIES,
  DECLARED_CATEGORIES,
  CATEGORY_TO_DOCUMENT_TYPE,
  DOCUMENT_TYPE_TO_CATEGORY,
  classifyCategoryFromHints,
  resolveDetectedCategory,
  resolveDeclaredCategory,
  canonicalDocumentTypeForCategory,
  shouldSyncDocumentType,
  canProposePropertyIdentity,
  shouldWriteExtractedFieldsToSystem,
};
