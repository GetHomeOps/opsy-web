export const FINANCIAL_UPLOAD_TYPES = [
  {
    id: "mortgage",
    label: "Mortgage",
    description: "Statement, note, or closing disclosure",
  },
  {
    id: "tax",
    label: "Property tax",
    description: "Tax bill, assessment notice, or payment receipt",
  },
  {
    id: "insurance",
    label: "Homeowners insurance",
    description: "Declarations page, policy, or premium bill",
  },
  {
    id: "hoa",
    label: "HOA",
    description: "Statement, dues invoice, or covenant",
  },
];

export const FINANCIAL_FILING_TYPE_IDS = new Set(
  FINANCIAL_UPLOAD_TYPES.map((type) => type.id),
);

const FINANCIAL_UPLOAD_COPY = {
  mortgage: {
    title: "Upload Mortgage Document",
    subtitle: "Mortgage statement, note, or closing disclosure",
    placeholder: "e.g. Mortgage statement August 2026",
  },
  tax: {
    title: "Upload Property Tax Document",
    subtitle: "Tax bill, assessment notice, or payment receipt",
    placeholder: "e.g. Property tax bill 2025",
  },
  insurance: {
    title: "Upload Insurance Document",
    subtitle: "Declarations page, policy, or premium bill",
    placeholder: "e.g. Homeowners insurance declarations 2026",
  },
  hoa: {
    title: "Upload HOA Document",
    subtitle: "HOA statement, dues invoice, or covenant",
    placeholder: "e.g. HOA dues statement 2026",
  },
};

const FINANCIAL_UPLOAD_FALLBACK = {
  title: "Upload Financial Document",
  subtitle:
    "Mortgage statements, tax bills, insurance declarations, and HOA statements",
  placeholder: "e.g. Mortgage statement August 2026",
};

export function isFinancialFilingType(value) {
  return FINANCIAL_FILING_TYPE_IDS.has(String(value || "").toLowerCase());
}

export function getFinancialUploadCopy(type) {
  const key = String(type || "").toLowerCase();
  return FINANCIAL_UPLOAD_COPY[key] || FINANCIAL_UPLOAD_FALLBACK;
}
