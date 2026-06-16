import React, { useMemo } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  History,
  Sparkles,
  Wrench,
} from "lucide-react";
import SectionCard from "../passport/SectionCard";
import { formatOverviewDate } from "../passport/SystemsOverviewPanel";
import EmptyStateCard from "../passport/EmptyStateCard";
import { StatusBadge } from "../passport/StatusBadge";
import {
  getMaintenanceRecordTitle,
  isCompletedMaintenanceRecord,
} from "../../helpers/maintenanceRecordMapping";

const TYPE_CONFIG = {
  completed: {
    label: "Completed",
    tone: "emerald",
    dot: "bg-emerald-500 ring-emerald-500/20",
    card: "border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-50/30 dark:bg-emerald-950/10",
    Icon: CheckCircle2,
  },
  scheduled: {
    label: "Scheduled",
    tone: "brand",
    dot: "bg-[#456564] ring-[#456564]/20 dark:bg-[#7fa3a1] dark:ring-[#7fa3a1]/20",
    card: "border-[#456564]/20 dark:border-[#5a7a78]/40 bg-[#456564]/5 dark:bg-[#5a7a78]/10",
    Icon: CalendarClock,
  },
  recommended: {
    label: "Recommended",
    tone: "amber",
    dot: "bg-amber-500 ring-amber-500/20",
    card: "border-amber-200/60 dark:border-amber-800/40 bg-amber-50/40 dark:bg-amber-950/10",
    Icon: Sparkles,
  },
};

function matchesSystemId(item, systemId) {
  return (
    String(item?.systemId ?? item?.system_key ?? item?.systemKey ?? "") ===
    String(systemId)
  );
}

function readField(item, ...keys) {
  for (const key of keys) {
    const value = item?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return null;
}

function normalizeDate(value) {
  if (!value) return null;
  const str = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(str) ? str : null;
}

function isInspectionRecord(record) {
  return (
    /inspection/i.test(String(record?.recordType ?? "")) ||
    /inspection/i.test(String(record?.description ?? ""))
  );
}

function getEventTitle(event) {
  const checklistTitle = readField(
    event,
    "checklist_item_title",
    "checklistItemTitle",
  );
  if (checklistTitle) return checklistTitle;

  const rawType = String(
    readField(event, "event_type", "eventType") ?? "",
  ).toLowerCase();
  if (rawType === "inspection") return "Inspection";
  if (rawType === "maintenance") return "Maintenance";

  return readField(event, "title", "system_name", "systemName") ?? "Service";
}

function isUpcomingRecord(record, today) {
  if (isCompletedMaintenanceRecord(record)) return false;
  const status = String(record?.status ?? "")
    .trim()
    .toLowerCase();
  if (
    ["scheduled", "confirmed", "in progress", "pending contractor"].includes(
      status,
    )
  ) {
    return true;
  }
  const nextDue = normalizeDate(record?.nextServiceDate);
  if (nextDue) return true;
  const serviceDate = normalizeDate(record?.date);
  return Boolean(serviceDate && serviceDate >= today);
}

function buildTimelineEntries({
  systemId,
  systemLabel,
  maintenanceRecords,
  maintenanceEvents,
  recommendations,
}) {
  const today = new Date().toISOString().slice(0, 10);
  const entries = [];
  const seen = new Set();

  const addEntry = (entry) => {
    const key = `${entry.type}|${entry.title}|${entry.date ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push(entry);
  };

  for (const record of maintenanceRecords.filter((r) =>
    matchesSystemId(r, systemId),
  )) {
    if (!isCompletedMaintenanceRecord(record)) continue;
    const date = normalizeDate(
      record.serviceDate ?? record.service_date ?? record.date ?? record.completedAt,
    );
    addEntry({
      id: `completed-${record.id ?? `${date}-${record.description}`}`,
      type: "completed",
      title: getMaintenanceRecordTitle(record, systemLabel),
      date,
      dateLabel: date ? formatOverviewDate(date) : null,
      subtitle: record.notes || null,
      record,
      isInspection: isInspectionRecord(record),
    });
  }

  for (const event of maintenanceEvents.filter((e) =>
    matchesSystemId(e, systemId),
  )) {
    const status = String(readField(event, "status") ?? "")
      .trim()
      .toLowerCase();
    if (!["scheduled", "confirmed"].includes(status)) continue;
    const date = normalizeDate(
      readField(event, "scheduled_date", "scheduledDate"),
    );
    addEntry({
      id: `event-${event.id ?? `${date}-${getEventTitle(event)}`}`,
      type: "scheduled",
      title: getEventTitle(event),
      date,
      dateLabel: date ? formatOverviewDate(date) : "Date TBD",
      subtitle:
        readField(event, "contractor_name", "contractorName") ||
        readField(event, "message_body", "messageBody", "notes") ||
        null,
      isInspection:
        String(readField(event, "event_type", "eventType") ?? "").toLowerCase() ===
        "inspection",
    });
  }

  // Completed records can carry a future next-service date (same source as the
  // overview "Upcoming service" card) without being an open/upcoming record.
  for (const record of maintenanceRecords.filter((r) =>
    matchesSystemId(r, systemId),
  )) {
    if (!isCompletedMaintenanceRecord(record)) continue;
    const date = normalizeDate(record.nextServiceDate ?? record.next_service_date);
    if (!date) continue;
    addEntry({
      id: `next-service-${record.id ?? `${date}-upcoming`}`,
      type: "scheduled",
      title: "Upcoming service",
      date,
      dateLabel: formatOverviewDate(date),
      subtitle: record.contractor || record.notes || null,
      isInspection: isInspectionRecord(record),
    });
  }

  for (const record of maintenanceRecords.filter((r) =>
    matchesSystemId(r, systemId),
  )) {
    if (!isUpcomingRecord(record, today)) continue;
    const date = normalizeDate(record.nextServiceDate ?? record.date);
    addEntry({
      id: `upcoming-${record.id ?? `${date}-${record.description}`}`,
      type: "scheduled",
      title: getMaintenanceRecordTitle(record, systemLabel),
      date,
      dateLabel: date ? formatOverviewDate(date) : "Date TBD",
      subtitle: record.contractor || record.notes || null,
      isInspection: isInspectionRecord(record),
    });
  }

  for (const [index, rec] of (recommendations ?? []).entries()) {
    const title =
      rec.task || rec.rationale || rec.title || "Maintenance suggestion";
    const when =
      rec.suggestedWhen ??
      rec.suggested_when ??
      rec.suggested_schedule_window ??
      null;
    addEntry({
      id: `recommended-${index}-${title}`,
      type: "recommended",
      title,
      date: null,
      dateLabel: when ? `Suggested: ${when}` : "When convenient",
      subtitle: rec.rationale && rec.rationale !== title ? rec.rationale : null,
      isInspection: false,
    });
  }

  const dated = entries.filter((e) => e.date);
  const undated = entries.filter((e) => !e.date);

  dated.sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const past = dated.filter((e) => e.date < today);
  const future = dated.filter((e) => e.date >= today);

  return { past, today, future, undated, hasAny: entries.length > 0 };
}

function TimelineLegend() {
  return (
    <div className="flex flex-wrap gap-3 mb-5 pb-4 border-b border-neutral-100 dark:border-neutral-800">
      {Object.entries(TYPE_CONFIG).map(([type, config]) => (
        <div key={type} className="flex items-center gap-1.5">
          <span
            className={`w-2.5 h-2.5 rounded-full ring-4 ${config.dot}`}
            aria-hidden
          />
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {config.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function TodayMarker() {
  return (
    <div className="relative flex items-center gap-3 py-2 my-1">
      <span className="w-6 flex justify-center shrink-0">
        <span className="w-2.5 h-2.5 rounded-full bg-neutral-400 dark:bg-neutral-500 ring-4 ring-neutral-200 dark:ring-neutral-700" />
      </span>
      <span className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400 dark:text-neutral-500 shrink-0">
        Today
      </span>
      <span className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
    </div>
  );
}

function TimelineItem({ entry, isLast, onOpenRecord }) {
  const config = TYPE_CONFIG[entry.type];
  const TypeIcon = config.Icon;
  const DetailIcon = entry.isInspection ? ClipboardCheck : Wrench;
  const openable =
    entry.type === "completed" && entry.record?.id != null && !!onOpenRecord;

  const handleClick = openable ? () => onOpenRecord(entry.record) : undefined;

  return (
    <div className="relative flex gap-4 pb-6 last:pb-0">
      {!isLast && (
        <div
          className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-neutral-200 dark:bg-neutral-700"
          aria-hidden
        />
      )}

      <div className="relative z-10 shrink-0 pt-1">
        <span
          className={`block w-6 h-6 rounded-full ring-4 ${config.dot}`}
          aria-hidden
        />
      </div>

      <div className="min-w-0 flex-1 -mt-0.5">
        <p className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 mb-1.5">
          {entry.dateLabel}
        </p>
        <div
          role={openable ? "button" : undefined}
          tabIndex={openable ? 0 : undefined}
          onClick={handleClick}
          onKeyDown={
            openable
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenRecord(entry.record);
                  }
                }
              : undefined
          }
          className={`rounded-xl border px-4 py-3 transition-colors ${config.card} ${
            openable
              ? "cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-700"
              : ""
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-lg bg-white/80 dark:bg-neutral-900/80 border border-neutral-200/60 dark:border-neutral-700/50 flex items-center justify-center shrink-0">
              <DetailIcon className="w-4 h-4 text-[#456564] dark:text-[#7fa3a1]" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <StatusBadge tone={config.tone}>
                  <TypeIcon className="w-3 h-3" />
                  {config.label}
                </StatusBadge>
              </div>
              <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                {entry.title}
              </p>
              {entry.subtitle && (
                <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 line-clamp-3">
                  {entry.subtitle}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SystemHistoryTab({
  systemId,
  systemLabel = "System",
  maintenanceRecords = [],
  maintenanceEvents = [],
  recommendations = [],
  onOpenRecord,
}) {
  const timeline = useMemo(
    () =>
      buildTimelineEntries({
        systemId,
        systemLabel,
        maintenanceRecords,
        maintenanceEvents,
        recommendations,
      }),
    [
      systemId,
      systemLabel,
      maintenanceRecords,
      maintenanceEvents,
      recommendations,
    ],
  );

  const orderedEntries = useMemo(() => {
    const items = [...timeline.past];
    const showTodayMarker =
      timeline.past.length > 0 &&
      (timeline.future.length > 0 || timeline.undated.length > 0);
    if (showTodayMarker) {
      items.push({ id: "__today__", type: "marker" });
    }
    items.push(...timeline.future, ...timeline.undated);
    return items;
  }, [timeline]);

  if (!timeline.hasAny) {
    return (
      <EmptyStateCard
        title="No maintenance history"
        description="Completed service, scheduled visits, and recommended maintenance for this system will appear here."
        icon={History}
      />
    );
  }

  return (
    <SectionCard flat title="System Timeline" icon={History}>
      <TimelineLegend />
      <div className="relative">
        {orderedEntries.map((entry, index) =>
          entry.type === "marker" ? (
            <TodayMarker key={entry.id} />
          ) : (
            <TimelineItem
              key={entry.id}
              entry={entry}
              isLast={index === orderedEntries.length - 1}
              onOpenRecord={onOpenRecord}
            />
          ),
        )}
      </div>
    </SectionCard>
  );
}
