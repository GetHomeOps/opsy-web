import React from "react";
import {
  getEffectivePriority,
  PRIORITY_PILL_STYLES,
} from "../../../helpers/actionItemFormatters";

export default function ActionItemPriorityBadge({ item, className = "" }) {
  const priority = getEffectivePriority(item);
  const pillStyle = PRIORITY_PILL_STYLES[priority] || PRIORITY_PILL_STYLES.medium;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${pillStyle} ${className}`}
    >
      {priority}
    </span>
  );
}
