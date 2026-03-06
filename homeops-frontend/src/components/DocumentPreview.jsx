import {useEffect} from "react";
import {createPortal} from "react-dom";
import {FileText, ExternalLink, RefreshCw, AlertCircle} from "lucide-react";
import ModalBlank from "./ModalBlank";
import usePresignedPreview from "../hooks/usePresignedPreview";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const PDF_EXTENSION = ".pdf";

function getFileType(key) {
  if (!key) return "other";
  const lower = key.toLowerCase();
  if (lower.endsWith(PDF_EXTENSION)) return "pdf";
  if (IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext))) return "image";
  return "other";
}

function DocumentPreview({modalOpen, setModalOpen, fileKey, fileName}) {
  const {url, isLoading, error, fetchPreview, clearError, refetch} =
    usePresignedPreview();
  const fileType = getFileType(fileKey ?? fileName);

  useEffect(() => {
    if (modalOpen && fileKey) {
      fetchPreview(fileKey);
    }
  }, [modalOpen, fileKey, fetchPreview]);

  const handleClose = () => {
    setModalOpen(false);
    clearError();
  };

  const handleOpenInNewTab = () => {
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const modalContent = (
    <ModalBlank
      modalOpen={modalOpen}
      setModalOpen={handleClose}
      contentClassName="max-w-4xl"
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {fileName || "Document Preview"}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Missing key */}
        {modalOpen && !fileKey && !isLoading && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="w-12 h-12 text-amber-500 dark:text-amber-400 mb-3" />
            <p className="text-gray-600 dark:text-gray-400">
              No document key provided. Cannot load preview.
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 dark:text-red-400 mb-3" />
            <p className="text-gray-700 dark:text-gray-300 mb-4">{error}</p>
            <button
              type="button"
              onClick={() => fetchPreview(fileKey)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              Try again
            </button>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16">
            <RefreshCw className="w-10 h-10 text-gray-400 animate-spin mb-3" />
            <p className="text-gray-500 dark:text-gray-400">Loading document…</p>
          </div>
        )}

        {/* Content: PDF, Image, or Open in new tab */}
        {url && !isLoading && !error && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleOpenInNewTab}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                <ExternalLink className="w-4 h-4" />
                Open in new tab
              </button>
              <button
                type="button"
                onClick={refetch}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium"
                title="Refresh URL (valid for 5 minutes)"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
            <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 min-h-[400px]">
              {fileType === "pdf" && (
                <object
                  data={url}
                  type="application/pdf"
                  className="w-full h-[480px]"
                  title={fileName || "PDF preview"}
                >
                  <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Embedded preview is not available. Use the button below to
                      open the document in a new tab.
                    </p>
                    <button
                      type="button"
                      onClick={handleOpenInNewTab}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open in new tab
                    </button>
                  </div>
                </object>
              )}
              {fileType === "image" && (
                <img
                  src={url}
                  alt={fileName || "Document preview"}
                  className="w-full max-h-[600px] object-contain"
                />
              )}
              {fileType === "other" && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <FileText className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-3" />
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Preview not available for this file type.
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenInNewTab}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open in new tab
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ModalBlank>
  );

  if (typeof document !== "undefined" && document.body) {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
}

export default DocumentPreview;
