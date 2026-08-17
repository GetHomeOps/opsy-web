"use strict";

/**
 * Maps AI-extracted field keys onto property_systems schema fields or
 * additional_details, with conflict-aware review rows.
 */

const { randomUUID } = require("crypto");
const {
  getSystemCatalog,
  getSchemaField,
} = require("./documentAnalysisSystemCatalog");

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
  brand: "Manufacturer / brand",
  model: "Model / product",
  material: "Material",
  installer: "Installer",
  vendor: "Vendor",
  cost: "Cost",
  warranty: "Warranty",
  warrantyDetails: "Warranty details",
  warrantyTerm: "Warranty term",
  condition: "Condition",
  technician: "Technician",
  scope: "Scope",
  summary: "Summary",
  findings: "Findings",
  notes: "Notes",
  serialNumber: "Serial number",
  permitNumber: "Permit number",
  installerPhone: "Installer phone",
  installerWebsite: "Installer website",
  installerEmail: "Installer email",
  installerStreet: "Installer street",
  installerCity: "Installer city",
  installerState: "Installer state",
  installerZip: "Installer ZIP",
  installerAddress: "Installer address",
};

/** Findings used only to populate a new installer contact, not system fields. */
const INSTALLER_CONTACT_KEY_MAP = {
  installerPhone: "phone",
  contractorPhone: "phone",
  vendorPhone: "phone",
  installerPhoneNumber: "phone",
  installerWebsite: "website",
  contractorWebsite: "website",
  vendorWebsite: "website",
  installerUrl: "website",
  installerEmail: "email",
  contractorEmail: "email",
  vendorEmail: "email",
  installerStreet: "street1",
  installerStreet1: "street1",
  installerStreet2: "street2",
  installerCity: "city",
  installerState: "state",
  installerZip: "zip_code",
  installerZipCode: "zip_code",
  installerPostalCode: "zip_code",
  installerCountry: "country",
  installerAddress: "address",
  contractorAddress: "address",
  vendorAddress: "address",
};

const SCHEMA_ALIASES = {
  lastInspection: "reportDate",
  lastInspectionDate: "reportDate",
  nextInspection: "nextServiceDate",
  nextInspectionDate: "nextServiceDate",
  issues: "findings",
  knownIssues: "findings",
  contractor: "installer",
  installerName: "installer",
  vendor: "installer",
  company: "installer",
  companyName: "installer",
  contractorName: "installer",
  businessName: "installer",
  manufacturer: "brand",
  brandName: "brand",
  product: "model",
  modelNumber: "model",
  totalCost: "cost",
  price: "cost",
  amount: "cost",
  systemType: "systemType",
  type: "type",
};

const COMMENTARY_FIELD_KEYS = new Set(["summary", "notes"]);

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
          const desc =
            item.description ||
            item.name ||
            item.item ||
            item.service ||
            item.text ||
            item.label;
          if (desc) parts.push(String(desc));
          const qty = item.quantity ?? item.qty;
          if (qty != null) parts.push(`Qty: ${qty}`);
          const price =
            item.price ?? item.unitPrice ?? item.amount ?? item.total ?? item.cost;
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

function isInstallerContactSidecarKey(fieldKey) {
  return Boolean(INSTALLER_CONTACT_KEY_MAP[fieldKey]);
}

function parseUsAddressLine(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  const m = s.match(
    /^(.+),\s*([^,]+),\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/,
  );
  if (!m) return { street1: s };
  return {
    street1: m[1].trim(),
    city: m[2].trim(),
    state: m[3].toUpperCase(),
    zip_code: m[4],
    country: "United States",
    country_code: "US",
  };
}

function normalizeWebsite(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (/^(www\.)?[\w.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(s)) return `https://${s}`;
  return s;
}

function applyAddressObject(details, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const street = value.street1 || value.street || value.address1 || value.line1;
  const street2 = value.street2 || value.address2 || value.line2;
  const city = value.city;
  const state = value.state || value.region;
  const zip = value.zip_code || value.zip || value.postalCode || value.postal_code;
  const country = value.country;
  if (street && !details.street1) details.street1 = String(street).trim();
  if (street2 && !details.street2) details.street2 = String(street2).trim();
  if (city && !details.city) details.city = String(city).trim();
  if (state && !details.state) details.state = String(state).trim();
  if (zip && !details.zip_code) details.zip_code = String(zip).trim();
  if (country && !details.country) details.country = String(country).trim();
}

function collectInstallerContactDetails(findings) {
  const details = {};
  const items = normalizeFindings(findings);
  for (const item of items) {
    const fieldKey = item.fieldKey || item.key;
    const canonical = resolveCanonicalFieldKey(fieldKey);
    if (
      canonical === "installer" &&
      item.value &&
      typeof item.value === "object" &&
      !Array.isArray(item.value)
    ) {
      const v = item.value;
      if (v.phone && !details.phone) details.phone = String(v.phone).trim();
      if (v.website && !details.website) details.website = normalizeWebsite(v.website);
      if (v.email && !details.email) details.email = String(v.email).trim();
      applyAddressObject(
        details,
        v.address && typeof v.address === "object" ? v.address : v,
      );
    }
    const contactKey = INSTALLER_CONTACT_KEY_MAP[fieldKey];
    if (!contactKey) continue;
    if (contactKey === "address") {
      if (item.value && typeof item.value === "object" && !Array.isArray(item.value)) {
        applyAddressObject(details, item.value);
      } else {
        const parsed = parseUsAddressLine(formatValueForStorage(item.value));
        if (parsed) {
          if (parsed.street1 && !details.street1) details.street1 = parsed.street1;
          if (parsed.city && !details.city) details.city = parsed.city;
          if (parsed.state && !details.state) details.state = parsed.state;
          if (parsed.zip_code && !details.zip_code) details.zip_code = parsed.zip_code;
          if (parsed.country && !details.country) details.country = parsed.country;
          if (parsed.country_code && !details.country_code) {
            details.country_code = parsed.country_code;
          }
        }
      }
      continue;
    }
    const text = formatValueForStorage(item.value);
    if (!text || details[contactKey]) continue;
    details[contactKey] = contactKey === "website" ? normalizeWebsite(text) : text;
  }

  if (details.state && /^[A-Za-z]{2}$/.test(details.state) && !details.country) {
    details.country = "United States";
    details.country_code = details.country_code || "US";
  }
  if (details.website) details.website = normalizeWebsite(details.website);

  const hasAny = Object.values(details).some((v) => v != null && String(v).trim() !== "");
  return hasAny ? details : null;
}

function formatInstallerContactDetailsPreview(details) {
  if (!details) return null;
  const address = [details.street1, details.city, details.state, details.zip_code]
    .filter(Boolean)
    .join(", ");
  const parts = [details.phone, details.website, details.email, address].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function normalizeFindings(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object" && Array.isArray(raw.items)) return raw.items;
  return [];
}

function coerceDate(val) {
  if (!val) return null;
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeForCompare(value) {
  if (value == null || value === "") return "";
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isEmptyValue(value) {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function parseWarrantyYesNo(value) {
  const s = String(value ?? "").trim().toLowerCase();
  if (!s) return null;
  if (["yes", "y", "true"].includes(s)) return "yes";
  if (["no", "n", "false"].includes(s)) return "no";
  if (/^(has |includes? |covered).{0,24}warranty/.test(s)) return "yes";
  if (/no warranty|not covered|warranty:?\s*none/.test(s)) return "no";
  return null;
}

function matchSelectOption(value, options) {
  if (!options?.length || value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const exact = options.find((opt) => opt.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;
  const compact = raw.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const fuzzy = options.find((opt) => {
    const optCompact = opt.toLowerCase().replace(/[^a-z0-9]+/g, "");
    return (
      compact.length >= 3 &&
      (optCompact.includes(compact) || compact.includes(optCompact))
    );
  });
  return fuzzy || null;
}

function findMatchingContact(name, contacts) {
  if (!name || !Array.isArray(contacts) || !contacts.length) return null;
  const norm = String(name).trim().toLowerCase().replace(/\s+/g, " ");
  if (norm.length < 3) return null;
  const exact = contacts.find((c) => {
    const cn = String(c.name || "").trim().toLowerCase().replace(/\s+/g, " ");
    return cn && cn === norm;
  });
  if (exact) return exact;
  return (
    contacts.find((c) => {
      const cn = String(c.name || "").trim().toLowerCase().replace(/\s+/g, " ");
      if (!cn || cn.length < 3) return false;
      return cn.includes(norm) || norm.includes(cn);
    }) || null
  );
}

function resolveCanonicalFieldKey(fieldKey) {
  if (!fieldKey) return "unknown";
  return SCHEMA_ALIASES[fieldKey] || fieldKey;
}

function getSchemaFieldFlexible(catalog, fieldKey) {
  const direct = getSchemaField(catalog, fieldKey);
  if (direct) return direct;
  if (fieldKey === "type") return getSchemaField(catalog, "systemType");
  if (fieldKey === "systemType") return getSchemaField(catalog, "type");
  return null;
}

function contactDisplayName(contacts, id) {
  if (id == null || !Array.isArray(contacts)) return id;
  const match = contacts.find((c) => String(c.id) === String(id));
  return match?.name || id;
}

/**
 * Decide where a finding should be stored for this system.
 */
function resolveDestination(fieldKey, value, catalog, contacts) {
  const canonical = resolveCanonicalFieldKey(fieldKey);
  const schema = getSchemaFieldFlexible(catalog, canonical);

  if (canonical === "brand" || canonical === "model") {
    return additionalDestination(canonical, FIELD_KEY_LABELS[canonical]);
  }

  if (schema?.type === "warranty-select") {
    const yesNo = parseWarrantyYesNo(value);
    if (yesNo) {
      return {
        destination: "schema",
        systemDataKey: schema.dataKey,
        destinationLabel: schema.label,
        merge: schema.merge || "replace",
        mappedValue: yesNo,
      };
    }
    return additionalDestination("warrantyDetails", "Warranty details");
  }

  if (schema?.type === "installer") {
    const contact = findMatchingContact(formatValueForStorage(value), contacts);
    if (contact) {
      return {
        destination: "schema",
        systemDataKey: "installer_id",
        destinationLabel: schema.label,
        merge: "replace",
        mappedValue: contact.id,
        mappedDisplayValue: contact.name,
      };
    }
    return additionalDestination("installer", "Installer");
  }

  if (schema?.type === "select" && schema.options?.length) {
    const matched = matchSelectOption(formatValueForStorage(value), schema.options);
    if (matched) {
      return {
        destination: "schema",
        systemDataKey: schema.dataKey,
        destinationLabel: schema.label,
        merge: schema.merge || "replace",
        mappedValue: matched,
      };
    }
    return additionalDestination(canonical, schema.label);
  }

  if (schema) {
    let mappedValue = value;
    if (schema.type === "date") {
      mappedValue = coerceDate(value) || formatValueForStorage(value);
    }
    return {
      destination: "schema",
      systemDataKey: schema.dataKey,
      destinationLabel: schema.label,
      merge: schema.merge || "replace",
      mappedValue,
    };
  }

  if (canonical === "warranty") {
    const yesNo = parseWarrantyYesNo(value);
    const warrantySchema = getSchemaField(catalog, "warranty");
    if (yesNo && warrantySchema) {
      return {
        destination: "schema",
        systemDataKey: warrantySchema.dataKey,
        destinationLabel: warrantySchema.label,
        merge: "replace",
        mappedValue: yesNo,
      };
    }
    return additionalDestination("warrantyDetails", "Warranty details");
  }

  return additionalDestination(
    canonical,
    formatFieldLabel(canonical, null),
  );
}

function additionalDestination(fieldKey, label) {
  return {
    destination: "additional_details",
    systemDataKey: "additional_details",
    destinationLabel: "Additional Details",
    merge: "append",
    mappedValue: null,
    additionalLabel: label || formatFieldLabel(fieldKey, null),
  };
}

function readCurrentValue(systemRow, systemDataKey) {
  const existingData =
    systemRow?.data && typeof systemRow.data === "object" ? systemRow.data : {};
  if (systemDataKey === "__next_service_date__") {
    return systemRow?.next_service_date || null;
  }
  if (systemDataKey === "additional_details") return null;
  const value = existingData[systemDataKey];
  return value == null || value === "" ? null : value;
}

function valuesEqual(a, b) {
  return normalizeForCompare(a) === normalizeForCompare(b);
}

function getItemValue(item, fieldOverrides) {
  const fieldKey = item.fieldKey || item.key;
  if (
    fieldOverrides &&
    fieldKey &&
    Object.prototype.hasOwnProperty.call(fieldOverrides, fieldKey)
  ) {
    return fieldOverrides[fieldKey];
  }
  return item.value;
}

/**
 * Build review rows with current system values for the UI.
 */
function buildReviewFields(systemKey, findings, systemRow, options = {}) {
  const catalog = getSystemCatalog(systemKey);
  const contacts = options.contacts || [];
  const sourceDocumentName = options.documentName || null;
  const existingDetails = Array.isArray(systemRow?.data?.additional_details)
    ? systemRow.data.additional_details
    : [];
  const contactDetails = collectInstallerContactDetails(findings);
  const contactDetailsPreview = formatInstallerContactDetailsPreview(contactDetails);

  return normalizeFindings(findings)
    .filter((item) => !isInstallerContactSidecarKey(item.fieldKey || item.key))
    .map((item) => {
    const fieldKey = item.fieldKey || item.key || "unknown";
    const dest = resolveDestination(fieldKey, item.value, catalog, contacts);
    const currentValue = dest.destination === "schema"
      ? dest.systemDataKey === "installer_id"
        ? contactDisplayName(contacts, readCurrentValue(systemRow, dest.systemDataKey))
        : readCurrentValue(systemRow, dest.systemDataKey)
      : null;
    const proposedForCompare =
      dest.mappedDisplayValue ?? dest.mappedValue ?? item.value;
    const currentRaw =
      dest.destination === "schema"
        ? readCurrentValue(systemRow, dest.systemDataKey)
        : null;
    const hasConflict =
      dest.destination === "schema" &&
      dest.merge !== "append" &&
      !isEmptyValue(currentRaw) &&
      !valuesEqual(currentRaw, dest.mappedValue ?? item.value);
    const duplicateDetail =
      dest.destination === "additional_details" &&
      existingDetails.some(
        (d) =>
          normalizeForCompare(d.label) ===
            normalizeForCompare(dest.additionalLabel) &&
          normalizeForCompare(d.value) ===
            normalizeForCompare(formatValueForStorage(item.value)),
      );
    const selectedByDefault = COMMENTARY_FIELD_KEYS.has(
      resolveCanonicalFieldKey(fieldKey),
    )
      ? false
      : dest.destination === "additional_details"
        ? !duplicateDetail
        : dest.merge === "append"
          ? true
          : !hasConflict;

    const schema = getSchemaFieldFlexible(catalog, resolveCanonicalFieldKey(fieldKey));
    const canCreateInstallerContact =
      schema?.type === "installer" && dest.destination === "additional_details";

    return {
      fieldKey,
      label: formatFieldLabel(fieldKey, item.label || dest.additionalLabel),
      proposedValue: item.value,
      mappedValue: dest.mappedValue,
      mappedDisplayValue: dest.mappedDisplayValue || null,
      confidence: item.confidence ?? null,
      evidence: item.evidence ?? null,
      destination: dest.destination,
      destinationLabel: dest.destinationLabel,
      systemDataKey: dest.systemDataKey,
      currentValue,
      hasConflict,
      selectedByDefault,
      canCreateInstallerContact,
      contactDetails: canCreateInstallerContact ? contactDetails : null,
      contactDetailsPreview: canCreateInstallerContact ? contactDetailsPreview : null,
      formFieldHint:
        dest.destination === "additional_details"
          ? "Additional Details"
          : dest.destinationLabel,
      sourceDocumentName,
    };
  });
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

function upsertAdditionalDetail(existingData, entry) {
  const current = Array.isArray(existingData.additional_details)
    ? [...existingData.additional_details]
    : [];
  const duplicate = current.find(
    (d) =>
      normalizeForCompare(d.label) === normalizeForCompare(entry.label) &&
      normalizeForCompare(d.value) === normalizeForCompare(entry.value),
  );
  if (duplicate) return current;
  current.push(entry);
  return current;
}

/**
 * Merge selected findings into property_systems.data.
 */
function mergeSelectedFields(findings, selectedFieldKeys, systemRow, options = {}) {
  const existingData =
    systemRow?.data && typeof systemRow.data === "object"
      ? { ...systemRow.data }
      : {};
  let nextServiceDate = systemRow?.next_service_date || null;
  const applied = [];
  const selected = new Set(selectedFieldKeys || []);
  const items = normalizeFindings(findings);
  const catalog = getSystemCatalog(systemRow?.system_key || options.systemKey);
  const contacts = options.contacts || [];
  const fieldOverrides = options.fieldOverrides || {};
  const source = options.source || {};

  for (const item of items) {
    const fieldKey = item.fieldKey || item.key;
    if (!fieldKey || !selected.has(fieldKey)) continue;
    if (isInstallerContactSidecarKey(fieldKey)) continue;

    const rawValue = getItemValue(item, fieldOverrides);
    if (rawValue == null || rawValue === "") continue;

    const dest = resolveDestination(fieldKey, rawValue, catalog, contacts);
    const label = formatFieldLabel(fieldKey, item.label || dest.additionalLabel);

    if (dest.destination === "additional_details") {
      const text = formatValueForStorage(rawValue);
      if (!text) continue;
      const entry = {
        id: randomUUID(),
        label: dest.additionalLabel || label,
        value: text,
        fieldKey,
        source: {
          propertyDocumentId: source.propertyDocumentId || null,
          documentName: source.documentName || null,
          documentKey: source.documentKey || null,
          analysisResultId: source.analysisResultId || null,
        },
        createdAt: new Date().toISOString(),
      };
      existingData.additional_details = upsertAdditionalDetail(existingData, entry);
      applied.push({
        fieldKey,
        label: entry.label,
        systemDataKey: "additional_details",
        destination: "additional_details",
        value: text,
        source: entry.source,
      });
      continue;
    }

    if (dest.systemDataKey === "__next_service_date__") {
      const dateVal = coerceDate(dest.mappedValue ?? rawValue);
      if (dateVal) {
        nextServiceDate = dateVal;
        applied.push({
          fieldKey,
          label,
          systemDataKey: "next_service_date",
          destination: "schema",
          value: dateVal,
        });
      }
      continue;
    }

    if (dest.merge === "append") {
      const text = formatValueForStorage(dest.mappedValue ?? rawValue);
      existingData[dest.systemDataKey] = appendText(
        existingData[dest.systemDataKey],
        text,
      );
      applied.push({
        fieldKey,
        label,
        systemDataKey: dest.systemDataKey,
        destination: "schema",
        value: text,
      });
      continue;
    }

    const stored =
      dest.mappedValue != null ? dest.mappedValue : typeof rawValue === "string"
        ? rawValue.trim()
        : rawValue;
    existingData[dest.systemDataKey] = stored;
    applied.push({
      fieldKey,
      label,
      systemDataKey: dest.systemDataKey,
      destination: "schema",
      value: stored,
    });
  }

  return { data: existingData, next_service_date: nextServiceDate, applied };
}

function formatResultForApi(row, systemRow, options = {}) {
  const findings = normalizeFindings(row.findings);
  const documentName = row.document_name || options.documentName || null;
  return {
    id: row.id,
    jobId: row.job_id,
    propertyId: row.property_id,
    propertyDocumentId: row.property_document_id,
    systemKey: row.system_key,
    detectedCategory: row.detected_category,
    categoryLabel: CATEGORY_LABELS[row.detected_category] || row.detected_category,
    findings,
    reviewFields: buildReviewFields(row.system_key, findings, systemRow, {
      contacts: options.contacts,
      documentName,
    }),
    reviewStatus: row.review_status,
    appliedFields: row.applied_fields || [],
    documentName,
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
  formatFieldLabel,
  collectInstallerContactDetails,
};
