import React from "react";
import {Loader2, Plus, StickyNote} from "lucide-react";
import SectionCard from "../../properties/partials/passport/SectionCard";

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

/**
 * Glanceable notes preview for Overview. Full CRUD lives in ScoutNotesModal.
 */
export default function ScoutNotesCard({
  notes = [],
  loading = false,
  onAddNote,
  onOpenNotes,
}) {
  const recent = notes.slice(0, 3);

  return (
    <SectionCard
      title="Notes"
      icon={StickyNote}
      badge={
        notes.length > 0 ? (
          <span className="text-xs font-semibold tabular-nums text-neutral-500">
            {notes.length}
          </span>
        ) : null
      }
      action={
        <div className="flex items-center gap-3">
          {notes.length > 0 ? (
            <button
              type="button"
              onClick={onOpenNotes}
              className="text-xs font-semibold text-[#456564] hover:underline"
            >
              Open notes
            </button>
          ) : null}
          <button
            type="button"
            onClick={onAddNote}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#456564] hover:underline"
          >
            <Plus className="w-3.5 h-3.5" />
            Add note
          </button>
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-6 text-neutral-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs">Loading notes…</span>
        </div>
      ) : recent.length === 0 ? (
        <div className="py-2 space-y-3">
          <p className="text-sm text-neutral-500">
            Capture walkthrough notes, seller comments, or negotiation reminders.
          </p>
          <button
            type="button"
            onClick={onAddNote}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-[#456564]/50 hover:text-[#456564] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add note
          </button>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {recent.map((note) => {
            const body = note.body ?? "";
            const ts =
              note.updatedAt ??
              note.updated_at ??
              note.createdAt ??
              note.created_at;
            return (
              <li
                key={note.id}
                className="rounded-md bg-amber-50/80 dark:bg-amber-900/15 border border-amber-100 dark:border-amber-900/30 px-2.5 py-1.5"
              >
                <div className="flex items-start gap-1.5">
                  <StickyNote className="w-3 h-3 text-amber-600 shrink-0 mt-0.5" />
                  <p
                    className="text-xs text-neutral-800 dark:text-neutral-200 flex-1 min-w-0 leading-snug line-clamp-2"
                    title={body}
                  >
                    {body}
                  </p>
                </div>
                <p className="text-[10px] text-neutral-500 mt-0.5 pl-[18px]">
                  {authorLabel(note)} · {formatNoteDate(ts)}
                </p>
              </li>
            );
          })}
          {notes.length > 3 ? (
            <li>
              <button
                type="button"
                onClick={onOpenNotes}
                className="w-full text-center text-xs font-semibold text-[#456564] hover:underline py-1"
              >
                View all {notes.length} notes →
              </button>
            </li>
          ) : null}
        </ul>
      )}
    </SectionCard>
  );
}
