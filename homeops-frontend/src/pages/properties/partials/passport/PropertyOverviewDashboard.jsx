import React, {useMemo} from "react";
import {
  Sparkles,
  Wrench,
  FileText,
  Image as ImageIcon,
  Settings,
  ClipboardList,
  CheckCircle2,
  ChevronRight,
  Calendar,
  Upload,
  Clock,
} from "lucide-react";
import SectionCard from "./SectionCard";
import EmptyStateCard from "./EmptyStateCard";
import PropertyNotesCard from "./PropertyNotesCard";
import {StatusBadge} from "./StatusBadge";
import OverviewFinancialsPreview from "../financials/OverviewFinancialsPreview";
import aiDocIllustration from "../../../../images/ai-doc.png";
import {
  IDENTITY_SECTIONS,
  isSectionComplete,
} from "../../constants/identitySections";
import {
  PROPERTY_SYSTEMS,
  DEFAULT_SYSTEM_IDS,
} from "../../constants/propertySystems";
import {countCompletedSystemsWithCustom} from "../../constants/systemSections";
import {isCompletedMaintenanceRecord} from "../../helpers/maintenanceRecordMapping";
import {getCompletedChecklistItemIds} from "../../helpers/inspectionAnalysisHelpers";

function formatMonthDay(value) {
  if (!value) return {month: "", day: ""};
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return {month: "", day: ""};
  return {
    month: d.toLocaleDateString("en-US", {month: "short"}).toUpperCase(),
    day: String(d.getDate()),
  };
}

function formatDocDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatUploadedLabel(doc) {
  const date = formatDocDate(
    doc.updated_at ?? doc.updatedAt ?? doc.document_date ?? doc.documentDate,
  );
  const size = formatFileSize(doc.file_size ?? doc.fileSize ?? doc.size);
  if (date && size) return `Uploaded ${date} · ${size}`;
  if (date) return `Uploaded ${date}`;
  return null;
}

function daysUntil(value) {
  if (!value) return null;
  const target = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function systemDisplayName(systemKey) {
  const match = PROPERTY_SYSTEMS.find((s) => s.id === systemKey);
  if (match) return match.name;
  const customMatch = String(systemKey ?? "").match(/^custom-(.+?)(-\d+)?$/);
  if (customMatch) return customMatch[1];
  return String(systemKey ?? "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isUpcomingMaintenanceEvent(event, maintenanceRecords, todayIso) {
  const eventType = event.event_type ?? event.eventType;
  const eventSystem = event.system_key ?? event.systemKey;
  if (
    eventType === "homeAnniversary" ||
    eventSystem === "homeAnniversary" ||
    eventType === "other" ||
    eventSystem === "other"
  ) {
    return false;
  }

  const date = event.scheduled_date ?? event.scheduledDate;
  if (!date || String(date).slice(0, 10) < todayIso) return false;

  const status = String(event.status ?? "scheduled").toLowerCase();
  if (!["scheduled", "confirmed"].includes(status)) return false;

  const checklistItemId = event.checklist_item_id ?? event.checklistItemId;
  if (checklistItemId != null) {
    const completedChecklistIds =
      getCompletedChecklistItemIds(maintenanceRecords);
    if (completedChecklistIds.has(Number(checklistItemId))) return false;
  }

  const eventDate = String(date).slice(0, 10);
  if (eventSystem) {
    const fulfilledByRecord = (maintenanceRecords ?? []).some((record) => {
      if (!isCompletedMaintenanceRecord(record)) return false;
      const recordSystem =
        record.systemId ?? record.system_key ?? record.systemKey;
      const recordDate = String(record.date ?? "").slice(0, 10);
      return (
        String(recordSystem) === String(eventSystem) && recordDate === eventDate
      );
    });
    if (fulfilledByRecord) return false;
  }

  return true;
}

function formatRecurrence(source, event = {}) {
  const type = event.recurrence_type ?? event.recurrenceType;
  if (type === "quarterly") return "Every 3 months";
  if (type === "semi-annually") return "Every 6 months";
  if (type === "annually") return "Every year";
  if (type === "one-time") return "One-time";
  if (type === "custom") {
    const val =
      event.recurrence_interval_value ?? event.recurrenceIntervalValue;
    const unit = event.recurrence_interval_unit ?? event.recurrenceIntervalUnit;
    if (val && unit) return `Every ${val} ${unit}`;
  }
  if (source === "Record") return "Suggested schedule";
  return null;
}

function getDocumentExtension(doc) {
  const mime = String(doc.mime_type ?? doc.mimeType ?? "").toLowerCase();
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) {
    const sub = mime.split("/")[1];
    if (sub === "jpeg") return "jpg";
    return sub;
  }
  const ref = (
    doc.document_key ??
    doc.documentKey ??
    doc.document_name ??
    doc.name ??
    ""
  ).toLowerCase();
  const match = ref.match(/\.([a-z0-9]+)$/);
  return match ? match[1] : null;
}

function formatFileSize(bytes) {
  if (bytes == null || Number.isNaN(Number(bytes))) return null;
  const n = Number(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function FileGlyph({tone = "neutral", variant = "doc", className}) {
  const fill =
    tone === "red" ? "#ef4444" : tone === "emerald" ? "#10b981" : "#94a3b8";
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <path
        d="M8 3h10.5L25 9.5V26a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z"
        fill={fill}
      />
      <path
        d="M18.5 3L25 9.5h-4.5A2 2 0 0 1 18.5 7.5V3Z"
        fill="#fff"
        fillOpacity="0.4"
      />
      {variant === "image" ? (
        <>
          <circle cx="12" cy="15" r="1.8" fill="#fff" />
          <path
            d="M9 23l3.5-4 2.5 2.8L18 18l3 5H9Z"
            fill="#fff"
            fillOpacity="0.92"
          />
        </>
      ) : (
        <>
          <rect
            x="9"
            y="15"
            width="12"
            height="1.9"
            rx="0.95"
            fill="#fff"
            fillOpacity="0.92"
          />
          <rect
            x="9"
            y="19"
            width="12"
            height="1.9"
            rx="0.95"
            fill="#fff"
            fillOpacity="0.92"
          />
          <rect
            x="9"
            y="23"
            width="8"
            height="1.9"
            rx="0.95"
            fill="#fff"
            fillOpacity="0.92"
          />
        </>
      )}
    </svg>
  );
}

function DocumentTypeIcon({doc}) {
  const ext = getDocumentExtension(doc)?.toLowerCase() ?? "";
  const isPdf = ext === "pdf";
  const isImage = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);

  const tone = isPdf ? "red" : isImage ? "emerald" : "neutral";
  const variant = isImage ? "image" : "doc";
  const bgClass = isPdf
    ? "bg-red-50 dark:bg-red-500/10"
    : isImage
      ? "bg-emerald-50 dark:bg-emerald-500/10"
      : "bg-neutral-100 dark:bg-neutral-800";

  return (
    <div
      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${bgClass}`}
    >
      <FileGlyph tone={tone} variant={variant} className="w-5 h-5" />
    </div>
  );
}

function countInspectionDetails(analysis) {
  if (!analysis) return null;
  const systems = analysis.systems_detected ?? analysis.systemsDetected ?? [];
  const needs = analysis.needs_attention ?? analysis.needsAttention ?? [];
  const maintenance =
    analysis.maintenance_suggestions ?? analysis.maintenanceSuggestions ?? [];
  const total = systems.length + needs.length + maintenance.length;
  return total > 0 ? total : null;
}

function isInspectionReport(doc) {
  const sys = (doc.system_key ?? doc.system ?? "").toLowerCase();
  const type = (doc.document_type ?? doc.type ?? "").toLowerCase();
  return (
    sys === "inspectionreport" ||
    sys === "inspection_report" ||
    type === "inspection"
  );
}

/**
 * Default Overview tab for the Property Passport workspace.
 */
function PropertyOverviewDashboard({
  propertyData = {},
  maintenanceRecords = [],
  maintenanceEvents = [],
  propertyDocuments = [],
  photosCount = 0,
  inspectionAnalysis = null,
  scoreCardSlot,
  teamSlot,
  notes = [],
  notesLoading = false,
  notesSaving = false,
  currentUserId = null,
  readOnly = false,
  onNavigateTab,
  onCompleteOutstandingTasks,
  onOpenInspectionAnalysis,
  onUploadInspectionReport,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
}) {
  const todayIso = new Date().toISOString().slice(0, 10);

  const completedIdentitySections = useMemo(
    () =>
      IDENTITY_SECTIONS.filter((s) => isSectionComplete(propertyData, s))
        .length,
    [propertyData],
  );

  const visibleSystemIds =
    (propertyData.selectedSystemIds?.length ?? 0) > 0
      ? propertyData.selectedSystemIds
      : DEFAULT_SYSTEM_IDS;
  const customSystemNames = propertyData.customSystemNames ?? [];
  const totalSystems =
    PROPERTY_SYSTEMS.filter((s) => visibleSystemIds.includes(s.id)).length +
    customSystemNames.length;
  const completedSystems = useMemo(
    () =>
      countCompletedSystemsWithCustom(
        propertyData,
        visibleSystemIds,
        customSystemNames,
      ),
    [propertyData, visibleSystemIds, customSystemNames],
  );

  const nextSteps = useMemo(() => {
    const steps = [];
    if (completedIdentitySections < IDENTITY_SECTIONS.length) {
      steps.push({
        id: "identity",
        icon: ClipboardList,
        title: "Complete property identity",
        description: `${completedIdentitySections} of ${IDENTITY_SECTIONS.length} identity sections complete`,
        actionLabel: "Complete",
        tab: "identity",
      });
    }
    if (completedSystems < totalSystems) {
      steps.push({
        id: "systems",
        icon: Settings,
        title: "Complete systems inventory",
        description: `${completedSystems} of ${totalSystems} home systems documented`,
        actionLabel: "Add Systems",
        tab: "systems",
      });
    }
    if ((maintenanceRecords?.length ?? 0) === 0) {
      steps.push({
        id: "maintenance",
        icon: Wrench,
        title: "Add maintenance records",
        description: "Track service history to build your passport score",
        actionLabel: "Add Records",
        tab: "maintenance",
      });
    }
    steps.push({
      id: "documents",
      icon: FileText,
      title: "Upload property documents",
      description: "Keep warranties, manuals, and reports in one place",
      actionLabel: "Upload",
      tab: "documents",
    });
    if (photosCount === 0) {
      steps.push({
        id: "media",
        icon: ImageIcon,
        title: "Add property photos",
        description: "Visual records help increase your passport score",
        actionLabel: "Add Photos",
        tab: "media",
      });
    }
    return steps.slice(0, 4);
  }, [
    completedIdentitySections,
    completedSystems,
    totalSystems,
    maintenanceRecords,
    photosCount,
  ]);

  const upcomingItems = useMemo(() => {
    const fromRecords = (maintenanceRecords ?? [])
      .filter(
        (r) =>
          r.nextServiceDate &&
          String(r.nextServiceDate).slice(0, 10) >= todayIso,
      )
      .map((r) => ({
        key: `record-${r.id ?? r.systemId}-${r.nextServiceDate}`,
        date: String(r.nextServiceDate).slice(0, 10),
        label: r.description || systemDisplayName(r.systemId ?? r.system_key),
        frequency: formatRecurrence("Record", r),
        badge: "Suggested",
        badgeTone: "amber",
      }));
    const fromEvents = (maintenanceEvents ?? [])
      .filter((e) =>
        isUpcomingMaintenanceEvent(e, maintenanceRecords, todayIso),
      )
      .map((e, i) => ({
        key: `event-${e.id ?? i}`,
        date: String(e.scheduled_date ?? e.scheduledDate).slice(0, 10),
        label:
          e.checklist_item_title ??
          e.title ??
          e.system_name ??
          systemDisplayName(e.system_key ?? e.systemKey),
        frequency: formatRecurrence("Scheduled", e),
        badge:
          e.event_type === "inspection" || e.eventType === "inspection"
            ? "Recommended"
            : "Scheduled",
        badgeTone: "brand",
      }));
    return [...fromRecords, ...fromEvents]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 3);
  }, [maintenanceRecords, maintenanceEvents, todayIso]);

  const recentDocuments = useMemo(() => {
    return [...(propertyDocuments ?? [])]
      .sort((a, b) => {
        const aTs = new Date(a.updated_at ?? a.updatedAt ?? a.created_at ?? 0);
        const bTs = new Date(b.updated_at ?? b.updatedAt ?? b.created_at ?? 0);
        return bTs - aTs;
      })
      .slice(0, 3);
  }, [propertyDocuments]);

  const extractedDetailCount = countInspectionDetails(inspectionAnalysis);
  const hasInspectionAnalysis = Boolean(inspectionAnalysis);
  const hasUploadedInspectionReport = useMemo(
    () => (propertyDocuments ?? []).some(isInspectionReport),
    [propertyDocuments],
  );

  const linkedRecords = [
    {
      id: "systems",
      icon: Settings,
      label: "Systems",
      detail: `${totalSystems} system${totalSystems === 1 ? "" : "s"} selected`,
      tab: "systems",
    },
    {
      id: "maintenance",
      icon: Wrench,
      label: "Maintenance",
      detail: `${maintenanceRecords?.length ?? 0} record${(maintenanceRecords?.length ?? 0) === 1 ? "" : "s"}`,
      tab: "maintenance",
    },
    {
      id: "documents",
      icon: FileText,
      label: "Documents",
      detail: "View all documents",
      tab: "documents",
    },
    {
      id: "media",
      icon: ImageIcon,
      label: "Media",
      detail: `${photosCount} photo${photosCount === 1 ? "" : "s"}`,
      tab: "media",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3">
        <div className="contents lg:block lg:space-y-4 lg:min-w-0">
          <SectionCard
            flat
            title="Smart Records & AI Extraction"
            icon={Sparkles}
            iconClassName="text-[#456564] dark:text-[#7fa3a1]"
            className="order-1 lg:order-none"
          >
            <div className="flex items-start justify-between gap-1.5">
              <div className="min-w-0 flex-1 space-y-3">
                {hasInspectionAnalysis ? (
                  <>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-[#456564] dark:text-[#7fa3a1] shrink-0" />
                        <p className="text-sm font-bold text-[#456564] dark:text-[#7fa3a1]">
                          You're all set!
                        </p>
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                        {extractedDetailCount != null
                          ? `We've extracted ${extractedDetailCount} details from your inspection report.`
                          : "Your inspection report has been analyzed."}{" "}
                        Review and confirm to keep your passport accurate.
                      </p>
                    </div>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => onOpenInspectionAnalysis?.()}
                        className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border border-neutral-200 dark:border-neutral-700 text-[#456564] dark:text-[#7fa3a1] hover:border-[#456564]/50 hover:bg-[#456564]/5 transition-colors"
                      >
                        Review Extracted Data
                      </button>
                    )}
                  </>
                ) : hasUploadedInspectionReport ? (
                  <>
                    <p className="text-sm font-semibold text-[#456564] dark:text-[#7fa3a1]">
                      Inspection report ready
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Run Passport Opsymization to extract condition ratings,
                      system findings, and maintenance recommendations from
                      your report.
                    </p>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => onOpenInspectionAnalysis?.()}
                        className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border border-neutral-200 dark:border-neutral-700 text-[#456564] dark:text-[#7fa3a1] hover:border-[#456564]/50 hover:bg-[#456564]/5 transition-colors"
                      >
                        Run Passport Opsymization
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-[#456564] dark:text-[#7fa3a1]">
                      No inspection report yet
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {readOnly
                        ? "No inspection report has been uploaded yet."
                        : "Upload an inspection report to run Passport Opsymization and extract property details automatically."}
                    </p>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() =>
                          onUploadInspectionReport?.() ??
                          onNavigateTab?.("documents")
                        }
                        className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border border-neutral-200 dark:border-neutral-700 text-[#456564] dark:text-[#7fa3a1] hover:border-[#456564]/50 hover:bg-[#456564]/5 transition-colors"
                      >
                        Upload Inspection Report
                      </button>
                    )}
                  </>
                )}
              </div>
              <div className="w-[76px] sm:w-[84px] shrink-0 self-start">
                <img
                  src={aiDocIllustration}
                  alt=""
                  aria-hidden
                  className="w-full h-auto object-contain pointer-events-none select-none"
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            flat
            title="Upcoming Maintenance"
            icon={Calendar}
            className="order-4 lg:order-none"
            action={
              readOnly ? null : (
                <button
                  type="button"
                  onClick={() => onNavigateTab?.("maintenance")}
                  className="text-xs font-semibold text-[#456564] dark:text-[#7fa3a1] hover:underline"
                >
                  View Calendar
                </button>
              )
            }
          >
            {upcomingItems.length > 0 ? (
              <>
                <ul>
                  {upcomingItems.map((item, index) => {
                    const {month, day} = formatMonthDay(item.date);
                    const days = daysUntil(item.date);
                    const rowClassName = `w-full flex items-center gap-3.5 text-left ${
                      index === 0 ? "pt-0 pb-2" : "py-2"
                    }`;
                    const rowContent = (
                      <>
                        <div className="flex flex-col items-center justify-center w-12 h-12 rounded-lg bg-white dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60 shadow-sm shrink-0">
                          <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase leading-none tracking-wide">
                            {month}
                          </span>
                          <span className="text-lg font-bold text-neutral-900 dark:text-white leading-none mt-1">
                            {day}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                            {item.label}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {item.frequency && (
                              <span className="inline-flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
                                <Clock
                                  className="w-3.5 h-3.5 shrink-0"
                                  aria-hidden
                                />
                                {item.frequency}
                              </span>
                            )}
                            <StatusBadge
                              tone={item.badgeTone}
                              className="!rounded uppercase tracking-wide !text-[10px] font-bold !px-2 !py-0.5"
                            >
                              {item.badge}
                            </StatusBadge>
                          </div>
                        </div>
                        {days != null && (
                          <span
                            className={`shrink-0 inline-flex items-center gap-0.5 text-xs font-semibold ${
                              readOnly ? "" : "group-hover:underline"
                            } ${
                              days <= 7
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-[#456564] dark:text-[#7fa3a1]"
                            }`}
                          >
                            {days === 0
                              ? "Today"
                              : `In ${days} day${days === 1 ? "" : "s"}`}
                            {!readOnly && (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </span>
                        )}
                      </>
                    );
                    return (
                      <li
                        key={item.key}
                        className={
                          index > 0
                            ? "border-t border-neutral-100 dark:border-neutral-800"
                            : undefined
                        }
                      >
                        {readOnly ? (
                          <div className={rowClassName}>{rowContent}</div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onNavigateTab?.("maintenance")}
                            className={`${rowClassName} group`}
                          >
                            {rowContent}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab?.("maintenance")}
                    className="mt-4 w-full inline-flex items-center justify-center gap-1 px-3 py-2.5 rounded-lg text-sm font-semibold border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-[#456564]/50 hover:text-[#456564] dark:hover:text-[#7fa3a1] transition-colors"
                  >
                    View All Maintenance
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </>
            ) : (
              <EmptyStateCard
                icon={Calendar}
                title="No upcoming maintenance"
                description="Schedule services or add next-service dates to maintenance records to see them here."
                actionLabel={readOnly ? undefined : "Open Maintenance"}
                onAction={readOnly ? undefined : () => onNavigateTab?.("maintenance")}
              />
            )}
          </SectionCard>
        </div>

        <div className="contents lg:block lg:space-y-4 lg:min-w-0">
          {scoreCardSlot && (
            <SectionCard
              flat
              title="Passport Completion"
              icon={CheckCircle2}
              data-section-id="health-status"
              className="order-3 lg:order-none"
            >
              {scoreCardSlot}
            </SectionCard>
          )}

          <SectionCard
            flat
            title="Recent Documents"
            icon={FileText}
            className="order-5 lg:order-none"
            action={
              readOnly ? null : (
                <button
                  type="button"
                  onClick={() => onNavigateTab?.("documents")}
                  className="text-xs font-semibold text-[#456564] dark:text-[#7fa3a1] hover:underline"
                >
                  View All
                </button>
              )
            }
          >
            {recentDocuments.length > 0 ? (
              <>
                <ul>
                  {recentDocuments.map((doc, index) => {
                    const uploadedLabel = formatUploadedLabel(doc);
                    const rowClassName = `w-full flex items-center gap-3 text-left ${
                      index === 0 ? "pt-0 pb-2" : "py-2"
                    }`;
                    const rowContent = (
                      <>
                        <DocumentTypeIcon doc={doc} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">
                            {doc.document_name ?? doc.name}
                          </p>
                          {uploadedLabel && (
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                              {uploadedLabel}
                            </p>
                          )}
                        </div>
                        {!readOnly && (
                          <ChevronRight className="w-4 h-4 text-neutral-300 dark:text-neutral-600 group-hover:text-[#456564] dark:group-hover:text-[#7fa3a1] shrink-0 transition-colors" />
                        )}
                      </>
                    );
                    return (
                      <li
                        key={doc.id}
                        className={
                          index > 0
                            ? "border-t border-neutral-100 dark:border-neutral-800"
                            : undefined
                        }
                      >
                        {readOnly ? (
                          <div className={rowClassName}>{rowContent}</div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onNavigateTab?.("documents")}
                            className={`${rowClassName} group`}
                          >
                            {rowContent}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab?.("documents")}
                    className="mt-3 w-full inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-[#456564]/50 hover:text-[#456564] dark:hover:text-[#7fa3a1] transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Open Documents
                  </button>
                )}
              </>
            ) : (
              <EmptyStateCard
                icon={FileText}
                title="Browse your documents"
                description="Uploads, inbox items, and filed documents live in the Documents tab."
                actionLabel={readOnly ? undefined : "Open Documents"}
                onAction={readOnly ? undefined : () => onNavigateTab?.("documents")}
              />
            )}
          </SectionCard>
        </div>

        <div className="contents lg:block lg:space-y-4 lg:min-w-0">
          <div className="order-2 lg:order-none">{teamSlot}</div>

          {!readOnly && (
            <div className="order-6 lg:order-none">
              <PropertyNotesCard
                notes={notes}
                loading={notesLoading}
                saving={notesSaving}
                currentUserId={currentUserId}
                onAddNote={onAddNote}
                onUpdateNote={onUpdateNote}
                onDeleteNote={onDeleteNote}
              />
            </div>
          )}
        </div>
      </div>

      <OverviewFinancialsPreview />

      {!readOnly && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard
          flat
          title="Recommended Next Steps"
          description="Improve your passport by completing these tasks"
          icon={Sparkles}
          className="lg:col-span-2"
        >
          {nextSteps.length > 0 ? (
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {nextSteps.map((step) => (
                <li
                  key={step.id}
                  className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                    <step.icon className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">
                      {step.title}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                      {step.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      step.id === "identity" || step.id === "systems"
                        ? onCompleteOutstandingTasks?.()
                        : onNavigateTab?.(step.tab)
                    }
                    className="shrink-0 inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-[#456564]/50 hover:text-[#456564] dark:hover:text-[#7fa3a1] transition-colors"
                  >
                    {step.actionLabel}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-2 py-2 text-sm text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              You're all set! Every passport section is complete.
            </div>
          )}
        </SectionCard>

        <SectionCard flat title="Linked Records" icon={ClipboardList}>
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {linkedRecords.map((rec) => (
              <li key={rec.id}>
                <button
                  type="button"
                  onClick={() => onNavigateTab?.(rec.tab)}
                  className="w-full flex items-center gap-3 py-2 first:pt-0 last:pb-0 text-left group"
                >
                  <rec.icon className="w-4 h-4 text-neutral-400 dark:text-neutral-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                      {rec.label}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                      {rec.detail}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-300 dark:text-neutral-600 group-hover:text-[#456564] dark:group-hover:text-[#7fa3a1] shrink-0 transition-colors" />
                </button>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
      )}
    </div>
  );
}

export default PropertyOverviewDashboard;
