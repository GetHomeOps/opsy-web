import React, {useState, useEffect} from "react";
import {
  X,
  MapPin,
  User,
  FileText,
  Calendar,
  Clock,
  Trash2,
  Loader2,
  Pencil,
  Repeat,
  Bell,
} from "lucide-react";
import ModalBlank from "../../components/ModalBlank";
import AppApi from "../../api/api";
import {buildGoogleCalendarUrl} from "../../lib/googleCalendarLink";
import {parseDateInput} from "../../lib/dateOffset";
import EventEditModal from "./EventEditModal";

const ALERT_TIMING_LABELS = {
  "1d": "1 day before",
  "3d": "3 days before",
  "1w": "1 week before",
  "2w": "2 weeks before",
};

function recurrenceLabel(event) {
  const t = event?.recurrenceType;
  if (!t || t === "one-time") return null;
  if (t === "quarterly") return "Every 3 months (quarterly)";
  if (t === "semi-annually") return "Every 6 months (semi-annually)";
  if (t === "annually") return "Every year (annually)";
  if (t === "custom") {
    const v = event.recurrenceIntervalValue;
    const u = event.recurrenceIntervalUnit;
    if (v && u) return `Every ${v} ${u}`;
    return "Custom interval";
  }
  return null;
}

function reminderLabel(event) {
  const timing = event?.alertTiming;
  if (!timing) return null;
  if (timing === "custom") {
    const days = event.alertCustomDays;
    return days ? `${days} day${days === 1 ? "" : "s"} before` : "Custom";
  }
  return ALERT_TIMING_LABELS[timing] || null;
}

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

function EventDetailModal({event, isOpen, onClose, onDeleted, onUpdated}) {
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteScope, setDeleteScope] = useState("single"); // "single" | "series"
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [series, setSeries] = useState([]);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const canDelete =
    event?.id != null && !String(event.id).startsWith("system-");
  const canEdit =
    event?.id != null && !String(event.id).startsWith("system-");

  const isRecurring =
    event?.recurrenceType && event.recurrenceType !== "one-time";
  const recurrenceText = recurrenceLabel(event);
  const reminderText = reminderLabel(event);

  useEffect(() => {
    if (!isOpen) {
      setDeleteConfirmOpen(false);
      setEditModalOpen(false);
      setDeleteScope("single");
      setSeries([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !event?.id || !isRecurring || !canDelete) return;
    let cancelled = false;
    setSeriesLoading(true);
    AppApi.getMaintenanceEventSeries(event.id)
      .then((rows) => {
        if (!cancelled) setSeries(rows || []);
      })
      .catch(() => {
        if (!cancelled) setSeries([]);
      })
      .finally(() => {
        if (!cancelled) setSeriesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, event?.id, isRecurring, canDelete]);

  const openDeleteConfirm = () => {
    if (!canDelete || deleting) return;
    setDeleteScope("single");
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteEvent = async () => {
    if (!canDelete || deleting || !event?.id) return;
    setDeleting(true);
    try {
      if (deleteScope === "series" && series.length > 1) {
        await AppApi.deleteMaintenanceEvent(event.id, {scope: "series"});
      } else {
        await AppApi.deleteMaintenanceEvent(event.id);
      }
      setDeleteConfirmOpen(false);
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

  const eventDate = event?.date ? parseDateInput(event.date) : null;
  const formattedDate = eventDate
    ? eventDate.toLocaleDateString("en-US", {
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
    <>
    <ModalBlank
      id="event-detail-modal"
      modalOpen={isOpen}
      setModalOpen={onClose}
      contentClassName="max-w-md"
      closeOnEscape={!deleteConfirmOpen}
      closeOnClickOutside={!deleteConfirmOpen}
      closeOnBackdropClick={!deleteConfirmOpen}
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

            {recurrenceText && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                  <Repeat className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Recurrence
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {recurrenceText}
                  </p>
                  {seriesLoading ? (
                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Loading series...
                    </p>
                  ) : series.length > 1 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {series.length} occurrences scheduled
                      {(() => {
                        const currentEventDate = parseDateInput(event.date);
                        if (!currentEventDate) return "";
                        const nextOccurrence = series.find((row) => {
                          const occurrenceDate = parseDateInput(
                            row.scheduled_date,
                          );
                          return (
                            occurrenceDate &&
                            occurrenceDate.getTime() >
                              currentEventDate.getTime()
                          );
                        });
                        if (!nextOccurrence) return "";
                        const nextDate = nextOccurrence.scheduled_date;
                        const parsed = parseDateInput(nextDate);
                        if (!parsed) return "";
                        return ` · next on ${parsed.toLocaleDateString(
                          "en-US",
                          {month: "short", day: "numeric", year: "numeric"},
                        )}`;
                      })()}
                    </p>
                  ) : null}
                </div>
              </div>
            )}

            {reminderText && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                  <Bell className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Reminder
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {reminderText}
                  </p>
                </div>
              </div>
            )}

            {event.nextScheduledDate && event.type === "maintenance" && parseDateInput(event.nextScheduledDate) && !recurrenceText && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Next Scheduled
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {parseDateInput(event.nextScheduledDate)?.toLocaleDateString("en-US", {
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
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setEditModalOpen(true)}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-[#456564] dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                  Edit event
                </button>
              )}
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
                  onClick={openDeleteConfirm}
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

    <ModalBlank
      id="event-delete-confirm-modal"
      modalOpen={deleteConfirmOpen}
      setModalOpen={setDeleteConfirmOpen}
      backdropZClassName="z-[300]"
      dialogZClassName="z-[300]"
      contentClassName="max-w-lg"
    >
      <div className="p-5 flex space-x-4">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-gray-100 dark:bg-gray-700">
          <svg
            className="shrink-0 fill-current text-red-500"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            aria-hidden
          >
            <path d="M8 0C3.6 0 0 3.6 0 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm0 12c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1zm1-3H7V4h2v5z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="mb-2">
            <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              {isRecurring && series.length > 1
                ? "Delete recurring event?"
                : "Delete this event?"}
            </div>
          </div>
          {isRecurring && series.length > 1 ? (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                This event is part of a recurring series with {series.length}{" "}
                occurrences.
              </p>
              <fieldset className="space-y-2 mb-5">
                <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input
                    type="radio"
                    name="event-delete-scope"
                    value="single"
                    checked={deleteScope === "single"}
                    onChange={() => setDeleteScope("single")}
                    className="form-radio mt-0.5 text-[#456564]"
                  />
                  <span>
                    <span className="font-medium">This event only</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      Other occurrences in the series stay scheduled.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input
                    type="radio"
                    name="event-delete-scope"
                    value="series"
                    checked={deleteScope === "series"}
                    onChange={() => setDeleteScope("series")}
                    className="form-radio mt-0.5 text-[#456564]"
                  />
                  <span>
                    <span className="font-medium">
                      Entire series ({series.length} events)
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      Removes every past and future occurrence.
                    </span>
                  </span>
                </label>
              </fieldset>
            </>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              Are you sure you want to delete this event? This action cannot be
              undone.
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="btn-sm border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 text-gray-800 dark:text-gray-300"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-sm bg-red-500 hover:bg-red-600 text-white"
              onClick={confirmDeleteEvent}
              disabled={deleting}
            >
              {deleting
                ? "Deleting..."
                : deleteScope === "series" && isRecurring && series.length > 1
                  ? `Delete ${series.length} events`
                  : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </ModalBlank>

    <EventEditModal
      event={event}
      isOpen={editModalOpen}
      onClose={setEditModalOpen}
      onUpdated={() => {
        onUpdated?.();
        onClose(false);
      }}
    />
    </>
  );
}

export default EventDetailModal;
