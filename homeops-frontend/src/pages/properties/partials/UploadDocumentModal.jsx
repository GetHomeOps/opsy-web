import React, {useState, useRef} from "react";
import {X, Upload, AlertCircle, CheckCircle2, Loader2} from "lucide-react";
import ModalBlank from "../../../components/ModalBlank";
import DatePickerInput from "../../../components/DatePickerInput";
import AppApi from "../../../api/api";
import useDocumentUpload from "../../../hooks/useDocumentUpload";
import UpgradePrompt from "../../../components/UpgradePrompt";

const documentTypes = [
  {id: "contract", label: "Contract"},
  {id: "warranty", label: "Warranty"},
  {id: "receipt", label: "Receipt"},
  {id: "inspection", label: "Inspection Report"},
  {id: "permit", label: "Permit"},
  {id: "manual", label: "Manual"},
  {id: "insurance", label: "Insurance"},
  {id: "mortgage", label: "Mortgage"},
  {id: "other", label: "Other"},
];

function UploadDocumentModal({
  isOpen,
  onClose,
  systemType,
  systemLabel,
  propertyId,
  systemsToShow = [],
  /** When true, lock to inspection report (system + type fixed), hide system/type dropdowns */
  inspectionReportOnly = false,
  /** Called after successful upload with created docs: [{key, name, type}] */
  onSuccess,
}) {
  const [upgradePromptOpen, setUpgradePromptOpen] = useState(false);
  const [upgradePromptMsg, setUpgradePromptMsg] = useState("");
  const [documentName, setDocumentName] = useState("");
  const [documentDate, setDocumentDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [documentType, setDocumentType] = useState(
    inspectionReportOnly ? "inspection" : "receipt",
  );
  const [uploadSystemKey, setUploadSystemKey] = useState(
    inspectionReportOnly ? "inspectionReport" : systemType,
  );
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccessCount, setUploadSuccessCount] = useState(0);
  const fileInputRef = useRef(null);

  const {
    uploadDocument,
    progress,
    isUploading,
    error: uploadHookError,
    clearError: clearUploadHookError,
  } = useDocumentUpload();

  const handleClose = () => {
    if (!isUploading) {
      setDocumentName("");
      setDocumentDate(new Date().toISOString().slice(0, 10));
      setDocumentType(inspectionReportOnly ? "inspection" : "receipt");
      setUploadSystemKey(inspectionReportOnly ? "inspectionReport" : systemType);
      setUploadFiles([]);
      setUploadError(null);
      setUploadSuccessCount(0);
      clearUploadHookError();
      onClose(false);
    }
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

    setUploadError(null);
    setUploadSuccessCount(0);
    clearUploadHookError();

    const createdDocs = [];
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
        await AppApi.createPropertyDocument({
          property_id: propertyId,
          document_name: name,
          document_date: documentDate,
          document_key: s3Key,
          document_type: documentType,
          system_key: uploadSystemKey,
        });
        successCount++;
        setUploadSuccessCount(successCount);
        createdDocs.push({key: s3Key, name: file.name, type: file.type});
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
      setUploadFiles([]);
      setDocumentName("");
      onSuccess?.(createdDocs);
      setTimeout(() => handleClose(), inspectionReportOnly ? 0 : 2000);
    }
  };

  const canUpload =
    !isUploading &&
    uploadFiles.length > 0 &&
    documentName.trim() &&
    documentDate;

  // Sync uploadSystemKey when systemType changes (e.g. modal opened for different system)
  React.useEffect(() => {
    if (isOpen) {
      if (inspectionReportOnly) {
        setUploadSystemKey("inspectionReport");
        setDocumentType("inspection");
      } else {
        const valid = systemsToShow.some((s) => s.id === systemType);
        setUploadSystemKey(valid ? systemType : systemsToShow[0]?.id ?? "general");
      }
    }
  }, [isOpen, systemType, systemsToShow, inspectionReportOnly]);

  return (
    <>
    <ModalBlank
      id="upload-document-modal"
      modalOpen={isOpen}
      setModalOpen={handleClose}
      contentClassName="max-w-md"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              {inspectionReportOnly ? "Upload Inspection Report" : "Upload Document"}
            </h2>
            {!inspectionReportOnly && (
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

        {uploadSuccessCount > 0 && (
          <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-emerald-800 dark:text-emerald-200 text-sm">
              <p className="font-medium">
                {uploadSuccessCount} file
                {uploadSuccessCount !== 1 ? "s" : ""} uploaded successfully.
              </p>
              <p className="mt-1 text-emerald-700 dark:text-emerald-300">
                You can find {uploadSuccessCount !== 1 ? "them" : "it"} in the
                Documents tab.
              </p>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Document Name <span className="text-red-500">*</span>
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
            Document Date <span className="text-red-500">*</span>
          </label>
          <DatePickerInput
            name="documentDate"
            value={documentDate}
            onChange={(e) => setDocumentDate(e.target.value)}
            required
          />
        </div>

        {!inspectionReportOnly && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Document Type <span className="text-red-500">*</span>
              </label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                className="form-select w-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                required
              >
                {documentTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                System <span className="text-red-500">*</span>
              </label>
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
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            File(s) <span className="text-red-500">*</span>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp,.gif"
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              setUploadFiles(files);
              setUploadError(null);
              e.target.value = "";
            }}
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-5 text-center hover:border-emerald-400 dark:hover:border-emerald-500 transition-colors cursor-pointer group"
          >
            <Upload className="w-10 h-10 mx-auto mb-3 text-gray-400 dark:text-gray-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Click to upload or drag and drop
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              PDF, JPG, PNG up to 10MB
            </p>
            {uploadFiles.length > 0 && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 font-medium">
                {uploadFiles.length} file
                {uploadFiles.length !== 1 ? "s" : ""} selected
              </p>
            )}
          </div>
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
