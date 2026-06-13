import React, { useMemo } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  ClipboardCheck,
  Repeat,
  User,
  Wrench,
} from "lucide-react";
import SectionCard from "../passport/SectionCard";
import { formatOverviewDate } from "../passport/SystemsOverviewPanel";
import EmptyStateCard from "../passport/EmptyStateCard";
import { StatusBadge } from "../passport/StatusBadge";

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

function formatStatusLabel(status, variant) {
  const normalized = String(status ?? "").trim().toLowerCase();
  if (normalized === "completed") return "Completed";
  if (normalized === "confirmed") return "Confirmed";
  if (normalized === "scheduled") return "Scheduled";
  if (normalized === "cancelled") return "Cancelled";
  if (normalized === "in progress") return "In Progress";
  if (normalized === "pending contractor") return "Pending Contractor";
  return variant === "completed" ? "Completed" : "Scheduled";
}

function isCompletedRecord(record) {
  const status = String(record?.status ?? "").trim().toLowerCase();
  const recordStatus = String(record?.record_status ?? "").trim().toLowerCase();
  return (
    status === "completed" ||
    recordStatus === "user_completed" ||
    recordStatus === "contractor_completed"
  );
}

function isUpcomingRecord(record, today) {
  if (isCompletedRecord(record)) return false;
  const status = String(record?.status ?? "").trim().toLowerCase();
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

function maintenanceRecordToEvent(record) {
  const recordType = String(record?.recordType ?? "").trim();
  const description = String(record?.description ?? "").trim();
  const title = recordType || description || "Service";
  const isInspection =
    /inspection/i.test(recordType) || /inspection/i.test(description);
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
    status: String(record?.status ?? "scheduled").trim().toLowerCase(),
    scheduled_date: displayDate,
    completed_date: completed && record?.date
      ? String(record.date).slice(0, 10)
      : null,
    checklist_item_title: title,
    contractor_name: record?.contractor ?? null,
    message_body: record?.notes ?? null,
  };
}

function matchesSystemId(item, systemId) {
  return (
    String(item?.systemId ?? item?.system_key ?? item?.systemKey ?? "") ===
    String(systemId)
  );
}

function MetaRow({ icon: Icon, children }) {
  if (!children) return null;
  return (
    <div className="flex items-center gap-1.5 min-w-0 text-xs text-neutral-500 dark:text-neutral-400">
      <Icon className="w-3.5 h-3.5 shrink-0 text-neutral-400 dark:text-neutral-500" />
      <span className="truncate">{children}</span>
    </div>
  );
}

function EventCard({ event, variant = "upcoming" }) {
  const date =
    readEventField(
      event,
      "scheduled_date",
      "scheduledDate",
      "completed_date",
      "completedDate",
    ) ?? null;
  const title = getEventTitle(event);
  const eventType = getEventType(event);
  const contractor = readEventField(event, "contractor_name", "contractorName");
  const scheduledTime = formatEventTime(
    readEventField(event, "scheduled_time", "scheduledTime"),
  );
  const recurrence = formatRecurrence(event);
  const status = readEventField(event, "status") ?? "";
  const statusLabel = formatStatusLabel(status, variant);
  const formattedDate = date ? (formatOverviewDate(date) ?? date) : null;
  const notes = readEventField(event, "message_body", "messageBody");
  const TypeIcon = eventType === "inspection" ? ClipboardCheck : Wrench;

  return (
    <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {eventType && (
              <StatusBadge tone={getEventTypeTone(eventType)}>
                <TypeIcon className="w-3 h-3" />
                {getEventTypeLabel(eventType)}
              </StatusBadge>
            )}
            <StatusBadge tone={variant === "completed" ? "emerald" : "brand"}>
              {statusLabel}
            </StatusBadge>
          </div>

          <p className="text-sm font-semibold text-neutral-900 dark:text-white break-words">
            {title}
          </p>

          <div className="space-y-1">
            {(formattedDate || scheduledTime) && (
              <MetaRow icon={Calendar}>
                {[formattedDate, scheduledTime].filter(Boolean).join(" · ")}
              </MetaRow>
            )}
            <MetaRow icon={User}>
              {contractor ?? "No contractor assigned"}
            </MetaRow>
            {recurrence && <MetaRow icon={Repeat}>{recurrence}</MetaRow>}
            {notes && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2 pt-0.5">
                {notes}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SystemMaintenanceTab({
  systemId,
  maintenanceEvents = [],
  maintenanceRecords = [],
  onSchedule,
}) {
  const { upcoming, history } = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    const eventsForSystem = maintenanceEvents.filter((event) =>
      matchesSystemId(event, systemId),
    );
    const recordsForSystem = maintenanceRecords.filter((record) =>
      matchesSystemId(record, systemId),
    );

    const upcomingEvents = eventsForSystem.filter((event) =>
      ["scheduled", "confirmed"].includes(String(event.status ?? "").toLowerCase()),
    );
    const upcomingEventIds = new Set(upcomingEvents.map((event) => event.id));
    const historyEvents = eventsForSystem.filter(
      (event) => !upcomingEventIds.has(event.id),
    );

    const upcomingRecordsRaw = recordsForSystem.filter((record) =>
      isUpcomingRecord(record, today),
    );
    const upcomingRecordIds = new Set(upcomingRecordsRaw.map((record) => record.id));
    const upcomingRecords = upcomingRecordsRaw.map(maintenanceRecordToEvent);
    const historyRecords = recordsForSystem
      .filter((record) => !upcomingRecordIds.has(record.id))
      .map(maintenanceRecordToEvent);

    const sortByDateAsc = (a, b) =>
      String(a.scheduled_date ?? a.scheduledDate ?? "").localeCompare(
        String(b.scheduled_date ?? b.scheduledDate ?? ""),
      );
    const sortByDateDesc = (a, b) =>
      String(b.scheduled_date ?? b.scheduledDate ?? b.completed_date ?? b.completedDate ?? "")
        .localeCompare(
          String(a.scheduled_date ?? a.scheduledDate ?? a.completed_date ?? a.completedDate ?? ""),
        );

    return {
      upcoming: [...upcomingEvents, ...upcomingRecords].sort(sortByDateAsc),
      history: [...historyEvents, ...historyRecords].sort(sortByDateDesc),
    };
  }, [maintenanceEvents, maintenanceRecords, systemId]);

  if (upcoming.length === 0 && history.length === 0) {
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
      {upcoming.length > 0 && (
        <SectionCard flat title="Upcoming" icon={Clock}>
          <div className="space-y-3">
            {upcoming.map((event) => (
              <EventCard key={event.id ?? event.scheduled_date} event={event} variant="upcoming" />
            ))}
          </div>
        </SectionCard>
      )}
      {history.length > 0 && (
        <SectionCard flat title="History" icon={CheckCircle2}>
          <div className="space-y-3">
            {history.map((event) => (
              <EventCard key={event.id ?? event.scheduled_date} event={event} variant="completed" />
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
