import React, { useState, useEffect, useRef } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import {
  CANNED_PLACEHOLDER_VARIABLES,
  resolveCannedPlaceholders,
} from "./cannedResponsesStorage";
import useSuppressBrowserAddressAutofill from "../../../../hooks/useSuppressBrowserAddressAutofill";

function CannedResponseModal({ open, onClose, initial, onSave, heading, ticket }) {
  const [title, setTitle] = useState("");
  const [shortcutKey, setShortcutKey] = useState("");
  const [body, setBody] = useState("");
  const [formError, setFormError] = useState("");
  const bodyRef = useRef(null);
  const bindTitleInput = useSuppressBrowserAddressAutofill("canned-response-title");
  const bindShortcutInput = useSuppressBrowserAddressAutofill("canned-response-shortcut");

  useEffect(() => {
    if (!open) return;
    setFormError("");
    if (initial) {
      setTitle(initial.title ?? "");
      setShortcutKey(initial.shortcutKey ?? "");
      setBody(initial.body ?? "");
    } else {
      setTitle("");
      setShortcutKey("");
      setBody("");
    }
  }, [open, initial]);

  function insertPlaceholderKey(key) {
    const token = `[${key}]`;
    const el = bodyRef.current;
    if (el && typeof el.selectionStart === "number") {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      setBody((prev) => prev.slice(0, start) + token + prev.slice(end));
      requestAnimationFrame(() => {
        const pos = start + token.length;
        el.selectionStart = el.selectionEnd = pos;
        el.focus();
      });
    } else {
      setBody((prev) => (prev ? `${prev}${token}` : token));
    }
  }

  const previewText =
    ticket && /\[[a-zA-Z]/.test(body)
      ? resolveCannedPlaceholders(body, ticket)
      : null;

  if (!open) return null;

  function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    const result = onSave({ title, shortcutKey, body });
    if (result?.ok === false) {
      setFormError(result.error || "Could not save.");
      return;
    }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="canned-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl max-h-[90vh] overflow-y-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2
            id="canned-modal-title"
            className="text-sm font-semibold text-gray-900 dark:text-gray-100"
          >
            {heading}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-4 py-4 space-y-3">
          <div>
            <label
              htmlFor="canned-title"
              className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1"
            >
              Title
            </label>
            <input
              id="canned-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-[#456564] focus:border-[#456564]"
              placeholder="e.g. Acknowledge feedback"
              {...bindTitleInput()}
            />
          </div>
          <div>
            <label
              htmlFor="canned-shortcut"
              className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1"
            >
              Shortcut
            </label>
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-gray-400 dark:text-gray-500 shrink-0">
                /
              </span>
              <input
                id="canned-shortcut"
                type="text"
                value={shortcutKey}
                onChange={(e) =>
                  setShortcutKey(e.target.value.replace(/[^a-zA-Z0-9-]/g, ""))
                }
                className="flex-1 min-w-0 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-[#456564] focus:border-[#456564] font-mono"
                placeholder="thanks"
                spellCheck={false}
                {...bindShortcutInput()}
              />
            </div>
            <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
              Type <span className="font-mono">/shortcut</span> in the reply box,
              then Space or Enter to insert (placeholders are filled in for this ticket).
            </p>
          </div>
          <div>
            <label
              htmlFor="canned-body"
              className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1"
            >
              Message
            </label>
            <textarea
              ref={bodyRef}
              id="canned-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-[#456564] focus:border-[#456564] resize-y min-h-[100px] max-h-[min(16rem,40vh)]"
              placeholder='e.g. Hi [firstName], …'
            />
            <div className="mt-2">
              <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                Insert variable
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CANNED_PLACEHOLDER_VARIABLES.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertPlaceholderKey(v.key)}
                    className="text-[11px] font-mono px-2 py-1 rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/80 transition-colors"
                    title={`${v.label} (${v.hint})`}
                  >
                    [{v.key}]
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
                Variables use the ticket requester (submitter) and ticket fields. Type{" "}
                <span className="font-mono">[firstName]</span> or use the buttons above.
              </p>
            </div>
            {previewText != null && (
              <div className="mt-2 rounded-lg border border-dashed border-gray-200 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-800/40 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">
                  Preview for this ticket
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-snug">
                  {previewText}
                </p>
              </div>
            )}
          </div>
          {formError && (
            <p className="text-xs text-red-600 dark:text-red-400">{formError}</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 text-sm font-medium rounded-lg bg-[#456564] hover:bg-[#34514f] text-white"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DefaultAnswersTab({ ticket, onInsertSnippet, canned }) {
  const { items, add, update, remove } = canned;
  const [modal, setModal] = useState(null);

  function openAdd() {
    setModal({ mode: "add", initial: null });
  }

  function openEdit(item) {
    setModal({
      mode: "edit",
      id: item.id,
      initial: {
        title: item.title,
        shortcutKey: item.shortcutKey,
        body: item.body,
      },
    });
  }

  function closeModal() {
    setModal(null);
  }

  function handleSave(draft) {
    if (modal?.mode === "add") {
      return add(draft);
    }
    if (modal?.mode === "edit" && modal.id) {
      return update(modal.id, draft);
    }
    return { ok: false, error: "Invalid state." };
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed flex-1 min-w-0">
          Click a card to insert with{" "}
          <span className="font-mono text-gray-600 dark:text-gray-300">[variables]</span>{" "}
          filled for this ticket. Use{" "}
          <span className="font-mono text-gray-600 dark:text-gray-300">/shortcut</span>{" "}
          in the composer, then Space or Enter.
        </p>
        <button
          type="button"
          onClick={openAdd}
          className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-[#456564] hover:bg-[#34514f] text-white transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>

      <ul className="space-y-3">
        {items.map((item) => {
          const hasVars = /\[[a-zA-Z]/.test(item.body);
          const preview =
            hasVars && ticket
              ? resolveCannedPlaceholders(item.body, ticket)
              : null;
          return (
            <li key={item.id}>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 overflow-hidden">
                <div className="flex items-start justify-between gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-700/80 bg-gray-50/80 dark:bg-gray-900/40">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {item.title}
                      </span>
                      <span
                        className="shrink-0 text-[11px] font-mono px-1.5 py-0.5 rounded bg-gray-200/80 dark:bg-gray-700/80 text-gray-600 dark:text-gray-300"
                        title={`Shortcut: /${item.shortcutKey}`}
                      >
                        /{item.shortcutKey}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className="p-1.5 rounded-md text-gray-400 hover:text-[#456564] dark:hover:text-[#7a9e9c] hover:bg-gray-100 dark:hover:bg-gray-800"
                      aria-label={`Edit ${item.title}`}
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {!item.builtin && (
                      <button
                        type="button"
                        onClick={() => remove(item.id)}
                        className="p-1.5 rounded-md text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                        aria-label={`Delete ${item.title}`}
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onInsertSnippet?.(item.body)}
                  className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
                >
                  <span className="block text-sm text-gray-700 dark:text-gray-300 leading-snug whitespace-pre-wrap">
                    {item.body}
                  </span>
                  {preview != null && preview !== item.body && (
                    <span className="mt-2 block text-[11px] text-gray-500 dark:text-gray-400 leading-snug border-t border-dashed border-gray-200 dark:border-gray-600 pt-2">
                      <span className="font-medium text-gray-400 dark:text-gray-500">
                        Preview:{" "}
                      </span>
                      {preview}
                    </span>
                  )}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <CannedResponseModal
        open={modal != null}
        onClose={closeModal}
        initial={modal?.initial}
        ticket={ticket}
        heading={
          modal?.mode === "add"
            ? "New canned response"
            : "Edit canned response"
        }
        onSave={handleSave}
      />
    </div>
  );
}

export default DefaultAnswersTab;
