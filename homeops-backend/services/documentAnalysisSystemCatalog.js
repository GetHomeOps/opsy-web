"use strict";

/**
 * System-aware field catalogs for document analysis.
 * Mirrors frontend systemFieldConfig / STANDARD_CUSTOM_SYSTEM_FIELDS so
 * extraction and mapping know which schema fields exist per system.
 */

const CONDITION_OPTIONS = ["Excellent", "Good", "Fair", "Poor"];

const ROOF_MATERIALS = [
  "Built Up",
  "Cedar Shake",
  "Composition",
  "Flat",
  "Green (Living)",
  "Metal",
  "Tile",
  "Torch Down",
  "Other",
];

const GUTTER_MATERIALS = ["Aluminum", "Copper", "Vinyl", "Other"];

const EXTRA_FIELDS = [
  { fieldKey: "brand", label: "Manufacturer / brand" },
  { fieldKey: "model", label: "Model / product" },
  { fieldKey: "installer", label: "Installer / contractor" },
  { fieldKey: "cost", label: "Cost" },
  { fieldKey: "warrantyDetails", label: "Warranty details" },
  { fieldKey: "warrantyTerm", label: "Warranty term" },
  { fieldKey: "serialNumber", label: "Serial number" },
  { fieldKey: "permitNumber", label: "Permit number" },
];

/** Invoice-extractable property identity fields (camelCase keys from propertyStructure). */
const IDENTITY_FIELDS = [
  { fieldKey: "identity.address", propertyKey: "address", column: "address", label: "Address", valueType: "string" },
  { fieldKey: "identity.city", propertyKey: "city", column: "city", label: "City", valueType: "string" },
  { fieldKey: "identity.state", propertyKey: "state", column: "state", label: "State", valueType: "string" },
  { fieldKey: "identity.zip", propertyKey: "zip", column: "zip", label: "ZIP", valueType: "string" },
  { fieldKey: "identity.county", propertyKey: "county", column: "county", label: "County", valueType: "string" },
  { fieldKey: "identity.taxId", propertyKey: "taxId", column: "tax_id", label: "Tax / Parcel ID", valueType: "string" },
  { fieldKey: "identity.ownerName", propertyKey: "ownerName", column: "owner_name", label: "Owner Name", valueType: "string" },
  { fieldKey: "identity.ownerName2", propertyKey: "ownerName2", column: "owner_name_2", label: "Owner Name 2", valueType: "string" },
  { fieldKey: "identity.ownerCity", propertyKey: "ownerCity", column: "owner_city", label: "Owner City", valueType: "string" },
  { fieldKey: "identity.ownerPhone", propertyKey: "ownerPhone", column: "owner_phone", label: "Owner Phone", valueType: "string" },
  { fieldKey: "identity.occupantName", propertyKey: "occupantName", column: "occupant_name", label: "Occupant Name", valueType: "string" },
  { fieldKey: "identity.propertyType", propertyKey: "propertyType", column: "property_type", label: "Property Type", valueType: "string" },
  { fieldKey: "identity.roofType", propertyKey: "roofType", column: "roof_type", label: "Roof", valueType: "string" },
  { fieldKey: "identity.yearBuilt", propertyKey: "yearBuilt", column: "year_built", label: "Year Built", valueType: "integer" },
  { fieldKey: "identity.sqFtTotal", propertyKey: "sqFtTotal", column: "sq_ft_total", label: "Total (ft²)", valueType: "number" },
];

const IDENTITY_FIELD_BY_KEY = new Map(
  IDENTITY_FIELDS.flatMap((field) => [
    [field.fieldKey, field],
    [field.propertyKey, field],
    [field.column, field],
    [`identity_${field.propertyKey}`, field],
  ]),
);

function schemaField(fieldKey, dataKey, label, type, extra = {}) {
  return { fieldKey, dataKey, label, type, ...extra };
}

const COMMON_LIFECYCLE_FIELDS = [
  schemaField("installDate", "install_date", "Install Date", "date"),
  schemaField("installer", "installer_id", "Installer", "installer"),
  schemaField("condition", "condition", "Condition", "select", {
    options: CONDITION_OPTIONS,
  }),
  schemaField("warranty", "warranty", "Warranty", "warranty-select"),
  schemaField("reportDate", "last_inspection", "Last Inspection", "date"),
  schemaField("nextServiceDate", "__next_service_date__", "Next Inspection", "date"),
  schemaField("findings", "issues", "Known Issues", "textarea", { merge: "append" }),
];

const SYSTEM_CATALOGS = {
  roof: {
    label: "Roof",
    schemaFields: [
      schemaField("material", "material", "Material", "select", {
        options: ROOF_MATERIALS,
      }),
      ...COMMON_LIFECYCLE_FIELDS,
    ],
  },
  gutters: {
    label: "Gutters",
    schemaFields: [
      schemaField("material", "material", "Material", "select", {
        options: GUTTER_MATERIALS,
      }),
      schemaField("gutterGuards", "guards", "Gutter Guards", "select", {
        options: ["Yes", "No"],
      }),
      schemaField("installDate", "install_date", "Install Date", "date"),
      schemaField("installer", "installer_id", "Installer", "installer"),
      schemaField("condition", "condition", "Condition", "select", {
        options: CONDITION_OPTIONS,
      }),
      schemaField("reportDate", "last_inspection", "Last Cleaning", "date"),
      schemaField("nextServiceDate", "__next_service_date__", "Next Cleaning Date", "date"),
      schemaField("findings", "issues", "Known Issues", "textarea", { merge: "append" }),
    ],
  },
  foundation: {
    label: "Foundation",
    schemaFields: [
      schemaField("type", "type", "Foundation Type", "text"),
      schemaField("condition", "condition", "Condition", "select", {
        options: CONDITION_OPTIONS,
      }),
      schemaField("reportDate", "last_inspection", "Last Inspection", "date"),
      schemaField("nextServiceDate", "__next_service_date__", "Next Inspection", "date"),
      schemaField("findings", "issues", "Known Issues", "textarea", { merge: "append" }),
    ],
  },
  exterior: {
    label: "Exterior / Siding",
    schemaFields: [
      schemaField("type", "type", "Siding Type", "text"),
      ...COMMON_LIFECYCLE_FIELDS,
    ],
  },
  windows: {
    label: "Windows",
    schemaFields: [
      schemaField("type", "type", "Window Type", "text"),
      ...COMMON_LIFECYCLE_FIELDS,
    ],
  },
  heating: {
    label: "Heating",
    schemaFields: [
      schemaField("systemType", "system_type", "System Type", "text"),
      schemaField("location", "location", "Location", "text"),
      ...COMMON_LIFECYCLE_FIELDS,
    ],
  },
  ac: {
    label: "Air Conditioning",
    schemaFields: [
      schemaField("systemType", "system_type", "System Type", "text"),
      schemaField("location", "location", "Location", "text"),
      ...COMMON_LIFECYCLE_FIELDS,
    ],
  },
  waterHeating: {
    label: "Water Heating",
    schemaFields: [
      schemaField("systemType", "system_type", "System Type", "text"),
      ...COMMON_LIFECYCLE_FIELDS,
    ],
  },
  electrical: {
    label: "Electrical",
    schemaFields: [
      schemaField("serviceAmperage", "service_amperage", "Service Amperage", "text"),
      schemaField("location", "location", "Panel Location", "text"),
      ...COMMON_LIFECYCLE_FIELDS,
    ],
  },
  plumbing: {
    label: "Plumbing",
    schemaFields: [
      schemaField("supplyMaterials", "supply_materials", "Supply Materials", "text"),
      schemaField("wasteType", "waste_type", "Waste Type", "text"),
      schemaField("mainTurnoffLocation", "main_turnoff_location", "Main Turnoff Location", "text"),
      schemaField("clearoutLocation", "clearout_location", "Clearout Location", "text"),
      ...COMMON_LIFECYCLE_FIELDS,
    ],
  },
  safety: {
    label: "Safety",
    schemaFields: [
      schemaField("smokeCOCoverage", "smoke_co_coverage", "Smoke/CO Coverage", "text"),
      schemaField("gfciStatus", "gfci_status", "GFCI Status", "text"),
      schemaField("findings", "known_hazards", "Known Hazards", "textarea", {
        merge: "append",
      }),
    ],
  },
};

const CUSTOM_CATALOG = {
  label: "Custom system",
  schemaFields: [
    schemaField("material", "material", "Material", "text"),
    ...COMMON_LIFECYCLE_FIELDS,
  ],
};

const GENERIC_CATALOG = {
  label: "System",
  schemaFields: [
    schemaField("material", "material", "Material", "text"),
    ...COMMON_LIFECYCLE_FIELDS,
  ],
};

function getSystemCatalog(systemKey) {
  const key = String(systemKey || "").trim();
  if (SYSTEM_CATALOGS[key]) {
    return { systemKey: key, ...SYSTEM_CATALOGS[key], extraFields: EXTRA_FIELDS };
  }
  if (key.startsWith("custom-")) {
    return { systemKey: key, ...CUSTOM_CATALOG, extraFields: EXTRA_FIELDS };
  }
  return { systemKey: key || "general", ...GENERIC_CATALOG, extraFields: EXTRA_FIELDS };
}

function getSchemaField(catalog, fieldKey) {
  if (!catalog?.schemaFields) return null;
  return catalog.schemaFields.find((f) => f.fieldKey === fieldKey) || null;
}

function getSchemaFieldByDataKey(catalog, dataKey) {
  if (!catalog?.schemaFields) return null;
  return catalog.schemaFields.find((f) => f.dataKey === dataKey) || null;
}

function isIdentityFieldKey(fieldKey) {
  if (!fieldKey) return false;
  const key = String(fieldKey).trim();
  return key.startsWith("identity.") || IDENTITY_FIELD_BY_KEY.has(key);
}

function resolveIdentityField(fieldKey) {
  if (!fieldKey) return null;
  const key = String(fieldKey).trim();
  if (IDENTITY_FIELD_BY_KEY.has(key)) return IDENTITY_FIELD_BY_KEY.get(key);
  if (key.startsWith("identity.")) {
    return IDENTITY_FIELD_BY_KEY.get(key) || null;
  }
  return null;
}

function getIdentityFields() {
  return IDENTITY_FIELDS;
}

function categoryExtractionHints(category) {
  if (category === "bid") {
    return `This document is a bid, quote, estimate, or proposal.
- Extract lineItems, totalPrice/cost, validUntil, termsAndConditions, and installer (issuing contractor).
- Do not extract property identity fields (owner, tax ID, year built). Bids are not a source of truth for the property.`;
  }
  if (category === "installation_invoice") {
    const identityLines = IDENTITY_FIELDS.map(
      (f) => `- ${f.fieldKey}: ${f.label}`,
    ).join("\n");
    return `This document is an invoice or paid receipt and is a source of truth for the property.
- Extract installer, cost, installDate, warranty, brand, model, serialNumber, and line items as usual.
- Also extract property identity fields when clearly present on the invoice (job-site / service address, Bill To owner, parcel/tax ID, year built, square footage). Use these exact fieldKeys:
${identityLines}
- Prefer the job-site or service address over the contractor's office address.
- Prefer Bill To / customer as ownerName, never the contractor.
- Only include identity fields you can support with evidence.`;
  }
  if (category === "maintenance_report") {
    return `This document is a maintenance or service report.
- Extract technician, reportDate, nextServiceDate, findings, and work performed.
- Do not treat this as a property identity source.`;
  }
  if (category === "inspection_report") {
    return `This document is an inspection or condition report.
- Extract condition, findings, reportDate, and recommended next steps.
- Do not treat this as a property identity source.`;
  }
  return `Extract only facts clearly supported by the document. Do not invent property identity values.`;
}

function buildExtractionPrompt({ catalog, category, documentType }) {
  const systemLabel = catalog.label || catalog.systemKey || "system";
  const systemKey = catalog.systemKey || "general";
  const schemaLines = (catalog.schemaFields || [])
    .map((f) => {
      let line = `- ${f.fieldKey}: ${f.label}`;
      if (f.options?.length) line += ` (prefer one of: ${f.options.join(", ")})`;
      if (f.type === "date") line += " (YYYY-MM-DD)";
      if (f.type === "warranty-select") {
        line += " (Yes or No only if clearly stated; otherwise use warrantyDetails)";
      }
      return line;
    })
    .join("\n");
  const extraLines = (catalog.extraFields || [])
    .map((f) => `- ${f.fieldKey}: ${f.label}`)
    .join("\n");
  const categoryHint = category ? ` (${String(category).replace(/_/g, " ")})` : "";
  const typeHint = documentType ? ` Document type hint: ${documentType}.` : "";
  const categoryRules = categoryExtractionHints(category);

  return `Extract information relevant to the "${systemLabel}" (${systemKey}) home system from this document${categoryHint}.${typeHint}
Output ONLY valid JSON:
{
  "summary": "1-2 sentence summary",
  "items": [
    { "fieldKey": "string", "label": "Human label", "value": "extracted value or array", "confidence": 0.0-1.0, "evidence": "short verbatim quote" }
  ]
}

${categoryRules}

Prefer these system fields when the document supports them:
${schemaLines}

Also extract these when present:
${extraLines}

For invoices, receipts, bids, quotes, and installation contracts:
- Extract the issuing company from the header, letterhead, logo, or "from" party as fieldKey "installer" (company name only).
- Do not use Bill To, the customer, or the property owner as installer.
- Prefer fieldKey "installer" over "vendor" or "company" for that company name.
- Also extract that same issuing company's contact details (header/letterhead/logo, not Bill To):
  - installerPhone
  - installerWebsite
  - installerEmail
  - installerStreet, installerCity, installerState, installerZip (use installerAddress as one line if you cannot split)
Look at logos and stylized header graphics; the contractor name, phone, website, and address are often only there.

You may include other useful fieldKeys with clear human labels for specific facts (serial numbers, coverage terms, contractor license, line items, technician, scope, etc.).
Include only fields you can support with evidence. Dates as YYYY-MM-DD when possible.
Do not invent values.`;
}

module.exports = {
  CONDITION_OPTIONS,
  EXTRA_FIELDS,
  IDENTITY_FIELDS,
  getSystemCatalog,
  getSchemaField,
  getSchemaFieldByDataKey,
  getIdentityFields,
  isIdentityFieldKey,
  resolveIdentityField,
  buildExtractionPrompt,
};
