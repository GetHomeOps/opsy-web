import React from "react";
import {
  CalendarClock,
  Clock,
  Sparkles,
  X,
} from "lucide-react";
import ModalBlank from "../../../../../components/ModalBlank";
import ActionItemPriorityBadge from "./ActionItemPriorityBadge";
import ActionItemScheduleButton from "./ActionItemScheduleButton";
import {
  formatActionItemDate,
  getEffectiveLastPerformedDate,
  getEffectiveNextDueDate,
  getRecurrenceLabel,
  isInspectionSource,
  isItemChecked,
  isOneOffActionItemDone,
  isRecurringActionItem,
} from "../../../helpers/actionItemFormatters";

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

function formatStatus(status) {
  const raw = String(status ?? "pending").toLowerCase();
  if (raw === "in_progress") return "In progress";
  if (raw === "completed") return "Completed";
  if (raw === "deferred") return "Deferred";
  if (raw === "not_applicable") return "Not applicable";
  return "Pending";
}

function SourceBadge({item}) {
  if (item.source === "user_created") {
    return (
      <span className="inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#456564]/10 text-[#456564] dark:bg-[#7aa3a2]/15 dark:text-[#7aa3a2]">
        My ToDo
      </span>
    );
  }
  if (item.source === "default_recommendation") {
    return (
      <span className="inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400">
        Recommended
      </span>
    );
  }
  if (isInspectionSource(item.source)) {
    return (
      <span className="inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400">
        Inspection Report
      </span>
    );
  }
  return null;
}

function DetailField({label, children}) {
  if (children == null || children === "") return null;
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1">
        {label}
      </p>
      <div className="text-sm text-neutral-700 dark:text-neutral-300">{children}</div>
    </div>
  );
}

export default function ActionItemDetailModal({
  item,
  isOpen,
  onClose,
  linkedEvent = null,
  completedChecklistItemIds,
  recordsByChecklistItemId = {},
  onScheduleItem,
  onToggleRequest,
  onAIPromptItem,
  showSchedule = true,
}) {
  if (!item) return null;

  const isInspectionItem = isInspectionSource(item.source);
  const isRecurring = isRecurringActionItem(item);
  const isChecked = isItemChecked(item, completedChecklistItemIds);
  const showCompletionToggle = !isRecurring;
  const lastPerformedDate = getEffectiveLastPerformedDate(
    item,
    recordsByChecklistItemId,
  );
  const isDone = !isInspectionItem
    && isOneOffActionItemDone(item, recordsByChecklistItemId);
  const nextDueDate = !isInspectionItem
    ? getEffectiveNextDueDate(item, recordsByChecklistItemId)
    : null;
  const recurrenceLabel = getRecurrenceLabel(item);

  const showScheduleButton =
    showSchedule &&
    onScheduleItem &&
    !linkedEvent &&
    (isRecurring || !isChecked);

  const scheduledDate = linkedEvent
    ? formatActionItemDate(
        linkedEvent.scheduled_date ?? linkedEvent.scheduledDate,
      )
    : null;
  const scheduledTime = linkedEvent
    ? formatScheduledTime(
        linkedEvent.scheduled_time ?? linkedEvent.scheduledTime,
      )
    : null;
  const eventStatus = linkedEvent
    ? String(linkedEvent.status ?? "scheduled").toLowerCase()
    : null;

  const handleSchedule = () => {
    onScheduleItem?.(item);
    onClose?.();
  };

  const handleMarkComplete = () => {
    onToggleRequest?.(item, {isChecked: false});
    onClose?.();
  };

  const handleAskAI = () => {
    onAIPromptItem?.(item);
    onClose?.();
  };

  return (
    <ModalBlank
      id="action-item-detail-modal"
      modalOpen={isOpen}
      setModalOpen={(open) => !open && onClose?.()}
      contentClassName="max-w-lg"
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <ActionItemPriorityBadge item={item} />
              <SourceBadge item={item} />
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 capitalize">
                {formatStatus(item.status)}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
              {item.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <DetailField label="Description">
            {item.description ? (
              <p className="whitespace-pre-wrap">{item.description}</p>
            ) : (
              <span className="text-neutral-400 dark:text-neutral-500">—</span>
            )}
          </DetailField>

          {isInspectionItem && item.suggested_when && (
            <DetailField label="Suggested timing">{item.suggested_when}</DetailField>
          )}

          {isInspectionItem && item.evidence && (
            <DetailField label="Evidence from report">
              <p className="whitespace-pre-wrap text-xs leading-relaxed bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-3 border border-neutral-100 dark:border-neutral-700">
                {item.evidence}
              </p>
            </DetailField>
          )}

          {isRecurring && recurrenceLabel && (
            <DetailField label="Frequency">{recurrenceLabel}</DetailField>
          )}

          {isInspectionItem ? (
            <DetailField label="Last performed">
              {lastPerformedDate
                ? formatActionItemDate(lastPerformedDate)
                : "None"}
            </DetailField>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <DetailField label="Last performed">
                {lastPerformedDate
                  ? formatActionItemDate(lastPerformedDate)
                  : "None"}
              </DetailField>
              <DetailField label="Next due">
                {isDone ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    Done
                  </span>
                ) : (
                  formatActionItemDate(nextDueDate) || "—"
                )}
              </DetailField>
            </div>
          )}

          {linkedEvent && (
            <DetailField label="Scheduled">
              <div className="flex items-start gap-2">
                <CalendarClock className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
                <div>
                  <div>
                    {scheduledDate || "—"}
                    {scheduledTime ? ` at ${scheduledTime}` : ""}
                  </div>
                  {eventStatus && (
                    <span className="inline-flex mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400 capitalize">
                      {eventStatus}
                    </span>
                  )}
                </div>
              </div>
            </DetailField>
          )}

          {item.notes && (
            <DetailField label="Notes">
              <p className="whitespace-pre-wrap">{item.notes}</p>
            </DetailField>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800">
          {showScheduleButton && (
            <ActionItemScheduleButton onClick={handleSchedule} />
          )}
          {showCompletionToggle && !isChecked && onToggleRequest && (
            <button
              type="button"
              onClick={handleMarkComplete}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-600 text-neutral-700 dark:text-neutral-200 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
            >
              <Clock className="w-3.5 h-3.5" />
              Mark complete
            </button>
          )}
          {isInspectionItem && onAIPromptItem && !isChecked && (
            <button
              type="button"
              onClick={handleAskAI}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-600 text-neutral-700 dark:text-neutral-200 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Ask AI
            </button>
          )}
        </div>
      </div>
    </ModalBlank>
  );
}
