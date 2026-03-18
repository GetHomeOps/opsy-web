import React, {useState, useEffect, useRef, useCallback, useMemo} from "react";
import {
  Wrench,
  Calendar,
  User,
  FileText,
  FileCheck,
  Upload,
  X,
  File,
  AlertCircle,
  Clock,
  Mail,
  Send,
  ExternalLink,
  Trash2,
  Save,
  Plus,
  ClipboardCheck,
  Loader2,
} from "lucide-react";
import DatePickerInput from "../../../../components/DatePickerInput";
import ContractorDropdown from "./ContractorDropdown";
import SendToContractorModal from "./SendToContractorModal";
import ContactSearchModal from "../ContactSearchModal";
import AppApi from "../../../../api/api";
import {normalizeProfessional} from "../../../professionals/utils/normalizeProfessional";
import {
  RECORD_STATUS,
  isNewMaintenanceRecord,
} from "../../helpers/maintenanceRecordMapping";
import Banner from "../../../../partials/containers/Banner";

/**
 * Inline form panel for viewing/editing maintenance records.
 * Used in the split-view layout (right column).
 * Edits update formData.maintenanceRecords in real time; global Save persists.
 */
function MaintenanceFormPanel({
  record,
  systemId,
  systemName,
  propertyId,
  onRecordChange,
  onSave,
  onFormDirty,
  onDelete,
  onOpenInNewTab,
  contacts = [],
  isNewRecord = false,
  savedMaintenanceRecords = [],
  propertyAddress = "",
  senderName = "",
  isSubmitting = false,
  saveBarAtTop = false,
  externalBanner = null,
  onExternalBannerClose,
}) {
  const persistOnChange = Boolean(onRecordChange);
  const persistOnSave = Boolean(onSave) && !persistOnChange;
  const newRecordIdRef = useRef(null);
  const initialSnapshotRef = useRef(null);
  const onFormDirtyRef = useRef(onFormDirty);
  const lastDirtySentRef = useRef(null);

  const [formData, setFormData] = useState({
    date: "",
    contractor: "",
    contractorEmail: "",
    contractorPhone: "",
    description: "",
    status: "Completed",
    cost: "",
    workOrderNumber: "",
    nextServiceDate: "",
    materialsUsed: [],
    notes: "",
    files: [],
    hideSendToContractorBanner: false,
  });

  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [recordStatus, setRecordStatus] = useState(null);
  const [checklistItems, setChecklistItems] = useState([]);
  const [selectedChecklistItemId, setSelectedChecklistItemId] = useState("");
  const [savedProfessionals, setSavedProfessionals] = useState([]);
  const [isSendingToContractor, setIsSendingToContractor] = useState(false);
  const [banner, setBanner] = useState({
    open: false,
    message: "",
    type: "error",
  });
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const buildHideBannerStorageKey = useCallback(
    (recordId) => `maintenance.hideSendToContractorBanner.${recordId}`,
    [],
  );
  const readHideBannerPreference = useCallback(
    (recordId) => {
      if (!recordId || typeof localStorage === "undefined") return false;
      try {
        return (
          localStorage.getItem(buildHideBannerStorageKey(recordId)) === "true"
        );
      } catch {
        return false;
      }
    },
    [buildHideBannerStorageKey],
  );
  const persistHideBannerPreference = useCallback(
    (recordId) => {
      if (!recordId || typeof localStorage === "undefined") return;
      try {
        localStorage.setItem(buildHideBannerStorageKey(recordId), "true");
      } catch {}
    },
    [buildHideBannerStorageKey],
  );

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
    if (!propertyId || !systemId) return;
    AppApi.getInspectionChecklist(propertyId, {
      systemKey: systemId,
      status: "pending",
    })
      .then((items) => {
        const inProgress = AppApi.getInspectionChecklist(propertyId, {
          systemKey: systemId,
          status: "in_progress",
        });
        return inProgress.then((ipItems) =>
          setChecklistItems([...items, ...ipItems]),
        );
      })
      .catch(() => setChecklistItems([]));
  }, [propertyId, systemId]);

  const isContractorPending = recordStatus === RECORD_STATUS.CONTRACTOR_PENDING;
  const isContractorCompleted =
    recordStatus === RECORD_STATUS.CONTRACTOR_COMPLETED;
  const showSendToContractorBanner =
    !formData.hideSendToContractorBanner &&
    !isContractorPending &&
    !isContractorCompleted;

  // Reset temp ID when entering "new record" mode
  useEffect(() => {
    if (!record) {
      newRecordIdRef.current = null;
    }
  }, [record]);

  const buildRecordData = useCallback(
    (formFields = formData, files = uploadedFiles, overrides = {}) => {
      const id =
        record?.id ??
        newRecordIdRef.current ??
        (newRecordIdRef.current = `MT-${Date.now()}`);
      return {
        ...formFields,
        files,
        systemId: systemId || "roof",
        id,
        record_status: recordStatus,
        checklist_item_id: selectedChecklistItemId
          ? parseInt(selectedChecklistItemId, 10)
          : null,
        ...overrides,
      };
    },
    [record?.id, formData, uploadedFiles, systemId, recordStatus],
  );

  const notifyRecordChange = useCallback(
    (formFields = formData, files = uploadedFiles, overrides = {}) => {
      if (!formFields.date?.trim()) return;
      const data = buildRecordData(formFields, files, overrides);
      if (persistOnChange) {
        onRecordChange?.(data);
      }
    },
    [buildRecordData, onRecordChange, formData, uploadedFiles, persistOnChange],
  );

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    if (!formData.date?.trim()) return;
    const data = buildRecordData();
    onSave?.(data);
  };

  /** Build comparable snapshot for dirty check */
  const buildSnapshot = useCallback(
    (fd, files, checklistId, status) => ({
      form: JSON.stringify({
        ...fd,
        materialsUsed: fd.materialsUsed,
      }),
      files: JSON.stringify(
        (files || []).map((f) => ({name: f.name, size: f.size})),
      ),
      checklistId: checklistId || "",
      recordStatus: status ?? "",
    }),
    [],
  );

  const formHasChanges = useMemo(() => {
    const init = initialSnapshotRef.current;
    if (!init) return isNewRecord;
    const initSnap = buildSnapshot(
      init.formData,
      init.uploadedFiles,
      init.selectedChecklistItemId,
      init.recordStatus,
    );
    const currSnap = buildSnapshot(
      formData,
      uploadedFiles,
      selectedChecklistItemId,
      recordStatus,
    );
    return (
      initSnap.form !== currSnap.form ||
      initSnap.files !== currSnap.files ||
      initSnap.checklistId !== currSnap.checklistId ||
      initSnap.recordStatus !== currSnap.recordStatus
    );
  }, [
    isNewRecord,
    formData,
    uploadedFiles,
    selectedChecklistItemId,
    recordStatus,
    buildSnapshot,
  ]);

  useEffect(() => {
    onFormDirtyRef.current = onFormDirty;
  }, [onFormDirty]);

  // Notify parent when dirty state changes (prevents callback feedback loops)
  useEffect(() => {
    if (!persistOnChange) return;
    if (lastDirtySentRef.current === formHasChanges) return;
    lastDirtySentRef.current = formHasChanges;
    onFormDirtyRef.current?.(formHasChanges);
  }, [persistOnChange, formHasChanges]);

  const handleCancelChanges = useCallback(() => {
    const init = initialSnapshotRef.current;
    if (!init) return;
    setFormData(init.formData);
    setUploadedFiles(init.uploadedFiles);
    setSelectedChecklistItemId(init.selectedChecklistItemId || "");
    setRecordStatus(init.recordStatus ?? null);
  }, []);

  useEffect(() => {
    if (record) {
      const mats = Array.isArray(record.materialsUsed)
        ? record.materialsUsed
        : record.materialsUsed
          ? [{ material: String(record.materialsUsed), description: "", cost: "" }]
          : [];
      const form = {
        date: record.date || "",
        contractor: record.contractor || "",
        contractorEmail: record.contractorEmail || "",
        contractorPhone: record.contractorPhone || "",
        description: record.description || "",
        status: record.status || "Completed",
        cost: record.cost || "",
        workOrderNumber: record.workOrderNumber || "",
        nextServiceDate: record.nextServiceDate || "",
        materialsUsed: mats,
        notes: record.notes || "",
        files: record.files || [],
        hideSendToContractorBanner:
          Boolean(record.hideSendToContractorBanner) ||
          readHideBannerPreference(record.id),
      };
      const files = record.files || [];
      const checklistId =
        record.checklist_item_id != null ? String(record.checklist_item_id) : "";
      const status =
        record.record_status ??
        (record.requestStatus === "pending"
          ? RECORD_STATUS.CONTRACTOR_PENDING
          : null);
      setFormData(form);
      setUploadedFiles(files);
      setSelectedChecklistItemId(checklistId);
      setRecordStatus(status);
      initialSnapshotRef.current = {
        formData: form,
        uploadedFiles: files,
        selectedChecklistItemId: checklistId,
        recordStatus: status,
      };
    } else {
      // New record
      const empty = {
        date: "",
        contractor: "",
        contractorEmail: "",
        contractorPhone: "",
        description: "",
        status: "Completed",
        cost: "",
        workOrderNumber: "",
        nextServiceDate: "",
        materialsUsed: [],
        notes: "",
        files: [],
        hideSendToContractorBanner: false,
      };
      setFormData(empty);
      setUploadedFiles([]);
      setSelectedChecklistItemId("");
      setRecordStatus(null);
      initialSnapshotRef.current = {
        formData: empty,
        uploadedFiles: [],
        selectedChecklistItemId: "",
        recordStatus: null,
      };
    }
  }, [record, readHideBannerPreference]);

  const showBanner = useCallback((message, type = "error") => {
    setBanner({open: true, message, type});
  }, []);

  const isContractorLocked = isContractorPending || isContractorCompleted;

  const handleInputChange = (e) => {
    if (isContractorLocked) return;
    const {name, value} = e.target;
    const next = {...formData, [name]: value};
    setFormData(next);
    if (persistOnChange) {
      queueMicrotask(() => notifyRecordChange(next, uploadedFiles));
    }
  };

  const handleContractorSelect = (contact) => {
    if (isContractorLocked) return;
    const next = {
      ...formData,
      contractor: contact.name || "",
      contractorEmail: contact.email || formData.contractorEmail,
      contractorPhone: contact.phone || formData.contractorPhone,
    };
    setFormData(next);
    if (persistOnChange) {
      queueMicrotask(() => notifyRecordChange(next, uploadedFiles));
    }
  };

  const handleContractorClear = () => {
    if (isContractorLocked) return;
    const next = {
      ...formData,
      contractor: "",
      contractorEmail: "",
      contractorPhone: "",
    };
    setFormData(next);
    if (persistOnChange) {
      queueMicrotask(() => notifyRecordChange(next, uploadedFiles));
    }
  };

  const handleFileUpload = (e) => {
    if (isContractorLocked) return;
    const files = Array.from(e.target.files);
    const newFiles = [
      ...uploadedFiles,
      ...files.map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type,
        file: file,
      })),
    ];
    setUploadedFiles(newFiles);
    if (persistOnChange) {
      queueMicrotask(() => notifyRecordChange(formData, newFiles));
    }
  };

  const handleRemoveFile = (index) => {
    if (isContractorLocked) return;
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);
    if (persistOnChange) {
      queueMicrotask(() => notifyRecordChange(formData, newFiles));
    }
  };

  const materialsLines = Array.isArray(formData.materialsUsed)
    ? formData.materialsUsed
    : [];

  const handleMaterialLineChange = (index, field, value) => {
    if (isContractorLocked) return;
    const lines = [...materialsLines];
    while (lines.length <= index) lines.push({ material: "", description: "", cost: "" });
    lines[index] = { ...lines[index], [field]: value };
    const next = { ...formData, materialsUsed: lines };
    setFormData(next);
    if (persistOnChange) queueMicrotask(() => notifyRecordChange(next, uploadedFiles));
  };

  const handleAddMaterialLine = () => {
    if (isContractorLocked) return;
    const lines = [...materialsLines, { material: "", description: "", cost: "" }];
    const next = { ...formData, materialsUsed: lines };
    setFormData(next);
    if (persistOnChange) queueMicrotask(() => notifyRecordChange(next, uploadedFiles));
  };

  const handleRemoveMaterialLine = (index) => {
    if (isContractorLocked) return;
    const lines = materialsLines.filter((_, i) => i !== index);
    const next = { ...formData, materialsUsed: lines };
    setFormData(next);
    if (persistOnChange) queueMicrotask(() => notifyRecordChange(next, uploadedFiles));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  /** Resolve the persisted record ID - when record has temp ID, look up matching saved record. */
  const getPersistedRecordId = useCallback(() => {
    const recordId = record?.id;
    if (!recordId) return null;
    if (!isNewMaintenanceRecord({id: recordId})) return recordId;
    const saved = Array.isArray(savedMaintenanceRecords)
      ? savedMaintenanceRecords
      : [];
    const norm = (v) => (v == null ? "" : String(v).trim().slice(0, 10));
    const match = saved.find(
      (r) =>
        String(r.systemId || "").slice(0, 50) ===
          String(systemId || "").slice(0, 50) &&
        norm(r.date) === norm(formData.date) &&
        (String(r.contractor || "").trim() ===
          String(formData.contractor || "").trim() ||
          String(r.workOrderNumber || "").trim() ===
            String(formData.workOrderNumber || "").trim()),
    );
    return match?.id ?? null;
  }, [
    record?.id,
    savedMaintenanceRecords,
    systemId,
    formData.date,
    formData.contractor,
    formData.workOrderNumber,
  ]);

  const handleSubmitRequest = async () => {
    if (isContractorPending || isContractorCompleted) return;
    if (!formData.date?.trim()) {
      showBanner("Please provide a date before submitting a request.");
      return;
    }
    if (!formData.contractor || !formData.contractorEmail) {
      showBanner(
        "Please provide contractor name and email before submitting a request.",
      );
      return;
    }

    const recordId = getPersistedRecordId();
    if (!recordId) {
      showBanner(
        "Please save the record first before sending it to the contractor.",
      );
      return;
    }

    setSendModalOpen(true);
  };

  const handleConfirmSend = async () => {
    const recordId = getPersistedRecordId();
    if (!recordId) {
      showBanner(
        "Please save the record first before sending it to the contractor.",
      );
      setIsSendingToContractor(false);
      return;
    }
    setIsSendingToContractor(true);
    try {
      await AppApi.sendMaintenanceToContractor(recordId, {
        contractorEmail: formData.contractorEmail,
        contractorName: formData.contractor,
      });
      setRecordStatus(RECORD_STATUS.CONTRACTOR_PENDING);
      if (persistOnChange) {
        queueMicrotask(() =>
          notifyRecordChange(formData, uploadedFiles, {
            record_status: RECORD_STATUS.CONTRACTOR_PENDING,
          }),
        );
      }
      setSendModalOpen(false);
      showBanner(
        "Report link sent to contractor! They'll receive an email shortly.",
        "success",
      );
    } catch (err) {
      showBanner(`Failed to send to contractor: ${err.message}`);
    } finally {
      setIsSendingToContractor(false);
    }
  };

  const handleHideBannerForRecord = () => {
    const persistedId = getPersistedRecordId() ?? record?.id;
    if (persistedId) {
      persistHideBannerPreference(persistedId);
    }
    const next = {...formData, hideSendToContractorBanner: true};
    setFormData(next);
    if (persistOnChange) {
      queueMicrotask(() => notifyRecordChange(next, uploadedFiles));
    }
  };

  const handleOpenInNewTab = () => {
    if (onOpenInNewTab) {
      const persistedId = getPersistedRecordId();
      const resolvedRecord =
        record && persistedId
          ? {
              ...record,
              id: persistedId,
            }
          : record;
      onOpenInNewTab({
        record: resolvedRecord,
        systemId: systemId,
        systemName: systemName,
        propertyId: propertyId,
      });
    }
  };

  // Empty state when no record is selected
  if (!systemId && !record) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 p-8">
        <Wrench className="w-16 h-16 mb-4 opacity-30" />
        <h3 className="text-lg font-medium mb-2">No Record Selected</h3>
        <p className="text-sm text-center max-w-md">
          Select a maintenance record from the tree view to view or edit its
          details, or click the + button to add a new record.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800">
      {/* Header with actions */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {record ? "Edit" : "New"} Maintenance Record
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {systemName || "System"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onOpenInNewTab && systemId && record && (
            <button
              type="button"
              onClick={handleOpenInNewTab}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">Open in Tab</span>
            </button>
          )}
          {systemId &&
            !showSendToContractorBanner &&
            !isContractorPending && !isContractorCompleted &&
            !isContractorCompleted && (
            <button
              type="button"
              onClick={handleSubmitRequest}
              disabled={isSendingToContractor}
              className="flex items-center justify-center p-2 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Send to contractor"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
          {record && onDelete && !isContractorPending && !isContractorCompleted && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onDelete(record.id);
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="Delete record"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          )}
        </div>
      </div>

      {/* Save bar at top (standalone page only) */}
      {saveBarAtTop &&
        persistOnSave &&
        (isNewRecord || formHasChanges) &&
        !isContractorPending && !isContractorCompleted && (
          <div className="flex-shrink-0 flex justify-end gap-3 px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <button
              type="button"
              className="btn bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-800 dark:text-gray-300 transition-colors duration-200 shadow-sm"
              onClick={handleCancelChanges}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn text-white transition-colors duration-200 shadow-sm min-w-[100px] bg-[#456564] hover:bg-[#34514f] flex items-center justify-center gap-2"
              onClick={handleSubmit}
              disabled={!formData.date?.trim() || isSubmitting}
            >
              {isSubmitting && (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />
              )}
              {isSubmitting
                ? isNewRecord
                  ? "Saving..."
                  : "Updating..."
                : isNewRecord
                  ? "Save"
                  : "Update"}
            </button>
          </div>
        )}

      {/* Contractor pending - read-only, blocks edits */}
      {isContractorPending && (
        <div className="px-6 py-4 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Awaiting contractor completion
              </h3>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                An email with a report link has been sent to the contractor.
                Editing is disabled until they submit their response.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Contractor completed - show success banner */}
      {isContractorCompleted && (
        <div className="px-6 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                Contractor report received
              </h3>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                The contractor has submitted their report. This record cannot be modified.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Form content - scrollable */}
      <div className="flex-1 overflow-y-auto">
        {/* Submit request banner - scrolls with form content */}
        {showSendToContractorBanner && (
          <div className="px-6 py-4 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-800">
            <div className="flex items-start gap-3">
              <Send className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200 mb-1">
                  Submit Request for Filling
                </h3>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 mb-3">
                  Need the contractor to fill out this form? Fill in the
                  contractor details below and click "Submit Request".
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSubmitRequest}
                    disabled={isSendingToContractor}
                    className="inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{backgroundColor: "#456654"}}
                    onMouseEnter={(e) => {
                      if (!isSendingToContractor)
                        e.target.style.backgroundColor = "#3a5548";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSendingToContractor)
                        e.target.style.backgroundColor = "#456654";
                    }}
                  >
                    <Send className="w-4 h-4" />
                    {isSendingToContractor
                      ? "Sending..."
                      : "Send to Contractor"}
                  </button>
                  <button
                    type="button"
                    onClick={handleHideBannerForRecord}
                    className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 underline"
                  >
                    Do not show this again
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (persistOnSave) handleSubmit(e);
          }}
          className={`p-6 space-y-6 ${
            isContractorPending || isContractorCompleted ? "opacity-75" : ""
          }`}
        >
          <fieldset disabled={isContractorLocked} className="space-y-6">
          {/* Contractor & Date - at top */}
          <div className="pb-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
              Contractor Information
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <User className="w-4 h-4 inline mr-2" />
                    Contractor
                  </label>
                  <ContractorDropdown
                    value={formData.contractor}
                    contacts={contacts}
                    favoriteProfessionals={savedProfessionals}
                    onSelect={handleContractorSelect}
                    onClear={handleContractorClear}
                    onSearchMore={() => setSearchModalOpen(true)}
                    placeholder="Select contractor"
                    disabled={isContractorPending || isContractorCompleted}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Calendar className="w-4 h-4 inline mr-2" />
                    Date
                  </label>
                  <DatePickerInput
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Mail className="w-4 h-4 inline mr-2" />
                    Email
                  </label>
                  <input
                    type="email"
                    name="contractorEmail"
                    value={formData.contractorEmail}
                    onChange={handleInputChange}
                    placeholder="contractor@email.com"
                    className="form-input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <FileCheck className="w-4 h-4 inline mr-2" />
                    Work Order #
                  </label>
                  <input
                    type="text"
                    name="workOrderNumber"
                    value={formData.workOrderNumber}
                    onChange={handleInputChange}
                    placeholder="Optional work order reference"
                    className="form-input w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Addresses Inspection Finding */}
          {checklistItems.length > 0 && (
            <div className="pb-6 border-b border-gray-200 dark:border-gray-700">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <ClipboardCheck className="w-4 h-4 inline mr-2" />
                Addresses Inspection Finding
              </label>
              <select
                value={selectedChecklistItemId}
                onChange={(e) => {
                  setSelectedChecklistItemId(e.target.value);
                  const next = {...formData};
                  notifyRecordChange(next, uploadedFiles, {
                    checklist_item_id: e.target.value
                      ? parseInt(e.target.value, 10)
                      : null,
                  });
                }}
                className="form-input w-full text-sm"
              >
                <option value="">
                  None — not linked to an inspection item
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
                Link this maintenance record to an inspection checklist item to
                track progress
              </p>
            </div>
          )}

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Status
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              className="form-select w-full"
            >
              <option value="Completed">Completed</option>
              <option value="Scheduled">Scheduled</option>
              <option value="In Progress">In Progress</option>
              <option value="Pending Contractor">
                Pending Contractor Fill-out
              </option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          {/* Next Service Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Clock className="w-4 h-4 inline mr-2" />
              Next Service Date
            </label>
            <DatePickerInput
              name="nextServiceDate"
              value={formData.nextServiceDate}
              onChange={handleInputChange}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              When is the next maintenance service scheduled?
            </p>
          </div>

          {/* Work Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <FileText className="w-4 h-4 inline mr-2" />
              Work Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={4}
              placeholder="Describe the maintenance work performed, issues found, and actions taken..."
              className="form-input w-full"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Provide a detailed description of the work completed
            </p>
          </div>

          {/* Materials Used */}
          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Wrench className="w-4 h-4 inline mr-2" />
              Materials Used
            </label>
            <div className="space-y-3">
              {materialsLines.map((line, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 md:grid-cols-[1fr_2fr_100px] gap-3 items-start w-full"
                >
                  <input
                    type="text"
                    value={line.material || ""}
                    onChange={(e) =>
                      handleMaterialLineChange(idx, "material", e.target.value)
                    }
                    placeholder="Material"
                    className="form-input w-full"
                  />
                  <input
                    type="text"
                    value={line.description || ""}
                    onChange={(e) =>
                      handleMaterialLineChange(idx, "description", e.target.value)
                    }
                    placeholder="Description"
                    className="form-input w-full"
                  />
                  <div className="relative flex">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
                      $
                    </span>
                    <input
                      type="number"
                      value={line.cost || ""}
                      onChange={(e) =>
                        handleMaterialLineChange(idx, "cost", e.target.value)
                      }
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      className="form-input w-full pl-7"
                    />
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddMaterialLine}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-[#456654] hover:text-[#3a5548] hover:bg-[#456654]/10 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add line
              </button>
            </div>
          </div>

          {/* Total Cost */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Total Cost
            </label>
            <div className="relative flex">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
                $
              </span>
              <input
                type="number"
                name="cost"
                value={formData.cost}
                onChange={handleInputChange}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="form-input w-full pl-7"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Total amount charged for this maintenance service
            </p>
          </div>

          {/* Additional Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <FileText className="w-4 h-4 inline mr-2" />
              Additional Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={3}
              placeholder="Any additional notes, recommendations, or follow-up actions needed..."
              className="form-input w-full"
            />
          </div>
          </fieldset>

          {/* Attachments */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Upload className="w-4 h-4 inline mr-2" />
              Attachments
            </label>
            <div className="space-y-3">
              {!isContractorLocked && (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 mb-2 text-gray-400 dark:text-gray-500" />
                    <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                      <span className="font-semibold">Click to upload</span> or
                      drag and drop
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      PDF, DOC, DOCX, JPG, PNG (MAX. 10MB)
                    </p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    multiple
                    onChange={handleFileUpload}
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  />
                </label>
              )}
              {(uploadedFiles.length > 0 || isContractorCompleted) && (
                <div className="space-y-2">
                  {uploadedFiles.length === 0 && isContractorCompleted ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 py-2">No attachments</p>
                  ) : null}
                  {uploadedFiles.map((file, index) => {
                    const fileKey = file.key;
                    const canOpen = Boolean(fileKey);
                    const handleOpen = canOpen
                      ? async () => {
                          try {
                            const url = await AppApi.getPresignedPreviewUrl(fileKey);
                            window.open(url, "_blank", "noopener,noreferrer");
                          } catch (err) {
                            showBanner(
                              err?.message || "Failed to open document",
                              "error"
                            );
                          }
                        }
                      : undefined;
                    return (
                      <div
                        key={index}
                        role={canOpen ? "button" : undefined}
                        tabIndex={canOpen ? 0 : undefined}
                        onKeyDown={canOpen ? (e) => e.key === "Enter" && handleOpen() : undefined}
                        onClick={canOpen ? handleOpen : undefined}
                        className={`flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 ${
                          canOpen ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <File className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {file.name}
                            </p>
                            {file.size && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {formatFileSize(file.size)}
                              </p>
                            )}
                          </div>
                          {!isContractorLocked && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveFile(index);
                              }}
                              className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Footer: Save bar (standalone tab, when modified) or hint. When saveBarAtTop, footer is hint-only. */}
      <div
        className={`${
          !saveBarAtTop &&
          persistOnSave &&
          (isNewRecord || formHasChanges) &&
          !isContractorPending
            ? "sticky bottom-0 z-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4 transition-all duration-200"
            : "flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"
        }`}
        style={
          !saveBarAtTop &&
          persistOnSave &&
          (isNewRecord || formHasChanges) &&
          !isContractorPending
            ? {
                boxShadow:
                  "0 -4px 24px rgba(0,0,0,0.06), 0 -1px 2px rgba(0,0,0,0.04)",
              }
            : undefined
        }
      >
        {!saveBarAtTop &&
        persistOnSave &&
        (isNewRecord || formHasChanges) &&
        !isContractorPending ? (
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="btn bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-800 dark:text-gray-300 transition-colors duration-200 shadow-sm"
              onClick={handleCancelChanges}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn text-white transition-colors duration-200 shadow-sm min-w-[100px] bg-[#456564] hover:bg-[#34514f] flex items-center justify-center gap-2"
              onClick={handleSubmit}
              disabled={!formData.date?.trim() || isSubmitting}
            >
              {isSubmitting && (
                <Loader2
                  className="w-4 h-4 animate-spin shrink-0"
                  aria-hidden
                />
              )}
              {isSubmitting
                ? isNewRecord
                  ? "Saving..."
                  : "Updating..."
                : isNewRecord
                  ? "Save"
                  : "Update"}
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Required fields
              {persistOnChange && (
                <span className="ml-2 text-gray-500">
                  • Changes save when you click the property Save/Update button
                  below
                </span>
              )}
            </p>
            {persistOnSave && !isContractorPending && !isContractorCompleted && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Edit the form to see the Update button
              </p>
            )}
          </>
        )}
      </div>

      {/* Top-right banner (error/success messages) */}
      <div className="fixed top-18 right-0 w-auto z-50">
        <Banner
          type={externalBanner?.open ? externalBanner.type : banner.type}
          open={externalBanner?.open ?? banner.open}
          setOpen={(open) => {
            if (!open && externalBanner?.open) {
              onExternalBannerClose?.();
            } else if (!open) {
              setBanner((prev) => ({...prev, open}));
            }
          }}
          className="transition-opacity duration-300"
        >
          {externalBanner?.open ? externalBanner.message : banner.message}
        </Banner>
      </div>

      {/* Contractor search modal */}
      <ContactSearchModal
        modalOpen={searchModalOpen}
        setModalOpen={setSearchModalOpen}
        contacts={contacts}
        savedProfessionals={savedProfessionals}
        onSelectContact={handleContractorSelect}
      />

      {/* Send to contractor email modal */}
      <SendToContractorModal
        modalOpen={sendModalOpen}
        setModalOpen={setSendModalOpen}
        contractorEmail={formData.contractorEmail}
        contractorName={formData.contractor}
        systemName={systemName}
        propertyAddress={propertyAddress || undefined}
        senderName={senderName || undefined}
        origin={
          typeof window !== "undefined" ? window.location.origin : undefined
        }
        inspectionDate={
          formData.date
            ? new Date(formData.date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })
            : undefined
        }
        inspectionFinding={
          selectedChecklistItemId && checklistItems.length > 0
            ? checklistItems.find(
                (ci) => String(ci.id) === selectedChecklistItemId
              )?.title
            : undefined
        }
        isSending={isSendingToContractor}
        onSend={handleConfirmSend}
      />
    </div>
  );
}

export default MaintenanceFormPanel;
