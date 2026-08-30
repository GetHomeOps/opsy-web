import React, {useMemo, useState, useRef} from "react";
import {X, Upload, AlertCircle, Loader2, ClipboardList, FileText, Receipt} from "lucide-react";
import ModalBlank from "../../../components/ModalBlank";
import DatePickerInput from "../../../components/DatePickerInput";
import AppApi from "../../../api/api";
import useDocumentUpload from "../../../hooks/useDocumentUpload";
import { S3_UPLOAD_FOLDER } from "../../../constants/s3UploadFolders";
import {
  defaultDocumentLabelFromFile,
} from "../../../constants/documentUpload";
import DocumentUploadPicker from "./documents/DocumentUploadPicker";
import UpgradePrompt from "../../../components/UpgradePrompt";
import {
  canUploadDocumentsOnDemo,
  DEMO_UPLOAD_UNAVAILABLE_MESSAGE,
} from "../../../utils/demoSite";
import { emitDocumentsFiled } from "../helpers/documentAnalysisFlow";
import { emitPropertyDocumentsChanged } from "../helpers/inspectionFlowSession";
import { resolveUploadSystemKey } from "../helpers/systemKeyUtils";
import {
  ANALYSIS_PROMPT_TYPES,
  UPLOAD_INVOICE_RECEIPT_TYPES,
  UPLOAD_OTHER_DOCUMENT_TYPES,
  filingTypeForAnalysisGroup,
  guessAnalysisCategory,
  resolveDeclaredAnalysisCategory,
} from "../helpers/documentAnalysisUi";

const TYPE_ICONS = {
  bid: ClipboardList,
  installation_invoice: Receipt,
  other: FileText,
};

function UploadDocumentModal({
  isOpen,
  onClose,
  systemType,
  systemLabel,
  propertyId,
  systemsToShow = [],
  propertySystems = [],
  customSystemNames = [],
  /** When true, lock to inspection report (system + type fixed), hide system/type dropdowns */
  inspectionReportOnly = false,
  /** Called after successful upload with created docs: [{key, name, type}] */
  onSuccess,
  /** Called with full property_document rows after each successful upload batch */
  onDocumentsFiled,
}) {
  const lockSystem = Boolean(systemType || systemLabel) && !inspectionReportOnly;
  const [upgradePromptOpen, setUpgradePromptOpen] = useState(false);
  const [upgradePromptMsg, setUpgradePromptMsg] = useState("");
  const [documentName, setDocumentName] = useState("");
  const [documentDate, setDocumentDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [typeGroup, setTypeGroup] = useState("");
  const [invoiceSubtype, setInvoiceSubtype] = useState("invoice");
  const [otherSubtype, setOtherSubtype] = useState("other");
  const resolvedInitialSystemKey = resolveUploadSystemKey(
    inspectionReportOnly ? "inspectionReport" : systemType,
    propertySystems,
    customSystemNames.length ? customSystemNames : systemsToShow.map((s) => s.label),
  );

  const [uploadSystemKey, setUploadSystemKey] = useState(
    resolvedInitialSystemKey,
  );
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccessCount, setUploadSuccessCount] = useState(0);
  const fileInputRef = useRef(null);

  const documentType = useMemo(() => {
    if (inspectionReportOnly) return "inspection";
    return filingTypeForAnalysisGroup(
      typeGroup,
      typeGroup === "installation_invoice" ? invoiceSubtype : otherSubtype,
    );
  }, [inspectionReportOnly, typeGroup, invoiceSubtype, otherSubtype]);

  const declaredAnalysisCategory = inspectionReportOnly
    ? null
    : resolveDeclaredAnalysisCategory(typeGroup);

  const {
    uploadDocument,
    progress,
    isUploading,
    error: uploadHookError,
    clearError: clearUploadHookError,
  } = useDocumentUpload({ uploadFolder: S3_UPLOAD_FOLDER.PROPERTY_DOCUMENTS });

  const resetForm = () => {
    setDocumentName("");
    setDocumentDate(new Date().toISOString().slice(0, 10));
    setTypeGroup("");
    setInvoiceSubtype("invoice");
    setOtherSubtype("other");
    setUploadSystemKey(
      resolveUploadSystemKey(
        inspectionReportOnly ? "inspectionReport" : systemType,
        propertySystems,
        customSystemNames.length
          ? customSystemNames
          : systemsToShow.map((s) => s.label),
      ),
    );
    setUploadFiles([]);
    setUploadError(null);
    setUploadSuccessCount(0);
    clearUploadHookError();
  };

  const handleClose = () => {
    if (isUploading) return;
    resetForm();
    onClose(false);
  };

  const handleUpload = async () => {
    if (!propertyId) {
      setUploadError("Save the property first to upload documents.");
      return;
    }
    if (uploadFiles.length === 0) {
      setUploadError("Please select at least one file.");
      return;
    }
    if (!documentName.trim()) {
      setUploadError("Please enter a document name.");
      return;
    }
    if (!documentDate) {
      setUploadError("Please select a document date.");
      return;
    }
    if (!inspectionReportOnly && !documentType) {
      setUploadError("Please choose what kind of document this is.");
      return;
    }

    setUploadError(null);
    setUploadSuccessCount(0);
    clearUploadHookError();

    const createdDocs = [];
    const filedPropertyDocs = [];
    let successCount = 0;
    for (let i = 0; i < uploadFiles.length; i++) {
      const file = uploadFiles[i];
      const name =
        uploadFiles.length > 1
          ? `${documentName} (${i + 1})`
          : documentName;
      const result = await uploadDocument(file);
      const s3Key = result?.key;
      if (!s3Key) continue;
      try {
        const prev = AppApi._suppressTierEmit;
        AppApi._suppressTierEmit = true;
        try {
          const created = await AppApi.createPropertyDocument({
            property_id: propertyId,
            document_name: name,
            document_date: documentDate,
            document_key: s3Key,
            document_type: documentType,
            system_key: uploadSystemKey,
            file_size_bytes: file.size,
          });
          successCount++;
          setUploadSuccessCount(successCount);
          createdDocs.push({key: s3Key, name: file.name, type: file.type});
          if (created) {
            filedPropertyDocs.push(
              declaredAnalysisCategory
                ? { ...created, declaredAnalysisCategory }
                : created,
            );
          }
        } finally {
          AppApi._suppressTierEmit = prev;
        }
      } catch (err) {
        if (err?.status === 403 && err?.message?.toLowerCase().includes("limit")) {
          setUpgradePromptMsg(err.message);
          setUpgradePromptOpen(true);
          break;
        }
        const msg = Array.isArray(err)
          ? err.join(", ")
          : err?.message || "Failed to save document";
        setUploadError(`File ${i + 1}: ${msg}`);
      }
    }

    if (successCount === uploadFiles.length && successCount > 0) {
      onSuccess?.(createdDocs);
      if (filedPropertyDocs.length) {
        onDocumentsFiled?.(filedPropertyDocs);
        emitDocumentsFiled(propertyId, filedPropertyDocs);
        emitPropertyDocumentsChanged(propertyId);
      }
      resetForm();
      onClose(false);
    }
  };

  const canUpload =
    !isUploading &&
    uploadFiles.length > 0 &&
    documentName.trim() &&
    documentDate &&
    (inspectionReportOnly || Boolean(documentType));

  // Sync uploadSystemKey when systemType changes (e.g. modal opened for different system)
  React.useEffect(() => {
    if (isOpen) {
      if (inspectionReportOnly) {
        setUploadSystemKey("inspectionReport");
        setDocumentName((prev) => prev || "Inspection report");
      } else {
        const valid = systemsToShow.some((s) => s.id === systemType);
        const fallback = systemsToShow[0]?.id ?? "general";
        setUploadSystemKey(
          resolveUploadSystemKey(
            valid ? systemType : fallback,
            propertySystems,
            customSystemNames.length
              ? customSystemNames
              : systemsToShow.map((s) => s.label),
          ),
        );
      }
    }
  }, [isOpen, systemType, systemsToShow, inspectionReportOnly, propertySystems, customSystemNames]);

  return (
    <>
    <ModalBlank
      id="upload-document-modal"
      modalOpen={isOpen}
      setModalOpen={handleClose}
      contentClassName={inspectionReportOnly ? "max-w-md" : "max-w-lg"}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              {inspectionReportOnly ? "Upload Inspection Report" : "Upload Document"}
            </h2>
            {!inspectionReportOnly && systemLabel && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {systemLabel} System
              </p>
            )}
          </div>
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {!canUploadDocumentsOnDemo() ? (
        <>
          <div className="px-5 py-8">
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              {DEMO_UPLOAD_UNAVAILABLE_MESSAGE}
            </p>
          </div>
          <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="btn border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300"
            >
              Got it
            </button>
          </div>
        </>
      ) : (
        <>
      {/* Content */}
      <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
        {uploadError && (
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
            <span className="text-red-800 dark:text-red-200 text-sm">
              {uploadError}
            </span>
          </div>
        )}

        {uploadHookError && (
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
            <span className="text-red-800 dark:text-red-200 text-sm">
              {uploadHookError}
            </span>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Document Name
          </label>
          <input
            type="text"
            value={documentName}
            onChange={(e) => setDocumentName(e.target.value)}
            placeholder="e.g. AC Maintenance Receipt 2024"
            className="form-input w-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Document Date
          </label>
          <DatePickerInput
            name="documentDate"
            value={documentDate}
            onChange={(e) => setDocumentDate(e.target.value)}
            popoverClassName="z-[250]"
            required
          />
        </div>

        {!inspectionReportOnly && (
          <>
            <fieldset>
              <legend className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                What is this document?
              </legend>
              <div className="space-y-2" role="radiogroup" aria-label="Document type">
                {ANALYSIS_PROMPT_TYPES.map((option) => {
                  const Icon = TYPE_ICONS[option.id] || FileText;
                  const selected = typeGroup === option.id;
                  return (
                    <label
                      key={option.id}
                      className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                        selected
                          ? "border-[#456564]/50 bg-[#456564]/5"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                      }`}
                    >
                      <input
                        type="radio"
                        name="upload-document-category"
                        value={option.id}
                        checked={selected}
                        onChange={() => setTypeGroup(option.id)}
                        className="mt-1 text-[#456564] focus:ring-[#456564]"
                      />
                      <Icon className="w-4 h-4 mt-0.5 shrink-0 text-[#456564]" />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                          {option.label}
                        </span>
                        <span className="block text-[11px] text-gray-500 dark:text-gray-400 leading-snug mt-0.5">
                          {option.description}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {typeGroup === "installation_invoice" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Invoice or receipt
                </label>
                <div className="flex gap-2">
                  {UPLOAD_INVOICE_RECEIPT_TYPES.map((option) => {
                    const selected = invoiceSubtype === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setInvoiceSubtype(option.id)}
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                          selected
                            ? "border-[#456564]/50 bg-[#456564]/5 text-gray-900 dark:text-gray-100"
                            : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {typeGroup === "other" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Document type
                </label>
                <select
                  value={otherSubtype}
                  onChange={(e) => setOtherSubtype(e.target.value)}
                  className="form-select w-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                >
                  {UPLOAD_OTHER_DOCUMENT_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                System
              </label>
              {lockSystem ? (
                <p className="text-sm text-gray-800 dark:text-gray-100 py-2">
                  {systemLabel || "This system"}
                </p>
              ) : (
                <select
                  value={uploadSystemKey}
                  onChange={(e) => setUploadSystemKey(e.target.value)}
                  className="form-select w-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                  required
                >
                  {systemsToShow.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            File(s)
          </label>
          <DocumentUploadPicker
            ref={fileInputRef}
            files={uploadFiles}
            multiple
            disabled={isUploading}
            onFilesChange={(files) => {
              setUploadFiles(files);
              setUploadError(null);
              if (files.length > 0) {
                setDocumentName((prev) => {
                  if (prev.trim()) return prev;
                  return defaultDocumentLabelFromFile(files[0]);
                });
                setTypeGroup((prev) => {
                  if (prev || inspectionReportOnly) return prev;
                  return guessAnalysisCategory({ document_name: files[0].name });
                });
              }
            }}
          />
        </div>

        {isUploading && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>
                Uploading
                {uploadFiles.length > 1
                  ? ` (${uploadSuccessCount + 1} of ${uploadFiles.length})`
                  : ""}
                …
              </span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div
                className="h-full bg-emerald-500 dark:bg-emerald-500 transition-all duration-300"
                style={{width: `${progress}%`}}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3 justify-end">
        <button
          onClick={handleClose}
          disabled={isUploading}
          className="btn border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleUpload}
          disabled={!canUpload}
          className="btn bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Upload
            </>
          )}
        </button>
      </div>
        </>
      )}
    </ModalBlank>
    <UpgradePrompt
      open={upgradePromptOpen}
      onClose={() => setUpgradePromptOpen(false)}
      title="Document limit reached"
      message={upgradePromptMsg || "You've reached the document limit for this system. Upgrade your plan for more."}
    />
    </>
  );
}

export default UploadDocumentModal;
