import React, { useState } from "react";
import { Trash2 } from "lucide-react";

const FREQUENCY_UNITS = ["days", "weeks", "months", "years"];

/** Inline editor for a recommendation's maintenance cadence. */
export default function RecommendationDateEditor({
  item,
  onSave,
  onClose,
  onDelete,
  className = "",
}) {
  const [frequency, setFrequency] = useState(
    item.frequency != null ? String(item.frequency) : "",
  );
  const [frequencyUnit, setFrequencyUnit] = useState(item.frequency_unit || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        frequency: frequency === "" ? null : Number(frequency),
        frequency_unit: frequencyUnit || null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const fieldClass =
    "form-input w-full text-xs py-1.5 dark:bg-gray-700/50 dark:border-gray-600";
  const labelClass =
    "block text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1";

  return (
    <div
      className={`rounded-lg border border-gray-100 dark:border-gray-700/50 bg-gray-50/70 dark:bg-gray-800/40 p-3 space-y-3 ${className}`}
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Frequency</label>
          <input
            type="number"
            min={1}
            className={fieldClass}
            value={frequency}
            placeholder="e.g. 3"
            onChange={(e) => setFrequency(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Unit</label>
          <select
            className={fieldClass}
            value={frequencyUnit}
            onChange={(e) => setFrequencyUnit(e.target.value)}
          >
            <option value="">None</option>
            {FREQUENCY_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center justify-between pt-1">
        {onDelete ? (
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-red-500 hover:text-red-600"
          >
            <Trash2 className="w-3 h-3" />
            Remove (not applicable)
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-2 py-1"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="text-[11px] font-medium px-3 py-1 rounded bg-gray-900 text-gray-100 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-800 dark:hover:bg-white"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
