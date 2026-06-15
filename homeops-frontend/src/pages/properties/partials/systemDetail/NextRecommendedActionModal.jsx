import React from "react";
import {Calendar, CalendarClock, Wrench, X} from "lucide-react";
import ModalBlank from "../../../../components/ModalBlank";
import {StatusBadge} from "../passport/StatusBadge";
import {formatOverviewDate} from "../passport/SystemsOverviewPanel";

/**
 * Details modal for the Next Recommended Action card on the system overview.
 */
export function NextRecommendedActionModal({
  isOpen,
  onClose,
  systemLabel,
  nextDue,
  nextDueOverdue = false,
  lastService,
  onViewMaintenance,
  onSchedule,
}) {
  if (!isOpen || !nextDue) return null;

  const formattedDue = formatOverviewDate(nextDue) ?? nextDue;
  const formattedLast = lastService
    ? (formatOverviewDate(lastService) ?? lastService)
    : null;

  return (
    <ModalBlank
      id="next-recommended-action-modal"
      modalOpen={isOpen}
      setModalOpen={(open) => !open && onClose?.()}
      backdropZClassName="z-[160]"
      dialogZClassName="z-[160]"
      contentClassName="max-w-lg"
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                nextDueOverdue
                  ? "bg-red-100 dark:bg-red-900/40"
                  : "bg-emerald-100 dark:bg-emerald-900/40"
              }`}
            >
              <Calendar
                className={`w-5 h-5 ${
                  nextDueOverdue
                    ? "text-red-600 dark:text-red-400"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}
              />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                {nextDueOverdue ? "Service overdue" : "Upcoming service"}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {systemLabel || "System"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/80 dark:bg-neutral-800/40 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Recommended date
            </p>
            <p className="text-xl font-bold text-neutral-900 dark:text-white mt-1">
              {formattedDue}
            </p>
            <div className="mt-2">
              <StatusBadge tone={nextDueOverdue ? "red" : "emerald"}>
                {nextDueOverdue ? "Overdue" : "Scheduled"}
              </StatusBadge>
            </div>
          </div>

          {formattedLast && (
            <div className="flex items-start gap-2.5 text-sm text-neutral-600 dark:text-neutral-400">
              <CalendarClock className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Last service recorded:{" "}
                <span className="font-medium text-neutral-800 dark:text-neutral-200">
                  {formattedLast}
                </span>
              </span>
            </div>
          )}

          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {nextDueOverdue
              ? "This service date has passed. Schedule a visit or log a maintenance record to keep this system up to date."
              : "Plan ahead by scheduling a contractor visit or logging the service once it is complete."}
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-2 mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <button
            type="button"
            className="btn-sm border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 text-gray-800 dark:text-gray-300"
            onClick={onClose}
          >
            Close
          </button>
          {onViewMaintenance && (
            <button
              type="button"
              className="btn-sm border border-[#456564] text-[#456564] dark:border-[#5a7a78] dark:text-[#5a7a78] hover:bg-[#456564]/10 flex items-center gap-1.5"
              onClick={onViewMaintenance}
            >
              <Wrench className="w-3.5 h-3.5" />
              View maintenance
            </button>
          )}
          {onSchedule && (
            <button
              type="button"
              className="btn-sm bg-[#456564] hover:bg-[#34514f] text-white flex items-center gap-1.5"
              onClick={onSchedule}
            >
              <Calendar className="w-3.5 h-3.5" />
              Schedule service
            </button>
          )}
        </div>
      </div>
    </ModalBlank>
  );
}
