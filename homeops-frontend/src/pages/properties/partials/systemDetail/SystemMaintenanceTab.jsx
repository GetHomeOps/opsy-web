import React, {useCallback, useMemo} from "react";
import {useNavigate, useParams} from "react-router-dom";
import {
  AlertCircle,
  Calendar,
  CalendarClock,
  ClipboardCheck,
  Clock,
  ChevronRight,
  DollarSign,
  Eye,
  History,
  MapPin,
  Paperclip,
  Repeat,
  Upload,
  User,
  Wrench,
} from "lucide-react";
import SectionCard from "../passport/SectionCard";
import {formatOverviewDate} from "../passport/SystemsOverviewPanel";
import EmptyStateCard from "../passport/EmptyStateCard";
import {StatusBadge} from "../passport/StatusBadge";
import {getMaintenanceRecordTitle} from "../../helpers/maintenanceRecordMapping";

/* ─────────────────────────── Field readers ─────────────────────────── */

function readEventField(event, ...keys) {
  for (const key of keys) {
    const value = event?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return null;
}

function getEventType(event) {
  const raw = String(readEventField(event, "event_type", "eventType") ?? "")
    .trim()
    .toLowerCase();
  if (raw === "inspection") return "inspection";
  if (raw === "maintenance") return "maintenance";
  return null;
}

function getEventTypeLabel(eventType) {
  if (eventType === "inspection") return "Inspection";
  if (eventType === "maintenance") return "Maintenance";
  return "Service";
}

function getEventTypeTone(eventType) {
  if (eventType === "inspection") return "brand";
  if (eventType === "maintenance") return "amber";
  return "neutral";
}

function getEventTitle(event) {
  const checklistTitle = readEventField(
    event,
    "checklist_item_title",
    "checklistItemTitle",
  );
  if (checklistTitle) return checklistTitle;

  const eventType = getEventType(event);
  if (eventType) return getEventTypeLabel(eventType);

  return (
    readEventField(event, "title", "system_name", "systemName") ?? "Service"
  );
}

function formatEventTime(timeStr) {
  if (!timeStr) return null;
  const [h, m] = String(timeStr).split(":");
  const hour = parseInt(h, 10);
  if (Number.isNaN(hour)) return String(timeStr);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${(m ?? "00").slice(0, 2)} ${ampm}`;
}

function formatRecurrence(event) {
  const type = readEventField(event, "recurrence_type", "recurrenceType");
  if (!type || type === "one-time") return null;
  if (type === "quarterly") return "Every 3 months";
  if (type === "semi-annually") return "Every 6 months";
  if (type === "annually") return "Every year";
  if (type === "custom") {
    const val = readEventField(
      event,
      "recurrence_interval_value",
      "recurrenceIntervalValue",
    );
    const unit = readEventField(
      event,
      "recurrence_interval_unit",
      "recurrenceIntervalUnit",
    );
    if (val && unit) return `Every ${val} ${unit}`;
    return "Custom schedule";
  }
  return null;
}

/* ─────────────────────────── Record helpers ─────────────────────────── */

function isCompletedRecord(record) {
  const status = String(record?.status ?? "")
    .trim()
    .toLowerCase();
  const recordStatusValue = String(record?.record_status ?? "")
    .trim()
    .toLowerCase();
  return (
    status === "completed" ||
    recordStatusValue === "user_completed" ||
    recordStatusValue === "contractor_completed"
  );
}

function isUpcomingRecord(record, today) {
  if (isCompletedRecord(record)) return false;
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
  const nextDue = record?.nextServiceDate
    ? String(record.nextServiceDate).slice(0, 10)
    : null;
  if (nextDue) return true;
  const serviceDate = record?.date ? String(record.date).slice(0, 10) : null;
  return Boolean(serviceDate && serviceDate >= today);
}

function isInspectionRecord(record) {
  return (
    /inspection/i.test(String(record?.recordType ?? "")) ||
    /inspection/i.test(String(record?.description ?? ""))
  );
}

function recordStatusBadge(record, today) {
  if (isCompletedRecord(record)) return {label: "Completed", tone: "emerald"};
  const nextDue = record?.nextServiceDate
    ? String(record.nextServiceDate).slice(0, 10)
    : null;
  if (nextDue && nextDue < today) return {label: "Overdue", tone: "red"};
  const status = String(record?.status ?? "")
    .trim()
    .toLowerCase();
  if (status === "scheduled" || status === "confirmed")
    return {label: "Scheduled", tone: "brand"};
  if (status === "in progress") return {label: "In Progress", tone: "amber"};
  if (status === "pending contractor") return {label: "Pending", tone: "amber"};
  if (status === "cancelled") return {label: "Cancelled", tone: "neutral"};
  return {label: record?.status || "—", tone: "neutral"};
}

function maintenanceRecordToEvent(record) {
  const recordType = String(record?.recordType ?? "").trim();
  const description = String(record?.description ?? "").trim();
  const title = recordType || description || "Service";
  const isInspection = isInspectionRecord(record);
  const completed = isCompletedRecord(record);
  const displayDate = completed
    ? record?.date
      ? String(record.date).slice(0, 10)
      : null
    : record?.nextServiceDate
      ? String(record.nextServiceDate).slice(0, 10)
      : record?.date
        ? String(record.date).slice(0, 10)
        : null;

  return {
    id: `record-${record?.id ?? title}`,
    event_type: isInspection ? "inspection" : "maintenance",
    status: String(record?.status ?? "scheduled")
      .trim()
      .toLowerCase(),
    scheduled_date: displayDate,
    checklist_item_title: title,
    contractor_name: record?.contractor ?? null,
    message_body: record?.notes ?? null,
    cost: record?.cost ?? null,
  };
}

function matchesSystemId(item, systemId) {
  return (
    String(item?.systemId ?? item?.system_key ?? item?.systemKey ?? "") ===
    String(systemId)
  );
}

/* ─────────────────────────── Formatters ─────────────────────────── */

function parseCost(value) {
  if (value == null || value === "") return null;
  const num = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(num) ? num : null;
}

function formatCurrency(num) {
  if (num == null || !Number.isFinite(num)) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(num);
}

function formatRecordAmount(value) {
  const num = parseCost(value);
  if (num == null || num === 0) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function getRecordTypeLabel(record) {
  if (isInspectionRecord(record)) return "Inspection";
  const recordType = String(record?.recordType ?? "").trim();
  if (recordType) return recordType;
  return "Service";
}

function getRecordDisplayDate(record) {
  if (isCompletedRecord(record)) {
    return record?.date
      ? (formatOverviewDate(record.date) ?? String(record.date).slice(0, 10))
      : "—";
  }
  const upcoming = record?.nextServiceDate ?? record?.date;
  return upcoming
    ? (formatOverviewDate(upcoming) ?? String(upcoming).slice(0, 10))
    : "—";
}

function daysBetween(fromStr, toStr) {
  const a = new Date(`${String(fromStr).slice(0, 10)}T00:00:00`);
  const b = new Date(`${String(toStr).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b - a) / 86400000);
}

function relativeFuture(dateStr, today) {
  const d = daysBetween(today, dateStr);
  if (d == null) return null;
  if (d === 0) return "Today";
  if (d < 0) return `${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"} overdue`;
  if (d < 31) return `in ${d} day${d === 1 ? "" : "s"}`;
  const months = Math.round(d / 30);
  return `in ${months} month${months === 1 ? "" : "s"}`;
}

function relativePast(dateStr, today) {
  const d = daysBetween(dateStr, today);
  if (d == null) return null;
  if (d <= 0) return "Today";
  if (d < 31) return `${d} day${d === 1 ? "" : "s"} ago`;
  const months = Math.round(d / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.round(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

function shortMonthYear(dateStr) {
  const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(dateStr).slice(0, 10);
  return d.toLocaleDateString("en-US", {month: "short", year: "numeric"});
}

function monthYearKey(dateStr) {
  const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Collapse dates to unique month/year labels, preserving chronological order. */
function uniqueMonthYearNodes(dates, {max = 3, takeFrom = "end"} = {}) {
  const sorted = [...dates].filter(Boolean).sort();
  const iter = takeFrom === "end" ? [...sorted].reverse() : sorted;
  const seen = new Set();
  const nodes = [];

  for (const date of iter) {
    const key = monthYearKey(date);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    nodes.push({key, label: shortMonthYear(date)});
    if (nodes.length >= max) break;
  }

  return takeFrom === "end" ? nodes.reverse() : nodes;
}

function buildInspectionTimelineNodes(
  records,
  upcomingEvents,
  today,
  {nextServiceDate} = {},
) {
  const inspectionDates = records
    .filter((record) => isCompletedRecord(record) && isInspectionRecord(record))
    .map((record) => (record.date ? String(record.date).slice(0, 10) : null))
    .filter(Boolean);

  const scheduledDates = [
    ...upcomingEvents.map(
      (event) => event.scheduled_date ?? event.scheduledDate,
    ),
    ...records
      .filter((record) => isUpcomingRecord(record, today))
      .flatMap((record) =>
        [record.nextServiceDate, record.date].filter(Boolean),
      ),
    ...records
      .filter(isCompletedRecord)
      .map((record) => record.nextServiceDate)
      .filter(Boolean),
    ...(nextServiceDate ? [nextServiceDate] : []),
  ]
    .filter(Boolean)
    .map((value) => String(value).slice(0, 10))
    .filter((value) => value >= today);

  const pastNodes = uniqueMonthYearNodes(inspectionDates, {
    max: 3,
    takeFrom: "end",
  }).map((node) => ({...node, done: true}));

  const pastKeys = new Set(pastNodes.map((node) => node.key));
  const futureNodes = uniqueMonthYearNodes(scheduledDates, {
    max: 3,
    takeFrom: "start",
  })
    .filter((node) => !pastKeys.has(node.key))
    .map((node) => ({...node, done: false}));

  return [...pastNodes, ...futureNodes].map(({key, label, done}) => ({
    key,
    label,
    done,
  }));
}

/* ─────────────────────────── Presentational pieces ─────────────────────────── */

function SummaryStat({icon: Icon, label, value, sub, subTone, onClick}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`flex items-start gap-3 rounded-xl border border-neutral-200/80 dark:border-neutral-700/50 bg-white dark:bg-neutral-900 px-4 py-3 text-left w-full ${
        onClick
          ? "hover:border-[#456564]/40 dark:hover:border-[#5a7a78]/60 transition-colors"
          : ""
      }`}
    >
      <span className="w-9 h-9 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-[#456564] dark:text-[#7fa3a1]" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.07em] truncate">
          {label}
        </p>
        <p className="text-base font-bold text-neutral-900 dark:text-white truncate">
          {value ?? "—"}
        </p>
        {sub && (
          <p
            className={`text-xs mt-0.5 truncate ${
              subTone === "red"
                ? "text-red-500 dark:text-red-400"
                : subTone === "brand"
                  ? "text-[#456564] dark:text-[#7fa3a1]"
                  : "text-neutral-400 dark:text-neutral-500"
            }`}
          >
            {sub}
          </p>
        )}
      </div>
    </Wrapper>
  );
}

function RecordsTimeline({nodes}) {
  if (!nodes || nodes.length < 2) return null;
  return (
    <div className="flex mb-4 px-1">
      {nodes.map((node, i) => (
        <React.Fragment key={node.key ?? `${node.label}-${i}`}>
          <div className="flex flex-col items-center shrink-0">
            <span
              className={`w-3 h-3 rounded-full border-2 ${
                node.done
                  ? "bg-emerald-500 border-emerald-500"
                  : "bg-white dark:bg-neutral-900 border-[#456564] dark:border-[#7fa3a1]"
              }`}
            />
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1 whitespace-nowrap">
              {node.label}
            </span>
          </div>
          {i < nodes.length - 1 && (
            <div className="flex-1 flex items-center self-start h-3 mx-1">
              <span
                className={`w-full h-0.5 ${
                  nodes[i + 1].done
                    ? "bg-emerald-400"
                    : "bg-neutral-200 dark:bg-neutral-700"
                }`}
              />
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function RecordField({label, children, className = ""}) {
  return (
    <div className={`flex flex-col min-w-0 ${className}`}>
      <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.06em] mb-0.5">
        {label}
      </span>
      <span className="text-sm text-neutral-800 dark:text-neutral-200 truncate">
        {children ?? "—"}
      </span>
    </div>
  );
}

function MaintenanceRecordRow({record, systemLabel, today, onOpen}) {
  const status = recordStatusBadge(record, today);
  const isInspection = isInspectionRecord(record);
  const Icon = isInspection ? ClipboardCheck : Wrench;
  const title = getMaintenanceRecordTitle(record, systemLabel);
  const amount = formatRecordAmount(record?.cost);
  const docs = Array.isArray(record?.files) ? record.files.length : 0;
  const dateLabel = getRecordDisplayDate(record);
  const typeLabel = getRecordTypeLabel(record);
  const vendor = String(record?.contractor ?? "").trim() || "—";

  const openable = record?.id != null && !!onOpen;
  const handleClick = openable ? () => onOpen(record) : undefined;

  return (
    <div
      role={openable ? "button" : undefined}
      tabIndex={openable ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={
        openable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen(record);
              }
            }
          : undefined
      }
      className={`group flex items-center gap-3 md:gap-4 rounded-xl border border-neutral-200/80 dark:border-neutral-700/50 bg-white dark:bg-neutral-900 px-3 py-3 md:px-4 md:py-3.5 transition-colors ${
        openable
          ? "cursor-pointer hover:border-neutral-300 dark:hover:border-neutral-600 hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40"
          : ""
      }`}
    >
      {/* Name block */}
      <div className="flex items-center gap-3 min-w-0 w-[12rem] lg:w-[13rem] shrink-0">
        <span className="w-10 h-10 rounded-lg border border-neutral-200/80 dark:border-neutral-700/50 bg-neutral-50 dark:bg-neutral-800 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-[#456564] dark:text-[#7fa3a1]" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
            {title}
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
            {systemLabel}
          </p>
        </div>
      </div>

      {/* Status badge column */}
      <div className="hidden sm:flex w-[6.5rem] shrink-0 justify-start">
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
      </div>

      {/* Data points spread across the remaining width */}
      <div className="hidden md:flex items-center justify-between flex-1 min-w-0 gap-4">
        <RecordField label="Date" className="flex-1">
          {dateLabel}
        </RecordField>
        <RecordField label="Vendor" className="flex-1">
          {vendor}
        </RecordField>
        <RecordField label="Amount" className="flex-1">
          {amount ?? "—"}
        </RecordField>
        <RecordField label="Type" className="flex-1">
          {typeLabel}
        </RecordField>
        <RecordField label="Attachments" className="flex-1">
          {docs > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Paperclip className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 shrink-0" />
              {docs}
            </span>
          ) : (
            "—"
          )}
        </RecordField>
      </div>

      {/* Mobile compact summary */}
      <div className="md:hidden flex flex-col items-end gap-0.5 ml-auto shrink-0 text-right">
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        <span className="text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap mt-1">
          {dateLabel}
        </span>
      </div>

      {openable ? (
        <ChevronRight className="w-4 h-4 text-neutral-300 dark:text-neutral-600 group-hover:text-neutral-400 dark:group-hover:text-neutral-500 shrink-0 transition-colors" />
      ) : (
        <span className="w-4 shrink-0" aria-hidden="true" />
      )}
    </div>
  );
}

function formatTimeWindow(event) {
  const start = readEventField(event, "scheduled_time", "scheduledTime");
  const end = readEventField(
    event,
    "scheduled_end_time",
    "scheduledEndTime",
    "end_time",
    "endTime",
  );
  const startFmt = formatEventTime(start);
  const endFmt = formatEventTime(end);
  if (startFmt && endFmt) return `${startFmt} – ${endFmt}`;
  return startFmt;
}

function formatEstCost(event) {
  const min = parseCost(
    readEventField(event, "estimated_cost_min", "estimatedCostMin"),
  );
  const max = parseCost(
    readEventField(event, "estimated_cost_max", "estimatedCostMax"),
  );
  const single = parseCost(
    readEventField(event, "estimated_cost", "estimatedCost", "cost"),
  );
  if (min != null && max != null) {
    return `${formatRecordAmount(min)} – ${formatRecordAmount(max)}`;
  }
  if (single != null) return formatRecordAmount(single);
  return null;
}

function ScheduledMetaField({icon: Icon, label, value}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <p className="text-sm font-semibold text-neutral-900 dark:text-white mt-1 truncate">
        {value || "—"}
      </p>
    </div>
  );
}

function NextScheduledCard({
  event,
  systemLabel,
  onReschedule,
  onAddReport,
  onViewDetails,
}) {
  const eventType = getEventType(event);
  const TypeIcon = eventType === "inspection" ? ClipboardCheck : Wrench;
  const title = getEventTitle(event);
  const contractor = readEventField(event, "contractor_name", "contractorName");
  const date = readEventField(event, "scheduled_date", "scheduledDate");
  const recurrence = formatRecurrence(event);
  const notes = readEventField(event, "message_body", "messageBody", "notes");
  const statusRaw = String(readEventField(event, "status") ?? "scheduled")
    .trim()
    .toLowerCase();
  const statusLabel = statusRaw === "confirmed" ? "Confirmed" : "Scheduled";
  const formattedDate = date ? (formatOverviewDate(date) ?? date) : null;
  const timeWindow = formatTimeWindow(event);
  const estCost = formatEstCost(event);

  return (
    <SectionCard flat title="Next Scheduled Maintenance" icon={CalendarClock}>
      <div className="rounded-2xl border border-sky-200/70 dark:border-sky-800/40 bg-sky-50/40 dark:bg-sky-950/15 p-4 md:p-5">
        <div className="flex items-start gap-4">
          <span className="w-14 h-14 rounded-2xl bg-white dark:bg-neutral-900 border border-sky-200/70 dark:border-sky-800/50 shadow-sm flex items-center justify-center shrink-0">
            <TypeIcon className="w-7 h-7 text-[#456564] dark:text-[#7fa3a1]" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {eventType && (
                <StatusBadge tone="emerald">
                  <TypeIcon className="w-3 h-3" />
                  {getEventTypeLabel(eventType)}
                </StatusBadge>
              )}
              <StatusBadge tone="brand">{statusLabel}</StatusBadge>
              {recurrence && (
                <StatusBadge tone="neutral">
                  <Repeat className="w-3 h-3" />
                  {recurrence}
                </StatusBadge>
              )}
            </div>
            <h3 className="text-lg md:text-xl font-bold text-neutral-900 dark:text-white mt-2 break-words">
              {title}
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-4 mt-5 pt-5 border-t border-sky-200/50 dark:border-sky-800/30">
          <ScheduledMetaField
            icon={User}
            label="Provider"
            value={contractor || "No professional assigned"}
          />
          <ScheduledMetaField
            icon={Calendar}
            label="Date"
            value={formattedDate || "Not set"}
          />
          <ScheduledMetaField
            icon={Clock}
            label="Time Window"
            value={timeWindow}
          />
          <ScheduledMetaField
            icon={MapPin}
            label="Location / System"
            value={systemLabel}
          />
          <ScheduledMetaField
            icon={DollarSign}
            label="Est. Cost"
            value={estCost}
          />
        </div>

        {notes && (
          <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-4 leading-relaxed whitespace-pre-line line-clamp-3">
            {notes}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={() => onReschedule?.(event)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:border-[#456564]/50 hover:text-[#456564] dark:hover:text-[#7fa3a1] transition-colors"
          >
            <Calendar className="w-4 h-4" />
            Reschedule
          </button>
          {onViewDetails && (
            <button
              type="button"
              onClick={() => onViewDetails?.(event)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:border-[#456564]/50 hover:text-[#456564] dark:hover:text-[#7fa3a1] transition-colors"
            >
              <Eye className="w-4 h-4" />
              View Details
            </button>
          )}
          {onAddReport && (
            <button
              type="button"
              onClick={() => onAddReport?.(event)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold btn-primary transition-colors"
            >
              <Upload className="w-4 h-4" />
              Add Report
            </button>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

function UpcomingRow({event}) {
  const eventType = getEventType(event);
  const Icon = eventType === "inspection" ? ClipboardCheck : Wrench;
  const date = readEventField(event, "scheduled_date", "scheduledDate");
  const time = formatEventTime(
    readEventField(event, "scheduled_time", "scheduledTime"),
  );
  const contractor = readEventField(event, "contractor_name", "contractorName");
  const formattedDate = date ? (formatOverviewDate(date) ?? date) : "No date";

  return (
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <span className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-[#456564] dark:text-[#7fa3a1]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
          {getEventTitle(event)}
        </p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
          {[formattedDate, time].filter(Boolean).join(" · ")}
          {contractor ? ` · ${contractor}` : ""}
        </p>
      </div>
      {eventType && (
        <StatusBadge tone={getEventTypeTone(eventType)}>
          {getEventTypeLabel(eventType)}
        </StatusBadge>
      )}
    </div>
  );
}

/* ─────────────────────────── Main tab ─────────────────────────── */

export function SystemMaintenanceTab({
  systemId,
  systemLabel,
  maintenanceEvents = [],
  maintenanceRecords = [],
  actionItemCount = 0,
  onSchedule,
  onReschedule,
  onAddReport,
  onViewDetails,
  onViewAllRecords,
  onViewActionItems,
  onOpenRecord,
}) {
  const navigate = useNavigate();
  const {accountUrl, uid} = useParams();

  const handleOpenRecord = useCallback(
    (record) => {
      if (onOpenRecord) {
        onOpenRecord(record);
        return;
      }
      const recordSystemId = record?.systemId ?? record?.system_key ?? systemId;
      if (!accountUrl || !uid || !recordSystemId || record?.id == null) return;
      navigate(
        `/${accountUrl}/properties/${uid}/maintenance/${encodeURIComponent(
          recordSystemId,
        )}/${encodeURIComponent(record.id)}`,
      );
    },
    [onOpenRecord, navigate, accountUrl, uid, systemId],
  );

  const summary = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    const events = maintenanceEvents.filter((event) =>
      matchesSystemId(event, systemId),
    );
    const records = maintenanceRecords.filter((record) =>
      matchesSystemId(record, systemId),
    );

    const upcomingEvents = events
      .filter((event) =>
        ["scheduled", "confirmed"].includes(
          String(event.status ?? "").toLowerCase(),
        ),
      )
      .sort((a, b) =>
        String(a.scheduled_date ?? a.scheduledDate ?? "").localeCompare(
          String(b.scheduled_date ?? b.scheduledDate ?? ""),
        ),
      );

    // Highlight the soonest scheduled event; fall back to an upcoming record.
    let highlight = upcomingEvents[0] ?? null;
    if (!highlight) {
      const upcomingRecord = records
        .filter((record) => isUpcomingRecord(record, today))
        .sort((a, b) =>
          String(a.nextServiceDate ?? a.date ?? "").localeCompare(
            String(b.nextServiceDate ?? b.date ?? ""),
          ),
        )[0];
      if (upcomingRecord) highlight = maintenanceRecordToEvent(upcomingRecord);
    }
    const otherUpcoming = upcomingEvents.filter((event) => event !== highlight);

    const completedDates = records
      .filter(isCompletedRecord)
      .map((record) => (record.date ? String(record.date).slice(0, 10) : null))
      .filter(Boolean)
      .sort();
    const lastServiceDate = completedDates[completedDates.length - 1] ?? null;

    const dueCandidates = [
      ...upcomingEvents.map(
        (event) => event.scheduled_date ?? event.scheduledDate,
      ),
      ...records
        .filter((record) => !isCompletedRecord(record))
        .flatMap((record) =>
          [record.nextServiceDate, record.date].filter(Boolean),
        ),
      ...records
        .filter(isCompletedRecord)
        .map((record) => record.nextServiceDate)
        .filter(Boolean),
    ]
      .filter(Boolean)
      .map((value) => String(value).slice(0, 10))
      .filter((value) => value >= today)
      .sort();
    const nextServiceDate = dueCandidates[0] ?? null;

    const lifetimeSpend = records.reduce(
      (sum, record) => sum + (parseCost(record.cost) ?? 0),
      0,
    );
    const billedServices = records.filter(
      (record) => (parseCost(record.cost) ?? 0) > 0,
    ).length;

    const recordsByDateDesc = [...records].sort((a, b) =>
      String(b.date ?? "").localeCompare(String(a.date ?? "")),
    );

    const timelineNodes = buildInspectionTimelineNodes(
      records,
      upcomingEvents,
      today,
      {nextServiceDate},
    );

    return {
      today,
      hasData: records.length > 0 || events.length > 0,
      highlight,
      otherUpcoming,
      records: recordsByDateDesc,
      recordsTotal: records.length,
      lastServiceDate,
      lastServiceRelative: lastServiceDate
        ? relativePast(lastServiceDate, today)
        : null,
      nextServiceDate,
      nextServiceRelative: nextServiceDate
        ? relativeFuture(nextServiceDate, today)
        : null,
      lifetimeSpend,
      billedServices,
      timelineNodes,
    };
  }, [maintenanceEvents, maintenanceRecords, systemId]);

  const topRecords = summary.records.slice(0, 5);

  if (!summary.hasData) {
    return (
      <EmptyStateCard
        title="No maintenance or inspections"
        description="Schedule an inspection or maintenance visit to track upcoming service for this system."
        actionLabel="Schedule inspection"
        onAction={onSchedule}
        icon={Calendar}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryStat
          icon={CalendarClock}
          label="Next Service Date"
          value={
            summary.nextServiceDate
              ? formatOverviewDate(summary.nextServiceDate)
              : "Not scheduled"
          }
          sub={summary.nextServiceRelative}
        />
        <SummaryStat
          icon={History}
          label="Last Service"
          value={
            summary.lastServiceDate
              ? formatOverviewDate(summary.lastServiceDate)
              : "No history"
          }
          sub={summary.lastServiceRelative}
        />
        <SummaryStat
          icon={DollarSign}
          label="Total Lifetime Spend"
          value={formatCurrency(summary.lifetimeSpend) ?? "$0"}
          sub={`${summary.billedServices} service${
            summary.billedServices === 1 ? "" : "s"
          }`}
        />
        <SummaryStat
          icon={AlertCircle}
          label="Open Items"
          value={String(actionItemCount ?? 0)}
          sub={
            actionItemCount > 0 && onViewActionItems
              ? "See details →"
              : undefined
          }
          subTone="brand"
          onClick={actionItemCount > 0 ? onViewActionItems : undefined}
        />
      </div>

      {/* Highlighted next scheduled event */}
      {summary.highlight && (
        <NextScheduledCard
          event={summary.highlight}
          systemLabel={systemLabel}
          onReschedule={onReschedule ?? onSchedule}
          onAddReport={onAddReport}
          onViewDetails={onViewDetails}
        />
      )}

      {/* Maintenance records summary */}
      <SectionCard flat title="Maintenance Records" icon={History}>
        {topRecords.length > 0 ? (
          <>
            <RecordsTimeline nodes={summary.timelineNodes} />
            <div className="space-y-2">
              {topRecords.map((record) => (
                <MaintenanceRecordRow
                  key={record.id ?? `${record.systemId}-${record.date}`}
                  record={record}
                  systemLabel={systemLabel}
                  today={summary.today}
                  onOpen={handleOpenRecord}
                />
              ))}
            </div>
            {onViewAllRecords && summary.recordsTotal > topRecords.length && (
              <div className="flex justify-center mt-4 pt-1">
                <button
                  type="button"
                  onClick={onViewAllRecords}
                  className="inline-flex items-center justify-center min-w-[10rem] px-5 py-2 rounded-lg text-sm font-semibold border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:border-[#456564]/50 hover:text-[#456564] dark:hover:text-[#7fa3a1] transition-colors"
                >
                  View All Records
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            No completed maintenance records yet. Completed service and
            inspections will be summarized here.
          </p>
        )}
      </SectionCard>

      {/* Additional scheduled events */}
      {summary.otherUpcoming.length > 0 && (
        <SectionCard flat title="Also Scheduled" icon={Clock}>
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {summary.otherUpcoming.map((event) => (
              <UpcomingRow
                key={event.id ?? event.scheduled_date}
                event={event}
              />
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
