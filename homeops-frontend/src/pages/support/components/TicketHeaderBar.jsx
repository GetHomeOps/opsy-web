import React from "react";
import { format } from "date-fns";
import { X } from "lucide-react";
import StatusBadge from "./StatusBadge";
import PriorityBadge from "./PriorityBadge";

/** Odoo-style status colors: colored left border + subtle bg for the select */
const STATUS_SELECT_CLASSES = {
  new: "border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-900/20 dark:border-l-amber-400",
  in_progress:
    "border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-l-blue-400",
  completed:
    "border-l-4 border-l-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 dark:border-l-emerald-400",
  closed:
    "border-l-4 border-l-gray-400 bg-gray-50/80 dark:bg-gray-800/30 dark:border-l-gray-500",
};

/** Assignee: amber tint when unassigned (draws attention), emerald when assigned */
const ASSIGN_SELECT_UNASSIGNED =
  "border-l-4 border-l-amber-400 bg-amber-50/70 dark:bg-amber-900/15 dark:border-l-amber-500";
const ASSIGN_SELECT_ASSIGNED =
  "border-l-4 border-l-emerald-500 bg-emerald-50/70 dark:bg-emerald-900/15 dark:border-l-emerald-400";

/**
 * Compact header with key ticket info at a glance.
 * Integrates status, assignee, timestamps, and actions in one bar.
 * Status/assignee selects use Odoo-style colored borders for quick visual feedback.
 */
function TicketHeaderBar({
  ticket,
  labels,
  statusDisplay,
  priority,
  admins = [],
  readOnly,
  asPage,
  onClose,
  onStatusChange,
  onAssign,
  variant,
  onConvertToSupportTicket,
  updating,
}) {
  const assigneeName =
    ticket?.assignedTo != null
      ? admins.find((a) => a.id === ticket.assignedTo)?.name ||
        admins.find((a) => a.id === ticket.assignedTo)?.email ||
        "—"
      : null;
  const isAssigned = ticket?.assignedTo != null;
  const statusSelectClass =
    STATUS_SELECT_CLASSES[statusDisplay] ||
    "border-l-4 border-l-gray-300 dark:border-l-gray-600";

  return (
    <div className="bg-white dark:bg-gray-800/95 rounded-xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 overflow-hidden">
      <div className="px-5 sm:px-6 py-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              #{ticket?.id}
            </span>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">
              {ticket?.subject}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-sm">
            <StatusBadge status={statusDisplay} labels={labels} />
            {variant === "support" && priority && (
              <PriorityBadge priority={priority} />
            )}
            {assigneeName && (
              <span className="text-gray-600 dark:text-gray-400">
                Assignee: <span className="font-medium">{assigneeName}</span>
              </span>
            )}
            <span className="text-gray-500 dark:text-gray-400">
              Created {ticket?.createdAt && format(new Date(ticket.createdAt), "MMM d, yyyy HH:mm")}
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              Updated {ticket?.updatedAt && format(new Date(ticket.updatedAt), "MMM d, yyyy HH:mm")}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {!readOnly && (
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={statusDisplay}
                onChange={(e) => onStatusChange?.(ticket.id, e.target.value)}
                disabled={updating}
                className={`form-select text-sm w-36 pl-3 ${statusSelectClass}`}
              >
                <option value="new">New</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="closed">Closed</option>
              </select>
              <select
                value={ticket?.assignedTo ?? ""}
                onChange={(e) =>
                  onAssign?.(
                    ticket.id,
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                disabled={updating}
                className={`form-select text-sm w-40 pl-3 ${
                  isAssigned ? ASSIGN_SELECT_ASSIGNED : ASSIGN_SELECT_UNASSIGNED
                }`}
              >
                <option value="">Unassigned</option>
                {admins.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name || a.email}
                  </option>
                ))}
              </select>
              {variant === "feedback" && (
                <button
                  type="button"
                  onClick={onConvertToSupportTicket}
                  className="btn text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-800 dark:text-gray-300"
                >
                  Convert to Support
                </button>
              )}
            </div>
          )}
          {!asPage && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700/50 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default TicketHeaderBar;
