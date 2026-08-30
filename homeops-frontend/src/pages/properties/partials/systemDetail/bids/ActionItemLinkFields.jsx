import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import AppApi from "../../../../../api/api";
import AddActionItemForm from "../actionItems/AddActionItemForm";

/**
 * Shared Action Item picker + create form for linking a document to a project.
 * `embedded` is used inside the analysis prompt (link on select/create).
 * `modal` keeps an explicit Link + Skip footer for the standalone panel.
 */
export default function ActionItemLinkFields({
  active = true,
  variant = "embedded",
  propertyId,
  systemKey,
  documentId,
  initialChecklistItemId = null,
  onLinked,
  onSkip,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [creating, setCreating] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!active || !propertyId || !systemKey) return;
    let cancelled = false;
    const preselected = initialChecklistItemId
      ? String(initialChecklistItemId)
      : "";
    setLoading(true);
    setError("");
    setSkipped(false);
    setSelectedId(preselected);
    AppApi.getInspectionChecklist(propertyId, { systemKey })
      .then((rows) => {
        if (cancelled) return;
        const next = rows || [];
        setItems(next);
        setCreating(!next.length && !preselected);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Could not load action items.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Seed from initialChecklistItemId only when the document/system context changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid refetch after onLinked updates the parent id
  }, [active, propertyId, systemKey, documentId]);

  const linkTo = async (itemId) => {
    if (!documentId || !itemId) return;
    setSaving(true);
    setError("");
    try {
      await AppApi.updatePropertyDocument(documentId, {
        checklist_item_id: itemId,
      });
      onLinked?.(itemId);
    } catch (err) {
      setError(err.message || "Could not link this document.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelCreate = () => {
    setCreating(false);
    if (items.length === 0) {
      setSkipped(true);
    }
  };

  const handleItemCreated = (item) => {
    if (!item?.id) return;
    setItems((prev) => [...prev, item]);
    setSelectedId(String(item.id));
    setSkipped(false);
    setCreating(false);
    linkTo(item.id);
  };

  const handleSelect = (value) => {
    setSelectedId(value);
    if (value && variant === "embedded") linkTo(value);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedId) linkTo(selectedId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin text-[#456564]" />
      </div>
    );
  }

  if (skipped && !creating) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Continue without an action item.
        </p>
        <button
          type="button"
          onClick={() => {
            setSkipped(false);
            setCreating(true);
          }}
          className="text-xs font-medium text-[#456564] hover:underline"
        >
          + Create new Action Item
        </button>
        {variant === "modal" && (
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={onSkip}
              className="text-xs font-medium text-gray-500 px-2 py-1"
            >
              Skip for now
            </button>
          </div>
        )}
      </div>
    );
  }

  if (creating) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {items.length === 0
            ? "This system has no Action Items yet. Create one to keep this document with the project."
            : "Create a new Action Item without losing this document."}
        </p>
        <AddActionItemForm
          propertyId={propertyId}
          systemKey={systemKey}
          startOpen
          submitLabel="Create and link"
          onItemCreated={handleItemCreated}
          onCancel={handleCancelCreate}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">
        Action Item
        <select
          value={selectedId}
          onChange={(e) => handleSelect(e.target.value)}
          disabled={saving}
          className="mt-1.5 w-full text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md px-2.5 py-2"
        >
          <option value="">Select an Action Item…</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="text-xs font-medium text-[#456564] hover:underline"
      >
        + Create new Action Item
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {variant === "modal" && (
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onSkip}
            className="text-xs font-medium text-gray-500 px-2 py-1"
          >
            Skip for now
          </button>
          <button
            type="submit"
            disabled={!selectedId || saving}
            className="btn-primary text-xs px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            {saving ? "Linking…" : "Link"}
          </button>
        </div>
      )}
    </form>
  );
}
