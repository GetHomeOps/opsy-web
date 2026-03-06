import React from "react";
import { format } from "date-fns";
import { Ticket } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Reusable tickets list for users to see their submitted tickets.
 * Used on Support page (user view) and can be used elsewhere.
 */
function TicketsList({
  tickets = [],
  loading = false,
  onTicketClick,
  statusBadgeClass,
  statusLabel,
  emptyMessage,
  title,
  description,
}) {
  const { t } = useTranslation();

  const defaultStatusBadgeClass = (status) => {
    switch (status) {
      case "new":
        return "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300";
      case "working_on_it":
      case "in_progress":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300";
      case "solved":
      case "completed":
      case "resolved":
        return "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300";
      default:
        return "bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300";
    }
  };

  const defaultStatusLabel = (status) => {
    switch (status) {
      case "new":
        return t("support.statusNew") || "New";
      case "working_on_it":
      case "in_progress":
        return t("support.statusWorking") || "In Progress";
      case "solved":
      case "completed":
      case "resolved":
        return t("support.statusSolved") || "Solved";
      default:
        return status || "—";
    }
  };

  const badgeClass = statusBadgeClass || defaultStatusBadgeClass;
  const label = statusLabel || defaultStatusLabel;

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-5 bg-gray-50/80 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Ticket className="w-5 h-5 text-[#456564] dark:text-[#5a7a78]" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title || (t("support.myTickets") || "My Tickets")}
          </h2>
        </div>
        <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">
          {description ||
            (t("support.myTicketsDescription") ||
              "Tickets you've submitted. Click to view details and replies.")}
        </p>
      </div>
      <div className="p-6">
        {loading ? (
          <p className="text-gray-500 dark:text-gray-400">
            {t("loading") || "Loading..."}
          </p>
        ) : tickets.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">
            {emptyMessage || (t("support.noTickets") || "No tickets yet.")}
          </p>
        ) : (
          <ul className="space-y-3">
            {tickets.map((ticket) => (
              <li
                key={ticket.id}
                role="button"
                tabIndex={0}
                onClick={() => onTicketClick?.(ticket)}
                onKeyDown={(e) =>
                  e.key === "Enter" && onTicketClick?.(ticket)
                }
                className="rounded-xl border border-gray-200 dark:border-gray-700/60 p-4 bg-gray-50/50 dark:bg-gray-800/30 hover:bg-gray-100/80 dark:hover:bg-gray-700/40 hover:border-[#456564]/30 dark:hover:border-[#5a7a78]/40 cursor-pointer transition-all duration-200"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 mr-2 capitalize">
                      {ticket.type}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass(
                        ticket.status
                      )}`}
                    >
                      {label(ticket.status)}
                    </span>
                    <p className="mt-1 font-medium text-gray-900 dark:text-white truncate">
                      {ticket.subject}
                    </p>
                    <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                      {ticket.description}
                    </p>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {format(new Date(ticket.createdAt), "PPp")}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default TicketsList;
