import React, {useState, useMemo, useEffect, useCallback, useRef} from "react";
import {createPortal} from "react-dom";
import {
  FileText,
  Upload,
  Trash2,
  File,
  FileCheck,
  Receipt,
  Shield,
  ClipboardList,
  Building,
  Droplet,
  Zap,
  Home,
  X,
  ChevronRight,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Menu,
  Settings,
  Sparkles,
} from "lucide-react";
import AppApi from "../../api/api";
import DatePickerInput from "../../components/DatePickerInput";
import useDocumentUpload from "../../hooks/useDocumentUpload";
import usePresignedPreview from "../../hooks/usePresignedPreview";
import {DocumentsTreeView, DocumentsPreviewPanel} from "./partials/documents";
import {PROPERTY_SYSTEMS} from "./constants/propertySystems";
import UpgradePrompt from "../../components/UpgradePrompt";

// System categories with icons – matches API system_key values
const systemCategories = [
  {id: "inspectionReport", label: "Inspection Report", icon: FileCheck, color: "text-green-600"},
  {id: "roof", label: "Roof", icon: Building, color: "text-blue-600"},
  {id: "gutters", label: "Gutters", icon: Droplet, color: "text-cyan-600"},
  {
    id: "foundation",
    label: "Foundation",
    icon: Building,
    color: "text-amber-600",
  },
  {
    id: "exterior",
    label: "Exterior/Siding",
    icon: Building,
    color: "text-orange-600",
  },
  {id: "windows", label: "Windows", icon: Home, color: "text-indigo-600"},
  {id: "heating", label: "Heating", icon: Zap, color: "text-red-600"},
  {id: "ac", label: "Air Conditioning", icon: Zap, color: "text-blue-500"},
  {
    id: "waterHeating",
    label: "Water Heating",
    icon: Droplet,
    color: "text-teal-600",
  },
  {id: "electrical", label: "Electrical", icon: Zap, color: "text-yellow-600"},
  {id: "plumbing", label: "Plumbing", icon: Droplet, color: "text-sky-600"},
  {id: "safety", label: "Safety", icon: Shield, color: "text-red-500"},
  {
    id: "inspections",
    label: "Inspections",
    icon: FileCheck,
    color: "text-green-600",
  },
];

// Document types – matches API document_type values
const documentTypes = [
  {id: "contract", label: "Contract", icon: FileText},
  {id: "warranty", label: "Warranty", icon: Shield},
  {id: "receipt", label: "Receipt", icon: Receipt},
  {id: "inspection", label: "Inspection Report", icon: FileCheck},
  {id: "permit", label: "Permit", icon: ClipboardList},
  {id: "manual", label: "Manual", icon: FileText},
  {id: "insurance", label: "Insurance", icon: Shield},
  {id: "mortgage", label: "Mortgage", icon: FileText},
  {id: "other", label: "Other", icon: File},
];

const months = [
  {value: "01", label: "January"},
  {value: "02", label: "February"},
  {value: "03", label: "March"},
  {value: "04", label: "April"},
  {value: "05", label: "May"},
  {value: "06", label: "June"},
  {value: "07", label: "July"},
  {value: "08", label: "August"},
  {value: "09", label: "September"},
  {value: "10", label: "October"},
  {value: "11", label: "November"},
  {value: "12", label: "December"},
];

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
const PDF_EXTENSION = ".pdf";

function getPreviewType(url) {
  if (!url) return "other";
  const lower = url.toLowerCase();
  if (lower.includes(".pdf") || lower.endsWith("pdf")) return "pdf";
  if (IMAGE_EXTENSIONS.some((ext) => lower.includes(ext))) return "image";
  return "other";
}

function formatDate(dateString) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function InlineDocumentPreview({
  url,
  fileName,
  onClose,
  fillHeight,
  narrowerPdf,
}) {
  const [error, setError] = useState(false);
  const fileType = getPreviewType(url ?? fileName);

  if (!url) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="w-12 h-12 text-amber-500 dark:text-amber-400 mb-3" />
        <p className="text-gray-600 dark:text-gray-400">
          No preview URL available. Use "Open in new tab" to view.
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
        <div
          className={`flex-1 min-h-0 ${narrowerPdf ? "max-w-lg mx-auto w-full" : "w-full"}`}
        >
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

function DocumentsTab({
  propertyData,
  onOpenAIAssistant,
  onOpenAIReport,
  openUploadModalForInspectionReport = false,
  onUploadModalOpened,
}) {
  const propertyId = propertyData?.id ?? propertyData?.identity?.id;
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [selectedSystem, setSelectedSystem] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [upgradePromptOpen, setUpgradePromptOpen] = useState(false);
  const [upgradePromptMsg, setUpgradePromptMsg] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [uploadDocumentName, setUploadDocumentName] = useState("");
  const [uploadDocumentDate, setUploadDocumentDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [uploadDocumentType, setUploadDocumentType] = useState("receipt");
  const [uploadSystemKey, setUploadSystemKey] = useState("inspectionReport");
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploadSuccessCount, setUploadSuccessCount] = useState(0);
  const [uploadError, setUploadError] = useState(null);
  const [indexingDocs, setIndexingDocs] = useState(false);
  const fileInputRef = useRef(null);

  const {
    uploadDocument,
    progress,
    isUploading,
    error: uploadHookError,
    clearError: clearUploadHookError,
  } = useDocumentUpload();

  const {
    url: presignedPreviewUrl,
    isLoading: presignedLoading,
    error: presignedError,
    fetchPreview: fetchPresignedPreview,
  } = usePresignedPreview();

  useEffect(() => {
    if (selectedDocument?.document_key) {
      fetchPresignedPreview(selectedDocument.document_key);
    }
  }, [selectedDocument?.document_key, fetchPresignedPreview]);

  // Open upload modal with inspection report preselected when requested from Inspection Analysis
  useEffect(() => {
    if (openUploadModalForInspectionReport) {
      setUploadSystemKey("inspectionReport");
      setUploadDocumentType("inspection");
      setShowUploadModal(true);
      onUploadModalOpened?.();
    }
  }, [openUploadModalForInspectionReport, onUploadModalOpened]);

  const fetchDocuments = useCallback(async () => {
    if (!propertyId) {
      setDocuments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setFetchError(null);
    try {
      const docs = await AppApi.getPropertyDocuments(propertyId);
      setDocuments(docs ?? []);
    } catch (err) {
      const msg = Array.isArray(err)
        ? err.join(", ")
        : err?.message || "Failed to load documents";
      setFetchError(msg);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Map API document to UI shape. Backend stores document_key (S3 path) like contacts/users.
  const toUIDoc = (doc) => ({
    id: doc.id,
    name: doc.document_name,
    system: doc.system_key === "general" ? "inspectionReport" : (doc.system_key || "inspectionReport"),
    type: doc.document_type || "other",
    document_key: doc.document_key,
    document_url: doc.document_url,
    document_date: doc.document_date,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
  });

  const availableYears = useMemo(() => {
    const years = new Set();
    documents.forEach((doc) => {
      const d = doc.document_date || doc.created_at;
      if (d) years.add(new Date(d).getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    const uiDocs = documents.map(toUIDoc);
    return uiDocs.filter((doc) => {
      const matchesSystem =
        selectedSystem === "all" || doc.system === selectedSystem;
      const matchesType = selectedType === "all" || doc.type === selectedType;
      const matchesSearch =
        searchQuery === "" ||
        (doc.name || "").toLowerCase().includes(searchQuery.toLowerCase());

      let matchesDate = true;
      if (selectedYear !== "all" || selectedMonth !== "all") {
        const d = doc.document_date || doc.created_at;
        if (!d) matchesDate = false;
        else {
          const docDate = new Date(d);
          const docYear = docDate.getFullYear().toString();
          const docMonth = String(docDate.getMonth() + 1).padStart(2, "0");
          if (selectedYear !== "all" && docYear !== selectedYear)
            matchesDate = false;
          if (selectedMonth !== "all" && docMonth !== selectedMonth)
            matchesDate = false;
        }
      }

      return matchesSystem && matchesType && matchesSearch && matchesDate;
    });
  }, [
    documents,
    selectedSystem,
    selectedType,
    searchQuery,
    selectedYear,
    selectedMonth,
  ]);

  useEffect(() => {
    if (
      selectedDocument &&
      !filteredDocuments.find((d) => d.id === selectedDocument.id)
    ) {
      setSelectedDocument(null);
    }
  }, [filteredDocuments, selectedDocument]);

  const documentsBySystem = useMemo(() => {
    const grouped = {};
    filteredDocuments.forEach((doc) => {
      const sys = doc.system === "general" ? "inspectionReport" : (doc.system || "inspectionReport");
      if (!grouped[sys]) grouped[sys] = [];
      grouped[sys].push(doc);
    });
    return grouped;
  }, [filteredDocuments]);

  // Visible systems: Inspection Report always shown; selected systems when any chosen
  const visibleSystemIds =
    (propertyData?.selectedSystemIds?.length ?? 0) > 0
      ? propertyData.selectedSystemIds
      : [];
  const customSystemNames = propertyData?.customSystemNames ?? [];
  const systemsToShow = useMemo(() => {
    const inspectionReport = systemCategories.find((c) => c.id === "inspectionReport");
    const selected = PROPERTY_SYSTEMS.filter((s) =>
      visibleSystemIds.includes(s.id),
    ).map((s) => {
      const cat = systemCategories.find((c) => c.id === s.id);
      return (
        cat || {id: s.id, label: s.name, icon: s.icon, color: "text-gray-600"}
      );
    });
    const custom = customSystemNames.map((name, i) => ({
      id: `custom-${name}-${i}`,
      label: name,
      icon: Settings,
      color: "text-gray-600",
    }));
    return [inspectionReport, ...selected, ...custom].filter(Boolean);
  }, [visibleSystemIds, customSystemNames]);

  // When filtering by system, tree column shows only that system
  const systemsForTree = useMemo(() => {
    if (selectedSystem === "all") return systemsToShow;
    const match = systemsToShow.find((s) => s.id === selectedSystem);
    return match ? [match] : systemsToShow;
  }, [systemsToShow, selectedSystem]);

  const handleSelectDocument = useCallback(
    (doc) => {
      const docRow = documents.find((d) => d.id === doc.id);
      const docKey = docRow?.document_key ?? doc.document_key;
      const docUrl = docRow?.document_url ?? doc.document_url;
      setSelectedDocument({
        ...doc,
        document_key: docKey,
        document_url: docUrl,
      });
    },
    [documents],
  );

  const handleDelete = async (docId) => {
    if (!window.confirm("Are you sure you want to delete this document?"))
      return;
    try {
      await AppApi.deletePropertyDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      if (selectedDocument?.id === docId) setSelectedDocument(null);
    } catch (err) {
      const msg = Array.isArray(err)
        ? err.join(", ")
        : err?.message || "Delete failed";
      alert(msg);
    }
  };

  const handleOpenInNewTab = async (doc) => {
    const key = doc.document_key;
    const url = doc.document_url || doc.url;
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    if (key) {
      try {
        const presignedUrl = await AppApi.getPresignedPreviewUrl(key);
        window.open(presignedUrl, "_blank", "noopener,noreferrer");
      } catch (err) {
        const msg = Array.isArray(err)
          ? err.join(", ")
          : err?.message || "Failed to open";
        alert(msg);
      }
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
    if (!uploadDocumentName.trim()) {
      setUploadError("Please enter a document name.");
      return;
    }
    if (!uploadDocumentDate) {
      setUploadError("Please select a document date.");
      return;
    }

    setUploadError(null);
    setUploadSuccessCount(0);
    clearUploadHookError();

    let successCount = 0;
    for (let i = 0; i < uploadFiles.length; i++) {
      const file = uploadFiles[i];
      const name =
        uploadFiles.length > 1
          ? `${uploadDocumentName} (${i + 1})`
          : uploadDocumentName;
      const result = await uploadDocument(file);
      const s3Key = result?.key;
      if (!s3Key) continue;
      try {
        const created = await AppApi.createPropertyDocument({
          property_id: propertyId,
          document_name: name,
          document_date: uploadDocumentDate,
          document_key: s3Key,
          document_type: uploadDocumentType,
          system_key: uploadSystemKey,
        });
        successCount++;
        setUploadSuccessCount(successCount);
        if (created) {
          setDocuments((prev) => [...prev, created]);
        } else {
          await fetchDocuments();
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
      setUploadFiles([]);
      setUploadDocumentName("");
      setShowUploadModal(false);
    }
  };

  const getDocumentIcon = (type) => {
    const dt = documentTypes.find((t) => t.id === type);
    return dt ? dt.icon : File;
  };

  const getFileTypeColor = (type) => {
    const colors = {
      contract:
        "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      warranty:
        "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      receipt:
        "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
      inspection:
        "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      permit:
        "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
      manual:
        "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
      insurance:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
      mortgage:
        "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
      other: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
    };
    return colors[type] || colors.other;
  };

  const handleIndexForAI = async () => {
    if (!propertyId || indexingDocs) return;
    setIndexingDocs(true);
    try {
      await AppApi.aiIngestDocuments(propertyId);
      fetchDocuments();
    } catch (err) {
      const msg = err?.message || "Indexing failed";
      alert(msg);
    } finally {
      setIndexingDocs(false);
    }
  };

  const clearFilters = () => {
    setSelectedSystem("all");
    setSelectedType("all");
    setSearchQuery("");
    setSelectedYear("all");
    setSelectedMonth("all");
  };

  const hasActiveFilters =
    selectedSystem !== "all" ||
    selectedType !== "all" ||
    searchQuery ||
    selectedYear !== "all" ||
    selectedMonth !== "all";

  // Close mobile sidebar on escape (must run before early return to preserve hook order)
  useEffect(() => {
    const handleKeydown = (e) => {
      if (e.key === "Escape" && sidebarOpen) setSidebarOpen(false);
    };
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [sidebarOpen]);

  const handleDocumentSelect = useCallback(
    (doc) => {
      handleSelectDocument(doc);
      setSidebarOpen(false);
    },
    [handleSelectDocument],
  );

  if (!propertyId) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center">
        <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-500" />
        <p className="text-gray-600 dark:text-gray-400">
          Save the property to manage documents.
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex h-[calc(100vh-200px)] min-h-[600px] bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="lg:hidden absolute inset-0 bg-gray-900/50 z-40 rounded-lg"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Panel - Tree View */}
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
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full bg-white dark:bg-gray-800 p-8">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Loading documents…
              </p>
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center h-full bg-white dark:bg-gray-800 p-6 text-center">
              <AlertCircle className="w-12 h-12 text-amber-500 dark:text-amber-400 mb-3" />
              <p className="text-sm text-amber-800 dark:text-amber-200 mb-4">
                {fetchError}
              </p>
              <button
                onClick={fetchDocuments}
                className="btn-sm bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Retry
              </button>
            </div>
          ) : (
            <DocumentsTreeView
              systemsToShow={systemsForTree}
              documentTypes={documentTypes}
              documentsBySystem={documentsBySystem}
              selectedDocumentId={selectedDocument?.id}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onSelectDocument={handleDocumentSelect}
              onUpload={() => {
                setShowUploadModal(true);
                setSidebarOpen(false);
              }}
              onCollapse={() => {
                setSidebarCollapsed(true);
                setSidebarOpen(false);
              }}
              getDocumentIcon={getDocumentIcon}
              getFileTypeColor={getFileTypeColor}
            />
          )}
        </div>
      </div>

      {/* Expand button when collapsed (desktop only) */}
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

      {/* Right Panel - Preview */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile menu button */}
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
          {onOpenAIAssistant && (
            <button
              type="button"
              onClick={onOpenAIAssistant}
              className="p-2 text-[#456564] hover:bg-[#456564]/10 rounded-lg transition-colors"
              title="AI Assistant"
            >
              <Sparkles className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Filters bar - horizontal, over central panel */}
        <div className="flex-shrink-0 px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-wrap items-center gap-2">
          <select
            value={selectedSystem}
            onChange={(e) => setSelectedSystem(e.target.value)}
            className="form-select text-sm bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded-lg pl-3 pr-8 py-1.5 min-w-[180px]"
          >
            <option value="all">All Systems</option>
            {systemsToShow.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="form-select text-sm bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded-lg pl-3 pr-8 py-1.5 min-w-[180px]"
          >
            <option value="all">All Types</option>
            {documentTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(e.target.value);
              if (e.target.value === "all") setSelectedMonth("all");
            }}
            className="form-select text-sm bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded-lg pl-3 pr-8 py-1.5 min-w-[120px]"
          >
            <option value="all">All Years</option>
            {availableYears.map((y) => (
              <option key={y} value={y.toString()}>
                {y}
              </option>
            ))}
          </select>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            disabled={selectedYear === "all"}
            className="form-select text-sm bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded-lg pl-3 pr-8 py-1.5 min-w-[140px] disabled:opacity-50"
          >
            <option value="all">All Months</option>
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-[#456654] dark:text-[#5a7a68] hover:underline font-medium px-2 py-1"
            >
              Clear filters
            </button>
          )}
          <div className="hidden lg:flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handleIndexForAI}
              disabled={indexingDocs || !propertyId}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50 px-2 py-1"
              title="Index documents for AI search"
            >
              {indexingDocs ? "Indexing…" : "Index for AI"}
            </button>
            {onOpenAIAssistant && (
              <button
                type="button"
                onClick={onOpenAIAssistant}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[#456564] hover:bg-[#456564]/10 transition-colors"
                title="AI Assistant"
              >
                <Sparkles className="w-4 h-4" />
                <span className="text-sm font-medium">AI Assistant</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <DocumentsPreviewPanel
            selectedDocument={selectedDocument}
            presignedPreviewUrl={presignedPreviewUrl}
            presignedLoading={presignedLoading}
            presignedError={presignedError}
            fetchPresignedPreview={fetchPresignedPreview}
            InlineDocumentPreview={InlineDocumentPreview}
            onClose={() => setSelectedDocument(null)}
            onOpenInNewTab={handleOpenInNewTab}
            onDelete={handleDelete}
            onOpenAIReport={onOpenAIReport}
            getDocumentIcon={getDocumentIcon}
            getFileTypeColor={getFileTypeColor}
            systemCategories={systemCategories}
            documentTypes={documentTypes}
          />
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isUploading) {
              setShowUploadModal(false);
              setUploadFiles([]);
              setUploadError(null);
              clearUploadHookError();
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Upload Document
              </h3>
              <button
                onClick={() => {
                  if (!isUploading) {
                    setShowUploadModal(false);
                    setUploadFiles([]);
                    setUploadError(null);
                    clearUploadHookError();
                  }
                }}
                disabled={isUploading}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
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
                <div className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span className="text-indigo-800 dark:text-indigo-200 text-xs">
                    {uploadSuccessCount} file
                    {uploadSuccessCount !== 1 ? "s" : ""} uploaded successfully
                  </span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Document Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={uploadDocumentName}
                  onChange={(e) => setUploadDocumentName(e.target.value)}
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
                  value={uploadDocumentDate}
                  onChange={(e) => setUploadDocumentDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Document Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={uploadDocumentType}
                  onChange={(e) => setUploadDocumentType(e.target.value)}
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
                  className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-5 text-center hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors cursor-pointer group"
                >
                  <Upload className="w-10 h-10 mx-auto mb-3 text-gray-400 dark:text-gray-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    PDF, JPG, PNG up to 10MB
                  </p>
                  {uploadFiles.length > 0 && (
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2 font-medium">
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
                      className="h-full bg-indigo-500 dark:bg-indigo-500 transition-all duration-300"
                      style={{width: `${progress}%`}}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3 justify-end">
              <button
                onClick={() => {
                  if (!isUploading) {
                    setShowUploadModal(false);
                    setUploadFiles([]);
                    setUploadError(null);
                    clearUploadHookError();
                  }
                }}
                disabled={isUploading}
                className="btn-sm border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-200 disabled:opacity-50 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={
                  isUploading ||
                  uploadFiles.length === 0 ||
                  !uploadDocumentName.trim() ||
                  !uploadDocumentDate
                }
                className="btn-sm bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 text-xs"
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
          </div>
        </div>
      )}
      <UpgradePrompt
        open={upgradePromptOpen}
        onClose={() => setUpgradePromptOpen(false)}
        title="Document limit reached"
        message={upgradePromptMsg || "You've reached the document limit for this system. Upgrade your plan for more."}
      />
    </div>
  );
}

export default DocumentsTab;
