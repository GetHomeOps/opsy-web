import React, {useState, useEffect, useCallback, useRef, useMemo} from "react";
import {createPortal} from "react-dom";
import {X, Upload, Send, Loader2, Sparkles, ClipboardCheck} from "lucide-react";
import DatePickerInput from "../../../../components/DatePickerInput";
import CurrencyInput from "../../../../components/CurrencyInput";
import ContractorDropdown from "./ContractorDropdown";
import ContactSearchModal from "../ContactSearchModal";
import SendToContractorModal from "./SendToContractorModal";
import AppApi from "../../../../api/api";
import {
  canUploadDocumentsOnDemo,
  DEMO_UPLOAD_UNAVAILABLE_MESSAGE,
} from "../../../../utils/demoSite";
import {normalizeProfessional} from "../../../professionals/utils/normalizeProfessional";
import {
  RECORD_STATUS,
  MAINTENANCE_RECORD_TYPE_OPTIONS,
  isNewMaintenanceRecord,
  toMaintenanceRecordPayload,
  fromMaintenanceRecordBackend,
  formatMaterialsUsedForDisplay,
  findPersistedMaintenanceRecord,
  resolveMaintenanceRecordSource,
} from "../../helpers/maintenanceRecordMapping";

const EMPTY_FORM = {
  description: "",
  systemId: "",
  recordType: "",
  date: "",
  contractor: "",
  contractorEmail: "",
  contractorPhone: "",
  status: "Scheduled",
  cost: "",
  workOrderNumber: "",
  source: "Manual",
  nextServiceDate: "",
  recurringReminder: false,
  materialsUsed: "",
  notes: "",
  findings: "",
  nextStepsRecommendation: "",
};

function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
}

/**
 * Right-side slide-out panel for creating or editing a maintenance record.
 */
function CreateMaintenanceRecordPanel({
  open,
  onClose,
  systems = [],
  record = null,
  defaultValues = null,
  propertyId,
  numericPropertyId = null,
  contacts = [],
  propertyAddress = "",
  senderName = "",
  savedMaintenanceRecords = [],
  onSubmit,
  onSendToContractor,
}) {
  const isEditing = Boolean(record);
  const newRecordIdRef = useRef(null);
  const persistedRecordIdRef = useRef(null);
  const panelRef = useRef(null);
  const scrollContainerRef = useRef(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [savedProfessionals, setSavedProfessionals] = useState([]);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittingMode, setSubmittingMode] = useState(null);
  const [error, setError] = useState("");
  const [checklistItems, setChecklistItems] = useState([]);
  const [selectedChecklistItemId, setSelectedChecklistItemId] = useState("");

  const recordTypeOptions = useMemo(() => {
    const options = [...MAINTENANCE_RECORD_TYPE_OPTIONS];
    const current = String(form.recordType ?? "").trim();
    if (current && !options.includes(current)) {
      options.push(current);
    }
    return options;
  }, [form.recordType]);

  useEffect(() => {
    AppApi.getSavedProfessionals()
      .then((list) => {
        const normalized = (list || [])
          .map((p) => normalizeProfessional(p))
          .filter(Boolean)
          .map((p) => ({
            id: `pro-${p.id}`,
            name: p.name || p.companyName || "",
            email: p.email || "",
            phone: p.phone || "",
          }));
        setSavedProfessionals(normalized);
      })
      .catch(() => setSavedProfessionals([]));
  }, []);

  useEffect(() => {
    if (!propertyId || !form.systemId) {
      setChecklistItems([]);
      return;
    }
    Promise.all([
      AppApi.getInspectionChecklist(propertyId, {
        systemKey: form.systemId,
        status: "pending",
      }),
      AppApi.getInspectionChecklist(propertyId, {
        systemKey: form.systemId,
        status: "in_progress",
      }),
    ])
      .then(([pending, inProgress]) =>
        setChecklistItems([...(pending ?? []), ...(inProgress ?? [])]),
      )
      .catch(() => setChecklistItems([]));
  }, [propertyId, form.systemId]);

  useEffect(() => {
    if (!open) return;
    if (record) {
      setForm({
        description: record.description ?? "",
        systemId: record.systemId ?? "",
        recordType: record.recordType ?? "",
        date: record.date ? String(record.date).slice(0, 10) : "",
        contractor: record.contractor ?? "",
        contractorEmail: record.contractorEmail ?? "",
        contractorPhone: record.contractorPhone ?? "",
        status: record.status ?? "Scheduled",
        cost: record.cost ?? "",
        workOrderNumber: record.workOrderNumber ?? "",
        source: resolveMaintenanceRecordSource(record),
        nextServiceDate: record.nextServiceDate
          ? String(record.nextServiceDate).slice(0, 10)
          : "",
        recurringReminder: false,
        materialsUsed: formatMaterialsUsedForDisplay(record.materialsUsed) ?? "",
        notes: record.notes ?? "",
        findings: record.findings ?? "",
        nextStepsRecommendation: record.nextStepsRecommendation ?? "",
      });
      setSelectedChecklistItemId(
        record.checklist_item_id != null
          ? String(record.checklist_item_id)
          : "",
      );
      setUploadedFiles(
        (record.files ?? []).map((f) => ({
          name: f.name,
          size: f.size,
          type: f.type,
          key: f.key ?? f.document_key ?? null,
          file: f.file,
        })),
      );
    } else {
      setForm({...EMPTY_FORM, ...(defaultValues ?? {})});
      setUploadedFiles([]);
      setSelectedChecklistItemId(
        defaultValues?.checklist_item_id != null
          ? String(defaultValues.checklist_item_id)
          : "",
      );
      newRecordIdRef.current = null;
      persistedRecordIdRef.current = null;
    }
    setError("");
  }, [open, record, defaultValues]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const handleChange = (e) => {
    const {name, value, type, checked} = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (name === "systemId") {
      setSelectedChecklistItemId("");
    }
  };

  const handleContractorSelect = (contact) => {
    setForm((prev) => ({
      ...prev,
      contractor: contact.name || "",
      contractorEmail: contact.email || "",
      contractorPhone: contact.phone || "",
    }));
  };

  const handleContractorClear = () => {
    setForm((prev) => ({
      ...prev,
      contractor: "",
      contractorEmail: "",
      contractorPhone: "",
    }));
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    if (!canUploadDocumentsOnDemo()) return;

    const startIndex = uploadedFiles.length;
    setUploadedFiles((prev) => [
      ...prev,
      ...files.map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type,
        key: null,
        uploading: true,
      })),
    ]);

    await Promise.all(
      files.map(async (file, i) => {
        const idx = startIndex + i;
        try {
          const doc = await AppApi.uploadDocument(file);
          const key = doc?.key ?? doc?.s3Key ?? null;
          setUploadedFiles((prev) =>
            prev.map((f, j) =>
              j === idx ? {...f, key, uploading: false, error: !key} : f,
            ),
          );
        } catch (err) {
          setUploadedFiles((prev) =>
            prev.map((f, j) =>
              j === idx ? {...f, uploading: false, error: true} : f,
            ),
          );
        }
      }),
    );
  };

  const handleRemoveFile = (index) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const buildRecordData = useCallback(
    (sendToContractor = false) => {
      const id =
        record?.id ??
        newRecordIdRef.current ??
        (newRecordIdRef.current = `MT-${Date.now()}`);
      return {
        ...form,
        files: uploadedFiles
          .filter((f) => !f.error)
          .map(({name, size, type, key}) => ({name, size, type, key})),
        systemId: form.systemId || "roof",
        id,
        checklist_item_id: selectedChecklistItemId
          ? parseInt(selectedChecklistItemId, 10)
          : null,
        record_status: sendToContractor
          ? RECORD_STATUS.DRAFT
          : (record?.record_status ?? null),
      };
    },
    [form, uploadedFiles, record, selectedChecklistItemId],
  );

  const getPersistedRecordId = useCallback(
    (recordData) => {
      const recordId = recordData.id;
      if (!recordId) return null;
      if (!isNewMaintenanceRecord({id: recordId})) return recordId;
      const saved = Array.isArray(savedMaintenanceRecords)
        ? savedMaintenanceRecords
        : [];
      return findPersistedMaintenanceRecord(recordData, saved)?.id ?? null;
    },
    [savedMaintenanceRecords],
  );

  const scrollToError = useCallback(() => {
    scrollContainerRef.current?.scrollTo({top: 0, behavior: "smooth"});
  }, []);

  const showError = useCallback(
    (message) => {
      setError(message);
      scrollToError();
    },
    [scrollToError],
  );

  const handleCreate = async ({sendToContractor = false} = {}) => {
    setError("");
    if (!form.description.trim()) {
      showError("Record title is required.");
      return;
    }
    if (!form.systemId) {
      showError("Please select a system.");
      return;
    }
    if (!form.recordType) {
      showError("Please select a record type.");
      return;
    }
    if (!form.date?.trim()) {
      showError("Service date is required.");
      return;
    }
    if (uploadedFiles.some((f) => f.uploading)) {
      showError("Please wait for document uploads to finish.");
      return;
    }
    if (sendToContractor && (!form.contractor || !form.contractorEmail)) {
      showError(
        "Contractor name and email are required to send to a contractor.",
      );
      return;
    }

    setSubmitting(true);
    setSubmittingMode(sendToContractor ? "send" : "create");
    try {
      const recordData = buildRecordData(sendToContractor);

      if (sendToContractor) {
        onSubmit?.(recordData, {keepPanelOpen: true, sendToContractor: true});

        let persistedId = getPersistedRecordId(recordData);
        let finalRecord = recordData;

        if (!persistedId && isNewMaintenanceRecord(recordData)) {
          if (!numericPropertyId) {
            showError(
              "Save the property first, then send to the contractor.",
            );
            return;
          }
          const payload = toMaintenanceRecordPayload(
            recordData,
            numericPropertyId,
          );
          const created = await AppApi.createMaintenanceRecord({
            ...payload,
            property_id: numericPropertyId,
          });
          finalRecord = {
            ...recordData,
            ...fromMaintenanceRecordBackend(created),
          };
          persistedId = finalRecord.id;
          newRecordIdRef.current = persistedId;
          onSubmit?.(finalRecord, {
            keepPanelOpen: true,
            sendToContractor: true,
            replaceTempId: recordData.id,
            silent: true,
            persistedRecord: finalRecord,
          });
        }

        if (!persistedId) {
          showError("Save the property first, then send to the contractor.");
          return;
        }

        persistedRecordIdRef.current = persistedId;
        setSendModalOpen(true);
        return;
      }

      let finalRecord = recordData;
      const tempId = recordData.id;

      if (isNewMaintenanceRecord(recordData) && numericPropertyId) {
        const payload = toMaintenanceRecordPayload(
          recordData,
          numericPropertyId,
        );
        const created = await AppApi.createMaintenanceRecord({
          ...payload,
          property_id: numericPropertyId,
        });
        finalRecord = {
          ...recordData,
          ...fromMaintenanceRecordBackend(created),
        };
        newRecordIdRef.current = finalRecord.id;
      }

      onSubmit?.(finalRecord, {
        keepPanelOpen: false,
        replaceTempId: isNewMaintenanceRecord({id: tempId}) ? tempId : undefined,
        silent: Boolean(
          numericPropertyId && isNewMaintenanceRecord({id: tempId}),
        ),
        persistedRecord:
          numericPropertyId && !isNewMaintenanceRecord(finalRecord)
            ? finalRecord
            : undefined,
      });
    } catch (err) {
      showError(err?.message || "Failed to create record.");
    } finally {
      setSubmitting(false);
      setSubmittingMode(null);
    }
  };

  const handleConfirmSend = async () => {
    const persistedId =
      persistedRecordIdRef.current ??
      getPersistedRecordId(buildRecordData(true));
    if (!persistedId) {
      showError("Could not find a saved record to send. Please try again.");
      setSendModalOpen(false);
      return;
    }
    setIsSending(true);
    try {
      await AppApi.sendMaintenanceToContractor(persistedId, {
        contractorEmail: form.contractorEmail,
        contractorName: form.contractor,
      });
      const sentRecord = {
        ...buildRecordData(true),
        id: persistedId,
        record_status: RECORD_STATUS.CONTRACTOR_PENDING,
        requestStatus: "pending",
      };
      onSubmit?.(sentRecord, {silent: true, keepPanelOpen: false});
      setSendModalOpen(false);
      onClose?.();
      onSendToContractor?.({needsSave: false});
    } catch (err) {
      setSendModalOpen(false);
      showError(err?.message || "Failed to send to contractor.");
    } finally {
      setIsSending(false);
    }
  };

  if (!open) return null;

  const systemName =
    systems.find((s) => s.id === form.systemId)?.name ??
    systems.find((s) => s.id === form.systemId)?.label ??
    "System";

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-gray-900/40 z-[150] transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        className="fixed inset-y-0 right-0 z-[151] w-full max-w-lg bg-white dark:bg-gray-800 shadow-2xl flex flex-col border-l border-gray-200 dark:border-gray-700"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-maintenance-record-title"
      >
        {/* Header */}
        <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2
                id="create-maintenance-record-title"
                className="text-lg font-bold text-gray-900 dark:text-white"
              >
                {isEditing
                  ? "Edit Maintenance Record"
                  : "Create Maintenance Record"}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Add a service, inspection, repair, or contractor visit to this
                property.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable form */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto px-5 py-5 space-y-6"
        >
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Basics */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
              Basics
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Record Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="e.g., Annual HVAC Service"
                  className="form-input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  System <span className="text-red-500">*</span>
                </label>
                <select
                  name="systemId"
                  value={form.systemId}
                  onChange={handleChange}
                  className="form-select w-full"
                >
                  <option value="">Select system</option>
                  {systems.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name ?? s.label ?? s.id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Record Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="recordType"
                  value={form.recordType}
                  onChange={handleChange}
                  className="form-select w-full"
                >
                  <option value="">Select record type</option>
                  {recordTypeOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              {checklistItems.length > 0 && (
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    <ClipboardCheck className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                    Action Item
                  </label>
                  <select
                    value={selectedChecklistItemId}
                    onChange={(e) => setSelectedChecklistItemId(e.target.value)}
                    className="form-select w-full"
                  >
                    <option value="">
                      None — not linked to an action item
                    </option>
                    {checklistItems.map((ci) => (
                      <option key={ci.id} value={ci.id}>
                        {ci.title}
                        {ci.priority && ci.priority !== "medium"
                          ? ` (${ci.priority})`
                          : ""}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Select the action item this maintenance record is solving
                  </p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Service Date <span className="text-red-500">*</span>
                </label>
                <DatePickerInput
                  name="date"
                  value={form.date}
                  onChange={handleChange}
                  required
                  popoverClassName="z-[250]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Contractor
                </label>
                <ContractorDropdown
                  value={form.contractor}
                  contractorEmail={form.contractorEmail}
                  contacts={contacts}
                  favoriteProfessionals={savedProfessionals}
                  onSelect={handleContractorSelect}
                  onClear={handleContractorClear}
                  onSearchMore={() => setSearchModalOpen(true)}
                  placeholder="Search or select contractor"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Status
                </label>
                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  className="form-select w-full"
                >
                  <option value="Scheduled">Scheduled</option>
                  <option value="Completed">Completed</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Pending Contractor">
                    Pending Contractor Fill-out
                  </option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Cost (USD)
                </label>
                <CurrencyInput
                  name="cost"
                  value={form.cost}
                  onChange={handleChange}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Work Order #
                </label>
                <input
                  type="text"
                  name="workOrderNumber"
                  value={form.workOrderNumber}
                  onChange={handleChange}
                  placeholder="Optional reference number"
                  className="form-input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Source
                </label>
                <div
                  className="form-input w-full bg-gray-50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-300 cursor-default"
                  aria-readonly="true"
                >
                  {form.source}
                </div>
              </div>
            </div>
          </section>

          {/* Scheduling */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
              Scheduling
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Next Service Date
                </label>
                <DatePickerInput
                  name="nextServiceDate"
                  value={form.nextServiceDate}
                  onChange={handleChange}
                  popoverClassName="z-[250]"
                />
              </div>
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Set recurring reminder
                </span>
                <input
                  type="checkbox"
                  name="recurringReminder"
                  checked={form.recurringReminder}
                  onChange={handleChange}
                  className="form-checkbox h-4 w-4 text-[#456564] rounded"
                />
              </label>
            </div>
          </section>

          {/* Documentation */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
              Documentation
            </h3>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Related Documents
            </label>
            <label className="flex flex-col items-center justify-center gap-2 px-4 py-8 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl cursor-pointer hover:border-[#456564]/50 hover:bg-[#456564]/5 transition-colors">
              <Upload className="w-8 h-8 text-gray-400" />
              <span className="text-sm text-gray-600 dark:text-gray-400 text-center">
                Drag and drop files here, or click to browse
              </span>
              <span className="text-xs text-gray-400">
                PDF, JPG, PNG up to 10MB each
              </span>
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png"
                className="sr-only"
                onChange={handleFileUpload}
              />
            </label>
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <Sparkles className="w-3 h-3 text-violet-500 shrink-0" />
              Documents are filed in the Documents tab and analyzed by AI to
              extract key details.
            </p>
            {uploadedFiles.length > 0 && (
              <ul className="mt-3 space-y-2">
                {uploadedFiles.map((file, idx) => (
                  <li
                    key={`${file.name}-${idx}`}
                    className="flex items-center justify-between gap-2 text-sm px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded-lg"
                  >
                    <span className="flex items-center gap-2 min-w-0 text-gray-700 dark:text-gray-300">
                      {file.uploading && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#456564] shrink-0" />
                      )}
                      <span className="truncate">{file.name}</span>
                      {file.error && (
                        <span className="text-xs text-red-500 shrink-0">
                          Upload failed
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-gray-400">
                        {formatFileSize(file.size)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(idx)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Report details */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
              Report Details
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Materials Used
                </label>
                <textarea
                  name="materialsUsed"
                  value={form.materialsUsed}
                  onChange={handleChange}
                  rows={3}
                  placeholder="List materials, parts, or supplies used (one per line)"
                  className="form-input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Work Performed
                </label>
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Describe the work performed during this service, inspection, or repair…"
                  className="form-input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Findings
                </label>
                <textarea
                  name="findings"
                  value={form.findings}
                  onChange={handleChange}
                  rows={3}
                  placeholder={
                    "One finding per line, e.g.\nOverall condition is good\nMinor hairline cracks observed"
                  }
                  className="form-input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Recommended Next Steps
                </label>
                <textarea
                  name="nextStepsRecommendation"
                  value={form.nextStepsRecommendation}
                  onChange={handleChange}
                  rows={3}
                  placeholder={
                    "One recommendation per line, e.g.\nMonitor for changes\nRe-inspect in 12 months"
                  }
                  className="form-input w-full"
                />
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/50">
          <button
            type="button"
            onClick={onClose}
            className="btn border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleCreate({sendToContractor: true})}
              disabled={submitting}
              className="btn inline-flex items-center gap-2 text-white bg-[#456654] hover:bg-[#3a5548] disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {submittingMode === "send" ? "Sending…" : "Send to Contractor"}
            </button>
            <button
              type="button"
              onClick={() => handleCreate()}
              disabled={submitting}
              className="btn text-white bg-[#456564] hover:bg-[#3a5548] disabled:opacity-50 min-w-[8rem]"
            >
              {submittingMode === "create"
                ? isEditing
                  ? "Saving…"
                  : "Creating…"
                : isEditing
                  ? "Save Changes"
                  : "Create Record"}
            </button>
          </div>
        </div>
      </div>

      <ContactSearchModal
        modalOpen={searchModalOpen}
        setModalOpen={setSearchModalOpen}
        contacts={contacts}
        savedProfessionals={savedProfessionals}
        onSelectContact={handleContractorSelect}
        showDirectoryLink
      />

      <SendToContractorModal
        modalOpen={sendModalOpen}
        setModalOpen={setSendModalOpen}
        backdropZClassName="z-[250]"
        dialogZClassName="z-[250]"
        contractorEmail={form.contractorEmail}
        contractorName={form.contractor}
        systemName={systemName}
        propertyAddress={propertyAddress}
        senderName={senderName}
        isSending={isSending}
        onSend={handleConfirmSend}
      />
    </>,
    document.body,
  );
}

export default CreateMaintenanceRecordPanel;
