import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Check, X, Plus, Trash2 } from "lucide-react";

/**
 * Inline-editable text. Renders the text normally; when `editable` is true,
 * shows a subtle hover indicator and opens an input popover on click.
 */
export function EditableInline({
  value,
  placeholder = "Click to edit",
  onSave,
  editable = false,
  className = "",
  style = {},
  hintLabel = "Edit",
  inputType = "text",
  multiline = false,
  as: Tag = "span",
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 240 });

  useEffect(() => {
    setDraft(value || "");
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (
        popoverRef.current?.contains(e.target) ||
        triggerRef.current?.contains(e.target)
      )
        return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openPopover = () => {
    if (!editable) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setPos({
        top: rect.bottom + 6 + window.scrollY,
        left: Math.max(8, rect.left + window.scrollX),
        width: Math.max(220, rect.width + 40),
      });
    }
    setOpen(true);
  };

  const submit = () => {
    onSave?.(draft.trim());
    setOpen(false);
  };

  return (
    <>
      <Tag
        ref={triggerRef}
        onClick={openPopover}
        className={`${className} ${
          editable
            ? "cursor-pointer rounded outline-1 outline-dashed outline-transparent hover:outline-[#456564]/60 hover:bg-[#456564]/5 transition-all px-0.5"
            : ""
        }`}
        style={style}
      >
        {value ? (
          value
        ) : (
          <span className="opacity-50 italic">{placeholder}</span>
        )}
      </Tag>
      {open &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: "absolute",
              top: pos.top,
              left: pos.left,
              width: pos.width,
              zIndex: 60,
            }}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3"
          >
            <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 mb-1.5">
              {hintLabel}
            </div>
            {multiline ? (
              <textarea
                autoFocus
                rows={3}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
                }}
                placeholder={placeholder}
                className="form-input w-full text-sm resize-y"
              />
            ) : (
              <input
                autoFocus
                type={inputType}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
                placeholder={placeholder}
                className="form-input w-full text-sm"
              />
            )}
            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                className="px-3 py-1.5 text-xs font-semibold rounded-md text-white inline-flex items-center gap-1 bg-[#456564] hover:bg-[#34514f]"
              >
                <Check className="w-3.5 h-3.5" />
                Save
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

const SOCIAL_DEFINITIONS = [
  { platform: "facebook", label: "Facebook", glyph: "f" },
  { platform: "x", label: "X (Twitter)", glyph: "X" },
  { platform: "linkedin", label: "LinkedIn", glyph: "in" },
  { platform: "instagram", label: "Instagram", glyph: "Ig" },
  { platform: "email", label: "Email / Website", glyph: "@" },
];

export const SOCIAL_PLATFORMS = SOCIAL_DEFINITIONS;

/** Returns the array of social link objects in the canonical order, including empty entries when in edit mode. */
function normalizeSocialLinks(socialLinks, includeEmpty) {
  const map = new Map();
  (socialLinks || []).forEach((s) => {
    if (s?.platform) map.set(s.platform, s.url || "");
  });
  if (includeEmpty) {
    return SOCIAL_DEFINITIONS.map((def) => ({
      platform: def.platform,
      url: map.get(def.platform) || "",
      def,
    }));
  }
  return SOCIAL_DEFINITIONS.filter((def) => map.get(def.platform)).map(
    (def) => ({
      platform: def.platform,
      url: map.get(def.platform),
      def,
    }),
  );
}

/**
 * Renders a row of social link badges. In edit mode all known platforms are
 * shown so users can add URLs by clicking; otherwise only filled-in links
 * are shown.
 */
export function EditableSocialLinks({
  socialLinks,
  primaryColor,
  editable = false,
  onChange,
}) {
  const [editingPlatform, setEditingPlatform] = useState(null);
  const [draft, setDraft] = useState("");
  const triggerRefs = useRef({});
  const popoverRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 260 });

  const items = normalizeSocialLinks(socialLinks, editable);

  useEffect(() => {
    if (!editingPlatform) return;
    const onClick = (e) => {
      if (
        popoverRef.current?.contains(e.target) ||
        triggerRefs.current[editingPlatform]?.contains(e.target)
      )
        return;
      setEditingPlatform(null);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setEditingPlatform(null);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [editingPlatform]);

  const openEditor = (platform, currentUrl) => {
    if (!editable) return;
    setDraft(currentUrl || "");
    const rect = triggerRefs.current[platform]?.getBoundingClientRect();
    if (rect) {
      setPos({
        top: rect.bottom + 6 + window.scrollY,
        left: Math.max(8, rect.left + window.scrollX - 100),
        width: 280,
      });
    }
    setEditingPlatform(platform);
  };

  const persist = (next) => {
    onChange?.(
      next
        .filter((s) => s.url && s.url.trim())
        .map(({ platform, url }) => ({ platform, url: url.trim() })),
    );
  };

  const save = () => {
    const next = items.map((it) =>
      it.platform === editingPlatform ? { ...it, url: draft.trim() } : it,
    );
    persist(next);
    setEditingPlatform(null);
  };

  const remove = (platform) => {
    const next = items.map((it) =>
      it.platform === platform ? { ...it, url: "" } : it,
    );
    persist(next);
    setEditingPlatform(null);
  };

  if (!editable && items.length === 0) return null;

  const editingItem = items.find((it) => it.platform === editingPlatform);

  return (
    <div className="flex items-center justify-center gap-2 flex-wrap">
      {items.map((it) => {
        const filled = !!it.url;
        const Tag = editable ? "button" : "a";
        const tagProps = editable
          ? {
              type: "button",
              onClick: () => openEditor(it.platform, it.url),
            }
          : {
              href: it.url,
              target: "_blank",
              rel: "noopener noreferrer",
            };
        return (
          <Tag
            key={it.platform}
            ref={(el) => {
              triggerRefs.current[it.platform] = el;
            }}
            title={editable ? `${it.def.label} link` : it.def.label}
            className={`relative w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold transition-all ${
              filled
                ? "hover:scale-110"
                : "border border-dashed border-gray-300 text-gray-400 hover:border-[#456564] hover:text-[#456564]"
            }`}
            style={
              filled
                ? {
                    backgroundColor: `${primaryColor}1a`,
                    color: primaryColor,
                  }
                : {}
            }
            {...tagProps}
          >
            {filled ? it.def.glyph : <Plus className="w-3 h-3" />}
          </Tag>
        );
      })}
      {editingItem &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: "absolute",
              top: pos.top,
              left: pos.left,
              width: pos.width,
              zIndex: 60,
            }}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3"
          >
            <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 mb-1.5">
              {editingItem.def.label} URL
            </div>
            <input
              autoFocus
              type="url"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
              }}
              placeholder={
                editingItem.platform === "email"
                  ? "mailto:hello@example.com"
                  : "https://…"
              }
              className="form-input w-full text-sm"
            />
            <div className="flex justify-between items-center mt-2">
              {editingItem.url ? (
                <button
                  type="button"
                  onClick={() => remove(editingItem.platform)}
                  className="px-2 py-1 text-xs text-red-500 hover:text-red-600 inline-flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPlatform(null)}
                  className="px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  className="px-3 py-1.5 text-xs font-semibold rounded-md text-white bg-[#456564] hover:bg-[#34514f] inline-flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export { normalizeSocialLinks };
