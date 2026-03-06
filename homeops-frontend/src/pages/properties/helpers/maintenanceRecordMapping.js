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

/** Fields stored in the `data` object; null/undefined become empty string or [] */
const DATA_FIELDS = [
  "contractor",
  "contractorEmail",
  "contractorPhone",
  "description",
  "priority",
  "cost",
  "workOrderNumber",
  "materialsUsed",
  "notes",
  "files",
  "requestStatus",
];

const DATA_DEFAULTS = {
  contractor: "",
  contractorEmail: "",
  contractorPhone: "",
  description: "",
  priority: "Medium",
  cost: "",
  workOrderNumber: "",
  materialsUsed: "",
  notes: "",
  files: [],
  requestStatus: null,
};

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

  const data = Object.fromEntries(
    DATA_FIELDS.map((key) => [key, recordData[key] ?? DATA_DEFAULTS[key]]),
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
  const d = backend.data || {};
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
    priority: d.priority ?? "Medium",
    cost: d.cost ?? "",
    workOrderNumber: d.workOrderNumber ?? "",
    materialsUsed: d.materialsUsed ?? "",
    notes: d.notes ?? "",
    files: d.files ?? [],
    requestStatus: d.requestStatus ?? backend.requestStatus ?? null,
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
