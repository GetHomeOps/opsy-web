import React, {useEffect, useState} from "react";
import {X} from "lucide-react";

import ModalBlank from "../../../components/ModalBlank";

/** Canonical systems available for templates (excludes "inspections"). */
const FREQUENCY_UNITS = ["days", "weeks", "months", "years"];
const PRIORITIES = ["urgent", "high", "medium", "low"];

const EMPTY_FORM = {
  system_key: "",
  title: "",
  description: "",
  frequency: "",
  frequency_unit: "",
  priority: "medium",
  lifecycle_replacement_years: "",
  active: true,
};

function toFormState(template, defaultSystemKey) {
  if (!template) {
    return {...EMPTY_FORM, system_key: defaultSystemKey || ""};
  }
  return {
    system_key: template.system_key || "",
    title: template.title || "",
    description: template.description || "",
    frequency: template.frequency ?? "",
    frequency_unit: template.frequency_unit || "",
    priority: template.priority || "medium",
    lifecycle_replacement_years: template.lifecycle_replacement_years ?? "",
    active: template.active !== false,
  };
}

/**
 * Create / edit modal for a single system recommendation template.
 *
 * Props:
 * - open, setOpen
 * - template: existing template to edit (null for create)
 * - defaultSystemKey: preselect a system when creating
 * - systemOptions: [{ id, name }]
 * - onSubmit(payload): async; payload uses snake_case keys for the API
 */
function SystemRecommendationFormModal({
  open,
  setOpen,
  template,
  defaultSystemKey,
  systemOptions = [],
  onSubmit,
}) {
  const isEdit = Boolean(template);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(toFormState(template, defaultSystemKey));
      setError("");
      setSubmitting(false);
    }
  }, [open, template, defaultSystemKey]);

  const update = (field, value) => setForm((prev) => ({...prev, [field]: value}));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.system_key) {
      setError("Please choose a system.");
      return;
    }
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }

    const payload = {
      system_key: form.system_key,
      title: form.title.trim(),
      description: form.description.trim() || null,
      frequency: form.frequency === "" ? null : Number(form.frequency),
      frequency_unit: form.frequency_unit || null,
      priority: form.priority || "medium",
      lifecycle_replacement_years:
        form.lifecycle_replacement_years === ""
          ? null
          : Number(form.lifecycle_replacement_years),
      active: Boolean(form.active),
    };

    try {
      setSubmitting(true);
      setError("");
      await onSubmit(payload);
      setOpen(false);
    } catch (err) {
      setError(err?.message || "Could not save the recommendation.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "form-input w-full text-sm dark:bg-gray-700/50 dark:border-gray-600";
  const labelClass =
    "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

  return (
    <ModalBlank modalOpen={open} setModalOpen={setOpen} contentClassName="max-w-xl">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700/60">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
          {isEdit ? "Edit recommendation" : "New recommendation"}
        </h2>
        <button
          type="button"
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          onClick={() => setOpen(false)}
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 px-3 py-2 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        <div>
          <label className={labelClass} htmlFor="rec-system">
            System
          </label>
          <select
            id="rec-system"
            className={inputClass}
            value={form.system_key}
            onChange={(e) => update("system_key", e.target.value)}
          >
            <option value="">Select a system…</option>
            {systemOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="rec-title">
            Title
          </label>
          <input
            id="rec-title"
            type="text"
            maxLength={500}
            className={inputClass}
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="e.g. Replace air filter"
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="rec-description">
            Description
          </label>
          <textarea
            id="rec-description"
            rows={3}
            className={inputClass}
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder="What the homeowner should do and why."
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="rec-frequency">
              Frequency
            </label>
            <input
              id="rec-frequency"
              type="number"
              min={1}
              className={inputClass}
              value={form.frequency}
              onChange={(e) => update("frequency", e.target.value)}
              placeholder="e.g. 3"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="rec-frequency-unit">
              Frequency unit
            </label>
            <select
              id="rec-frequency-unit"
              className={inputClass}
              value={form.frequency_unit}
              onChange={(e) => update("frequency_unit", e.target.value)}
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="rec-priority">
              Priority
            </label>
            <select
              id="rec-priority"
              className={inputClass}
              value={form.priority}
              onChange={(e) => update("priority", e.target.value)}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="rec-lifecycle">
              Lifecycle replacement (years)
            </label>
            <input
              id="rec-lifecycle"
              type="number"
              min={1}
              className={inputClass}
              value={form.lifecycle_replacement_years}
              onChange={(e) =>
                update("lifecycle_replacement_years", e.target.value)
              }
              placeholder="optional"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            className="form-checkbox"
            checked={form.active}
            onChange={(e) => update("active", e.target.checked)}
          />
          Active (generated for new properties)
        </label>

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700/60">
          <button
            type="button"
            className="btn-sm border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-sm bg-gray-900 text-gray-100 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-800 dark:hover:bg-white"
            disabled={submitting}
          >
            {submitting ? "Saving…" : isEdit ? "Save changes" : "Create"}
          </button>
        </div>
      </form>
    </ModalBlank>
  );
}

export default SystemRecommendationFormModal;
