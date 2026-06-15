import React from "react";
import {
  X,
  Calendar,
  Clock,
  User,
  Mail,
  ClipboardCheck,
  FileText,
  Repeat,
} from "lucide-react";
import ModalBlank from "../../../../components/ModalBlank";
import {StatusBadge} from "../passport/StatusBadge";
import {formatOverviewDate} from "../passport/SystemsOverviewPanel";

function readEventField(event, ...keys) {
  for (const key of keys) {
    const value = event?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return null;
}

function getEventType(event) {
  const raw = String(readEventField(event, "event_type", "eventType") ?? "")
    .trim()
    .toLowerCase();
  if (raw === "inspection") return "inspection";
  if (raw === "maintenance") return "maintenance";
  return null;
}

function getEventTitle(event) {
  const checklistTitle = readEventField(
    event,
    "checklist_item_title",
    "checklistItemTitle",
  );
  if (checklistTitle) return checklistTitle;

  const eventType = getEventType(event);
  if (eventType === "inspection") return "Inspection";
  if (eventType === "maintenance") return "Maintenance";

  return (
    readEventField(event, "title", "system_name", "systemName") ?? "Service"
  );
}

function formatEventTime(timeStr) {
  if (!timeStr) return null;
  const [h, m] = String(timeStr).split(":");
  const hour = parseInt(h, 10);
  if (Number.isNaN(hour)) return String(timeStr);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${(m ?? "00").slice(0, 2)} ${ampm}`;
}

function formatRecurrence(event) {
  const type = readEventField(event, "recurrence_type", "recurrenceType");
  if (!type || type === "one-time") return null;
  if (type === "quarterly") return "Every 3 months";
  if (type === "semi-annually") return "Every 6 months";
  if (type === "annually") return "Every year";
  if (type === "custom") {
    const val = readEventField(
      event,
      "recurrence_interval_value",
      "recurrenceIntervalValue",
    );
    const unit = readEventField(
      event,
      "recurrence_interval_unit",
      "recurrenceIntervalUnit",
    );
    if (val && unit) return `Every ${val} ${unit}`;
    return "Custom schedule";
  }
  return null;
}

function DetailRow({icon: Icon, label, children}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {label}
        </p>
        <div className="text-sm text-neutral-600 dark:text-neutral-400 mt-0.5">
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Read-only modal for a scheduled maintenance/inspection event on the system tab.
 */
export function ScheduledEventDetailsModal({
  event,
  systemLabel,
  isOpen,
  onClose,
}) {
  if (!event) return null;

  const eventType = getEventType(event);
  const title = getEventTitle(event);
  const contractor = readEventField(event, "contractor_name", "contractorName");
  const contractorEmail = readEventField(
    event,
    "contractor_email",
    "contractorEmail",
  );
  const replyEmail = readEventField(event, "reply_email", "replyEmail");
  const date = readEventField(event, "scheduled_date", "scheduledDate");
  const time = formatEventTime(
    readEventField(event, "scheduled_time", "scheduledTime"),
  );
  const messageBody = readEventField(
    event,
    "message_body",
    "messageBody",
    "notes",
  );
  const actionItem = readEventField(
    event,
    "checklist_item_title",
    "checklistItemTitle",
  );
  const recurrence = formatRecurrence(event);
  const statusRaw = String(readEventField(event, "status") ?? "scheduled")
    .trim()
    .toLowerCase();
  const statusLabel = statusRaw === "confirmed" ? "Confirmed" : "Scheduled";
  const formattedDate = date ? (formatOverviewDate(date) ?? date) : null;
  const messageEnabled = readEventField(
    event,
    "message_enabled",
    "messageEnabled",
  );

  return (
    <ModalBlank
      id="scheduled-event-details-modal"
      modalOpen={isOpen}
      setModalOpen={onClose}
      contentClassName="max-w-lg"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              {eventType && (
                <StatusBadge tone="emerald">
                  {eventType === "inspection" ? "Inspection" : "Maintenance"}
                </StatusBadge>
              )}
              <StatusBadge tone="brand">{statusLabel}</StatusBadge>
              {recurrence && (
                <StatusBadge tone="neutral">
                  <Repeat className="w-3 h-3" />
                  {recurrence}
                </StatusBadge>
              )}
            </div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white break-words">
              {title}
            </h2>
            {systemLabel && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                {systemLabel}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onClose(false)}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <DetailRow icon={Calendar} label="Scheduled date">
            {formattedDate || "Not set"}
            {time && (
              <span className="inline-flex items-center gap-1 ml-2 text-neutral-500">
                <Clock className="w-3.5 h-3.5" />
                {time}
              </span>
            )}
          </DetailRow>

          <DetailRow icon={User} label="Professional">
            {contractor || "No professional assigned"}
            {contractorEmail && (
              <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-0.5 truncate">
                {contractorEmail}
              </p>
            )}
          </DetailRow>

          {actionItem && (
            <DetailRow icon={ClipboardCheck} label="Linked action item">
              {actionItem}
            </DetailRow>
          )}

          {(messageBody || messageEnabled) && (
            <DetailRow icon={Mail} label="Message to contractor">
              {messageBody ? (
                <p className="whitespace-pre-wrap leading-relaxed">
                  {messageBody}
                </p>
              ) : (
                <p className="text-neutral-500 dark:text-neutral-500 italic">
                  No message was included with this event.
                </p>
              )}
              {replyEmail && (
                <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-2">
                  Reply-to: {replyEmail}
                </p>
              )}
            </DetailRow>
          )}

          {!actionItem && !messageBody && !messageEnabled && (
            <DetailRow icon={FileText} label="Additional details">
              <p className="text-neutral-500 dark:text-neutral-500 italic">
                No contractor message or linked action item for this event.
              </p>
            </DetailRow>
          )}
        </div>

        <div className="flex justify-end mt-6 pt-5 border-t border-neutral-200 dark:border-neutral-700">
          <button
            type="button"
            onClick={() => onClose(false)}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </ModalBlank>
  );
}
