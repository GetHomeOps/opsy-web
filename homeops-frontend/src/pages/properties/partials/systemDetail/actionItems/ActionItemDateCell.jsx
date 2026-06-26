import React from "react";
import {
  formatActionItemDate,
  formatRelativeDue,
  formatRelativePast,
} from "../../../helpers/actionItemFormatters";

const TONE_CLASSES = {
  red: "text-red-600 dark:text-red-400",
  amber: "text-amber-600 dark:text-amber-400",
  neutral: "text-emerald-600 dark:text-emerald-400",
  muted: "text-neutral-400 dark:text-neutral-500",
};

export default function ActionItemDateCell({
  date,
  mode = "due",
  emptyLabel = "—",
  statusLabel,
  onEdit,
  editable = false,
  className = "",
}) {
  if (statusLabel) {
    return (
      <div className={className}>
        <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
          {statusLabel}
        </div>
      </div>
    );
  }

  const formatted = formatActionItemDate(date);
  const relative =
    mode === "due" ? formatRelativeDue(date) : formatRelativePast(date);

  if (!formatted) {
    if (editable && onEdit) {
      return (
        <button
          type="button"
          onClick={onEdit}
          className={`text-xs text-[#456564] dark:text-[#7aa3a2] hover:underline ${className}`}
        >
          Set dates
        </button>
      );
    }
    return (
      <span className={`text-xs text-neutral-400 dark:text-neutral-500 ${className}`}>
        {emptyLabel}
      </span>
    );
  }

  return (
    <div className={className}>
      <div className="text-xs font-medium text-neutral-800 dark:text-neutral-200">
        {editable && onEdit ? (
          <button type="button" onClick={onEdit} className="hover:underline text-left">
            {formatted}
          </button>
        ) : (
          formatted
        )}
      </div>
      {relative && (
        <div
          className={`text-[10px] mt-0.5 ${TONE_CLASSES[relative.tone] ?? TONE_CLASSES.muted}`}
        >
          {relative.label}
        </div>
      )}
    </div>
  );
}
