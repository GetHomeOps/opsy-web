import React from "react";
import {
  MessageSquare,
  Inbox,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MessageCircle,
} from "lucide-react";
import {supportToColumnStatus, feedbackToColumnStatus} from "../kanbanConfig";

/**
 * KPI tracker for support/feedback management pages.
 * Displays ticket counts by status and priority, similar to Odoo helpdesk.
 * @param {Object} props
 * @param {'support'|'feedback'} props.variant
 * @param {Array} props.tickets - Full list of tickets (unfiltered for true metrics)
 * @param {boolean} props.loading
 * @param {Function} props.tierToPriority - (tier) => 'urgent'|'high'|'medium'|'low' - support only
 */
function TicketKpiTracker({
  variant,
  tickets = [],
  loading = false,
  tierToPriority,
}) {
  const list = tickets || [];
  const toColumnStatus =
    variant === "support" ? supportToColumnStatus : feedbackToColumnStatus;

  const total = list.length;
  const newCount = list.filter(
    (t) => toColumnStatus(t.status) === "new",
  ).length;
  const inProgress = list.filter(
    (t) => toColumnStatus(t.status) === "in_progress",
  ).length;
  const resolved =
    variant === "support"
      ? list.filter((t) => toColumnStatus(t.status) === "completed").length
      : list.filter((t) => toColumnStatus(t.status) === "completed").length;
  const closed = list.filter(
    (t) => toColumnStatus(t.status) === "closed",
  ).length;
  const urgent =
    variant === "support" && tierToPriority
      ? list.filter((t) => tierToPriority(t.subscriptionTier) === "urgent")
          .length
      : 0;

  const kpiItems = [
    {
      label: "Total",
      value: total,
      icon: variant === "support" ? MessageSquare : MessageCircle,
      color:
        "bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300",
      iconColor: "text-slate-500 dark:text-slate-400",
    },
    {
      label: "New",
      value: newCount,
      icon: Inbox,
      color: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300",
      iconColor: "text-blue-500 dark:text-blue-400",
    },
    {
      label: "In Progress",
      value: inProgress,
      icon: Loader2,
      color:
        "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300",
      iconColor: "text-amber-500 dark:text-amber-400",
    },
    {
      label: variant === "support" ? "Resolved" : "Implemented",
      value: resolved,
      icon: CheckCircle2,
      color:
        "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300",
      iconColor: "text-emerald-500 dark:text-emerald-400",
    },
    {
      label: "Closed",
      value: closed,
      icon: XCircle,
      color: "bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300",
      iconColor: "text-gray-500 dark:text-gray-400",
    },
  ];

  if (variant === "support") {
    kpiItems.push({
      label: "Urgent",
      value: urgent,
      icon: AlertTriangle,
      color: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300",
      iconColor: "text-red-500 dark:text-red-400",
    });
  }

  return (
    <div className="flex flex-wrap gap-3 mb-4">
      {kpiItems.map((item) => {
        const Icon = item.icon;
        const displayValue = loading ? "—" : item.value;
        return (
          <div
            key={item.label}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200/60 dark:border-gray-600/40 ${item.color}`}
          >
            <Icon
              className={`w-4 h-4 shrink-0 ${item.iconColor}`}
              strokeWidth={2}
            />
            <span className="text-sm font-medium tabular-nums">
              {displayValue}
            </span>
            <span className="text-sm opacity-90">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default TicketKpiTracker;
