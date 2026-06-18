import React, {useEffect, useMemo, useRef, useState} from "react";
import {
  ChevronRight,
  Pencil,
  Upload,
  Share2,
  Trash2,
  ExternalLink,
  FileText,
  CheckCircle2,
  Calendar,
  CalendarClock,
  DollarSign,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  User,
  Phone,
  Mail,
  Clock,
  ClipboardList,
  ListTodo,
  Wrench,
  Loader2,
  Search,
} from "lucide-react";
import SectionCard from "../passport/SectionCard";
import {StatusBadge} from "../passport/StatusBadge";
import {
  RECORD_STATUS,
  getMaintenanceRecordTitle,
  resolveMaintenanceRecordSource,
} from "../../helpers/maintenanceRecordMapping";
import AppApi from "../../../../api/api";
import {
  openPropertyDocumentInNewTab,
  resolvePropertyDocumentIdFromLinkedFile,
} from "../../helpers/propertyDocumentNavigation";

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCost(value) {
  if (value == null || value === "") return "—";
  const num = Number(String(value).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}

function formatFileSize(bytes) {
  if (!bytes) return "";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
}

function getStatusTone(status) {
  switch (String(status ?? "").trim()) {
    case "Completed":
      return "emerald";
    case "Scheduled":
      return "brand";
    case "In Progress":
    case "Pending Contractor":
      return "amber";
    case "Cancelled":
      return "neutral";
    default:
      return "neutral";
  }
}

function getChecklistStatusTone(status) {
  switch (String(status ?? "").toLowerCase()) {
    case "completed":
      return "emerald";
    case "in_progress":
      return "amber";
    case "deferred":
      return "neutral";
    case "not_applicable":
      return "neutral";
    default:
      return "brand";
  }
}

function formatChecklistStatus(status) {
  switch (String(status ?? "").toLowerCase()) {
    case "in_progress":
      return "In Progress";
    case "not_applicable":
      return "N/A";
    default:
      return status
        ? String(status).charAt(0).toUpperCase() + String(status).slice(1)
        : "Pending";
  }
}

/** Split a free-text field into list items (one per line, strips bullets). */
function splitLines(text) {
  return String(text ?? "")
    .split(/\n+/)
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
}

function parseFindings(record) {
  return splitLines(record?.findings);
}

/** Inline info item for the record header summary row. */
function RecordInfoItem({icon: Icon, label, value}) {
  return (
    <div className="flex items-start gap-2.5 min-w-0 min-[1351px]:min-w-[8.5rem] min-[1351px]:flex-1 min-[1351px]:px-4 min-[1351px]:first:pl-0 min-[1351px]:last:pr-0">
      <Icon className="w-4 h-4 text-neutral-400 dark:text-neutral-500 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {label}
        </p>
        <p className="text-sm font-semibold text-neutral-900 dark:text-white max-[1350px]:break-words min-[1351px]:truncate">
          {value ?? "—"}
        </p>
      </div>
    </div>
  );
}
/** Small icon action button used in the record header. */
function HeaderActionButton({
  icon: Icon,
  label,
  onClick,
  danger,
  title,
  iconOnly = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? label}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
        danger
          ? "border-red-200 dark:border-red-800 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
          : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {!iconOnly && label}
    </button>
  );
}

/**
 * Read-only maintenance record page — matches the post-submit detail mockup.
 */
function MaintenanceRecordReadView({
  record,
  propertyId,
  propertyUid,
  accountUrl,
  systemName,
  systemCondition,
  successMessage,
  onBack,
  onEdit,
  onDelete,
  onOpenInNewTab,
  onDismissSuccess,
  onAttachFiles,
}) {
  const fileInputRef = useRef(null);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [openingDocumentKey, setOpeningDocumentKey] = useState(null);
  const [linkedTask, setLinkedTask] = useState(null);
  const [linkedTaskLoading, setLinkedTaskLoading] = useState(false);

  const checklistItemId = record?.checklist_item_id;

  useEffect(() => {
    if (!propertyId || checklistItemId == null || checklistItemId === "") {
      setLinkedTask(null);
      setLinkedTaskLoading(false);
      return;
    }

    let cancelled = false;
    setLinkedTaskLoading(true);

    AppApi.getInspectionChecklist(propertyId)
      .then((items) => {
        if (cancelled) return;
        const match = (items ?? []).find(
          (item) => String(item.id) === String(checklistItemId),
        );
        setLinkedTask(match ?? null);
      })
      .catch(() => {
        if (!cancelled) setLinkedTask(null);
      })
      .finally(() => {
        if (!cancelled) setLinkedTaskLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [propertyId, checklistItemId]);

  const title = getMaintenanceRecordTitle(record, systemName);

  const findings = useMemo(() => parseFindings(record), [record]);
  const nextSteps = useMemo(
    () => splitLines(record?.nextStepsRecommendation),
    [record],
  );
  const files = Array.isArray(record?.files) ? record.files : [];
  const source = resolveMaintenanceRecordSource(record);
  const isCompleted = String(record?.status ?? "") === "Completed";

  const recordType = String(record?.recordType ?? "").trim() || "—";

  const summaryItems = useMemo(
    () => [
      {icon: Calendar, label: "Service Date", value: formatDate(record?.date)},
      {icon: Wrench, label: "System", value: systemName},
      {icon: ClipboardList, label: "Type", value: recordType},
      {icon: User, label: "Contractor", value: record?.contractor || "—"},
      {icon: DollarSign, label: "Cost", value: formatCost(record?.cost)},
      {
        icon: CalendarClock,
        label: "Next Service Date",
        value: formatDate(record?.nextServiceDate),
      },
      {icon: FileText, label: "Source", value: source},
    ],
    [record, systemName, source, recordType],
  );

  const timeline = useMemo(() => {
    const events = [];
    if (record?.date) {
      events.push({
        label:
          record.status === "Scheduled"
            ? "Inspection scheduled"
            : "Service performed",
        date: record.date,
      });
    }
    events.push({
      label: "Record created",
      date: record?.date ?? new Date().toISOString(),
    });
    return events;
  }, [record]);

  const handleUploadClick = () => {
    setUploadError("");
    fileInputRef.current?.click();
  };

  const handleFilesSelected = async (e) => {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (selected.length === 0 || !onAttachFiles) return;
    setUploadingDocs(true);
    setUploadError("");
    try {
      const uploaded = [];
      for (const file of selected) {
        const doc = await AppApi.uploadDocument(file);
        const key = doc?.key ?? doc?.s3Key ?? null;
        if (key) {
          uploaded.push({
            name: file.name,
            size: file.size,
            type: file.type,
            key,
          });
        }
      }
      if (uploaded.length > 0) {
        onAttachFiles(uploaded);
      }
    } catch (err) {
      setUploadError(
        Array.isArray(err) ? err.join(", ") : err?.message || "Upload failed.",
      );
    } finally {
      setUploadingDocs(false);
    }
  };

  const handleOpenLinkedDocument = async (file) => {
    const key = file?.key ?? file?.document_key;
    if (!key) return;

    const canOpenInDocumentsTab = accountUrl && propertyUid && propertyId;
    if (!canOpenInDocumentsTab) {
      try {
        const url = await AppApi.getPresignedPreviewUrl(key);
        if (url) window.open(url, "_blank", "noopener,noreferrer");
      } catch {
        // Presign failed; nothing actionable for the user here
      }
      return;
    }

    setOpeningDocumentKey(key);
    try {
      const docs = await AppApi.getPropertyDocuments(propertyId);
      const propertyDocuments = Array.isArray(docs) ? docs : [];
      const documentId = resolvePropertyDocumentIdFromLinkedFile(
        file,
        propertyDocuments,
        record?.id,
      );
      if (
        documentId &&
        openPropertyDocumentInNewTab({
          accountUrl,
          propertyId: propertyUid,
          documentId,
        })
      ) {
        return;
      }

      const url = await AppApi.getPresignedPreviewUrl(key);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      // Lookup or presign failed; nothing actionable for the user here
    } finally {
      setOpeningDocumentKey(null);
    }
  };

  return (
    <div className="space-y-4">
      {successMessage && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-2 text-sm text-emerald-800 dark:text-emerald-200">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {successMessage}
          </div>
          {onDismissSuccess && (
            <button
              type="button"
              onClick={onDismissSuccess}
              className="text-xs text-emerald-600 hover:underline"
            >
              Dismiss
            </button>
          )}
        </div>
      )}

      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400"
      >
        <button
          type="button"
          onClick={onBack}
          className="font-medium hover:text-[#456564] dark:hover:text-[#7fa3a1] transition-colors"
        >
          Maintenance
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-neutral-300 dark:text-neutral-600 shrink-0" />
        <span className="font-medium text-gray-800 dark:text-neutral-200 truncate">
          {title}
        </span>
      </nav>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_17rem] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          {/* Header card */}
          <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/50 bg-white dark:bg-neutral-900 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">
                  {title}
                </h1>
                {record?.status && (
                  <StatusBadge tone={getStatusTone(record.status)}>
                    {record.status}
                  </StatusBadge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {onEdit && (
                  <HeaderActionButton
                    icon={Pencil}
                    label="Edit Record"
                    onClick={onEdit}
                  />
                )}
                {onAttachFiles && (
                  <HeaderActionButton
                    icon={uploadingDocs ? Loader2 : Upload}
                    label={uploadingDocs ? "Uploading…" : "Upload Document"}
                    onClick={handleUploadClick}
                  />
                )}
                <HeaderActionButton
                  icon={Share2}
                  label="Share"
                  title="Coming soon"
                />
                {onOpenInNewTab && (
                  <HeaderActionButton
                    icon={ExternalLink}
                    label="Open"
                    title="Open in new tab"
                    onClick={onOpenInNewTab}
                    iconOnly
                  />
                )}
                {onDelete && (
                  <HeaderActionButton
                    icon={Trash2}
                    label="Delete"
                    title="Delete record"
                    danger
                    onClick={() => onDelete(record.id)}
                  />
                )}
              </div>
            </div>

            {/* Summary info row — grid below 1350px so labels stay readable */}
            <div className="mt-5 pt-5 border-t border-neutral-100 dark:border-neutral-800 max-[1350px]:grid max-[1350px]:grid-cols-2 max-[1350px]:sm:grid-cols-3 max-[1350px]:gap-x-6 max-[1350px]:gap-y-4 min-[1351px]:flex min-[1351px]:items-stretch min-[1351px]:overflow-x-auto">
              {summaryItems.map((item, index) => (
                <React.Fragment key={item.label}>
                  {index > 0 && (
                    <div
                      className="w-px bg-neutral-100 dark:bg-neutral-800 shrink-0 self-stretch max-[1350px]:hidden"
                      aria-hidden
                    />
                  )}
                  <RecordInfoItem {...item} />
                </React.Fragment>
              ))}
            </div>

            {uploadError && (
              <p className="mt-3 text-xs text-red-600 dark:text-red-400">
                {uploadError}
              </p>
            )}
          </div>

          {/* Content grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SectionCard flat title="Work Performed" icon={Wrench}>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {record?.notes?.trim() ? (
                  record.notes
                ) : (
                  <span className="text-gray-400 italic">
                    No work description yet. Edit the record or wait for the
                    contractor report.
                  </span>
                )}
              </p>
            </SectionCard>

            <SectionCard flat title="Findings" icon={Search}>
              {findings.length > 0 ? (
                <ul className="space-y-2">
                  {findings.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400 italic">
                  {isCompleted
                    ? "No findings recorded for this service."
                    : "Findings will appear here once the service is completed."}
                </p>
              )}
            </SectionCard>

            <SectionCard flat title="Recommended Next Steps" icon={ListTodo}>
              {nextSteps.length > 0 ? (
                <ul className="space-y-1.5 list-disc list-inside text-sm text-gray-700 dark:text-gray-300">
                  {nextSteps.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400 italic">
                  No recommendations yet. Add them when editing the record.
                </p>
              )}
            </SectionCard>

            <SectionCard
              flat
              title="Linked Documents"
              icon={ClipboardList}
              action={
                onAttachFiles && (
                  <button
                    type="button"
                    onClick={handleUploadClick}
                    disabled={uploadingDocs}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#456564] hover:underline disabled:opacity-50"
                  >
                    {uploadingDocs ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Upload className="w-3 h-3" />
                    )}
                    Add
                  </button>
                )
              }
            >
              {files.length > 0 ? (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {files.map((file, idx) => {
                    const key = file?.key ?? file?.document_key;
                    return (
                      <li key={`${file.name}-${idx}`}>
                        <button
                          type="button"
                          onClick={() => handleOpenLinkedDocument(file)}
                          disabled={!key}
                          title="Open in Documents tab"
                          className="w-full flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0 text-left group disabled:cursor-default"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-4 h-4 text-[#456564] shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate group-hover:text-[#456564]">
                                {file.name}
                              </p>
                              {file.size ? (
                                <p className="text-xs text-gray-400">
                                  {formatFileSize(file.size)}
                                </p>
                              ) : null}
                            </div>
                          </div>
                          {key &&
                            (openingDocumentKey === key ? (
                              <Loader2 className="w-4 h-4 text-gray-400 shrink-0 animate-spin" />
                            ) : (
                              <ExternalLink className="w-4 h-4 text-gray-400 shrink-0 group-hover:text-[#456564]" />
                            ))}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-gray-400 italic">
                  No documents linked. Uploaded files are filed in the Documents
                  tab and analyzed by AI.
                </p>
              )}
            </SectionCard>

            {record?.contractor && (
              <SectionCard flat title="Contractor Details" icon={User}>
                <div className="space-y-2 text-sm">
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {record.contractor}
                  </p>
                  {record.contractorPhone && (
                    <p className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Phone className="w-3.5 h-3.5" />
                      {record.contractorPhone}
                    </p>
                  )}
                  {record.contractorEmail && (
                    <p className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Mail className="w-3.5 h-3.5" />
                      {record.contractorEmail}
                    </p>
                  )}
                </div>
              </SectionCard>
            )}

            <SectionCard flat title="Activity Timeline" icon={Clock}>
              <ul className="space-y-3">
                {timeline.map((event, idx) => (
                  <li key={idx} className="flex gap-3">
                    <span className="w-2 h-2 rounded-full bg-[#456564] mt-1.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {event.label}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(event.date)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4 min-w-0">
          <SectionCard flat>
            <p className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
              Next Due
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {formatDate(record?.nextServiceDate)}
            </p>
            <button
              type="button"
              className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <Calendar className="w-3.5 h-3.5" />
              Add to Calendar
            </button>
          </SectionCard>

          <SectionCard flat title="Related System">
            <p className="text-xs font-semibold text-gray-900 dark:text-white">
              {systemName}
            </p>
            {systemCondition && (
              <StatusBadge tone="emerald" className="mt-2">
                {systemCondition}
              </StatusBadge>
            )}
          </SectionCard>

          <SectionCard flat title="Linked Tasks" icon={ListTodo}>
            {linkedTaskLoading ? (
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading linked task…
              </div>
            ) : linkedTask ? (
              <div className="rounded-lg border border-gray-100 dark:border-gray-700/60 bg-gray-50/60 dark:bg-gray-800/40 px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-white leading-snug">
                    {linkedTask.title}
                  </p>
                  <StatusBadge tone={getChecklistStatusTone(linkedTask.status)}>
                    {formatChecklistStatus(linkedTask.status)}
                  </StatusBadge>
                </div>
                {linkedTask.description && (
                  <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    {linkedTask.description}
                  </p>
                )}
                {linkedTask.source === "user_created" && (
                  <StatusBadge tone="neutral" className="mt-2">
                    My ToDo
                  </StatusBadge>
                )}
              </div>
            ) : checklistItemId ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Linked task could not be loaded.
              </p>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                No tasks linked to this record yet.
              </p>
            )}
          </SectionCard>

          <SectionCard
            flat
            title="AI Summary"
            badge={
              <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                Beta
              </span>
            }
            icon={Sparkles}
          >
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              {record?.description
                ? `This ${systemName.toLowerCase()} record documents "${title}". ${
                    record.status === "Scheduled"
                      ? "Service is scheduled and pending completion."
                      : "Review findings and next steps for ongoing maintenance planning."
                  }`
                : "An AI summary will appear once more record details are available."}
            </p>
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-600"
                aria-label="Helpful"
              >
                <ThumbsUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-600"
                aria-label="Not helpful"
              >
                <ThumbsDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </SectionCard>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png"
        className="sr-only"
        onChange={handleFilesSelected}
      />
    </div>
  );
}

export default MaintenanceRecordReadView;
