import React from "react";
import { formatActionItemDate } from "../../../helpers/actionItemFormatters";
import ActionItemScheduleButton from "./ActionItemScheduleButton";

const STATUS_STYLES = {
  scheduled:
    "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  completed:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  cancelled:
    "bg-neutral-100 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400",
};

function formatScheduledTime(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return raw;
  const hour = Number(match[1]);
  const minute = match[2];
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minute} ${period}`;
}

export default function ActionItemScheduledCell({
  linkedEvent = null,
  onViewEvent,
  onSchedule,
  showSchedule = false,
  scheduleDisabled = false,
  className = "",
}) {
  if (!linkedEvent) {
    if (showSchedule && onSchedule) {
      return (
        <ActionItemScheduleButton
          onClick={onSchedule}
          disabled={scheduleDisabled}
        />
      );
    }
    return (
      <span
        className={`text-xs text-neutral-400 dark:text-neutral-500 ${className}`}
      >
        —
      </span>
    );
  }

  const scheduledDate =
    linkedEvent.scheduled_date ?? linkedEvent.scheduledDate ?? null;
  const formattedDate = formatActionItemDate(scheduledDate);
  const scheduledTime = formatScheduledTime(
    linkedEvent.scheduled_time ?? linkedEvent.scheduledTime,
  );
  const status = String(linkedEvent.status ?? "scheduled").toLowerCase();
  const statusClass =
    STATUS_STYLES[status] ?? STATUS_STYLES.scheduled;

  const content = (
    <div className={className}>
      <div className="text-xs font-medium text-neutral-800 dark:text-neutral-200">
        {formattedDate || "—"}
      </div>
      {scheduledTime && (
        <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
          {scheduledTime}
        </div>
      )}
      <span
        className={`inline-flex mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize ${statusClass}`}
      >
        {status}
      </span>
    </div>
  );

  if (onViewEvent) {
    return (
      <button
        type="button"
        onClick={() => onViewEvent(linkedEvent)}
        className="text-left hover:opacity-80 transition-opacity"
        title="View scheduled event"
      >
        {content}
      </button>
    );
  }

  return content;
}
