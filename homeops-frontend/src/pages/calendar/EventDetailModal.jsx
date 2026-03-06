import React, {useState} from "react";
import {X, MapPin, User, FileText, Calendar, Clock, Trash2, Loader2} from "lucide-react";
import ModalBlank from "../../components/ModalBlank";
import AppApi from "../../api/api";
import {buildGoogleCalendarUrl} from "../../lib/googleCalendarLink";

/**
 * Normalized calendar event shape (from API).
 * @typedef {Object} CalendarEvent
 * @property {string} id
 * @property {string} title
 * @property {string} date - YYYY-MM-DD
 * @property {string} type - "maintenance" | "inspection"
 * @property {number} propertyId
 * @property {string} status
 * @property {string} [propertyName]
 * @property {string} [address]
 * @property {string|null} [contractorName]
 * @property {string|null} [notes]
 * @property {string|null} [scheduledTime]
 * @property {string|null} [nextScheduledDate]
 */

function EventDetailModal({event, isOpen, onClose, onDeleted}) {
  const [deleting, setDeleting] = useState(false);
  const canDelete =
    event?.type === "maintenance" &&
    event?.id != null &&
    !String(event.id).startsWith("system-");

  const handleDelete = async () => {
    if (!canDelete || deleting) return;
    if (!window.confirm("Are you sure you want to delete this event?")) return;
    setDeleting(true);
    try {
      await AppApi.deleteMaintenanceEvent(event.id);
      onDeleted?.();
      onClose(false);
    } catch (err) {
      console.error("Failed to delete event:", err);
    } finally {
      setDeleting(false);
    }
  };

  const statusLabel = event
    ? event.status === "scheduled"
      ? "Scheduled"
      : event.status === "completed"
        ? "Completed"
        : event.status === "cancelled"
          ? "Cancelled"
          : event.status === "due"
            ? "Due"
            : event.status
    : "";

  const statusClass = event
    ? event.status === "scheduled"
      ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
      : event.status === "completed"
        ? "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
        : event.status === "cancelled"
          ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
          : event.status === "due"
            ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
            : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
    : "";

  const typeLabel = event?.type === "inspection" ? "Inspection" : "Maintenance";
  const typeBadgeClass = event?.type === "inspection"
    ? "bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300"
    : "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300";

  const formattedDate = event?.date
    ? new Date(event.date).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  const formattedTime = event?.scheduledTime
    ? (() => {
        const [h, m] = event.scheduledTime.split(":");
        const hour = parseInt(h, 10);
        const ampm = hour >= 12 ? "PM" : "AM";
        const hour12 = hour % 12 || 12;
        return `${hour12}:${m} ${ampm}`;
      })()
    : null;

  return (
    <ModalBlank
      id="event-detail-modal"
      modalOpen={isOpen}
      setModalOpen={onClose}
      contentClassName="max-w-md"
    >
      {event && (
        <div className="p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${typeBadgeClass}`}
                >
                  {typeLabel}
                </span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusClass}`}
                >
                  {statusLabel}
                </span>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                {event.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onClose(false)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            {event.propertyName && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Property
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {event.propertyName}
                  </p>
                  {event.address && (
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                      {event.address}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Scheduled Date
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {formattedDate}
                  {formattedTime && (
                    <span className="ml-1 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {formattedTime}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {event.contractorName && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Contractor
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {event.contractorName}
                  </p>
                </div>
              </div>
            )}

            {event.notes && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Notes
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                    {event.notes}
                  </p>
                </div>
              </div>
            )}

            {event.nextScheduledDate && event.type === "maintenance" && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Next Scheduled
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {new Date(event.nextScheduledDate).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-2">
              <a
                href={buildGoogleCalendarUrl(event)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <Calendar className="w-4 h-4" />
                Add to Google Calendar
              </a>
              {canDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                >
                  {deleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Delete event
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </ModalBlank>
  );
}

export default EventDetailModal;
