import React, {useState, useMemo, useEffect, useCallback, useRef} from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  FileText,
  Upload,
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
  Undo2,
} from "lucide-react";
import AppApi from "../../api/api";
import DatePickerInput from "../../components/DatePickerInput";
import {Popover, PopoverContent, PopoverTrigger} from "../../components/ui/popover";
import {Calendar as CalendarIcon} from "lucide-react";
import useDocumentUpload from "../../hooks/useDocumentUpload";
import { S3_UPLOAD_FOLDER } from "../../constants/s3UploadFolders";
import usePresignedPreview from "../../hooks/usePresignedPreview";
import {
  DocumentsTreeView,
  DocumentsTreeSkeleton,
  DocumentsPreviewPanel,
  DocumentsInboxView,
  FolderContentsView,
  useDocumentsInbox,
} from "./partials/documents";
import {PROPERTY_SYSTEMS, CUSTOM_SYSTEM_DEFAULT_ICON} from "./constants/propertySystems";
import {PROPERTY_DOCUMENTS_CHANGED_EVENT} from "./helpers/inspectionFlowSession";
import UpgradePrompt from "../../components/UpgradePrompt";
import ModalBlank from "../../components/ModalBlank";
import {
  MAX_DOCUMENT_UPLOAD_LABEL,
  defaultDocumentLabelFromFile,
} from "../../constants/documentUpload";

// System categories with icons – matches API system_key values
const systemCategories = [
  {
    id: "inspectionReport",
    label: "Inspection Report",
    icon: FileCheck,
    color: "text-green-600",
  },
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

function getPreviewType(url) {
  if (!url) return "other";
  const lower = url.toLowerCase();
  if (lower.includes(".pdf") || lower.endsWith("pdf")) return "pdf";
  if (IMAGE_EXTENSIONS.some((ext) => lower.includes(ext))) return "image";
  return "other";
}

function InlineDocumentPreview({
  url,
  fileName,
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
  accountUrl = "",
  propertyUid,
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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [upgradePromptOpen, setUpgradePromptOpen] = useState(false);
  const [upgradePromptMsg, setUpgradePromptMsg] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  // null = inbox view; system id = folder view
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [activeDrag, setActiveDrag] = useState(null);
  const [toast, setToast] = useState(null); // { kind, message, undo? }
  const [uploadDocumentName, setUploadDocumentName] = useState("");
  const [uploadDocumentDate, setUploadDocumentDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [uploadDocumentType, setUploadDocumentType] = useState("receipt");
  const [uploadSystemKey, setUploadSystemKey] = useState("inspectionReport");
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploadSuccessCount, setUploadSuccessCount] = useState(0);
  const [uploadError, setUploadError] = useState(null);
  const [inspectionUploadBlockedNotice, setInspectionUploadBlockedNotice] =
    useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const fileInputRef = useRef(null);
  const uploadSuccessBannerRef = useRef(null);

  const hasInspectionReport = useMemo(
    () => documents.some((d) => d.system_key === "inspectionReport"),
    [documents],
  );

  useEffect(() => {
    if (uploadSuccessCount > 0) {
      uploadSuccessBannerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [uploadSuccessCount]);

  const {
    uploadDocument,
    progress,
    isUploading,
    error: uploadHookError,
    clearError: clearUploadHookError,
  } = useDocumentUpload({ uploadFolder: S3_UPLOAD_FOLDER.PROPERTY_DOCUMENTS });

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

  /* ----- inbox state ----- */
  const visibleSystemIds =
    (propertyData?.selectedSystemIds?.length ?? 0) > 0
      ? propertyData.selectedSystemIds
      : [];
  const customSystemNames = propertyData?.customSystemNames ?? [];

  const systemsToShow = useMemo(() => {
    const inspectionReport = systemCategories.find(
      (c) => c.id === "inspectionReport",
    );
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
      icon: CUSTOM_SYSTEM_DEFAULT_ICON,
      color: "text-gray-600",
    }));
    return [inspectionReport, ...selected, ...custom].filter(Boolean);
  }, [visibleSystemIds, customSystemNames]);

  const allowedSystemKeys = useMemo(
    () => systemsToShow.map((s) => s.id),
    [systemsToShow],
  );

  const inbox = useDocumentsInbox(propertyId, { allowedSystemKeys });

  /* ----- documents list & grouping ----- */

  useEffect(() => {
    if (!openUploadModalForInspectionReport) return;
    onUploadModalOpened?.();
    if (hasInspectionReport) {
      setInspectionUploadBlockedNotice(
        "This property already has an inspection report. Delete it in the documents list before uploading a new one.",
      );
      return;
    }
    setUploadSystemKey("inspectionReport");
    setUploadDocumentType("inspection");
    setShowUploadModal(true);
  }, [
    openUploadModalForInspectionReport,
    onUploadModalOpened,
    hasInspectionReport,
  ]);

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

  // Keep folder tree in sync when an inspection report is saved or analysis finishes from another
  // surface (e.g. Passport / Systems setup modal) while this tab is mounted.
  useEffect(() => {
    if (!propertyId) return;
    const pid = String(propertyId);
    const onPropertyDocumentsChanged = (e) => {
      if (String(e?.detail?.propertyId) !== pid) return;
      fetchDocuments();
    };
    window.addEventListener(
      PROPERTY_DOCUMENTS_CHANGED_EVENT,
      onPropertyDocumentsChanged,
    );
    return () => {
      window.removeEventListener(
        PROPERTY_DOCUMENTS_CHANGED_EVENT,
        onPropertyDocumentsChanged,
      );
    };
  }, [propertyId, fetchDocuments]);

  const toUIDoc = (doc) => ({
    id: doc.id,
    name: doc.document_name,
    system:
      doc.system_key === "general"
        ? "inspectionReport"
        : doc.system_key || "inspectionReport",
    type: doc.document_type || "other",
    document_key: doc.document_key,
    document_url: doc.document_url,
    document_date: doc.document_date,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
    maintenance_record_id: doc.maintenance_record_id,
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
      if (
        selectedYear !== "all" ||
        selectedMonth !== "all" ||
        dateFrom ||
        dateTo
      ) {
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
          // Compare on YYYY-MM-DD strings to avoid timezone drift between the
          // filter inputs (date-only) and document_date timestamps.
          const docDateStr = `${docYear}-${docMonth}-${String(
            docDate.getDate(),
          ).padStart(2, "0")}`;
          if (dateFrom && docDateStr < dateFrom) matchesDate = false;
          if (dateTo && docDateStr > dateTo) matchesDate = false;
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
    dateFrom,
    dateTo,
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
      const sys =
        doc.system === "general"
          ? "inspectionReport"
          : doc.system || "inspectionReport";
      if (!grouped[sys]) grouped[sys] = [];
      grouped[sys].push(doc);
    });
    return grouped;
  }, [filteredDocuments]);

  const systemsForTree = useMemo(() => {
    if (selectedSystem === "all") return systemsToShow;
    const match = systemsToShow.find((s) => s.id === selectedSystem);
    return match ? [match] : systemsToShow;
  }, [systemsToShow, selectedSystem]);

  const openUploadModalWithSystem = useCallback(
    (systemId) => {
      setUploadSystemKey(systemId);
      setUploadDocumentType(
        systemId === "inspectionReport" ? "inspection" : "receipt",
      );
      setUploadDocumentName("");
      setUploadFiles([]);
      setUploadError(null);
      setUploadSuccessCount(0);
      clearUploadHookError();
      setShowUploadModal(true);
      setSidebarOpen(false);
    },
    [clearUploadHookError],
  );

  // Tree "Upload" button now opens a hidden file picker that drops files
  // straight into the inbox (no modal). Faster for the common path.
  const inboxBrowseRef = useRef(null);
  const openDefaultUploadModal = useCallback(() => {
    inboxBrowseRef.current?.click();
  }, []);

  useEffect(() => {
    if (!showUploadModal || !hasInspectionReport) return;
    if (uploadSystemKey !== "inspectionReport") return;
    const next =
      systemsToShow.find((s) => s.id !== "inspectionReport")?.id ?? "roof";
    setUploadSystemKey(next);
    setUploadDocumentType("receipt");
  }, [showUploadModal, hasInspectionReport, uploadSystemKey, systemsToShow]);

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

  const handleDelete = useCallback((docId) => {
    setDeleteTargetId(docId);
    setDeleteConfirmOpen(true);
  }, []);

  const confirmDeleteDocument = useCallback(async () => {
    if (deleteTargetId == null) return;
    setDeleteSubmitting(true);
    try {
      await AppApi.deletePropertyDocument(deleteTargetId);
      const id = deleteTargetId;
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      setSelectedDocument((cur) => (cur?.id === id ? null : cur));
      setDeleteConfirmOpen(false);
      setDeleteTargetId(null);
    } catch (err) {
      const msg = Array.isArray(err)
        ? err.join(", ")
        : err?.message || "Delete failed";
      setToast({ kind: "error", message: msg });
    } finally {
      setDeleteSubmitting(false);
    }
  }, [deleteTargetId]);

  const setDeleteModalOpen = useCallback(
    (open) => {
      if (open) {
        setDeleteConfirmOpen(true);
        return;
      }
      if (deleteSubmitting) return;
      setDeleteConfirmOpen(false);
      setDeleteTargetId(null);
    },
    [deleteSubmitting],
  );

  const deleteModalTitle = useMemo(() => {
    if (deleteTargetId == null) return "Delete this document?";
    const name = documents.find((d) => d.id === deleteTargetId)
      ?.document_name;
    return name ? `Delete “${name}”?` : "Delete this document?";
  }, [documents, deleteTargetId]);

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
    if (uploadSystemKey === "inspectionReport") {
      if (hasInspectionReport) {
        setUploadError(
          "This property already has an inspection report. Delete it first to upload another.",
        );
        return;
      }
      if (uploadFiles.length > 1) {
        setUploadError(
          "Only one file can be uploaded as the property inspection report.",
        );
        return;
      }
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
          file_size_bytes: file.size,
        });
        successCount++;
        setUploadSuccessCount(successCount);
        if (created) {
          setDocuments((prev) => [...prev, created]);
        } else {
          await fetchDocuments();
        }
      } catch (err) {
        if (
          err?.status === 403 &&
          err?.message?.toLowerCase().includes("limit")
        ) {
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
      await fetchDocuments();
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

  const clearFilters = () => {
    setSelectedSystem("all");
    setSelectedType("all");
    setSearchQuery("");
    setSelectedYear("all");
    setSelectedMonth("all");
    setDateFrom("");
    setDateTo("");
  };

  const hasActiveFilters =
    selectedSystem !== "all" ||
    selectedType !== "all" ||
    searchQuery ||
    selectedYear !== "all" ||
    selectedMonth !== "all" ||
    dateFrom ||
    dateTo;

  const dateRangeError =
    dateFrom && dateTo && dateFrom > dateTo
      ? "Start date must be before end date"
      : null;

  const dateRangeLabel = useMemo(() => {
    const fmt = (s) => {
      if (!s) return "";
      const [y, m, d] = s.split("-");
      return `${d}/${m}/${y}`;
    };
    if (dateFrom && dateTo) return `${fmt(dateFrom)} – ${fmt(dateTo)}`;
    if (dateFrom) return `From ${fmt(dateFrom)}`;
    if (dateTo) return `Until ${fmt(dateTo)}`;
    return "Date range";
  }, [dateFrom, dateTo]);

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

  /* ----- Toast helper ----- */
  const showToast = useCallback((next) => {
    setToast(next);
    if (next?.timeout !== false) {
      const id = setTimeout(() => {
        setToast((cur) => (cur === next ? null : cur));
      }, next?.duration ?? 5000);
      return () => clearTimeout(id);
    }
    return undefined;
  }, []);

  /* ----- DnD wiring (drop inbox card → folder, drop filed doc → folder) ----- */

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  /**
   * dnd-kit modifier: pin the center of the DragOverlay to the cursor.
   *
   * By default, dnd-kit preserves the relative grab point inside the source
   * element — but our overlay is a small pill while inbox cards are tall, so
   * the cursor ended up far below the overlay. Centering the overlay on the
   * pointer is the standard UX when the drag preview is smaller than the
   * source. (Equivalent to @dnd-kit/modifiers' snapCenterToCursor; inlined
   * here to avoid adding a dependency for a few lines of code.)
   */
  const snapCenterToCursor = useCallback(
    ({ activatorEvent, draggingNodeRect, transform }) => {
      if (!draggingNodeRect || !activatorEvent) return transform;
      const coords =
        "clientX" in activatorEvent && "clientY" in activatorEvent
          ? { x: activatorEvent.clientX, y: activatorEvent.clientY }
          : activatorEvent.touches?.length
            ? {
                x: activatorEvent.touches[0].clientX,
                y: activatorEvent.touches[0].clientY,
              }
            : null;
      if (!coords) return transform;
      const offsetX = coords.x - draggingNodeRect.left;
      const offsetY = coords.y - draggingNodeRect.top;
      return {
        ...transform,
        x: transform.x + offsetX - draggingNodeRect.width / 2,
        y: transform.y + offsetY - draggingNodeRect.height / 2,
      };
    },
    [],
  );

  const inboxRef = useRef(inbox);
  inboxRef.current = inbox;

  const handleDragStart = useCallback((event) => {
    setActiveDrag(event.active);
  }, []);

  const handleDragEnd = useCallback(
    async (event) => {
      const { active, over } = event;
      setActiveDrag(null);
      if (!active || !over) return;

      const overData = over.data?.current;
      const activeData = active.data?.current;
      if (overData?.type !== "folder") return;

      const targetSystem = overData.systemKey;
      const targetLabel = overData.label;
      const inspectionFull =
        targetSystem === "inspectionReport" && hasInspectionReport;

      if (inspectionFull) {
        showToast({
          kind: "error",
          message: `Can't move into ${targetLabel}: an inspection report already exists.`,
        });
        return;
      }

      if (activeData?.type === "inbox") {
        const card = inboxRef.current.cards.find(
          (c) => c.clientId === activeData.clientId,
        );
        if (!card?.id) {
          showToast({ kind: "error", message: "File is still uploading." });
          return;
        }
        try {
          await inboxRef.current.fileOne(card.clientId, {
            system_key: targetSystem,
            document_type: card.proposed.document_type || "other",
            document_name: card.proposed.document_name || card.name,
            document_date:
              card.proposed.document_date ||
              new Date().toISOString().slice(0, 10),
          });
          await fetchDocuments();
          showToast({
            kind: "success",
            message: `Filed "${card.name}" in ${targetLabel}`,
          });
        } catch (err) {
          if (err?.status === 403 && err?.message?.toLowerCase().includes("limit")) {
            setUpgradePromptMsg(err.message);
            setUpgradePromptOpen(true);
          } else {
            showToast({
              kind: "error",
              message: err?.message || "Failed to file document",
            });
          }
        }
        return;
      }

      if (activeData?.type === "filed") {
        const docId = activeData.documentId;
        const fromSystem = activeData.currentSystemKey;
        if (fromSystem === targetSystem) return;
        const fromDoc = documents.find((d) => d.id === docId);
        try {
          const updated = await AppApi.updatePropertyDocument(docId, {
            system_key: targetSystem,
          });
          setDocuments((prev) =>
            prev.map((d) => (d.id === docId ? { ...d, ...updated } : d)),
          );
          showToast({
            kind: "success",
            message: `Moved to ${targetLabel}`,
            undo: async () => {
              try {
                const reverted = await AppApi.updatePropertyDocument(docId, {
                  system_key: fromSystem,
                });
                setDocuments((prev) =>
                  prev.map((d) => (d.id === docId ? { ...d, ...reverted } : d)),
                );
                showToast({ kind: "success", message: "Move undone" });
              } catch (err) {
                showToast({
                  kind: "error",
                  message: err?.message || "Undo failed",
                });
              }
            },
          });
        } catch (err) {
          if (err?.status === 403 && err?.message?.toLowerCase().includes("limit")) {
            setUpgradePromptMsg(err.message);
            setUpgradePromptOpen(true);
          } else {
            showToast({
              kind: "error",
              message: err?.message || "Move failed",
              data: fromDoc,
            });
          }
        }
        return;
      }
    },
    [documents, fetchDocuments, hasInspectionReport, showToast],
  );

  /* ----- inbox card actions ----- */

  const inboxFileOne = useCallback(
    async (clientId) => {
      const card = inbox.cards.find((c) => c.clientId === clientId);
      if (!card) return;
      try {
        await inbox.fileOne(clientId, {
          system_key: card.proposed.system_key,
          document_type: card.proposed.document_type,
          document_name: card.proposed.document_name,
          document_date: card.proposed.document_date,
        });
        await fetchDocuments();
        showToast({
          kind: "success",
          message: `Filed "${card.name}"`,
        });
      } catch (err) {
        if (err?.status === 403 && err?.message?.toLowerCase().includes("limit")) {
          setUpgradePromptMsg(err.message);
          setUpgradePromptOpen(true);
        } else {
          showToast({ kind: "error", message: err?.message || "Filing failed" });
        }
      }
    },
    [inbox, fetchDocuments, showToast],
  );

  const inboxFileBulk = useCallback(
    async (items) => {
      const res = await inbox.fileBulk(items);
      await fetchDocuments();
      const filedCount = res?.filed?.length ?? items.length;
      showToast({
        kind: "success",
        message: `Filed ${filedCount} document${filedCount === 1 ? "" : "s"}`,
      });
      return res;
    },
    [inbox, fetchDocuments, showToast],
  );

  const inboxRetry = useCallback(
    (clientId) => {
      const card = inbox.cards.find((c) => c.clientId === clientId);
      if (!card?.file) return;
      // simplest retry path: re-add the same file (creates a fresh card)
      inbox.removeStaged(clientId);
      inbox.addFiles([card.file]);
    },
    [inbox],
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

  const selectedFolderObj = selectedFolder
    ? systemsToShow.find((s) => s.id === selectedFolder)
    : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDrag(null)}
    >
      <div className="relative flex h-[calc(100vh-200px)] min-h-[600px] bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
        {inspectionUploadBlockedNotice && (
          <div className="absolute top-2 left-2 right-2 z-[60] flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 px-3 py-2 text-sm text-amber-900 dark:text-amber-100 shadow-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="flex-1 min-w-0">{inspectionUploadBlockedNotice}</p>
            <button
              type="button"
              onClick={() => setInspectionUploadBlockedNotice(null)}
              className="shrink-0 p-0.5 rounded hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-200"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {sidebarOpen && (
          <div
            className="lg:hidden absolute inset-0 bg-gray-900/50 z-40 rounded-lg"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <input
          ref={inboxBrowseRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp,.gif"
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            if (files.length) inbox.addFiles(files);
            e.target.value = "";
          }}
        />

        {/* Left sidebar - tree of folders */}
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
              <DocumentsTreeSkeleton />
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
                selectedFolderId={selectedFolder}
                inboxCount={inbox.cards.length}
                inboxSelected={!selectedFolder && !selectedDocument}
                onSelectInbox={() => {
                  setSelectedFolder(null);
                  setSelectedDocument(null);
                }}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                onSelectDocument={handleDocumentSelect}
                onSelectFolder={(id) => {
                  setSelectedFolder(id);
                  setSelectedDocument(null);
                }}
                onUpload={openDefaultUploadModal}
                onUploadForSystem={openUploadModalWithSystem}
                systemUploadDisabledIds={
                  hasInspectionReport ? ["inspectionReport"] : []
                }
                onCollapse={() => {
                  setSidebarCollapsed(true);
                  setSidebarOpen(false);
                }}
                getFileTypeColor={getFileTypeColor}
              />
            )}
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

          {/* Filters bar */}
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
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={`inline-flex items-center gap-1.5 text-sm rounded-lg border pl-3 pr-3 py-1.5 transition-colors ${
                    dateFrom || dateTo
                      ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200"
                      : "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <CalendarIcon className="w-3.5 h-3.5" />
                  {dateRangeLabel}
                  {(dateFrom || dateTo) && (
                    <X
                      className="w-3.5 h-3.5 ml-1 opacity-70 hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDateFrom("");
                        setDateTo("");
                      }}
                    />
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto p-3 z-[60]"
                align="start"
                sideOffset={6}
              >
                <div className="flex flex-col gap-3 min-w-[260px]">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      From
                    </label>
                    <DatePickerInput
                      name="documentsDateFrom"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="form-input w-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-lg text-sm py-1.5"
                      maxDate={dateTo || undefined}
                      popoverClassName="z-[70]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      To
                    </label>
                    <DatePickerInput
                      name="documentsDateTo"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="form-input w-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-lg text-sm py-1.5"
                      minDate={dateFrom || undefined}
                      popoverClassName="z-[70]"
                    />
                  </div>
                  {dateRangeError && (
                    <span className="text-xs text-red-600 dark:text-red-400">
                      {dateRangeError}
                    </span>
                  )}
                  {(dateFrom || dateTo) && (
                    <button
                      type="button"
                      onClick={() => {
                        setDateFrom("");
                        setDateTo("");
                      }}
                      className="self-end text-xs text-[#456654] dark:text-[#5a7a68] hover:underline font-medium"
                    >
                      Clear range
                    </button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-[#456654] dark:text-[#5a7a68] hover:underline font-medium px-2 py-1"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Body: inbox view OR folder contents OR preview */}
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
                onOpenInNewTab={handleOpenInNewTab}
                onDelete={handleDelete}
                onOpenAIReport={onOpenAIReport}
                getDocumentIcon={getDocumentIcon}
                getFileTypeColor={getFileTypeColor}
                systemCategories={systemCategories}
                documentTypes={documentTypes}
                accountUrl={accountUrl}
                propertyUid={propertyUid ?? propertyData?.property_uid ?? propertyData?.identity?.property_uid}
              />
            ) : selectedFolderObj ? (
              <FolderContentsView
                folder={selectedFolderObj}
                documents={documentsBySystem[selectedFolderObj.id] || []}
                onBack={() => setSelectedFolder(null)}
                onUploadForSystem={openUploadModalWithSystem}
                onSelectDocument={handleDocumentSelect}
                selectedDocumentId={selectedDocument?.id}
                onOpenInNewTab={handleOpenInNewTab}
                onDelete={handleDelete}
                documentTypes={documentTypes}
                getFileTypeColor={getFileTypeColor}
                isUploadDisabled={
                  selectedFolderObj.id === "inspectionReport" &&
                  hasInspectionReport
                }
                uploadDisabledReason="An inspection report already exists for this property"
              />
            ) : (
              <DocumentsInboxView
                cards={inbox.cards}
                loading={inbox.loading}
                onAddFiles={inbox.addFiles}
                onRemove={inbox.removeStaged}
                onRetry={inboxRetry}
                onPatchProposed={inbox.updateProposed}
                onFileOne={inboxFileOne}
                onFileBulk={inboxFileBulk}
                systemsToShow={systemsToShow}
                documentTypes={documentTypes}
                systemUploadDisabledIds={
                  hasInspectionReport ? ["inspectionReport"] : []
                }
              />
            )}
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div
            className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-md min-w-[280px] flex items-center gap-3 px-4 py-2.5 rounded-lg shadow-lg border ${
              toast.kind === "success"
                ? "bg-emerald-600 border-emerald-700 text-white"
                : "bg-red-600 border-red-700 text-white"
            }`}
          >
            {toast.kind === "success" ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span className="text-sm flex-1">{toast.message}</span>
            {toast.undo && (
              <button
                type="button"
                onClick={async () => {
                  const fn = toast.undo;
                  setToast(null);
                  await fn();
                }}
                className="text-sm font-medium underline hover:no-underline flex items-center gap-1"
              >
                <Undo2 className="w-3.5 h-3.5" /> Undo
              </button>
            )}
            <button
              type="button"
              onClick={() => setToast(null)}
              className="p-0.5 rounded hover:bg-white/10"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Drag overlay — centered on the cursor so the preview always sits
            under the pointer regardless of where on the source card the user
            grabbed. */}
        <DragOverlay dropAnimation={null} modifiers={[snapCenterToCursor]}>
          {activeDrag ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-[#456654]/60 rounded-lg shadow-xl text-sm font-medium text-gray-900 dark:text-gray-100 cursor-grabbing select-none pointer-events-none">
              <FileText className="w-4 h-4 text-[#456654] dark:text-[#7a9a88]" />
              {activeDrag.data?.current?.type === "inbox"
                ? inbox.cards.find(
                    (c) => c.clientId === activeDrag.data.current.clientId,
                  )?.name || "Document"
                : "Document"}
            </div>
          ) : null}
        </DragOverlay>

        {/* Upload Modal — kept for the per-folder + button and inspection-report flow */}
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
                  <div
                    ref={uploadSuccessBannerRef}
                    className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="text-emerald-800 dark:text-emerald-200 text-xs">
                      {uploadSuccessCount} file
                      {uploadSuccessCount !== 1 ? "s" : ""} uploaded successfully
                    </span>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Document Name
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
                    Document Date
                  </label>
                  <DatePickerInput
                    name="documentDate"
                    value={uploadDocumentDate}
                    onChange={(e) => setUploadDocumentDate(e.target.value)}
                    popoverClassName="z-[250]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Document Type
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
                    System
                  </label>
                  <select
                    value={uploadSystemKey}
                    onChange={(e) => setUploadSystemKey(e.target.value)}
                    className="form-select w-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                    required
                  >
                    {systemsToShow.map((cat) => (
                      <option
                        key={cat.id}
                        value={cat.id}
                        disabled={
                          hasInspectionReport && cat.id === "inspectionReport"
                        }
                      >
                        {cat.label}
                        {hasInspectionReport && cat.id === "inspectionReport"
                          ? " (already uploaded)"
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    File(s)
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple={uploadSystemKey !== "inspectionReport"}
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.gif"
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setUploadFiles(files);
                      setUploadError(null);
                      if (files.length > 0) {
                        setUploadDocumentName((prev) => {
                          if (prev.trim()) return prev;
                          return defaultDocumentLabelFromFile(files[0]);
                        });
                      }
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
                      PDF, JPG, PNG, GIF, WebP — up to {MAX_DOCUMENT_UPLOAD_LABEL}{" "}
                      each
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

              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3 justify-end">
                {uploadSuccessCount > 0 && !isUploading ? (
                  <>
                    <button
                      onClick={() => {
                        setUploadSuccessCount(0);
                        setUploadDocumentDate(new Date().toISOString().slice(0, 10));
                        setUploadError(null);
                        clearUploadHookError();
                      }}
                      className="btn-sm bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 text-xs"
                    >
                      <Upload className="w-4 h-4" />
                      Add more
                    </button>
                    <button
                      onClick={() => {
                        setShowUploadModal(false);
                        setUploadFiles([]);
                        setUploadDocumentName("");
                        setUploadDocumentDate(new Date().toISOString().slice(0, 10));
                        setUploadError(null);
                        setUploadSuccessCount(0);
                        clearUploadHookError();
                      }}
                      className="btn-sm border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-200 text-xs"
                    >
                      Done
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        if (!isUploading) {
                          setShowUploadModal(false);
                          setUploadFiles([]);
                          setUploadDocumentName("");
                          setUploadDocumentDate(new Date().toISOString().slice(0, 10));
                          setUploadError(null);
                          setUploadSuccessCount(0);
                          clearUploadHookError();
                        }
                      }}
                      disabled={isUploading}
                      className="btn-sm border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-200 disabled:opacity-50 text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        await handleUpload();
                      }}
                      disabled={
                        isUploading ||
                        uploadFiles.length === 0 ||
                        !uploadDocumentName.trim() ||
                        !uploadDocumentDate
                      }
                      className="btn-sm bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 text-xs"
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
                  </>
                )}
              </div>
            </div>
          </div>
        )}
        <UpgradePrompt
          open={upgradePromptOpen}
          onClose={() => setUpgradePromptOpen(false)}
          title="Document limit reached"
          message={
            upgradePromptMsg ||
            "You've reached the document limit for this system. Upgrade your plan for more."
          }
        />

        <ModalBlank
          id="document-delete-confirm-modal"
          modalOpen={deleteConfirmOpen}
          setModalOpen={setDeleteModalOpen}
          backdropZClassName="z-[300]"
          dialogZClassName="z-[300]"
          contentClassName="max-w-lg"
        >
          <div className="p-5 flex space-x-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-gray-100 dark:bg-gray-700">
              <svg
                className="shrink-0 fill-current text-red-500"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                aria-hidden
              >
                <path d="M8 0C3.6 0 0 3.6 0 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm0 12c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1zm1-3H7V4h2v5z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="mb-2">
                <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                  {deleteModalTitle}
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                Are you sure you want to delete this document? This action
                cannot be undone.
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className="btn-sm border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 text-gray-800 dark:text-gray-300"
                  onClick={() => setDeleteModalOpen(false)}
                  disabled={deleteSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-sm bg-red-500 hover:bg-red-600 text-white"
                  onClick={confirmDeleteDocument}
                  disabled={deleteSubmitting}
                >
                  {deleteSubmitting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </ModalBlank>
      </div>
    </DndContext>
  );
}

export default DocumentsTab;
