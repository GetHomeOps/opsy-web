import React, {useState, useEffect, useRef, useCallback} from "react";
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
  DollarSign,
  Clock,
  Mail,
  Phone,
  Send,
  ExternalLink,
  Trash2,
  Save,
  Plus,
  ClipboardCheck,
} from "lucide-react";
import DatePickerInput from "../../../../components/DatePickerInput";
import InstallerSelect from "../InstallerSelect";
import AppApi from "../../../../api/api";
import {RECORD_STATUS} from "../../helpers/maintenanceRecordMapping";

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
  onDelete,
  onOpenInNewTab,
  contacts = [],
  isNewRecord = false,
}) {
  const persistOnChange = Boolean(onRecordChange);
  const persistOnSave = Boolean(onSave) && !persistOnChange;
  const newRecordIdRef = useRef(null);

  const [formData, setFormData] = useState({
    date: "",
    contractor: "",
    contractorEmail: "",
    contractorPhone: "",
    description: "",
    status: "Completed",
    priority: "Medium",
    cost: "",
    workOrderNumber: "",
    nextServiceDate: "",
    materialsUsed: "",
    notes: "",
    files: [],
  });

  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [recordStatus, setRecordStatus] = useState(null);
  const [submitRequestBannerVisible, setSubmitRequestBannerVisible] =
    useState(true);
  const [checklistItems, setChecklistItems] = useState([]);
  const [selectedChecklistItemId, setSelectedChecklistItemId] = useState("");

  useEffect(() => {
    if (!propertyId || !systemId) return;
    AppApi.getInspectionChecklist(propertyId, { systemKey: systemId, status: "pending" })
      .then((items) => {
        const inProgress = AppApi.getInspectionChecklist(propertyId, { systemKey: systemId, status: "in_progress" });
        return inProgress.then((ipItems) => setChecklistItems([...items, ...ipItems]));
      })
      .catch(() => setChecklistItems([]));
  }, [propertyId, systemId]);

  const [isSendingToContractor, setIsSendingToContractor] = useState(false);

  const isContractorPending = recordStatus === RECORD_STATUS.CONTRACTOR_PENDING;
  const isContractorCompleted = recordStatus === RECORD_STATUS.CONTRACTOR_COMPLETED;
  const isDraft =
    recordStatus === RECORD_STATUS.DRAFT || recordStatus == null;

  // Show banner when entering new record mode; hide when selecting a different record
  useEffect(() => {
    if (isNewRecord) setSubmitRequestBannerVisible(true);
    else if (record && newRecordIdRef.current != null && record.id !== newRecordIdRef.current) {
      setSubmitRequestBannerVisible(false);
    }
  }, [isNewRecord, record?.id]);

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
        checklist_item_id: selectedChecklistItemId ? parseInt(selectedChecklistItemId, 10) : null,
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
    [
      buildRecordData,
      onRecordChange,
      formData,
      uploadedFiles,
      persistOnChange,
    ],
  );

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    if (!formData.date?.trim()) return;
    const data = buildRecordData();
    onSave?.(data);
  };

  useEffect(() => {
    if (record) {
      setFormData({
        date: record.date || "",
        contractor: record.contractor || "",
        contractorEmail: record.contractorEmail || "",
        contractorPhone: record.contractorPhone || "",
        description: record.description || "",
        status: record.status || "Completed",
        priority: record.priority || "Medium",
        cost: record.cost || "",
        workOrderNumber: record.workOrderNumber || "",
        nextServiceDate: record.nextServiceDate || "",
        materialsUsed: record.materialsUsed || "",
        notes: record.notes || "",
        files: record.files || [],
      });
      setUploadedFiles(record.files || []);
      setRecordStatus(
        record.record_status ??
          (record.requestStatus === "pending"
            ? RECORD_STATUS.CONTRACTOR_PENDING
            : null),
      );
    } else {
      // New record
      setFormData({
        date: "",
        contractor: "",
        contractorEmail: "",
        contractorPhone: "",
        description: "",
        status: "Completed",
        priority: "Medium",
        cost: "",
        workOrderNumber: "",
        nextServiceDate: "",
        materialsUsed: "",
        notes: "",
        files: [],
      });
      setUploadedFiles([]);
      setRecordStatus(null);
    }
  }, [record]);

  const handleInputChange = (e) => {
    if (isContractorPending) return;
    const {name, value} = e.target;
    const next = {...formData, [name]: value};
    if (name === "contractor" && contacts?.length) {
      const contact =
        contacts.find((c) => String(c.id) === String(value)) ||
        contacts.find((c) => (c.name || "") === value);
      if (contact) {
        next.contractorEmail = contact.email || formData.contractorEmail;
        next.contractorPhone = contact.phone || formData.contractorPhone;
      }
    }
    setFormData(next);
    if (persistOnChange) {
      queueMicrotask(() => notifyRecordChange(next, uploadedFiles));
    }
  };

  const handleFileUpload = (e) => {
    if (isContractorPending) return;
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
    if (isContractorPending) return;
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);
    if (persistOnChange) {
      queueMicrotask(() => notifyRecordChange(formData, newFiles));
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const handleSubmitRequest = async () => {
    if (isContractorPending) return;
    if (!formData.date?.trim()) {
      alert("Please provide a date before submitting a request.");
      return;
    }
    if (!formData.contractor || !formData.contractorEmail) {
      alert(
        "Please provide contractor name and email before submitting a request.",
      );
      return;
    }

    const recordId = record?.id;
    const isPersistedRecord = recordId && !/^MT-\d+$/.test(String(recordId));

    if (!isPersistedRecord) {
      alert("Please save the record first before sending it to the contractor.");
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
      alert("Report link sent to contractor! They'll receive an email to fill out the maintenance report.");
    } catch (err) {
      alert(`Failed to send to contractor: ${err.message}`);
    } finally {
      setIsSendingToContractor(false);
    }
  };

  const handleCancelSubmitRequest = () => {
    if (!formData.date?.trim()) {
      alert("Please provide a date before completing this record.");
      return;
    }
    setSubmitRequestBannerVisible(false);
    setRecordStatus(RECORD_STATUS.USER_COMPLETED);
    if (persistOnChange) {
      queueMicrotask(() =>
        notifyRecordChange(formData, uploadedFiles, {
          record_status: RECORD_STATUS.USER_COMPLETED,
        }),
      );
    }
  };

  const handleOpenInNewTab = () => {
    if (onOpenInNewTab) {
      onOpenInNewTab({
        record: record,
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
          {record && onDelete && !isContractorPending && (
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
        <div className="px-6 py-4 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                Contractor report received
              </h3>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                The contractor has submitted their report. Review the details below.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Form content - scrollable */}
      <div className="flex-1 overflow-y-auto">
        {/* Submit request banner - shown when draft, until Submit or Cancel */}
        {submitRequestBannerVisible &&
          isDraft &&
          !isContractorPending &&
          (isNewRecord || (record?.id && record.id === newRecordIdRef.current)) && (
            <div className="mx-6 mt-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <Send className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200 mb-1">
                      Submit Request for Filling
                    </h3>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 mb-3">
                      Need the contractor to fill out this form? Fill in the
                      contractor details below and click "Submit Request".
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleSubmitRequest}
                        disabled={isSendingToContractor}
                        className="inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{backgroundColor: "#456654"}}
                        onMouseEnter={(e) => {
                          if (!isSendingToContractor) e.target.style.backgroundColor = "#3a5548";
                        }}
                        onMouseLeave={(e) => {
                          if (!isSendingToContractor) e.target.style.backgroundColor = "#456654";
                        }}
                      >
                        <Send className="w-4 h-4" />
                        {isSendingToContractor ? "Sending..." : "Send to Contractor"}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelSubmitRequest}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                    </div>
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
          className={`p-6 space-y-6 ${isContractorPending ? "pointer-events-none opacity-75" : ""}`}
        >
          {/* Work Order & Date - at top */}
          <div className="pb-6 border-b border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Calendar className="w-4 h-4 inline mr-2" />
                  Date <span className="text-red-500">*</span>
                </label>
                <DatePickerInput
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  required
                />
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
                    checklist_item_id: e.target.value ? parseInt(e.target.value, 10) : null,
                  });
                }}
                className="form-input w-full text-sm"
              >
                <option value="">None — not linked to an inspection item</option>
                {checklistItems.map((ci) => (
                  <option key={ci.id} value={ci.id}>
                    {ci.title}{ci.priority && ci.priority !== "medium" ? ` (${ci.priority})` : ""}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Link this maintenance record to an inspection checklist item to track progress
              </p>
            </div>
          )}

          {/* Contractor Information */}
          <div className="pb-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
              Contractor Information
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <User className="w-4 h-4 inline mr-2" />
                  Contractor
                </label>
                <InstallerSelect
                  name="contractor"
                  value={formData.contractor}
                  onChange={handleInputChange}
                  contacts={contacts}
                  placeholder="Select contractor"
                />
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
                    <Phone className="w-4 h-4 inline mr-2" />
                    Phone
                  </label>
                  <input
                    type="tel"
                    name="contractorPhone"
                    value={formData.contractorPhone}
                    onChange={handleInputChange}
                    placeholder="(555) 123-4567"
                    className="form-input w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Priority & Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <AlertCircle className="w-4 h-4 inline mr-2" />
                Priority
              </label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleInputChange}
                className="form-select w-full"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Emergency">Emergency</option>
              </select>
            </div>
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
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Wrench className="w-4 h-4 inline mr-2" />
              Materials Used
            </label>
            <textarea
              name="materialsUsed"
              value={formData.materialsUsed}
              onChange={handleInputChange}
              rows={3}
              placeholder="List materials, parts, or supplies used"
              className="form-input w-full"
            />
          </div>

          {/* Total Cost */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <DollarSign className="w-4 h-4 inline mr-2" />
              Total Cost
            </label>
            <input
              type="number"
              name="cost"
              value={formData.cost}
              onChange={handleInputChange}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="form-input w-full"
            />
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

          {/* Attachments */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Upload className="w-4 h-4 inline mr-2" />
              Attachments
            </label>
            <div className="space-y-3">
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
              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  {uploadedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <File className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {file.name}
                          </p>
                          {file.size && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {formatFileSize(file.size)}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(index)}
                        className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Footer: Save button (standalone) or hint (tab) */}
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          <span className="text-red-500">*</span> Required fields
          {persistOnChange && (
            <span className="ml-2 text-gray-500">
              • Changes save when you click the property Save/Update button below
            </span>
          )}
        </p>
        {persistOnSave && !isContractorPending && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!formData.date?.trim()}
            className="btn text-white flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{backgroundColor: "#6b9a7a"}}
          >
            {record ? (
              <Save className="w-4 h-4" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            {record ? "Update" : "Add"}
          </button>
        )}
      </div>
    </div>
  );
}

export default MaintenanceFormPanel;
