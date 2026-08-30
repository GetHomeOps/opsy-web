export const DOCUMENT_ANALYSIS_CATEGORY_TABS = [
  { id: "bid", label: "Bids" },
  { id: "maintenance_report", label: "Maintenance" },
  { id: "inspection_report", label: "Inspection" },
  { id: "installation_invoice", label: "Installation" },
  { id: "other", label: "Other" },
];

export const ANALYSIS_PROMPT_TYPES = [
  {
    id: "bid",
    label: "Bid / quote",
    description: "Saved for comparison. Opsy will not overwrite this system's installed details.",
  },
  {
    id: "installation_invoice",
    label: "Invoice / receipt",
    description:
      "Source of truth. Opsy can fill property identity and system details after you review.",
  },
  {
    id: "other",
    label: "Other",
    description: "Extract useful details without treating this as a bid or an invoice.",
  },
];

const DOCUMENT_TYPE_TO_CATEGORY = {
  invoice: "installation_invoice",
  receipt: "installation_invoice",
  bid: "bid",
  quote: "bid",
  estimate: "bid",
  contract: "bid",
};

export const UPLOAD_OTHER_DOCUMENT_TYPES = [
  { id: "contract", label: "Contract" },
  { id: "warranty", label: "Warranty" },
  { id: "inspection", label: "Inspection Report" },
  { id: "permit", label: "Permit" },
  { id: "manual", label: "Manual" },
  { id: "insurance", label: "Insurance" },
  { id: "mortgage", label: "Mortgage" },
  { id: "other", label: "Other" },
];

export const UPLOAD_INVOICE_RECEIPT_TYPES = [
  { id: "invoice", label: "Invoice" },
  { id: "receipt", label: "Receipt" },
];

const PICKER_CATEGORIES = new Set(ANALYSIS_PROMPT_TYPES.map((type) => type.id));
const OTHER_FILING_TYPES = new Set(UPLOAD_OTHER_DOCUMENT_TYPES.map((type) => type.id));

export function resolveDeclaredAnalysisCategory(value) {
  const category = String(value || "").trim();
  return PICKER_CATEGORIES.has(category) ? category : null;
}

export function readDeclaredAnalysisCategory(doc) {
  const source = doc && typeof doc === "object" ? doc : {};
  return resolveDeclaredAnalysisCategory(
    source.declaredAnalysisCategory || source.declared_analysis_category,
  );
}

export function guessAnalysisCategory(doc) {
  const declared = readDeclaredAnalysisCategory(doc);
  if (declared) return declared;

  const source = doc && typeof doc === "object" ? doc : {};
  const type = String(source.document_type || source.type || "").trim().toLowerCase();
  if (DOCUMENT_TYPE_TO_CATEGORY[type]) return DOCUMENT_TYPE_TO_CATEGORY[type];

  const name = String(source.document_name || source.file_name || source.name || "").toLowerCase();
  if (/\bbid\b|\bquote\b|\bestimate\b|\bproposal\b/.test(name)) return "bid";
  if (/\binvoice\b|\binvoices\b|\breceipt\b/.test(name)) return "installation_invoice";
  return "other";
}

export function filingTypeForAnalysisGroup(groupId, subtype) {
  const category = resolveDeclaredAnalysisCategory(groupId);
  if (category === "bid") return "bid";
  if (category === "installation_invoice") {
    return subtype === "receipt" ? "receipt" : "invoice";
  }
  if (category === "other") {
    return OTHER_FILING_TYPES.has(subtype) ? subtype : "other";
  }
  return null;
}

export function shouldSkipAnalysisTypeStep(declaredCategory) {
  const category = resolveDeclaredAnalysisCategory(declaredCategory);
  return category === "bid" || category === "installation_invoice";
}

export function shouldPromptActionItemLink(category) {
  return category === "bid" || category === "installation_invoice";
}

export const ANALYSIS_PROMPT_STEPS = ["project", "type", "approval"];

const STEP_TITLES = {
  project: "Which project is this for?",
  type: "What is this document?",
  approval: "Analyze this document with AI?",
};

export function getAnalysisPromptSteps({
  canLinkActionItem,
  declaredCategory,
} = {}) {
  const skipType = shouldSkipAnalysisTypeStep(declaredCategory);
  const steps = [];
  if (canLinkActionItem) steps.push("project");
  if (!skipType) steps.push("type");
  steps.push("approval");
  return steps;
}

export function getAnalysisPromptStepTitle(step) {
  return STEP_TITLES[step] || STEP_TITLES.approval;
}

export function resolveFindingsModalConfig({
  categoryFilter = null,
  systemLabel,
} = {}) {
  if (categoryFilter === "bid") {
    return {
      title: "Quotes & bids",
      description: systemLabel
        ? `Compare quotes and bids for ${systemLabel}.`
        : "Compare quotes and bids for this system.",
      emptyTitle: "No quotes or bids yet",
      emptyDescription:
        "File a bid, quote, or estimate into this system folder and Opsy will extract the details for comparison.",
      tabs: DOCUMENT_ANALYSIS_CATEGORY_TABS.filter((tab) => tab.id === "bid"),
    };
  }
  return {
    title: "AI document insights",
    description: systemLabel || "",
    emptyTitle: "No AI document insights yet",
    emptyDescription:
      "Upload a document using the Upload button and Opsy will extract key details for this system.",
    tabs: DOCUMENT_ANALYSIS_CATEGORY_TABS,
  };
}

export function partitionReviewFields(reviewFields = []) {
  const identityFields = [];
  const systemFields = [];
  for (const field of reviewFields) {
    if (field?.destination === "property_identity") identityFields.push(field);
    else systemFields.push(field);
  }
  return { identityFields, systemFields };
}

export function pickQuoteSummary(item = {}) {
  const findings = Array.isArray(item.findings) ? item.findings : [];
  const byKey = new Map(
    findings.map((field) => [field.fieldKey || field.key, field]),
  );
  const applied = Array.isArray(item.appliedFields) ? item.appliedFields : [];
  for (const field of applied) {
    const key = field.fieldKey || field.key;
    if (key && !byKey.has(key)) byKey.set(key, field);
  }
  const valueOf = (...keys) => {
    for (const key of keys) {
      const field = byKey.get(key);
      if (field?.value != null && field.value !== "") return field.value;
      if (field?.proposedValue != null && field.proposedValue !== "") {
        return field.proposedValue;
      }
    }
    return null;
  };
  return {
    installer: valueOf("installer", "vendor", "contractor"),
    total: valueOf("totalPrice", "cost", "price", "amount"),
    validUntil: valueOf("validUntil"),
    lineItems: valueOf("lineItems"),
  };
}
