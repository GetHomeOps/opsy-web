import React, {useState} from "react";
import {CheckCircle2, Circle} from "lucide-react";
import ActionItemPriorityBadge from "./ActionItemPriorityBadge";
import ActionItemDateCell from "./ActionItemDateCell";
import ActionItemScheduledCell from "./ActionItemScheduledCell";
import ActionItemRowMenu from "./ActionItemRowMenu";
import RecommendationDateEditor from "./RecommendationDateEditor";
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

const STATUS_CONFIG = {
  completed: {
    icon: CheckCircle2,
    color: "text-emerald-600 dark:text-emerald-400",
  },
  not_completed: {
    icon: Circle,
    color: "text-gray-400 dark:text-gray-500",
  },
};

function MobileMeta({children}) {
  return (
    <div className="md:hidden mt-2 space-y-1.5 text-xs text-neutral-500 dark:text-neutral-400">
      {children}
    </div>
  );
}

function getEditorColSpan(variant) {
  if (variant === "recommended" || variant === "recurrent") return 9;
  if (variant === "inspection") return 7;
  return 8;
}

export default function ActionItemTableRow({
  item,
  variant = "recommended",
  completedChecklistItemIds,
  recordsByChecklistItemId = {},
  linkedEvent = null,
  isSyncing = false,
  onToggleRequest,
  onStatusChange,
  onDelete,
  onUpdateItem,
  onScheduleItem,
  onAIPromptItem,
  onViewEvent,
  onViewItem,
  onAddRecord,
  showSchedule = true,
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const isUserCreated = item.source === "user_created";
  const isDefaultRecommendation = item.source === "default_recommendation";
  const isUserManaged = isUserCreated || isDefaultRecommendation;
  const isInspectionItem = isInspectionSource(item.source);
  const isRecurring = isRecurringActionItem(item);
  const isChecked = isItemChecked(item, completedChecklistItemIds);
  const showCompletionToggle = !isRecurring;
  const statusConf = isChecked
    ? STATUS_CONFIG.completed
    : STATUS_CONFIG.not_completed;
  const StatusIcon = statusConf.icon;
  const recurrenceLabel = getRecurrenceLabel(item);
  const lastPerformedDate = getEffectiveLastPerformedDate(
    item,
    recordsByChecklistItemId,
  );
  const nextDueDate = getEffectiveNextDueDate(item, recordsByChecklistItemId);
  const isDone = isOneOffActionItemDone(item, recordsByChecklistItemId);
  const canEditFrequency =
    isDefaultRecommendation && onUpdateItem
      ? true
      : isInspectionItem &&
        onUpdateItem &&
        ((variant === "inspection" && !isRecurring) ||
          (variant === "recurrent" && isRecurring));
  const canClearSchedule = isInspectionItem && onUpdateItem && isRecurring;

  const handleToggle = () => {
    if (!showCompletionToggle || isSyncing) return;
    if (onToggleRequest) {
      onToggleRequest(item, {isChecked});
      return;
    }
    const nextStatus = item.status === "completed" ? "pending" : "completed";
    onStatusChange?.(item.id, nextStatus);
  };

  const openEditor = () => setEditorOpen(true);
  const handleClearSchedule = () => {
    onUpdateItem?.(item.id, {frequency: null, frequency_unit: null});
  };
  const showScheduleButton =
    showSchedule &&
    onScheduleItem &&
    !linkedEvent &&
    (isRecurring || !isChecked);

  return (
    <>
      <tr
        className={`group border-b border-neutral-100 dark:border-neutral-800 transition-colors ${
          isChecked
            ? "bg-emerald-50/30 dark:bg-emerald-900/10"
            : "hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40"
        }`}
      >
        <td className="px-3 py-3 w-10 align-top">
          {showCompletionToggle ? (
            <button
              type="button"
              onClick={handleToggle}
              disabled={isSyncing}
              className={`transition-all duration-200 ${statusConf.color} hover:scale-110 ${isSyncing ? "opacity-70" : ""}`}
              title={isChecked ? "Mark as pending" : "Mark as done"}
            >
              <StatusIcon
                className="w-5 h-5"
                strokeWidth={isChecked ? 2.5 : 1.5}
              />
            </button>
          ) : (
            <span
              className="inline-flex w-5 h-5 items-center justify-center text-[10px] font-medium text-neutral-400 dark:text-neutral-500"
              title="Recurring maintenance"
              aria-hidden
            >
              ↻
            </span>
          )}
        </td>

        <td className="px-3 py-3 align-top w-24">
          <ActionItemPriorityBadge item={item} />
        </td>

        <td className="px-3 py-3 align-top min-w-[12rem]">
          {onViewItem ? (
            <button
              type="button"
              onClick={() => onViewItem(item)}
              className={`text-sm font-medium text-left hover:underline ${
                isChecked
                  ? "text-neutral-400 dark:text-neutral-500 line-through"
                  : "text-neutral-900 dark:text-neutral-100"
              }`}
            >
              {item.title}
            </button>
          ) : (
            <div
              className={`text-sm font-medium ${
                isChecked
                  ? "text-neutral-400 dark:text-neutral-500 line-through"
                  : "text-neutral-900 dark:text-neutral-100"
              }`}
            >
              {item.title}
            </div>
          )}
          {isUserCreated && (
            <span className="inline-flex mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#456564]/10 text-[#456564] dark:bg-[#7aa3a2]/15 dark:text-[#7aa3a2]">
              My ToDo
            </span>
          )}
          {isDefaultRecommendation && (
            <span className="inline-flex mt-1 ml-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400">
              Recommended
            </span>
          )}
          {isInspectionItem && (
            <span className="inline-flex mt-1 ml-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400">
              Inspection Report
            </span>
          )}
          <MobileMeta>
            {recurrenceLabel &&
              (variant === "recommended" || variant === "recurrent") && (
              <div>Every: {recurrenceLabel}</div>
            )}
            {variant !== "inspection" && (
              <div>
                Next:{" "}
                {isDone
                  ? "Done"
                  : formatActionItemDate(nextDueDate) || "—"}
              </div>
            )}
            <div>
              Last:{" "}
              {lastPerformedDate
                ? formatActionItemDate(lastPerformedDate)
                : "None"}
            </div>
            {linkedEvent ? (
              <div>
                Scheduled:{" "}
                {formatActionItemDate(
                  linkedEvent.scheduled_date ?? linkedEvent.scheduledDate,
                ) || "—"}
              </div>
            ) : !showScheduleButton ? (
              <div>Scheduled: —</div>
            ) : null}
          </MobileMeta>
        </td>

        <td className="hidden md:table-cell px-3 py-3 align-top max-w-xs">
          <p
            className={`text-xs leading-relaxed line-clamp-3 ${
              isChecked
                ? "text-neutral-400 dark:text-neutral-500"
                : "text-neutral-500 dark:text-neutral-400"
            }`}
          >
            {item.description || "—"}
          </p>
        </td>

        {(variant === "recommended" || variant === "recurrent") && (
          <td className="px-3 py-3 align-top min-w-[7rem]">
            <div className="text-xs font-medium text-neutral-800 dark:text-neutral-200">
              {recurrenceLabel || "—"}
            </div>
            <div className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">
              {variant === "recurrent" ? "Inspection Report" : "Recommended"}
            </div>
          </td>
        )}

        {variant !== "inspection" && (
          <td className="px-3 py-3 align-top min-w-[7rem]">
            <ActionItemDateCell
              date={isDone ? null : nextDueDate}
              mode="due"
              statusLabel={isDone ? "Done" : undefined}
              editable={false}
            />
          </td>
        )}

        <td className="hidden md:table-cell px-3 py-3 align-top min-w-[7rem]">
          <ActionItemDateCell
            date={lastPerformedDate}
            mode="past"
            emptyLabel="None"
            editable={false}
          />
        </td>

        <td className="px-3 py-3 align-top min-w-[7rem]">
          <ActionItemScheduledCell
            linkedEvent={linkedEvent}
            onViewEvent={onViewEvent}
            onSchedule={
              showScheduleButton ? () => onScheduleItem(item) : undefined
            }
            showSchedule={showScheduleButton}
            scheduleDisabled={isSyncing}
          />
        </td>

        <td className="px-3 py-3 align-top">
          <div className="flex items-center justify-end gap-1.5">
            <ActionItemRowMenu
              showAddRecord={Boolean(onAddRecord)}
              onAddRecord={() => onAddRecord?.(item)}
              showEditFrequency={canEditFrequency}
              editFrequencyLabel={
                isInspectionItem
                  ? isRecurring
                    ? "Edit recurring schedule"
                    : "Set recurring schedule"
                  : "Edit frequency"
              }
              onEditFrequency={openEditor}
              showClearSchedule={canClearSchedule}
              onClearSchedule={handleClearSchedule}
              showAI={Boolean(onAIPromptItem) && showCompletionToggle && !isChecked}
              onAIPrompt={() => onAIPromptItem?.(item)}
              showDelete={isUserManaged && Boolean(onDelete)}
              onDelete={() => onDelete?.(item.id)}
            />
          </div>
        </td>
      </tr>
      {editorOpen && canEditFrequency && (
        <tr>
          <td colSpan={getEditorColSpan(variant)} className="px-3 pb-3">
            <RecommendationDateEditor
              item={item}
              onSave={(patch) => onUpdateItem(item.id, patch)}
              onClose={() => setEditorOpen(false)}
              onDelete={onDelete}
            />
          </td>
        </tr>
      )}
    </>
  );
}
