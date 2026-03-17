import React from "react";
import { format } from "date-fns";
import {
  CircleDot,
  UserCheck,
  Flag,
  Tag,
  Calendar,
  RefreshCw,
  Folder,
} from "lucide-react";
import StatusBadge, { SUPPORT_STATUS_LABELS, FEEDBACK_STATUS_LABELS } from "../StatusBadge";
import PriorityBadge from "../PriorityBadge";

const STATUS_SELECT_STYLES = {
  new: "border-l-2 border-l-amber-500",
  in_progress: "border-l-2 border-l-blue-500",
  completed: "border-l-2 border-l-emerald-500",
  closed: "border-l-2 border-l-gray-400",
};

function MetaField({ icon: Icon, label, children, className = "" }) {
  return (
    <div className={`py-2.5 ${className}`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
        <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="pl-5">{children}</div>
    </div>
  );
}

function TicketMetaPanel({
  ticket,
  admins = [],
  variant = "support",
  readOnly = false,
  onStatusChange,
  onAssign,
  onConvertToSupportTicket,
  updating = false,
}) {
  const labels =
    variant === "feedback" ? FEEDBACK_STATUS_LABELS : SUPPORT_STATUS_LABELS;
  const statusDisplay = ticket?.status || "new";
  const statusBorder = STATUS_SELECT_STYLES[statusDisplay] || "";

  return (
    <div className="space-y-0 divide-y divide-gray-100 dark:divide-gray-700/50">
      <MetaField icon={CircleDot} label="Status">
        {!readOnly ? (
          <select
            value={statusDisplay}
            onChange={(e) => onStatusChange?.(ticket.id, e.target.value)}
            disabled={updating}
            className={`form-select text-sm w-full py-1.5 px-2 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 ${statusBorder}`}
          >
            <option value="new">New</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="closed">Closed</option>
          </select>
        ) : (
          <StatusBadge status={statusDisplay} labels={labels} />
        )}
      </MetaField>

      {variant === "support" && (
        <MetaField icon={Flag} label="Priority">
          <PriorityBadge priority={ticket?.priority || "low"} />
        </MetaField>
      )}

      <MetaField icon={UserCheck} label="Assignee">
        {!readOnly ? (
          <select
            value={ticket?.assignedTo ?? ""}
            onChange={(e) =>
              onAssign?.(
                ticket.id,
                e.target.value ? Number(e.target.value) : null,
              )
            }
            disabled={updating}
            className={`form-select text-sm w-full py-1.5 px-2 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 ${
              ticket?.assignedTo != null
                ? "border-l-2 border-l-emerald-500"
                : "border-l-2 border-l-amber-400"
            }`}
          >
            <option value="">Unassigned</option>
            {admins.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name || a.email}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {ticket?.assignedTo != null
              ? admins.find((a) => a.id === ticket.assignedTo)?.name ||
                admins.find((a) => a.id === ticket.assignedTo)?.email ||
                "Assigned"
              : "Unassigned"}
          </span>
        )}
      </MetaField>

      {variant === "support" && ticket?.category && (
        <MetaField icon={Folder} label="Category">
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {ticket.category}
          </span>
        </MetaField>
      )}

      {variant === "feedback" && (
        <>
          {ticket?.featureCategory && (
            <MetaField icon={Tag} label="Feature">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {ticket.featureCategory}
              </span>
            </MetaField>
          )}
          {ticket?.roadmapTag && (
            <MetaField icon={Tag} label="Roadmap">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {ticket.roadmapTag}
              </span>
            </MetaField>
          )}
        </>
      )}

      <MetaField icon={Calendar} label="Created">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {ticket?.createdAt
            ? format(new Date(ticket.createdAt), "MMM d, yyyy 'at' h:mm a")
            : "—"}
        </span>
      </MetaField>

      <MetaField icon={RefreshCw} label="Updated">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {ticket?.updatedAt
            ? format(new Date(ticket.updatedAt), "MMM d, yyyy 'at' h:mm a")
            : "—"}
        </span>
      </MetaField>

      {!readOnly && variant === "feedback" && onConvertToSupportTicket && (
        <div className="pt-3">
          <button
            type="button"
            onClick={onConvertToSupportTicket}
            className="w-full text-sm py-2 px-3 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            Convert to Support Ticket
          </button>
        </div>
      )}
    </div>
  );
}

export default TicketMetaPanel;
