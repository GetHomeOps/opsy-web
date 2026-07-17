import React, {useEffect, useRef, useState} from "react";
import {AlertCircle, FileCheck, Loader2, Upload, X} from "lucide-react";
import ModalBlank from "../../components/ModalBlank";
import AppApi, {getApiErrorMessage} from "../../api/api";
import {uploadDocumentFile} from "../../hooks/useDocumentUpload";
import {S3_UPLOAD_FOLDER} from "../../constants/s3UploadFolders";
import {MAX_DOCUMENT_UPLOAD_LABEL} from "../../constants/documentUpload";
import {
  canUploadDocumentsOnDemo,
  DEMO_UPLOAD_UNAVAILABLE_MESSAGE,
} from "../../utils/demoSite";
import {inferDocumentType, inferMimeType} from "./prePurchaseUtils";

/**
 * Modal to upload an inspection report for a pre-purchase analysis
 * (used when setup finished without a report).
 */
export default function PrePurchaseUploadModal({
  open,
  onClose,
  analysisId,
  onUploaded,
}) {
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [startingAnalysis, setStartingAnalysis] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const isBusy = isUploading || startingAnalysis;

  useEffect(() => {
    if (!open) {
      setIsUploading(false);
      setUploadProgress(0);
      setStartingAnalysis(false);
      setError(null);
      setDragOver(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [open]);

  async function processFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length || !analysisId || isBusy) return;

    if (!canUploadDocumentsOnDemo()) {
      setError(DEMO_UPLOAD_UNAVAILABLE_MESSAGE);
      return;
    }

    setError(null);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      for (const file of files) {
        const result = await uploadDocumentFile(file, {
          uploadFolder: S3_UPLOAD_FOLDER.PRE_PURCHASE,
          onProgress: (pct) => setUploadProgress(pct),
        });
        if (!result?.key) {
          setError("Upload failed");
          continue;
        }

        await AppApi.addPrePurchaseDocument(analysisId, {
          documentName: file.name,
          documentKey: result.key,
          documentType: inferDocumentType(file.name) || "inspection",
          mimeType: inferMimeType(file),
          fileSizeBytes: file.size ?? null,
        });

        setIsUploading(false);
        setStartingAnalysis(true);
        try {
          await AppApi.startPrePurchaseAnalysis(analysisId);
          await onUploaded?.();
          onClose?.();
        } catch (startErr) {
          await onUploaded?.();
          setError(
            getApiErrorMessage(
              startErr,
              "Report uploaded, but analysis could not be started."
            )
          );
        }
        return;
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Upload failed"));
    } finally {
      setIsUploading(false);
      setStartingAnalysis(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleClose() {
    if (isBusy) return;
    onClose?.();
  }

  return (
    <ModalBlank
      id="pre-purchase-upload-modal"
      modalOpen={open}
      setModalOpen={(next) => {
        if (!next) handleClose();
      }}
      closeOnClickOutside={!isBusy}
      closeOnEscape={!isBusy}
      contentClassName="max-w-lg"
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-[#456564]/10 dark:bg-[#456564]/20 flex items-center justify-center shrink-0">
              <FileCheck className="w-5 h-5 text-[#456564]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Add inspection report
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Upload a home inspection PDF or related documents. Analysis
                starts automatically after upload.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isBusy}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div
          className={`relative rounded-2xl border-2 border-dashed p-8 transition-colors ${
            dragOver
              ? "border-[#456564] bg-[#456564]/5 dark:bg-[#456564]/10"
              : "border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/30"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            if (!isBusy) setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (!isBusy) processFiles(e.dataTransfer.files);
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,image/*,.doc,.docx"
            disabled={isBusy || !canUploadDocumentsOnDemo()}
            onChange={(e) => processFiles(e.target.files)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
            aria-label="Upload inspection report"
          />
          <div className="relative flex flex-col items-center justify-center min-h-[140px] text-center pointer-events-none">
            {isBusy ? (
              <>
                <Loader2 className="w-10 h-10 text-[#456564] animate-spin mb-3" />
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {startingAnalysis
                    ? "Starting analysis…"
                    : `Uploading… ${uploadProgress}%`}
                </p>
              </>
            ) : !canUploadDocumentsOnDemo() ? (
              <p className="text-sm text-amber-800 dark:text-amber-200 px-2">
                {DEMO_UPLOAD_UNAVAILABLE_MESSAGE}
              </p>
            ) : (
              <>
                <Upload className="w-10 h-10 text-gray-400 dark:text-gray-500 mb-3" />
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Drag & drop your inspection report here
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  or click to browse (PDF, images). Max {MAX_DOCUMENT_UPLOAD_LABEL}{" "}
                  per file.
                </p>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20">
            <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 dark:text-red-300 flex-1">
              {error}
            </p>
            <button
              type="button"
              onClick={() => setError(null)}
              className="p-0.5 rounded text-red-500 hover:text-red-700 dark:text-red-400"
              aria-label="Dismiss error"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </ModalBlank>
  );
}
