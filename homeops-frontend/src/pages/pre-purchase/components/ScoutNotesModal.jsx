import React, {useEffect, useRef, useState} from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import ModalBlank from "../../../components/ModalBlank";
import AppApi from "../../../api/api";
import {compressImageForUpload} from "../../../utils/compressImage";
import {S3_UPLOAD_FOLDER} from "../../../constants/s3UploadFolders";

const MAX_NOTE_IMAGES = 2;
const ACCEPT_IMAGE = "image/jpeg,image/png,image/webp,image/gif";

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

function noteImageKeys(note) {
  return Array.isArray(note.imageKeys)
    ? note.imageKeys
    : Array.isArray(note.image_keys)
      ? note.image_keys
      : [];
}

function noteImageUrls(note) {
  return Array.isArray(note.imageUrls)
    ? note.imageUrls
    : Array.isArray(note.image_urls)
      ? note.image_urls
      : [];
}

/** Build media slots from an existing note for edit mode. */
function slotsFromNote(note) {
  const keys = noteImageKeys(note);
  const urls = noteImageUrls(note);
  return keys.map((key, i) => ({
    id: `existing-${key}-${i}`,
    key,
    previewUrl: urls[i] || null,
    uploading: false,
    localOnly: false,
  }));
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

function NoteImageThumbnails({urls, size = "md"}) {
  const [expandedIndex, setExpandedIndex] = useState(null);
  const valid = (urls || []).filter(Boolean).slice(0, MAX_NOTE_IMAGES);
  if (valid.length === 0) return null;

  const thumbBox = size === "sm" ? "w-10 h-10" : "w-14 h-14";
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
    <div className="mt-1.5 pl-5 space-y-1.5">
      <div className="flex items-center gap-1.5">
        {valid.map((url, i) => {
          const selected = expandedIndex === i;
          return (
            <button
              key={`${url}-${i}`}
              type="button"
              onClick={() =>
                setExpandedIndex((prev) => (prev === i ? null : i))
              }
              aria-expanded={selected}
              aria-label={
                selected
                  ? `Collapse note image ${i + 1}`
                  : `Expand note image ${i + 1}`
              }
              className={`${thumbBox} rounded-md overflow-hidden border shrink-0 bg-white/60 dark:bg-neutral-900/40 hover:opacity-90 transition-all ${
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
        <div className="relative w-full rounded-md overflow-hidden border border-amber-200/80 dark:border-amber-800/40 bg-white/80 dark:bg-neutral-900/60">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpandedIndex(null);
            }}
            className="absolute top-1.5 right-1.5 z-10 p-1 rounded-full bg-black/45 text-white hover:bg-black/60"
            aria-label="Minimize image"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <img
            src={valid[expandedIndex]}
            alt={`Note image ${expandedIndex + 1}`}
            className="w-full max-h-48 object-contain"
          />
          {hasCarousel ? (
            <>
              <button
                type="button"
                onClick={goPrev}
                className="absolute left-1 top-1/2 -translate-y-1/2 p-1 rounded-full bg-black/45 text-white hover:bg-black/60"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={goNext}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-full bg-black/45 text-white hover:bg-black/60"
                aria-label="Next image"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/45 text-white tabular-nums">
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
 * Compact dual-slot media strip for compose/edit.
 * slots: [{ key, previewUrl, uploading, localOnly }]
 */
function NoteMediaSlots({
  slots,
  onAddFiles,
  onRemove,
  disabled = false,
  error = null,
}) {
  const inputRef = useRef(null);
  const canAdd = slots.length < MAX_NOTE_IMAGES && !disabled;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        {slots.map((slot, index) => (
          <div
            key={slot.id || slot.key || slot.previewUrl || index}
            className="relative w-14 h-14 rounded-md overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 shrink-0"
          >
            {slot.previewUrl ? (
              <img
                src={slot.previewUrl}
                alt={`Upload ${index + 1}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
              </div>
            )}
            {slot.uploading ? (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              </div>
            ) : null}
            {!slot.uploading && !disabled ? (
              <button
                type="button"
                onClick={() => onRemove?.(index)}
                className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/50 text-white hover:bg-black/70"
                aria-label={`Remove image ${index + 1}`}
              >
                <X className="w-3 h-3" />
              </button>
            ) : null}
          </div>
        ))}
        {canAdd ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium border border-dashed border-neutral-300 dark:border-neutral-600 text-neutral-600 dark:text-neutral-400 hover:border-[#456564]/50 hover:text-[#456564] transition-colors"
          >
            <ImagePlus className="w-3.5 h-3.5" />
            Add image
            {slots.length > 0 ? (
              <span className="text-neutral-400">({slots.length}/{MAX_NOTE_IMAGES})</span>
            ) : null}
          </button>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_IMAGE}
          multiple={slots.length === 0}
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            e.target.value = "";
            if (files.length) onAddFiles?.(files);
          }}
        />
      </div>
      {error ? (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : null}
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
  const [composeSlots, setComposeSlots] = useState([]);
  const [composeUploadError, setComposeUploadError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [editSlots, setEditSlots] = useState([]);
  const [editUploadError, setEditUploadError] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setComposing(false);
      setDraft("");
      setComposeSlots((prev) => {
        prev.forEach((s) => {
          if (s.localOnly && s.previewUrl) URL.revokeObjectURL(s.previewUrl);
        });
        return [];
      });
      setComposeUploadError(null);
      setEditingId(null);
      setEditDraft("");
      setEditSlots((prev) => {
        prev.forEach((s) => {
          if (s.localOnly && s.previewUrl) URL.revokeObjectURL(s.previewUrl);
        });
        return [];
      });
      setEditUploadError(null);
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

  async function uploadFilesToSlots(files, currentSlots, setSlots, setError) {
    setError(null);

    const imageFiles = files.filter((f) => f && f.type?.startsWith("image/"));
    if (imageFiles.length === 0) {
      if (files.length > 0) {
        setError("Please select an image file (JPEG, PNG, WebP)");
      }
      return;
    }

    // Build slots outside setState so React Strict Mode double-invokes
    // cannot desync the upload matcher from the rendered preview URL.
    const room = MAX_NOTE_IMAGES - currentSlots.length;
    const accepted = imageFiles.slice(0, Math.max(0, room)).map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      key: null,
      previewUrl: URL.createObjectURL(file),
      uploading: true,
      localOnly: true,
      _file: file,
    }));

    if (accepted.length === 0) return;

    setSlots((prev) => [...prev, ...accepted].slice(0, MAX_NOTE_IMAGES));

    for (const placeholder of accepted) {
      const file = placeholder._file;
      try {
        const toUploadFile = await compressImageForUpload(file);
        const document = await AppApi.uploadDocument(toUploadFile, {
          uploadFolder: S3_UPLOAD_FOLDER.PRE_PURCHASE,
        });
        const key =
          document?.key ??
          document?.s3Key ??
          document?.fileKey ??
          document?.objectKey ??
          document?.url;
        const displayUrl =
          document?.presignedUrl ??
          document?.presigned_url ??
          (typeof document?.url === "string" &&
          (document.url.includes("X-Amz-") || document.url.includes("Signature="))
            ? document.url
            : null);

        if (!key) throw new Error("Upload succeeded but no key was returned");

        setSlots((prev) =>
          prev.map((s) =>
            s.id === placeholder.id
              ? {
                  id: placeholder.id,
                  key,
                  previewUrl: displayUrl || placeholder.previewUrl,
                  uploading: false,
                  localOnly: !displayUrl,
                }
              : s,
          ),
        );
      } catch (err) {
        const msg =
          Array.isArray(err) ? err.join(", ") : err?.message || "Upload failed";
        setError(msg);
        setSlots((prev) => {
          const next = prev.filter((s) => s.id !== placeholder.id);
          if (placeholder.previewUrl) URL.revokeObjectURL(placeholder.previewUrl);
          return next;
        });
      }
    }
  }

  function removeSlot(index, setSlots) {
    setSlots((prev) => {
      const slot = prev[index];
      if (slot?.localOnly && slot.previewUrl) {
        URL.revokeObjectURL(slot.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  }

  function resetCompose() {
    setComposing(false);
    setDraft("");
    setComposeSlots((prev) => {
      prev.forEach((s) => {
        if (s.localOnly && s.previewUrl) URL.revokeObjectURL(s.previewUrl);
      });
      return [];
    });
    setComposeUploadError(null);
  }

  function resetEdit() {
    setEditingId(null);
    setEditDraft("");
    setEditSlots((prev) => {
      prev.forEach((s) => {
        if (s.localOnly && s.previewUrl) URL.revokeObjectURL(s.previewUrl);
      });
      return [];
    });
    setEditUploadError(null);
  }

  const composeUploading = composeSlots.some((s) => s.uploading);
  const editUploading = editSlots.some((s) => s.uploading);

  async function handleSubmit() {
    const text = draft.trim();
    if (!text || saving || composeUploading) return;
    const imageKeys = composeSlots.map((s) => s.key).filter(Boolean);
    await onAddNote?.({body: text, imageKeys});
    resetCompose();
  }

  async function handleSaveEdit(noteId) {
    const text = editDraft.trim();
    if (!text || saving || editUploading) return;
    const imageKeys = editSlots.map((s) => s.key).filter(Boolean);
    await onUpdateNote?.(noteId, {body: text, imageKeys});
    resetEdit();
  }

  async function handleDelete(noteId) {
    if (!window.confirm("Delete this note?")) return;
    await onDeleteNote?.(noteId);
  }

  function startEdit(note) {
    setEditingId(note.id);
    setEditDraft(noteBody(note));
    setEditSlots(slotsFromNote(note));
    setEditUploadError(null);
    setMenuOpenId(null);
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
            <NoteMediaSlots
              slots={composeSlots}
              onAddFiles={(files) =>
                uploadFilesToSlots(
                  files,
                  composeSlots,
                  setComposeSlots,
                  setComposeUploadError,
                )
              }
              onRemove={(i) => {
                removeSlot(i, setComposeSlots);
                setComposeUploadError(null);
              }}
              disabled={saving}
              error={composeUploadError}
            />
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={resetCompose}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || composeUploading || !draft.trim()}
                onClick={handleSubmit}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold btn-primary disabled:opacity-50"
              >
                {saving || composeUploading ? (
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
                      <NoteMediaSlots
                        slots={editSlots}
                        onAddFiles={(files) =>
                          uploadFilesToSlots(
                            files,
                            editSlots,
                            setEditSlots,
                            setEditUploadError,
                          )
                        }
                        onRemove={(i) => {
                          removeSlot(i, setEditSlots);
                          setEditUploadError(null);
                        }}
                        disabled={saving}
                        error={editUploadError}
                      />
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={resetEdit}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        >
                          <X className="w-3.5 h-3.5" />
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={saving || editUploading || !editDraft.trim()}
                          onClick={() => handleSaveEdit(note.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold btn-primary disabled:opacity-50"
                        >
                          {saving || editUploading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
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
                                onEdit={() => startEdit(note)}
                                onDelete={() => handleDelete(note.id)}
                                onClose={() => setMenuOpenId(null)}
                              />
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      <NoteImageThumbnails urls={noteImageUrls(note)} />
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
