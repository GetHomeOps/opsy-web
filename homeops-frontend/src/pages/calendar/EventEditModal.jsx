import React, {useState, useEffect} from "react";
import {X, Loader2, Calendar, Clock, FileText, CheckCircle} from "lucide-react";
import ModalBlank from "../../components/ModalBlank";
import DatePickerInput from "../../components/DatePickerInput";
import AppApi from "../../api/api";

const STATUS_OPTIONS = [
  {value: "scheduled", label: "Scheduled", color: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"},
  {value: "completed", label: "Completed", color: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"},
  {value: "cancelled", label: "Cancelled", color: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"},
];

function EventEditModal({event, isOpen, onClose, onUpdated}) {
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("scheduled");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && event) {
      setScheduledDate(event.date || "");
      setScheduledTime(event.scheduledTime || "");
      setNotes(event.notes || "");
      setStatus(event.status || "scheduled");
      setError(null);
    }
  }, [isOpen, event]);

  const handleSave = async () => {
    if (!event?.id || saving) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        scheduled_date: scheduledDate,
        status,
      };
      if (scheduledTime) {
        payload.scheduled_time = scheduledTime;
      } else {
        payload.scheduled_time = null;
      }
      if (notes.trim()) {
        payload.message_body = notes.trim();
      }
      await AppApi.updateMaintenanceEvent(event.id, payload);
      onUpdated?.();
      onClose(false);
    } catch (err) {
      console.error("Failed to update event:", err);
      setError(err?.message || "Failed to update event. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    scheduledDate !== (event?.date || "") ||
    scheduledTime !== (event?.scheduledTime || "") ||
    notes !== (event?.notes || "") ||
    status !== (event?.status || "scheduled");

  return (
    <ModalBlank
      id="event-edit-modal"
      modalOpen={isOpen}
      setModalOpen={onClose}
      backdropZClassName="z-[300]"
      dialogZClassName="z-[300]"
      contentClassName="max-w-md"
    >
      {event && (
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Edit Event
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {event.title}
                {event.propertyName ? ` — ${event.propertyName}` : ""}
              </p>
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
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                <Calendar className="w-4 h-4 text-[#456564]" />
                Date
              </label>
              <DatePickerInput
                name="scheduled_date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                placeholder="Select date"
                popoverClassName="z-[310]"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                <Clock className="w-4 h-4 text-[#456564]" />
                Time
                <span className="text-xs font-normal text-gray-400">(optional)</span>
              </label>
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="form-input w-full"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                <FileText className="w-4 h-4 text-[#456564]" />
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="form-textarea w-full"
                placeholder="Add notes..."
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                <CheckCircle className="w-4 h-4 text-[#456564]" />
                Status
              </label>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatus(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      status === opt.value
                        ? `${opt.color} ring-2 ring-offset-1 ring-gray-400 dark:ring-gray-500 dark:ring-offset-gray-800`
                        : "bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => onClose(false)}
              className="btn border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !scheduledDate || !hasChanges}
              className="flex items-center gap-2 btn bg-[#456564] hover:bg-[#34514f] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      )}
    </ModalBlank>
  );
}

export default EventEditModal;
