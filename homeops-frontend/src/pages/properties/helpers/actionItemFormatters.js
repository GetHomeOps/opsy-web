import { parseDateInput } from "../../../lib/dateOffset";
import { formatOverviewDate } from "../partials/passport/SystemsOverviewPanel";

/** Local calendar date as YYYY-MM-DD. */
export function todayDateString() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Compute a next-due date from a last-performed date + frequency cadence. */
export function computeNextDue(lastPerformed, frequency, unit) {
  if (!lastPerformed || !frequency || !unit) return "";
  const base = parseDateInput(lastPerformed);
  if (!base || Number.isNaN(base.getTime())) return "";
  const n = Number(frequency);
  if (!Number.isFinite(n) || n <= 0) return "";
  const d = new Date(base.getTime());
  if (unit === "days") d.setDate(d.getDate() + n);
  else if (unit === "weeks") d.setDate(d.getDate() + n * 7);
  else if (unit === "months") d.setMonth(d.getMonth() + n);
  else if (unit === "years") d.setFullYear(d.getFullYear() + n);
  else return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Latest completed maintenance record date for an action item, or null. */
export function getEffectiveLastPerformedDate(item, recordsByChecklistItemId = {}) {
  const id = Number(item?.id);
  if (!Number.isFinite(id)) return null;
  const fromRecord = recordsByChecklistItemId[id];
  if (fromRecord) return fromRecord;
  return item?.last_performed_date
    ? String(item.last_performed_date).slice(0, 10)
    : null;
}

/** Display next-due date derived from last performed + cadence (never stored). */
export function getEffectiveNextDueDate(item, recordsByChecklistItemId = {}) {
  const today = todayDateString();
  const lastPerformed = getEffectiveLastPerformedDate(item, recordsByChecklistItemId);
  if (!lastPerformed) return today;

  const { frequency, frequency_unit: frequencyUnit, lifecycle_replacement_years: lifecycleYears } =
    item ?? {};

  if (frequency && frequencyUnit) {
    return computeNextDue(lastPerformed, frequency, frequencyUnit) || today;
  }
  if (lifecycleYears) {
    return computeNextDue(lastPerformed, lifecycleYears, "years") || today;
  }
  return today;
}

export const PRIORITY_PILL_STYLES = {
  urgent: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  high: "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  medium: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  low: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400",
};

function daysUntil(value) {
  if (!value) return null;
  const target = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function getEffectivePriority(item) {
  if (item?.priority) return String(item.priority).toLowerCase();
  if (item?.severity === "critical") return "urgent";
  if (item?.severity === "high") return "high";
  if (item?.severity === "low") return "low";
  return "medium";
}

export function getRecurrenceLabel(item) {
  if (item?.frequency && item?.frequency_unit) {
    if (item.frequency === 1) {
      return `Every ${String(item.frequency_unit).replace(/s$/, "")}`;
    }
    return `Every ${item.frequency} ${item.frequency_unit}`;
  }
  if (item?.lifecycle_replacement_years) {
    return `Every ~${item.lifecycle_replacement_years} years`;
  }
  return item?.suggested_when || null;
}

export function formatRelativeDue(value) {
  const days = daysUntil(value);
  if (days == null) return null;
  if (days < 0) return { label: "Overdue", tone: "red" };
  if (days <= 90) return { label: "Due soon", tone: "amber" };
  if (days >= 365) {
    const years = Math.round(days / 365);
    return {
      label: years === 1 ? "In 1 year" : `In ${years} years`,
      tone: "neutral",
    };
  }
  if (days >= 30) {
    const months = Math.round(days / 30);
    return {
      label: months === 1 ? "In 1 month" : `In ${months} months`,
      tone: "neutral",
    };
  }
  return {
    label: days === 1 ? "In 1 day" : `In ${days} days`,
    tone: "neutral",
  };
}

export function formatRelativePast(value) {
  const days = daysUntil(value);
  if (days == null) return null;
  const past = -days;
  if (past < 0) return null;
  if (past === 0) return { label: "Today", tone: "neutral" };
  if (past >= 365) {
    const years = Math.round(past / 365);
    return {
      label: years === 1 ? "~1 year ago" : `~${years} years ago`,
      tone: "neutral",
    };
  }
  if (past >= 30) {
    const months = Math.round(past / 30);
    return {
      label: months === 1 ? "1 month ago" : `${months} months ago`,
      tone: "neutral",
    };
  }
  return {
    label: past === 1 ? "1 day ago" : `${past} days ago`,
    tone: "neutral",
  };
}

export function formatActionItemDate(value) {
  return formatOverviewDate(value) ?? null;
}

export function countPriorities(items) {
  const counts = { urgent: 0, high: 0, medium: 0, low: 0 };
  for (const item of items ?? []) {
    const p = getEffectivePriority(item);
    if (counts[p] != null) counts[p] += 1;
  }
  return counts;
}

export function isInspectionSource(source) {
  return ["needs_attention", "maintenance_suggestion"].includes(source);
}

/** Split inspection-source items into one-off findings vs recurring maintenance. */
export function splitInspectionActionItems(items = []) {
  const inspectionSourceItems = items.filter((i) =>
    isInspectionSource(i.source),
  );
  return {
    findingItems: inspectionSourceItems.filter(
      (i) => !isRecurringActionItem(i),
    ),
    recurrentItems: inspectionSourceItems.filter((i) =>
      isRecurringActionItem(i),
    ),
  };
}

/** True when an action item should recur (recommended or has structural cadence). */
export function isRecurringActionItem(item) {
  if (!item) return false;
  if (item.source === "default_recommendation") return true;
  if (item.frequency && item.frequency_unit) return true;
  if (item.lifecycle_replacement_years) return true;
  return false;
}

/** True when a one-off item has been performed and needs no next due date. */
export function isOneOffActionItemDone(item, recordsByChecklistItemId = {}) {
  if (isRecurringActionItem(item)) return false;
  return Boolean(getEffectiveLastPerformedDate(item, recordsByChecklistItemId));
}

export function isItemChecked(item, completedChecklistItemIds) {
  if (isRecurringActionItem(item)) {
    return false;
  }
  const explicitlyIncomplete = ["pending", "in_progress"].includes(
    String(item?.status ?? "").toLowerCase(),
  );
  const addressed =
    completedChecklistItemIds?.has?.(Number(item?.id)) ?? false;
  return item?.status === "completed" || (addressed && !explicitlyIncomplete);
}
