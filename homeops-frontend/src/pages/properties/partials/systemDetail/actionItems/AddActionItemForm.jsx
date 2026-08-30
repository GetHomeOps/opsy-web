import React, { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import AppApi from "../../../../../api/api";

/**
 * Shared create form for custom Action Items (system tab + bid-link flow).
 */
export default function AddActionItemForm({
  systemKey,
  propertyId,
  onItemCreated,
  onCancel,
  startOpen = false,
  compact = false,
  submitLabel = "Add Action Item",
}) {
  const [isOpen, setIsOpen] = useState(Boolean(startOpen));
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("pending");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (startOpen) {
      setIsOpen(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [startOpen]);

  const handleOpen = () => {
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const resetFields = () => {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setDueDate("");
    setStatus("pending");
    setError("");
  };

  const handleCancel = () => {
    resetFields();
    setIsOpen(Boolean(startOpen));
    onCancel?.();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const item = await AppApi.createChecklistItem(propertyId, {
        systemKey,
        title: title.trim(),
        description: description.trim() || null,
        priority,
        nextDueDate: dueDate || null,
        status,
      });
      onItemCreated?.(item);
      resetFields();
      setIsOpen(Boolean(startOpen));
    } catch (err) {
      setError(err.message || "Could not add action item.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) {
    return (
      <div className={compact ? "flex justify-end" : "flex justify-end pt-1"}>
        <button
          type="button"
          onClick={handleOpen}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#456564] dark:text-[#7aa3a2] border border-[#456564]/30 dark:border-[#7aa3a2]/30 rounded-lg hover:bg-[#456564]/5 dark:hover:bg-[#7aa3a2]/10 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Action Item
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-neutral-200 dark:border-neutral-600 bg-neutral-50/50 dark:bg-neutral-800/30 p-3 space-y-2"
    >
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What needs to be done? e.g. Replace living room flooring"
        maxLength={500}
        className="w-full text-sm bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-600 rounded-md px-2.5 py-1.5 text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-[#456564] dark:focus:ring-[#7aa3a2]"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description / notes (optional)"
        rows={2}
        className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-600 rounded-md px-2.5 py-1.5 text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-[#456564] dark:focus:ring-[#7aa3a2] resize-none"
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <label className="text-[10px] uppercase tracking-wide text-neutral-400">
          Priority
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="mt-1 w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-600 rounded-md px-2 py-1.5 text-neutral-700 dark:text-neutral-300"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>
        <label className="text-[10px] uppercase tracking-wide text-neutral-400">
          Due date
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="mt-1 w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-600 rounded-md px-2 py-1.5 text-neutral-700 dark:text-neutral-300"
          />
        </label>
        <label className="text-[10px] uppercase tracking-wide text-neutral-400">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-600 rounded-md px-2 py-1.5 text-neutral-700 dark:text-neutral-300"
          >
            <option value="pending">Pending</option>
            <option value="in_progress">In progress</option>
          </select>
        </label>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleCancel}
          disabled={saving}
          className="text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 px-2 py-1"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!title.trim() || saving}
          className="text-xs font-medium px-3 py-1.5 rounded-lg btn-primary disabled:opacity-50"
        >
          {saving ? "Adding…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
