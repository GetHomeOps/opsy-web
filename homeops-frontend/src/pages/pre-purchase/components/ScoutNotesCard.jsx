import React, {useState} from "react";
import {ChevronLeft, ChevronRight, Loader2, Plus, StickyNote, X} from "lucide-react";
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

function noteImageUrls(note) {
  return Array.isArray(note.imageUrls)
    ? note.imageUrls
    : Array.isArray(note.image_urls)
      ? note.image_urls
      : [];
}

function NoteThumbnails({urls}) {
  const [expandedIndex, setExpandedIndex] = useState(null);
  const valid = (urls || []).filter(Boolean).slice(0, 2);
  if (valid.length === 0) return null;

  const hasCarousel = valid.length > 1;
  const isExpanded = expandedIndex != null && valid[expandedIndex];

  function goPrev(e) {
    e.stopPropagation();
    setExpandedIndex((prev) =>
      prev == null ? 0 : (prev - 1 + valid.length) % valid.length,
    );
  }

  function goNext(e) {
    e.stopPropagation();
    setExpandedIndex((prev) =>
      prev == null ? 0 : (prev + 1) % valid.length,
    );
  }

  return (
    <div className="mt-1 pl-[18px] space-y-1">
      <div className="flex items-center gap-1">
        {valid.map((url, i) => {
          const selected = expandedIndex === i;
          return (
            <button
              key={`${url}-${i}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpandedIndex((prev) => (prev === i ? null : i));
              }}
              aria-expanded={selected}
              aria-label={
                selected
                  ? `Collapse note image ${i + 1}`
                  : `Expand note image ${i + 1}`
              }
              className={`w-8 h-8 shrink-0 rounded overflow-hidden border bg-white/60 hover:opacity-90 transition-all ${
                selected
                  ? "border-[#456564] ring-1 ring-[#456564]/40"
                  : "border-amber-200/80 dark:border-amber-800/40"
              }`}
            >
              <img
                src={url}
                alt={`Note image ${i + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          );
        })}
      </div>
      {isExpanded ? (
        <div className="relative w-full rounded overflow-hidden border border-amber-200/80 dark:border-amber-800/40 bg-white/80 dark:bg-neutral-900/60">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpandedIndex(null);
            }}
            className="absolute top-1 right-1 z-10 p-0.5 rounded-full bg-black/45 text-white hover:bg-black/60"
            aria-label="Minimize image"
          >
            <X className="w-3 h-3" />
          </button>
          <img
            src={valid[expandedIndex]}
            alt={`Note image ${expandedIndex + 1}`}
            className="w-full max-h-36 object-contain"
          />
          {hasCarousel ? (
            <>
              <button
                type="button"
                onClick={goPrev}
                className="absolute left-0.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full bg-black/45 text-white hover:bg-black/60"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={goNext}
                className="absolute right-0.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full bg-black/45 text-white hover:bg-black/60"
                aria-label="Next image"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <span className="absolute bottom-1 left-1/2 -translate-x-1/2 px-1 py-0.5 rounded text-[9px] font-medium bg-black/45 text-white tabular-nums">
                {expandedIndex + 1}/{valid.length}
              </span>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
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
            const urls = noteImageUrls(note).filter(Boolean);
            return (
              <li
                key={note.id}
                role="button"
                tabIndex={0}
                onClick={onOpenNotes}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenNotes?.();
                  }
                }}
                className="rounded-md bg-amber-50/80 dark:bg-amber-900/15 border border-amber-100 dark:border-amber-900/30 px-2.5 py-1.5 cursor-pointer hover:border-amber-200 dark:hover:border-amber-800/50 transition-colors"
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
                {urls.length > 0 ? <NoteThumbnails urls={urls} /> : null}
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
