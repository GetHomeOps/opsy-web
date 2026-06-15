/**
 * record_status: lifecycle of the record
 * - draft: user filling in, neither completed nor submitted; shows submit/cancel alert
 * - user_completed: user completed it themselves (canceled submit); editable
 * - contractor_pending: submitted to contractor; read-only, blocks edits
 */
export const RECORD_STATUS = {
  DRAFT: "draft",
  USER_COMPLETED: "user_completed",
  CONTRACTOR_PENDING: "contractor_pending",
  CONTRACTOR_COMPLETED: "contractor_completed",
};

/** True when a maintenance record represents finished work (not scheduled/upcoming). */
export function isCompletedMaintenanceRecord(record) {
  const status = String(record?.status ?? "").trim().toLowerCase();
  const recordStatus = String(record?.record_status ?? "").trim().toLowerCase();
  const camelRecordStatus = String(record?.recordStatus ?? "")
    .trim()
    .toLowerCase();
  return (
    status === "completed" ||
    recordStatus === RECORD_STATUS.USER_COMPLETED ||
    recordStatus === RECORD_STATUS.CONTRACTOR_COMPLETED ||
    camelRecordStatus === RECORD_STATUS.USER_COMPLETED ||
    camelRecordStatus === RECORD_STATUS.CONTRACTOR_COMPLETED
  );
}

/** Fields stored in the `data` object; null/undefined become empty string or [] */
const DATA_FIELDS = [
  "contractor",
  "contractorEmail",
  "contractorPhone",
  "description",
  "cost",
  "workOrderNumber",
  "materialsUsed",
  "notes",
  "findings",
  "nextStepsRecommendation",
  "files",
  "requestStatus",
  "checklist_item_id",
  "hideSendToContractorBanner",
  "recordType",
  "source",
];

const DATA_DEFAULTS = {
  contractor: "",
  contractorEmail: "",
  contractorPhone: "",
  description: "",
  cost: "",
  workOrderNumber: "",
  materialsUsed: [],
  notes: "",
  findings: "",
  nextStepsRecommendation: "",
  files: [],
  requestStatus: null,
  checklist_item_id: null,
  hideSendToContractorBanner: false,
  recordType: "",
  source: "Manual",
};

/** Canonical record types for maintenance records. */
export const MAINTENANCE_RECORD_TYPE_OPTIONS = [
  "Inspection",
  "Maintenance",
  "Installation",
  "Repair",
  "Other",
];

/**
 * Resolves the read-only source label for a maintenance record.
 * @returns {"Manual"|"Contractor"}
 */
export function resolveMaintenanceRecordSource(record) {
  if (!record) return "Manual";

  const stored = String(record.source ?? "").trim().toLowerCase();
  if (stored === "contractor") return "Contractor";

  const recordStatus = String(record.record_status ?? "").toLowerCase();
  if (recordStatus === RECORD_STATUS.CONTRACTOR_COMPLETED) return "Contractor";
  if (record.contractorSubmittedAt) return "Contractor";

  return "Manual";
}

/**
 * Maps an array of form records to backend payload format.
 *
 * @param {Array} records - Form records from MaintenanceTab
 * @param {string|number} propertyId - Property ID
 * @returns {Array} Payloads for createMaintenanceRecords API
 */
export function prepareMaintenanceRecordsForApi(records, propertyId) {
  const arr = Array.isArray(records) ? records : [];
  return arr.map((record) => toMaintenanceRecordPayload(record, propertyId));
}

/**
 * Maps form record data to the backend maintenance record schema.
 *
 * @param {Object} recordData - Form data from MaintenanceFormPanel
 * @param {string|number} propertyId - Property ID
 * @returns {Object} Payload for createMaintenanceRecord API
 */
export function toMaintenanceRecordPayload(recordData, propertyId) {
  const validPropertyId = parseInt(propertyId, 10);
  if (!Number.isInteger(validPropertyId)) {
    throw new Error("Invalid property_id: must be an integer");
  }

  const materialsUsed = normalizeMaterialsUsed(recordData.materialsUsed);

  const data = Object.fromEntries(
    DATA_FIELDS.map((key) => {
      if (key === "materialsUsed") return [key, materialsUsed];
      if (key === "checklist_item_id") {
        const v = recordData.checklist_item_id ?? recordData[key] ?? DATA_DEFAULTS[key];
        return [key, v == null || v === "" ? null : v];
      }
      return [key, recordData[key] ?? DATA_DEFAULTS[key]];
    }),
  );

  return {
    property_id: validPropertyId,
    system_key: String(recordData.systemId ?? "").slice(0, 50),
    completed_at: formatDateTime(recordData.date),
    next_service_date: formatDate(recordData.nextServiceDate),
    data,
    status: String(recordData.status ?? "Completed").slice(0, 50),
    record_status: recordData.record_status ?? null,
  };
}

/** Format materialsUsed for display in textarea: array of { material, description, cost } → newline-separated string. */
export function formatMaterialsUsedForDisplay(value) {
  if (value == null || value === "") return "";
  if (typeof value === "string") return value.trim();
  if (!Array.isArray(value)) return String(value);
  return value
    .map((row) => {
      const parts = [];
      if (row?.material) parts.push(String(row.material).trim());
      if (row?.description) parts.push(String(row.description).trim());
      if (row?.cost && String(row.cost).trim()) parts.push(`$${String(row.cost).trim()}`);
      return parts.filter(Boolean).join(" — ");
    })
    .filter(Boolean)
    .join("\n");
}

/** Normalize materialsUsed for UI: always return array of { material, description, cost }. */
function normalizeMaterialsUsedForUi(value) {
  if (Array.isArray(value)) {
    return value.map((row) => ({
      material: String(row?.material ?? "").trim(),
      description: String(row?.description ?? "").trim(),
      cost: String(row?.cost ?? "").trim(),
    }));
  }
  if (value != null && String(value).trim()) {
    return [{ material: String(value).trim(), description: "", cost: "" }];
  }
  return [];
}

/** Normalize materialsUsed: support legacy string or new array format. */
function normalizeMaterialsUsed(value) {
  if (Array.isArray(value)) {
    return value.map((row) => ({
      material: String(row?.material ?? "").trim(),
      description: String(row?.description ?? "").trim(),
      cost: String(row?.cost ?? "").trim(),
    }));
  }
  if (value != null && String(value).trim()) {
    return [{ material: String(value).trim(), description: "", cost: "" }];
  }
  return [];
}

/** Format a date value to YYYY-MM-DD or null (for "date" format) */
function formatDate(value) {
  if (value == null || value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** Format a date value to ISO 8601 date-time or null (for "date-time" format) */
function formatDateTime(value) {
  if (value == null || value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Maps a maintenance record from backend format to UI format.
 *
 * Backend: { id, property_id, system_key, completed_at, next_service_date, status, data }
 * UI: { id, systemId, date, contractor, description, ... }
 *
 * @param {Object} backend - Record from API
 * @returns {Object} Record for MaintenanceTab/MaintenanceFormPanel
 */
export function fromMaintenanceRecordBackend(backend) {
  if (!backend) return null;
  const raw = backend.data;
  let d;
  if (typeof raw === "string") {
    try { d = JSON.parse(raw) ?? {}; } catch (_) { d = {}; }
  } else {
    d = raw || {};
  }
  return {
    id: backend.id,
    property_id: backend.property_id,
    systemId: backend.system_key ?? backend.systemId ?? "roof",
    system_key: backend.system_key,
    date: backend.completed_at ?? null,
    nextServiceDate: backend.next_service_date ?? null,
    status: backend.status ?? "Completed",
    contractor: d.contractor ?? "",
    contractorEmail: d.contractorEmail ?? "",
    contractorPhone: d.contractorPhone ?? "",
    description: d.description ?? "",
    cost: d.cost ?? "",
    workOrderNumber: d.workOrderNumber ?? "",
    materialsUsed: normalizeMaterialsUsedForUi(d.materialsUsed),
    notes: d.notes ?? "",
    findings: d.findings ?? "",
    nextStepsRecommendation: d.nextStepsRecommendation ?? "",
    files: d.files ?? [],
    requestStatus: d.requestStatus ?? backend.requestStatus ?? null,
    checklist_item_id: d.checklist_item_id ?? null,
    hideSendToContractorBanner: Boolean(d.hideSendToContractorBanner),
    recordType: d.recordType ?? "",
    source: resolveMaintenanceRecordSource({
      source: d.source,
      record_status:
        backend.recordStatus ??
        backend.record_status ??
        (d.requestStatus === "pending" ? RECORD_STATUS.CONTRACTOR_PENDING : null),
      contractorSubmittedAt: d.contractorSubmittedAt ?? null,
    }),
    record_status:
      backend.recordStatus ??
      backend.record_status ??
      (d.requestStatus === "pending" ? RECORD_STATUS.CONTRACTOR_PENDING : null),
    contractorSubmittedAt: d.contractorSubmittedAt ?? null,
  };
}

/**
 * Maps an array of backend maintenance records to UI format.
 */
export function mapMaintenanceRecordsFromBackend(records) {
  const arr = Array.isArray(records) ? records : [];
  return arr.map(fromMaintenanceRecordBackend).filter(Boolean);
}

/** Client-side temp ID pattern (MT-{timestamp}) */
const TEMP_ID_PATTERN = /^MT-\d+$/;

/**
 * Returns true if the record is new (not yet persisted to backend).
 * New records have id matching MT-{timestamp} or no id.
 */
export function isNewMaintenanceRecord(record) {
  const id = record?.id;
  if (id == null) return true;
  return typeof id === "string" && TEMP_ID_PATTERN.test(id);
}

/** Returns a numeric backend maintenance record id, or null for temp/missing ids. */
export function getPersistedMaintenanceId(id) {
  if (id == null || isNewMaintenanceRecord({id})) return null;
  const parsed = parseInt(id, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normMaintenanceText(value) {
  return String(value ?? "").trim();
}

function normMaintenanceDate(value) {
  return value == null ? "" : String(value).trim().slice(0, 10);
}

/**
 * User-facing title for a maintenance record (list, detail, breadcrumbs).
 * Prefers the record title (description), then record type.
 */
export function getMaintenanceRecordTitle(record, systemName = "System") {
  const description = normMaintenanceText(record?.description);
  if (description) return description;
  const recordType = normMaintenanceText(record?.recordType);
  if (recordType) return recordType;
  return `${systemName} Record`;
}

/**
 * Finds the persisted backend record that corresponds to an in-memory temp record.
 * Uses multiple fields so records sharing system/date/contractor stay distinct.
 */
export function findPersistedMaintenanceRecord(tempRecord, savedRecords) {
  if (!tempRecord || !Array.isArray(savedRecords) || savedRecords.length === 0) {
    return null;
  }

  const matches = savedRecords.filter(
    (candidate) =>
      normMaintenanceText(candidate.systemId) ===
        normMaintenanceText(tempRecord.systemId) &&
      normMaintenanceDate(candidate.date) ===
        normMaintenanceDate(tempRecord.date) &&
      normMaintenanceText(candidate.contractor) ===
        normMaintenanceText(tempRecord.contractor) &&
      normMaintenanceText(candidate.recordType) ===
        normMaintenanceText(tempRecord.recordType) &&
      normMaintenanceText(candidate.description) ===
        normMaintenanceText(tempRecord.description) &&
      normMaintenanceText(candidate.status) ===
        normMaintenanceText(tempRecord.status),
  );

  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    const withDetails = matches.find(
      (candidate) =>
        normMaintenanceText(candidate.cost) ===
          normMaintenanceText(tempRecord.cost) &&
        normMaintenanceDate(candidate.nextServiceDate) ===
          normMaintenanceDate(tempRecord.nextServiceDate),
    );
    return withDetails ?? matches[0];
  }

  return null;
}

/**
 * Resolves the record object to show in read/detail views.
 * Prefers saved data by ID, then strict temp-record matching.
 */
export function resolveMaintenanceRecordForView(record, savedRecords = []) {
  if (!record) return null;

  const saved = Array.isArray(savedRecords) ? savedRecords : [];
  if (saved.length === 0) return record;

  if (!isNewMaintenanceRecord(record)) {
    const byId = saved.find((candidate) => String(candidate.id) === String(record.id));
    return byId ? {...record, ...byId} : record;
  }

  const matched = findPersistedMaintenanceRecord(record, saved);
  return matched ? {...record, ...matched} : record;
}

/**
 * Computes what would be sent to the backend for maintenance sync.
 * Returns { toCreate, toUpdate, toDelete } with payloads ready for API calls.
 *
 * @param {Array} currentRecords - Form records from state.formData.maintenanceRecords
 * @param {Set|Array} originalIds - IDs that existed when property was loaded
 * @param {string|number} propertyId - Property ID
 * @returns {Object} { toCreate, toUpdate, toDelete }
 */
export function computeMaintenanceSyncPlan(currentRecords, originalIds, propertyId) {
  const records = Array.isArray(currentRecords) ? currentRecords : [];
  const originalSet =
    originalIds instanceof Set ? originalIds : new Set(originalIds ?? []);

  const currentIds = new Set(
    records
      .filter((r) => !isNewMaintenanceRecord(r))
      .map((r) => String(r.id)),
  );

  const toCreate = records
    .filter((r) => isNewMaintenanceRecord(r))
    .map((r) => toMaintenanceRecordPayload(r, propertyId));

  const toUpdate = records
    .filter((r) => !isNewMaintenanceRecord(r))
    .map((r) => ({
      id: r.id,
      payload: toMaintenanceRecordPayload(r, propertyId),
    }));

  const toDelete = [...originalSet].filter(
    (id) => id != null && !currentIds.has(String(id)),
  );

  return { toCreate, toUpdate, toDelete };
}
