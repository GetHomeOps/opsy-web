import {useState, useRef, useEffect} from "react";
import {Upload, FileText, ExternalLink, Eye, RefreshCw} from "lucide-react";
import Sidebar from "../partials/Sidebar";
import Header from "../partials/Header";
import DocumentPreview from "../components/DocumentPreview";
import usePresignedPreview from "../hooks/usePresignedPreview";
import AppApi from "../api/api";

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];
const ACCEPT_ATTR = ".pdf,application/pdf,.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

/** Get S3 key from upload response - supports key, s3Key, fileKey, objectKey, or derived from url */
function getDocumentKey(doc) {
  if (!doc) return null;
  const key =
    doc.key ?? doc.s3Key ?? doc.fileKey ?? doc.objectKey ?? doc.path;
  if (key) return key;
  const url = doc.url;
  if (!url) return null;
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/^\/+/, "");
    return path || null;
  } catch {
    return null;
  }
}

function getFileType(fileOrKey) {
  const name = typeof fileOrKey === "string" ? fileOrKey : fileOrKey?.name;
  if (!name) return "other";
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if ([".jpg", ".jpeg", ".png", ".webp"].some((e) => lower.endsWith(e)))
    return "image";
  return "other";
}

function PdfFileExample() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [uploadedDoc, setUploadedDoc] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [openInNewTabLoading, setOpenInNewTabLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!ACCEPTED_TYPES.includes(selected.type)) {
      setError("Please select a PDF or image file (PDF, JPG, PNG, WebP).");
      setFile(null);
      setUploadedDoc(null);
      return;
    }
    setError(null);
    setFile(selected);
    setUploadedDoc(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setError(null);
    try {
      const document = await AppApi.uploadDocument(file);
      setUploadedDoc(document);
    } catch (err) {
      setError(Array.isArray(err) ? err.join(", ") : err?.message || "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const documentKey = getDocumentKey(uploadedDoc);
  const {
    url: previewUrl,
    isLoading: previewLoading,
    error: previewError,
    fetchPreview,
    refetch: refetchPreview,
  } = usePresignedPreview();

  useEffect(() => {
    if (documentKey) {
      fetchPreview(documentKey);
    }
  }, [documentKey, fetchPreview]);

  const handleOpenInNewTab = async () => {
    if (!documentKey) return;
    setOpenInNewTabLoading(true);
    try {
      const url = await AppApi.getPresignedPreviewUrl(documentKey);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(Array.isArray(err) ? err.join(", ") : err?.message || "Failed to open document.");
    } finally {
      setOpenInNewTabLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setUploadedDoc(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <main className="grow">
          <div className="px-0 sm:px-4 lg:px-5 xxl:px-12 py-8 w-full max-w-[96rem] mx-auto">
            <div className="max-w-2xl mx-auto">
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
                Document Upload
              </h1>

      {/* Upload area */}
      <div className="space-y-4">
        <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <Upload className="w-10 h-10 mb-2 text-gray-400 dark:text-gray-500" />
            <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
              <span className="font-semibold">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              PDF, JPG, PNG, WebP (max 10MB)
            </p>
            {file && (
              <p className="mt-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                {file.name}
              </p>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={ACCEPT_ATTR}
            onChange={handleFileChange}
          />
        </label>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleUpload}
            disabled={!file || isUploading}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium transition-colors"
          >
            {isUploading ? "Uploading…" : "Upload"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Inline preview window - shows once uploaded */}
      {uploadedDoc && (
        <div className="mt-8 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <span className="font-medium text-gray-900 dark:text-gray-100">
                Preview
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium"
              >
                <Eye className="w-4 h-4" />
                Expand
              </button>
              <button
                type="button"
                onClick={handleOpenInNewTab}
                disabled={!documentKey || openInNewTabLoading}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium"
              >
                <ExternalLink className="w-4 h-4" />
                {openInNewTabLoading ? "Opening…" : "Open in new tab"}
              </button>
              {previewUrl && (
                <button
                  type="button"
                  onClick={refetchPreview}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium"
                  title="Refresh (URL valid 5 min)"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              )}
            </div>
          </div>
          <div className="h-[480px] bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
            {previewLoading && (
              <div className="flex flex-col items-center text-gray-500 dark:text-gray-400">
                <RefreshCw className="w-10 h-10 animate-spin mb-2" />
                <p>Loading preview…</p>
              </div>
            )}
            {previewError && (
              <div className="flex flex-col items-center px-4 text-center">
                <p className="text-red-600 dark:text-red-400 mb-3">{previewError}</p>
                <button
                  type="button"
                  onClick={() => fetchPreview(documentKey)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry
                </button>
              </div>
            )}
            {previewUrl && !previewLoading && !previewError && (
              (() => {
                const fileType = getFileType(file ?? documentKey);
                if (fileType === "image") {
                  return (
                    <img
                      src={previewUrl}
                      alt={file?.name || "Preview"}
                      className="w-full h-full object-contain"
                    />
                  );
                }
                if (fileType === "pdf") {
                  return (
                    <object
                      data={previewUrl}
                      type="application/pdf"
                      className="w-full h-full"
                      title={file?.name || "PDF preview"}
                    >
                      <div className="flex flex-col items-center justify-center p-6 text-center">
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                          Embedded preview unavailable. Use &quot;Open in new tab&quot; to view.
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
                  );
                }
                return (
                  <div className="flex flex-col items-center justify-center p-6 text-center">
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
                );
              })()
            )}
          </div>
        </div>
      )}

      <DocumentPreview
        modalOpen={previewOpen}
        setModalOpen={setPreviewOpen}
        fileKey={documentKey}
        fileName={file?.name}
      />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default PdfFileExample;
