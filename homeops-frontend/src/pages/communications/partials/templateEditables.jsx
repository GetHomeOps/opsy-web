import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Check, X, Trash2 } from "lucide-react";

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

/** Returns the array of configured social link objects in canonical order. */
function normalizeSocialLinks(socialLinks) {
  const map = new Map();
  (socialLinks || []).forEach((s) => {
    if (s?.platform && s?.url) map.set(s.platform, s.url);
  });
  return SOCIAL_DEFINITIONS.filter((def) => map.get(def.platform)).map(
    (def) => ({
      platform: def.platform,
      url: map.get(def.platform),
      def,
    }),
  );
}

/**
 * Renders only social platforms the user has added.
 * "Add" is a text control below the row (not a 4th circle in the final message).
 * Popovers use position: fixed + viewport rect so they work inside scrollable
 * live-preview panes.
 */
export function EditableSocialLinks({
  socialLinks,
  primaryColor,
  editable = false,
  onChange,
  showAddControl = true,
  onSetShowAddControl,
}) {
  const [editingPlatform, setEditingPlatform] = useState(null);
  const [draft, setDraft] = useState("");
  const triggerRefs = useRef({});
  const addPopoverRef = useRef(null);
  const urlPopoverRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 280 });

  const items = normalizeSocialLinks(socialLinks);
  const configuredPlatforms = new Set(items.map((it) => it.platform));
  const availableToAdd = SOCIAL_DEFINITIONS.filter(
    (def) => !configuredPlatforms.has(def.platform),
  );

  const getAnchorKeyForPosition = () => {
    if (!editingPlatform) return null;
    if (editingPlatform === "__add__") return "__add__";
    if (items.some((i) => i.platform === editingPlatform)) return editingPlatform;
    return "__add__";
  };

  const positionFromAnchor = (key, width = 280) => {
    const el = key ? triggerRefs.current[key] : null;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth || 800;
    const rawLeft = rect.left + (rect.width - width) / 2;
    const left = Math.max(8, Math.min(rawLeft, vw - width - 8));
    setPos({
      top: rect.bottom + 6,
      left,
      width,
    });
  };

  useLayoutEffect(() => {
    if (!editingPlatform) return;
    const key = getAnchorKeyForPosition();
    if (key) {
      requestAnimationFrame(() =>
        positionFromAnchor(key, editingPlatform === "__add__" ? 260 : 280),
      );
    }
  }, [editingPlatform]);

  useEffect(() => {
    if (!editingPlatform) return;
    const onScrollReposition = () => {
      const key = getAnchorKeyForPosition();
      if (key) positionFromAnchor(key, editingPlatform === "__add__" ? 260 : 280);
    };
    window.addEventListener("scroll", onScrollReposition, true);
    window.addEventListener("resize", onScrollReposition);
    return () => {
      window.removeEventListener("scroll", onScrollReposition, true);
      window.removeEventListener("resize", onScrollReposition);
    };
  }, [editingPlatform]);

  useEffect(() => {
    if (!editingPlatform) return;
    const onClick = (e) => {
      const inAdd = addPopoverRef.current?.contains(e.target);
      const inUrl = urlPopoverRef.current?.contains(e.target);
      const key = getAnchorKeyForPosition();
      const onTrigger = key
        ? triggerRefs.current[key]?.contains(e.target)
        : false;
      if (inAdd || inUrl || onTrigger) return;
      setEditingPlatform(null);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setEditingPlatform(null);
    };
    document.addEventListener("mousedown", onClick, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [editingPlatform]);

  const openEditor = (platform, currentUrl) => {
    if (!editable) return;
    setDraft(currentUrl || "");
    setEditingPlatform(platform);
  };

  const openAddPicker = (e) => {
    e?.stopPropagation();
    if (!editable) return;
    setDraft("");
    setEditingPlatform("__add__");
  };

  const persistList = (nextList) => {
    onChange?.(
      nextList
        .filter((s) => s.url && s.url.trim())
        .map(({ platform, url }) => ({ platform, url: url.trim() })),
    );
  };

  const save = () => {
    if (!editingPlatform || editingPlatform === "__add__") return;
    const url = draft.trim();
    if (!url) return;
    const exists = items.some((it) => it.platform === editingPlatform);
    const next = exists
      ? items.map((it) =>
          it.platform === editingPlatform ? { ...it, url } : it,
        )
      : [...items, { platform: editingPlatform, url }];
    persistList(next);
    setEditingPlatform(null);
  };

  const remove = (platform) => {
    persistList(items.filter((it) => it.platform !== platform));
    setEditingPlatform(null);
  };

  const pickPlatform = (platform) => {
    setEditingPlatform(platform);
    setDraft("");
  };

  if (!editable && items.length === 0) return null;

  const editingItem =
    editingPlatform && editingPlatform !== "__add__"
      ? SOCIAL_DEFINITIONS.find((def) => def.platform === editingPlatform)
      : null;
  const editingItemUrl =
    items.find((it) => it.platform === editingPlatform)?.url || "";

  const fixedStyle = {
    position: "fixed",
    top: pos.top,
    left: pos.left,
    width: pos.width,
    zIndex: 200,
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {items.map((it) => {
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
              title={editable ? `Edit ${it.def.label}` : it.def.label}
              className="relative w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold transition-all hover:scale-110"
              style={{
                backgroundColor: `${primaryColor}1a`,
                color: primaryColor,
              }}
              {...tagProps}
            >
              {it.def.glyph}
            </Tag>
          );
        })}
      </div>

      {editingPlatform === "__add__" &&
        createPortal(
            <div
              ref={addPopoverRef}
              style={fixedStyle}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-2"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 px-2 pt-1 pb-1.5">
                Add social link
              </div>
              <ul className="max-h-64 overflow-y-auto">
                {availableToAdd.map((def) => (
                  <li key={def.platform}>
                    <button
                      type="button"
                      onClick={() => pickPlatform(def.platform)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-200"
                    >
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold"
                        style={{
                          backgroundColor: `${primaryColor}1a`,
                          color: primaryColor,
                        }}
                      >
                        {def.glyph}
                      </span>
                      {def.label}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex justify-end pt-1.5">
                <button
                  type="button"
                  onClick={() => setEditingPlatform(null)}
                  className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>,
            document.body,
          )}

        {editingItem &&
          createPortal(
            <div
              ref={urlPopoverRef}
              style={fixedStyle}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 mb-1.5">
                {editingItem.label} URL
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
                {editingItemUrl ? (
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

      {editable && availableToAdd.length > 0 && showAddControl && (
        <div className="text-center space-y-0.5 max-w-sm mx-auto px-1">
          <button
            type="button"
            ref={(el) => {
              triggerRefs.current["__add__"] = el;
            }}
            onClick={openAddPicker}
            className="text-xs font-medium text-[#456564] hover:underline"
          >
            + Add a social link
          </button>
          <p className="text-[10px] text-gray-400 leading-snug">
            Editor only — the sent message only shows links you add here, not
            this button.
          </p>
          {onSetShowAddControl && (
            <button
              type="button"
              onClick={() => onSetShowAddControl(false)}
              className="text-[10px] text-gray-400 hover:text-gray-600 underline"
            >
              Hide &quot;add&quot; control
            </button>
          )}
        </div>
      )}

      {editable && !showAddControl && onSetShowAddControl && availableToAdd.length > 0 && (
        <p className="text-center text-[10px] text-gray-500">
          <button
            type="button"
            onClick={() => onSetShowAddControl(true)}
            className="underline"
          >
            Show &quot;add a social link&quot;
          </button>
        </p>
      )}
    </div>
  );
}

export { normalizeSocialLinks };

/**
 * Inline-editable stat cards. Each card has a value + label that can be
 * clicked to edit. In edit mode, an "Add" button appears after the last card,
 * and each card shows a small × button on hover to remove it.
 */
export function EditableStatCards({
  cards,
  primaryColor,
  editable = false,
  onChange,
  maxCards = 4,
  showAddControl = true,
  onSetShowAddControl,
}) {
  const list = Array.isArray(cards) ? cards : [];

  const updateAt = (idx, patch) => {
    const next = list.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    onChange?.(next);
  };

  const removeAt = (idx) => {
    const next = list.filter((_, i) => i !== idx);
    onChange?.(next);
  };

  const add = () => {
    if (list.length >= maxCards) return;
    onChange?.([...list, { value: "0", label: "New" }]);
  };

  const gridCols =
    list.length <= 1
      ? "grid-cols-1 max-w-[180px] mx-auto"
      : list.length === 2
        ? "grid-cols-2 max-w-sm mx-auto"
        : "grid-cols-3";

  return (
    <div className="mt-5 space-y-2">
      <div className={`grid gap-2 ${gridCols}`}>
        {list.map((s, idx) => (
          <div
            key={idx}
            className="relative group text-center p-3 rounded-xl"
            style={{ backgroundColor: `${primaryColor}10` }}
          >
            {editable && list.length > 1 && (
              <button
                type="button"
                onClick={() => removeAt(idx)}
                title="Remove this metric from the message"
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-gray-200 shadow-sm text-gray-400 hover:text-red-500 hover:border-red-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
              >
                <X className="w-3 h-3" />
              </button>
            )}
            <div className="text-lg font-bold leading-none">
              <EditableInline
                value={s.value ?? ""}
                placeholder="0"
                editable={editable}
                hintLabel="Value"
                onSave={(v) => updateAt(idx, { value: v })}
                className="inline-block"
                style={{ color: primaryColor }}
              />
            </div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500 mt-1">
              <EditableInline
                value={s.label ?? ""}
                placeholder="Label"
                editable={editable}
                hintLabel="Label"
                onSave={(v) => updateAt(idx, { label: v })}
                className="inline-block"
              />
            </div>
          </div>
        ))}
      </div>

      {editable && showAddControl && list.length < maxCards && (
        <div className="text-center space-y-0.5 max-w-sm mx-auto">
          <button
            type="button"
            onClick={add}
            className="text-xs font-medium text-[#456564] hover:underline"
          >
            + Add another stat
          </button>
          <p className="text-[10px] text-gray-400 leading-snug">
            The green metric tiles are what get sent. This line is for editing
            only — you can remove it with “Hide &quot;add&quot; control”.
          </p>
          {onSetShowAddControl && (
            <button
              type="button"
              onClick={() => onSetShowAddControl(false)}
              className="text-[10px] text-gray-400 hover:text-gray-600 underline"
            >
              Hide &quot;add&quot; control
            </button>
          )}
        </div>
      )}

      {editable && !showAddControl && onSetShowAddControl && list.length < maxCards && (
        <p className="text-center text-[10px] text-gray-500">
          <button
            type="button"
            onClick={() => onSetShowAddControl(true)}
            className="underline"
          >
            Show &quot;add another stat&quot;
          </button>
        </p>
      )}
    </div>
  );
}
