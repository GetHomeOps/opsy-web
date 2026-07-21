import React, {useEffect, useRef, useState} from "react";
import {
  Check,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import ModalBlank from "../../../components/ModalBlank";

function formatNoteDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function authorLabel(note) {
  const name =
    note.authorName ?? note.author_name ?? note.authorEmail ?? note.author_email;
  if (!name) return "Team member";
  return String(name).split(" ")[0] || name;
}

function noteBody(note) {
  return note.body ?? "";
}

function noteTimestamp(note) {
  return note.updatedAt ?? note.updated_at ?? note.createdAt ?? note.created_at;
}

function noteUserId(note) {
  return note.userId ?? note.user_id;
}

function NoteMenu({onEdit, onDelete, onClose}) {
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose?.();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-1 z-20 min-w-[7rem] rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg py-1"
    >
      <button
        type="button"
        onClick={() => {
          onEdit?.();
          onClose?.();
        }}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
      >
        <Pencil className="w-3.5 h-3.5" />
        Edit
      </button>
      <button
        type="button"
        onClick={() => {
          onDelete?.();
          onClose?.();
        }}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Delete
      </button>
    </div>
  );
}

/**
 * Full notes workspace for an Opsy Scout analysis.
 * Open with startComposing=true to focus the compose field immediately.
 */
export default function ScoutNotesModal({
  open,
  onClose,
  title = "Notes",
  subtitle,
  notes = [],
  loading = false,
  saving = false,
  currentUserId = null,
  startComposing = false,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
}) {
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [menuOpenId, setMenuOpenId] = useState(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setComposing(false);
      setDraft("");
      setEditingId(null);
      setEditDraft("");
      setMenuOpenId(null);
      return;
    }
    if (startComposing) {
      setComposing(true);
    } else {
      setComposing(false);
    }
  }, [open, startComposing]);

  useEffect(() => {
    if (open && composing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [open, composing]);

  async function handleSubmit() {
    const text = draft.trim();
    if (!text || saving) return;
    await onAddNote?.(text);
    setDraft("");
    setComposing(false);
  }

  async function handleSaveEdit(noteId) {
    const text = editDraft.trim();
    if (!text || saving) return;
    await onUpdateNote?.(noteId, text);
    setEditingId(null);
    setEditDraft("");
  }

  async function handleDelete(noteId) {
    if (!window.confirm("Delete this note?")) return;
    await onDeleteNote?.(noteId);
  }

  return (
    <ModalBlank
      id="scout-notes-modal"
      modalOpen={open}
      setModalOpen={(v) => {
        if (!v) onClose?.();
      }}
      contentClassName="max-w-xl"
    >
      <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-700 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
            <StickyNote className="w-5 h-5 text-amber-600 shrink-0" aria-hidden />
            {title}
            {notes.length > 0 ? (
              <span className="text-sm font-medium text-neutral-500">
                ({notes.length})
              </span>
            ) : null}
          </h2>
          {subtitle ? (
            <p className="text-sm text-neutral-500 mt-0.5 truncate">{subtitle}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          aria-label="Close notes"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
        {composing ? (
          <div className="space-y-2">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write a note…"
              rows={4}
              className="w-full text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-neutral-800 dark:text-neutral-200 resize-none focus:outline-none focus:ring-2 focus:ring-[#456564]/30"
            />
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setComposing(false);
                  setDraft("");
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || !draft.trim()}
                onClick={handleSubmit}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold btn-primary disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                Save note
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-semibold border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-[#456564]/50 hover:text-[#456564] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add note
          </button>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-neutral-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading notes…</span>
          </div>
        ) : notes.length === 0 && !composing ? (
          <p className="text-sm text-neutral-500 py-4 text-center">
            Capture walkthrough notes, seller comments, or negotiation reminders.
          </p>
        ) : (
          <ul className="space-y-2">
            {notes.map((note) => {
              const isOwner =
                currentUserId != null &&
                Number(noteUserId(note)) === Number(currentUserId);
              const isEditing = editingId === note.id;

              return (
                <li
                  key={note.id}
                  className="relative rounded-lg bg-amber-50/80 dark:bg-amber-900/15 border border-amber-100 dark:border-amber-900/30 px-3 py-2.5"
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <textarea
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        rows={3}
                        className="w-full text-sm rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2.5 py-2 text-neutral-800 dark:text-neutral-200 resize-none focus:outline-none focus:ring-2 focus:ring-[#456564]/30"
                      />
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null);
                            setEditDraft("");
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        >
                          <X className="w-3.5 h-3.5" />
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={saving || !editDraft.trim()}
                          onClick={() => handleSaveEdit(note.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold btn-primary disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start gap-2">
                        <StickyNote className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-sm text-neutral-800 dark:text-neutral-200 flex-1 min-w-0 leading-snug whitespace-pre-wrap">
                          {noteBody(note)}
                        </p>
                        {isOwner ? (
                          <div className="relative shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                setMenuOpenId(
                                  menuOpenId === note.id ? null : note.id,
                                )
                              }
                              className="p-0.5 rounded text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100/80 dark:hover:bg-neutral-800/60"
                              aria-label="Note options"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                            {menuOpenId === note.id ? (
                              <NoteMenu
                                onEdit={() => {
                                  setEditingId(note.id);
                                  setEditDraft(noteBody(note));
                                }}
                                onDelete={() => handleDelete(note.id)}
                                onClose={() => setMenuOpenId(null)}
                              />
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      <p className="text-xs text-neutral-500 mt-1.5 pl-5">
                        {authorLabel(note)} · {formatNoteDate(noteTimestamp(note))}
                      </p>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </ModalBlank>
  );
}
