import React, {useState, useRef, useEffect} from "react";
import {
  StickyNote,
  Plus,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
  Check,
} from "lucide-react";
import SectionCard from "./SectionCard";

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

function NoteMenu({onEdit, onDelete, onClose}) {
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose?.();
    };
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

function PropertyNotesCard({
  notes = [],
  loading = false,
  saving = false,
  currentUserId = null,
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

  const recentNotes = notes.slice(0, 3);

  useEffect(() => {
    if (composing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [composing]);

  const handleSubmit = async () => {
    const text = draft.trim();
    if (!text || saving) return;
    await onAddNote?.(text);
    setDraft("");
    setComposing(false);
  };

  const handleSaveEdit = async (noteId) => {
    const text = editDraft.trim();
    if (!text || saving) return;
    await onUpdateNote?.(noteId, text);
    setEditingId(null);
    setEditDraft("");
  };

  const handleDelete = async (noteId) => {
    if (!window.confirm("Delete this note?")) return;
    await onDeleteNote?.(noteId);
  };

  return (
    <SectionCard
      flat
      title="Recent Notes"
      icon={StickyNote}
      action={
        notes.length > 3 ? (
          <span className="text-xs font-semibold text-[#456564] dark:text-[#7fa3a1]">
            View All
          </span>
        ) : null
      }
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-6 text-neutral-500 dark:text-neutral-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs">Loading notes…</span>
        </div>
      ) : (
        <div className="space-y-1.5">
          {recentNotes.length > 0 ? (
            <ul className="space-y-1.5">
              {recentNotes.map((note) => {
                const isOwner =
                  currentUserId != null &&
                  Number(note.user_id ?? note.userId) === Number(currentUserId);
                const isEditing = editingId === note.id;
                const author =
                  note.author_name ??
                  note.authorName ??
                  note.author_email ??
                  note.authorEmail ??
                  "Team member";

                return (
                  <li
                    key={note.id}
                    className="relative rounded-md bg-amber-50/80 dark:bg-amber-900/15 border border-amber-100 dark:border-amber-900/30 px-2.5 py-1.5"
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
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                          >
                            <X className="w-3.5 h-3.5" />
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={saving || !editDraft.trim()}
                            onClick={() => handleSaveEdit(note.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-white bg-[#456564] hover:bg-[#34514f] disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start gap-1.5">
                          <StickyNote className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <p
                            className="text-[11px] text-neutral-800 dark:text-neutral-200 flex-1 min-w-0 leading-snug truncate"
                            title={note.body}
                          >
                            {note.body}
                          </p>
                          {isOwner && (
                            <div className="relative shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  setMenuOpenId(
                                    menuOpenId === note.id ? null : note.id,
                                  )
                                }
                                className="p-0.5 rounded text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100/80 dark:hover:bg-neutral-800/60"
                                aria-label="Note options"
                              >
                                <MoreHorizontal className="w-3.5 h-3.5" />
                              </button>
                              {menuOpenId === note.id && (
                                <NoteMenu
                                  onEdit={() => {
                                    setEditingId(note.id);
                                    setEditDraft(note.body ?? "");
                                  }}
                                  onDelete={() => handleDelete(note.id)}
                                  onClose={() => setMenuOpenId(null)}
                                />
                              )}
                            </div>
                          )}
                        </div>
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 pl-[18px] truncate">
                          {author} ·{" "}
                          {formatNoteDate(
                            note.updated_at ?? note.updatedAt ?? note.created_at,
                          )}
                        </p>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : !composing ? (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 py-2">
              Add notes about contractors, repairs, or anything your team should
              know.
            </p>
          ) : null}

          {composing ? (
            <div className="space-y-2 pt-1">
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write a note…"
                rows={3}
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
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#456564] hover:bg-[#34514f] disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  Save Note
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setComposing(true)}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-[#456564]/50 hover:text-[#456564] dark:hover:text-[#7fa3a1] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Note
            </button>
          )}
        </div>
      )}
    </SectionCard>
  );
}

export default PropertyNotesCard;
