import React, {useEffect, useMemo, useRef, useState} from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  AlertCircle,
  ChevronRight,
  FileCheck,
  FileText,
  Loader2,
  Menu,
  RefreshCw,
  Smartphone,
  Sparkles,
  Upload,
  X,
  ExternalLink,
} from "lucide-react";
import AppApi, {getApiErrorMessage} from "../../../api/api";
import {uploadDocumentFile} from "../../../hooks/useDocumentUpload";
import usePresignedPreview from "../../../hooks/usePresignedPreview";
import {S3_UPLOAD_FOLDER} from "../../../constants/s3UploadFolders";
import ModalBlank from "../../../components/ModalBlank";
import SectionCard from "../../properties/partials/passport/SectionCard";
import EmptyStateCard from "../../properties/partials/passport/EmptyStateCard";
import {StatusBadge} from "../../properties/partials/passport/StatusBadge";
import {
  DocumentsFolderSidebar,
  DocumentsTableView,
  DocumentsPreviewPanel,
  DocumentCaptureModal,
} from "../../properties/partials/documents";
import {inferMimeType} from "../prePurchaseUtils";

const INSPECTION_FOLDER = {
  id: "inspectionReport",
  label: "Inspection Report",
  icon: FileCheck,
  color: "text-green-600",
};

const DOCUMENT_TYPES = [
  {id: "inspection", label: "Inspection Report", icon: FileCheck},
];

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

function getPreviewType(url) {
  if (!url) return "other";
  const lower = url.toLowerCase();
  if (lower.includes(".pdf") || lower.endsWith("pdf")) return "pdf";
  if (IMAGE_EXTENSIONS.some((ext) => lower.includes(ext))) return "image";
  return "other";
}

function InlineDocumentPreview({url, fileName, fillHeight}) {
  const [error, setError] = useState(false);
  const fileType = getPreviewType(url ?? fileName);

  if (!url) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="w-12 h-12 text-amber-500 dark:text-amber-400 mb-3" />
        <p className="text-gray-600 dark:text-gray-400">
          No preview URL available. Use &quot;Open in new tab&quot; to view.
        </p>
      </div>
    );
  }

  if (error || fileType === "other") {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Preview not available for this file type.
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open in new tab
        </a>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 min-h-[200px] ${
        fillHeight ? "h-full flex flex-col" : ""
      }`}
    >
      {fileType === "pdf" && (
        <div className="flex-1 min-h-0 w-full">
          <object
            data={`${url}#toolbar=0`}
            type="application/pdf"
            className="w-full h-full min-h-[400px]"
            title={fileName || "PDF preview"}
            onError={() => setError(true)}
          >
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Embedded preview unavailable. Use the button below.
              </p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open in new tab
              </a>
            </div>
          </object>
        </div>
      )}
      {fileType === "image" && (
        <img
          src={url}
          alt={fileName || "Document preview"}
          className="w-full max-h-[600px] object-contain"
          onError={() => setError(true)}
        />
      )}
    </div>
  );
}

function toUIDoc(d) {
  return {
    id: d.id,
    name: d.documentName,
    system: "inspectionReport",
    type: "inspection",
    document_key: d.documentKey,
    created_at: d.createdAt,
    document_date: d.createdAt,
    analysisStatus: d.analysisStatus,
    pageCount: d.pageCount,
  };
}

function getFileTypeColor(type) {
  if (type === "inspection") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
  }
  return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
}

export default function DocumentsTab({
  analysis,
  onChanged,
  onRefreshAnalysis,
  refreshing = false,
}) {
  const fileInputRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCaptureModal, setShowCaptureModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [error, setError] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {activationConstraint: {distance: 8}})
  );

  const {
    url: presignedPreviewUrl,
    isLoading: presignedLoading,
    error: presignedError,
    fetchPreview: fetchPresignedPreview,
  } = usePresignedPreview();

  const rawDocuments = analysis?.documents || [];
  const documents = useMemo(() => rawDocuments.map(toUIDoc), [rawDocuments]);

  const canModify =
    analysis?.status === "completed" ||
    analysis?.status === "failed" ||
    analysis?.status === "draft" ||
    analysis?.status === "uploading";
  const canStart =
    analysis?.status === "draft" ||
    analysis?.status === "failed" ||
    analysis?.status === "uploading";

  useEffect(() => {
    if (selectedDocument?.document_key) {
      fetchPresignedPreview(selectedDocument.document_key);
    }
  }, [selectedDocument?.document_key, fetchPresignedPreview]);

  const filteredDocuments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return documents.filter((doc) => {
      if (!q) return true;
      return (doc.name || "").toLowerCase().includes(q);
    });
  }, [documents, searchQuery]);

  useEffect(() => {
    if (
      selectedDocument &&
      !filteredDocuments.find((d) => d.id === selectedDocument.id)
    ) {
      setSelectedDocument(null);
    }
  }, [filteredDocuments, selectedDocument]);

  const documentsBySystem = useMemo(
    () => ({inspectionReport: documents}),
    [documents]
  );

  const tableDocuments = useMemo(
    () =>
      selectedFolder
        ? filteredDocuments.filter((doc) => doc.system === selectedFolder)
        : filteredDocuments,
    [filteredDocuments, selectedFolder]
  );

  const selectedFolderObj = selectedFolder
    ? INSPECTION_FOLDER
    : null;

  const recentParsed = useMemo(() => {
    return [...documents]
      .sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime()
      )
      .slice(0, 5)
      .map((doc) => ({
        doc,
        status: doc.analysisStatus || "pending",
      }));
  }, [documents]);

  const smartSummary = useMemo(() => {
    const analyzed = documents.filter((d) => d.analysisStatus === "completed");
    const processing = documents.filter(
      (d) =>
        d.analysisStatus === "processing" || d.analysisStatus === "pending"
    );
    return {
      total: documents.length,
      analyzed: analyzed.length,
      processing: processing.length,
      recent: recentParsed,
    };
  }, [documents, recentParsed]);

  function getAnalysisStatus(docId) {
    const doc = documents.find((d) => d.id === docId);
    return doc?.analysisStatus || "pending";
  }

  async function handleUpload(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length || !analysis?.id || !canModify) return;
    setError(null);
    setUploading(true);
    setUploadProgress({current: 0, total: files.length, name: files[0]?.name});

    let anySucceeded = false;
    let anyFailed = false;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress({current: i + 1, total: files.length, name: file.name});
      try {
        const result = await uploadDocumentFile(file, {
          uploadFolder: S3_UPLOAD_FOLDER.PRE_PURCHASE,
        });
        if (!result?.key) throw new Error("Upload failed");
        await AppApi.addPrePurchaseDocument(analysis.id, {
          documentName: file.name,
          documentKey: result.key,
          documentType: "inspection",
          mimeType: inferMimeType(file),
          fileSizeBytes: file.size ?? null,
        });
        anySucceeded = true;
      } catch (err) {
        anyFailed = true;
        setError(getApiErrorMessage(err, `Failed to upload ${file.name}`));
      }
    }

    setUploading(false);
    setUploadProgress(null);

    if (anyFailed && !anySucceeded) return;

    const shouldAutoStart =
      anySucceeded &&
      onRefreshAnalysis &&
      (analysis?.status === "draft" || analysis?.status === "uploading");
    if (shouldAutoStart) {
      await onChanged?.();
      await onRefreshAnalysis();
    } else {
      await onChanged?.();
    }
  }

  function requestDelete(docId) {
    if (!canModify) return;
    setDeleteTargetId(docId);
    setDeleteConfirmOpen(true);
  }

  async function confirmDelete() {
    if (!analysis?.id || deleteTargetId == null) return;
    setDeleteSubmitting(true);
    setError(null);
    try {
      await AppApi.deletePrePurchaseDocument(analysis.id, deleteTargetId);
      if (selectedDocument?.id === deleteTargetId) setSelectedDocument(null);
      setDeleteConfirmOpen(false);
      setDeleteTargetId(null);
      await onChanged?.();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to remove document."));
    } finally {
      setDeleteSubmitting(false);
    }
  }

  async function handleOpenInNewTab(doc) {
    const key = doc?.document_key;
    if (!key) return;
    try {
      const url = await AppApi.getPresignedPreviewUrl(key);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to open document."));
    }
  }

  function openFilePicker() {
    if (!canModify || uploading) return;
    fileInputRef.current?.click();
  }

  const deleteTargetName =
    documents.find((d) => d.id === deleteTargetId)?.name || "this document";

  return (
    <DndContext sensors={sensors}>
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_19rem] gap-4 items-start">
        <div className="relative flex h-[calc(100vh-200px)] min-h-[600px] min-w-0 bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
          {error && (
            <div className="absolute top-2 left-2 right-2 z-[60] flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm text-red-900 dark:text-red-100 shadow-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="flex-1 min-w-0">{error}</p>
              <button
                type="button"
                onClick={() => setError(null)}
                className="shrink-0 p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/50"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {uploadProgress && (
            <div className="absolute top-2 left-2 right-2 z-[60] flex items-center gap-2 rounded-lg border border-[#456654]/30 bg-white dark:bg-gray-800 px-3 py-2 text-sm shadow-sm">
              <Loader2 className="w-4 h-4 animate-spin text-[#456654] shrink-0" />
              <p className="flex-1 min-w-0 truncate text-neutral-700 dark:text-neutral-200">
                Uploading {uploadProgress.name}
                {uploadProgress.total > 1
                  ? ` (${uploadProgress.current}/${uploadProgress.total})`
                  : ""}
                …
              </p>
            </div>
          )}

          {sidebarOpen && (
            <div
              className="lg:hidden absolute inset-0 bg-gray-900/50 z-40 rounded-lg"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.doc,.docx"
            className="hidden"
            onChange={(e) => {
              handleUpload(e.target.files);
              e.target.value = "";
            }}
          />

          {/* Left sidebar */}
          <div
            className={`
              flex-shrink-0 transition-all duration-200 ease-in-out
              lg:relative lg:z-auto
              ${sidebarCollapsed ? "lg:w-0 lg:overflow-hidden" : "lg:w-72"}
              absolute inset-y-0 left-0 z-50 lg:static
              ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
            `}
          >
            <div className="w-72 h-full rounded-l-lg overflow-hidden">
              <DocumentsFolderSidebar
                systemsToShow={[INSPECTION_FOLDER]}
                documentsBySystem={documentsBySystem}
                totalCount={documents.length}
                showInbox={false}
                allSelected={!selectedFolder}
                selectedFolderId={selectedFolder}
                onSelectAll={() => {
                  setSelectedFolder(null);
                  setSelectedDocument(null);
                  setSidebarOpen(false);
                }}
                onSelectFolder={(id) => {
                  setSelectedFolder(id);
                  setSelectedDocument(null);
                  setSidebarOpen(false);
                }}
                onUploadForSystem={canModify ? openFilePicker : undefined}
                onCollapse={() => {
                  setSidebarCollapsed(true);
                  setSidebarOpen(false);
                }}
              />
            </div>
          </div>

          {sidebarCollapsed && (
            <div className="hidden lg:flex flex-shrink-0 w-7 flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setSidebarCollapsed(false)}
                className="p-1.5 mt-2 mx-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded transition-colors"
                title="Expand sidebar"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Main panel */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="lg:hidden flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="p-2 -ml-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Open documents menu"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Documents
                </span>
              </div>
            </div>

            <div className="flex-1 min-h-0">
              {selectedDocument ? (
                <DocumentsPreviewPanel
                  selectedDocument={selectedDocument}
                  presignedPreviewUrl={presignedPreviewUrl}
                  presignedLoading={presignedLoading}
                  presignedError={presignedError}
                  fetchPresignedPreview={fetchPresignedPreview}
                  InlineDocumentPreview={InlineDocumentPreview}
                  onClose={() => setSelectedDocument(null)}
                  onBack={() => setSelectedDocument(null)}
                  backLabel={
                    selectedFolderObj
                      ? selectedFolderObj.label
                      : "All Documents"
                  }
                  onOpenInNewTab={handleOpenInNewTab}
                  onDelete={requestDelete}
                  getDocumentIcon={() => FileCheck}
                  getFileTypeColor={getFileTypeColor}
                  systemCategories={[INSPECTION_FOLDER]}
                  documentTypes={DOCUMENT_TYPES}
                />
              ) : (
                <DocumentsTableView
                  title={
                    selectedFolderObj
                      ? selectedFolderObj.label
                      : "All Documents"
                  }
                  documents={tableDocuments}
                  documentTypes={DOCUMENT_TYPES}
                  getFileTypeColor={getFileTypeColor}
                  getAnalysisStatus={getAnalysisStatus}
                  onSelectDocument={(doc) => {
                    setSelectedDocument(doc);
                    setSidebarOpen(false);
                  }}
                  onOpenInNewTab={handleOpenInNewTab}
                  onDelete={requestDelete}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  selectedType="all"
                  onUploadClick={canModify ? openFilePicker : undefined}
                  emptyDescription="Upload an inspection report to start your Opsy Scout analysis."
                  emptyActionLabel="Upload Inspection Report"
                />
              )}
            </div>
          </div>
        </div>

        {/* Right rail — Smart Records & AI */}
        <div className="space-y-4 min-w-0">
          <SectionCard
            flat
            title="Smart Records & AI"
            description="Add an inspection report and let Opsy extract key details"
            icon={Sparkles}
          >
            <div className="space-y-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-400 dark:text-neutral-500 mb-2">
                  Add &amp; Extract Documents
                </p>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={openFilePicker}
                    disabled={!canModify || uploading}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-neutral-200/80 dark:border-neutral-700/60 hover:border-[#456654]/50 hover:bg-[#456654]/[0.04] dark:hover:bg-[#456654]/10 transition-colors text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="w-8 h-8 rounded-lg bg-[#456654]/10 dark:bg-[#456654]/25 flex items-center justify-center shrink-0">
                      {uploading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[#456654]" />
                      ) : (
                        <Upload className="w-4 h-4 text-[#456654] dark:text-[#7a9a88]" />
                      )}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-neutral-900 dark:text-white">
                        Upload Inspection Report
                      </span>
                      <span className="block text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                        Upload files from your device
                      </span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-neutral-300 dark:text-neutral-600 group-hover:text-[#456654] dark:group-hover:text-[#7a9a88] shrink-0" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCaptureModal(true)}
                    disabled={!canModify || uploading}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-neutral-200/80 dark:border-neutral-700/60 hover:border-[#456654]/50 hover:bg-[#456654]/[0.04] dark:hover:bg-[#456654]/10 transition-colors text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="w-8 h-8 rounded-lg bg-[#456654]/10 dark:bg-[#456654]/25 flex items-center justify-center shrink-0">
                      <Smartphone className="w-4 h-4 text-[#456654] dark:text-[#7a9a88]" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-neutral-900 dark:text-white">
                        Add from Mobile
                      </span>
                      <span className="block text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                        Capture or upload from your phone
                      </span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-neutral-300 dark:text-neutral-600 group-hover:text-[#456654] dark:group-hover:text-[#7a9a88] shrink-0" />
                  </button>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-400 dark:text-neutral-500 mb-2">
                  Recent Parsed Documents
                </p>
                {smartSummary.recent.length > 0 ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-700/50 py-2">
                        <p className="text-base font-bold text-neutral-900 dark:text-white tabular-nums">
                          {smartSummary.analyzed}
                        </p>
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.06em]">
                          Analyzed
                        </p>
                      </div>
                      <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-700/50 py-2">
                        <p className="text-base font-bold text-neutral-900 dark:text-white tabular-nums">
                          {smartSummary.processing}
                        </p>
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.06em]">
                          In Progress
                        </p>
                      </div>
                      <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-700/50 py-2">
                        <p className="text-base font-bold text-neutral-900 dark:text-white tabular-nums">
                          {smartSummary.total}
                        </p>
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.06em]">
                          Documents
                        </p>
                      </div>
                    </div>
                    <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {smartSummary.recent.map(({doc, status}) => (
                        <li key={`analysis-${doc.id}`}>
                          <button
                            type="button"
                            onClick={() => setSelectedDocument(doc)}
                            className="w-full flex flex-col gap-1 py-2 first:pt-0 last:pb-0 text-left group"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <FileText className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                              <span className="text-sm text-neutral-800 dark:text-neutral-200 truncate flex-1">
                                {doc.name || "Document"}
                              </span>
                              <StatusBadge
                                tone={
                                  status === "completed"
                                    ? "emerald"
                                    : status === "failed"
                                      ? "red"
                                      : "amber"
                                }
                              >
                                {status === "completed"
                                  ? "Analyzed"
                                  : status === "failed"
                                    ? "Failed"
                                    : status === "processing"
                                      ? "Analyzing"
                                      : "Pending"}
                              </StatusBadge>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                    {onRefreshAnalysis && (
                      <button
                        type="button"
                        onClick={onRefreshAnalysis}
                        disabled={
                          !canModify ||
                          refreshing ||
                          documents.length === 0 ||
                          uploading
                        }
                        className="w-full px-3 py-1.5 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-[#456654]/50 hover:text-[#456654] dark:hover:text-[#7a9a88] transition-colors inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {refreshing ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                        {canStart ? "Start analysis" : "Refresh analysis"}
                      </button>
                    )}
                  </div>
                ) : (
                  <EmptyStateCard
                    icon={Sparkles}
                    title="No AI extractions yet"
                    description="Upload an inspection report — Opsy can extract systems, issues, and recommendations automatically."
                  />
                )}
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      <DocumentCaptureModal
        open={showCaptureModal}
        onClose={() => setShowCaptureModal(false)}
        onAddToInbox={(files) => handleUpload(files)}
      />

      <ModalBlank
        id="pre-purchase-doc-delete"
        modalOpen={deleteConfirmOpen}
        setModalOpen={(open) => {
          if (!open && !deleteSubmitting) {
            setDeleteConfirmOpen(false);
            setDeleteTargetId(null);
          }
        }}
        backdropZClassName="z-[300]"
        dialogZClassName="z-[300]"
        contentClassName="max-w-lg"
      >
        <div className="p-5 flex space-x-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-red-100 dark:bg-red-500/20">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <div className="mb-2">
              <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                Delete &ldquo;{deleteTargetName}&rdquo;?
              </div>
            </div>
            <div className="text-sm mb-6 text-gray-600 dark:text-gray-400">
              Are you sure you want to delete this document? This action cannot
              be undone.
            </div>
            <div className="flex flex-wrap justify-end space-x-2">
              <button
                type="button"
                className="btn-sm border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 text-gray-800 dark:text-gray-300"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setDeleteTargetId(null);
                }}
                disabled={deleteSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-sm bg-red-500 hover:bg-red-600 text-white"
                onClick={confirmDelete}
                disabled={deleteSubmitting}
              >
                {deleteSubmitting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      </ModalBlank>
    </DndContext>
  );
}
