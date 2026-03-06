import React, { useCallback, useEffect, useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-text-style/color";
import { BackgroundColor } from "@tiptap/extension-text-style/background-color";
import { FontSize } from "@tiptap/extension-text-style/font-size";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link as LinkIcon,
  ImagePlus,
  Heading2,
  Heading3,
  Quote,
  Palette,
  Highlighter,
  Type,
} from "lucide-react";

const TEXT_COLORS = [
  { value: "#000000", label: "Black" },
  { value: "#374151", label: "Gray" },
  { value: "#dc2626", label: "Red" },
  { value: "#ea580c", label: "Orange" },
  { value: "#ca8a04", label: "Amber" },
  { value: "#16a34a", label: "Green" },
  { value: "#2563eb", label: "Blue" },
  { value: "#7c3aed", label: "Purple" },
];

const HIGHLIGHT_COLORS = [
  { value: "#fef3c7", label: "Yellow" },
  { value: "#d1fae5", label: "Green" },
  { value: "#dbeafe", label: "Blue" },
  { value: "#fce7f3", label: "Pink" },
  { value: "#e0e7ff", label: "Indigo" },
];

const FONT_SIZES = [
  { value: "12px", label: "12" },
  { value: "14px", label: "14" },
  { value: "16px", label: "16" },
  { value: "18px", label: "18" },
  { value: "20px", label: "20" },
  { value: "24px", label: "24" },
];

/**
 * PostRichEditor - Tiptap-based rich text editor with toolbar.
 * Features: Bold, Italic, Underline, Headings, Lists, Blockquote, Link, Images, Text color, Highlight.
 * onImageSelect: optional () => Promise<string | null> - when provided, used for file upload flow.
 */
function PostRichEditor({
  value = "",
  onChange,
  placeholder = "Write your post...",
  disabled = false,
  minHeight = "200px",
  onImageSelect,
  className = "",
}) {
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        link: {
          openOnClick: false,
          HTMLAttributes: { class: "text-[#456564] underline hover:opacity-80" },
        },
      }),
      Image.configure({
        allowBase64: true,
        HTMLAttributes: {
          class: "max-w-full h-auto rounded-lg",
          referrerPolicy: "no-referrer",
        },
        resize: {
          enabled: true,
          directions: ["top-left", "top-right", "bottom-left", "bottom-right"],
          minWidth: 80,
          minHeight: 50,
          alwaysPreserveAspectRatio: true,
        },
      }),
      Placeholder.configure({ placeholder }),
      TextStyle,
      Color,
      BackgroundColor,
      FontSize,
    ],
    [placeholder]
  );

  const editor = useEditor({
    extensions,
    content: value || "",
    editable: !disabled,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
  });

  // Sync external value changes (e.g. when switching resources)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current && (value || "").trim() !== current.trim()) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [editor, value]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  const handleImageClick = useCallback(async () => {
    if (!editor) return;
    let url = null;
    if (onImageSelect) {
      url = await onImageSelect();
    } else {
      url = prompt("Enter image URL:");
    }
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor, onImageSelect]);

  const handleLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href;
    const url = prompt("Enter URL:", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  }, [editor]);

  if (!editor) {
    return (
      <div
        className={`rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden min-h-[200px] bg-white dark:bg-gray-800 animate-pulse ${className}`}
        style={{ minHeight }}
      />
    );
  }

  return (
    <div
      className={`rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden ${className}`}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-1.5 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-600">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={disabled}
          active={editor.isActive("bold")}
          title="Bold"
          icon={<Bold className="w-4 h-4" />}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={disabled}
          active={editor.isActive("italic")}
          title="Italic"
          icon={<Italic className="w-4 h-4" />}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          disabled={disabled}
          active={editor.isActive("underline")}
          title="Underline"
          icon={<Underline className="w-4 h-4" />}
        />
        <div className="w-px h-5 bg-gray-200 dark:bg-gray-600 mx-0.5" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          disabled={disabled}
          active={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
          icon={<Heading2 className="w-4 h-4" />}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          disabled={disabled}
          active={editor.isActive("heading", { level: 3 })}
          title="Heading 3"
          icon={<Heading3 className="w-4 h-4" />}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          disabled={disabled}
          active={editor.isActive("blockquote")}
          title="Quote"
          icon={<Quote className="w-4 h-4" />}
        />
        <div className="w-px h-5 bg-gray-200 dark:bg-gray-600 mx-0.5" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          disabled={disabled}
          active={editor.isActive("bulletList")}
          title="Bullet list"
          icon={<List className="w-4 h-4" />}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          disabled={disabled}
          active={editor.isActive("orderedList")}
          title="Numbered list"
          icon={<ListOrdered className="w-4 h-4" />}
        />
        <div className="w-px h-5 bg-gray-200 dark:bg-gray-600 mx-0.5" />
        <FontSizeDropdown
          editor={editor}
          disabled={disabled}
          sizes={FONT_SIZES}
          icon={<Type className="w-4 h-4" />}
          title="Text size"
          setSize={(s) => editor.chain().focus().setFontSize(s).run()}
          unsetSize={() => editor.chain().focus().unsetFontSize().run()}
        />
        <ColorDropdown
          editor={editor}
          disabled={disabled}
          colors={TEXT_COLORS}
          icon={<Palette className="w-4 h-4" />}
          title="Text color"
          setColor={(c) => editor.chain().focus().setColor(c).run()}
          unsetColor={() => editor.chain().focus().unsetColor().run()}
        />
        <ColorDropdown
          editor={editor}
          disabled={disabled}
          colors={HIGHLIGHT_COLORS}
          icon={<Highlighter className="w-4 h-4" />}
          title="Highlight"
          setColor={(c) => editor.chain().focus().setBackgroundColor(c).run()}
          unsetColor={() => editor.chain().focus().unsetBackgroundColor().run()}
        />
        <div className="w-px h-5 bg-gray-200 dark:bg-gray-600 mx-0.5" />
        <ToolbarButton
          onClick={handleLink}
          disabled={disabled}
          active={editor.isActive("link")}
          title="Link"
          icon={<LinkIcon className="w-4 h-4" />}
        />
        <ToolbarButton
          onClick={handleImageClick}
          disabled={disabled}
          title="Add image"
          icon={<ImagePlus className="w-4 h-4" />}
        />
      </div>

      {/* Editor area */}
      <EditorContent
        editor={editor}
        className="post-rich-editor-wrapper"
        style={{ minHeight }}
      />
      <style>{`
        .post-rich-editor-wrapper .tiptap {
          outline: none;
          min-height: inherit;
          padding: 1rem;
          font-size: 0.875rem;
          line-height: 1.5;
          color: rgb(55 65 81);
        }
        .dark .post-rich-editor-wrapper .tiptap {
          color: rgb(209 213 219);
        }
        .post-rich-editor-wrapper .tiptap .is-editor-empty::before {
          content: attr(data-placeholder);
          float: left;
          color: rgb(156 163 175);
          pointer-events: none;
          height: 0;
        }
        .dark .post-rich-editor-wrapper .tiptap .is-editor-empty::before {
          color: rgb(107 114 128);
        }
        .post-rich-editor-wrapper .tiptap img {
          display: block;
          max-width: 100%;
          height: auto;
          min-height: 80px;
          border-radius: 0.5rem;
          object-fit: contain;
        }
        .post-rich-editor-wrapper .tiptap ul {
          list-style-type: disc;
          padding-left: 1.5rem;
        }
        .post-rich-editor-wrapper .tiptap ol {
          list-style-type: decimal;
          padding-left: 1.5rem;
        }
        .post-rich-editor-wrapper .tiptap li {
          display: list-item;
        }
        .post-rich-editor-wrapper .tiptap blockquote {
          border-left: 4px solid rgb(209 213 219);
          padding-left: 1rem;
          margin: 1rem 0;
          color: rgb(107 114 128);
        }
        .dark .post-rich-editor-wrapper .tiptap blockquote {
          border-left-color: rgb(75 85 99);
          color: rgb(156 163 175);
        }
        .post-rich-editor-wrapper .tiptap h2 {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 1rem 0 0.5rem;
        }
        .post-rich-editor-wrapper .tiptap h3 {
          font-size: 1.125rem;
          font-weight: 600;
          margin: 0.75rem 0 0.5rem;
        }
        /* Resizable image handles */
        .post-rich-editor-wrapper [data-resize-container] {
          position: relative;
          display: inline-block;
        }
        .post-rich-editor-wrapper [data-resize-handle] {
          position: absolute;
          width: 10px;
          height: 10px;
          background: #456564;
          border: 2px solid white;
          border-radius: 2px;
          cursor: nwse-resize;
          z-index: 10;
          box-shadow: 0 1px 2px rgba(0,0,0,0.2);
        }
        .post-rich-editor-wrapper [data-resize-handle="top-left"] { cursor: nwse-resize; }
        .post-rich-editor-wrapper [data-resize-handle="top-right"] { cursor: nesw-resize; }
        .post-rich-editor-wrapper [data-resize-handle="bottom-left"] { cursor: nesw-resize; }
        .post-rich-editor-wrapper [data-resize-handle="bottom-right"] { cursor: nwse-resize; }
        .post-rich-editor-wrapper [data-resize-state="true"] [data-resize-handle] {
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}

function ToolbarButton({ onClick, disabled, active, title, icon }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-2 rounded transition-colors ${
        active
          ? "bg-[#456564]/20 text-[#456564] dark:bg-[#456564]/30 dark:text-[#5a7a78]"
          : "text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-gray-200"
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {icon}
    </button>
  );
}

function FontSizeDropdown({ editor, disabled, sizes, icon, title, setSize, unsetSize }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        title={title}
        className={`p-2 rounded transition-colors ${
          open
            ? "bg-[#456564]/20 text-[#456564] dark:bg-[#456564]/30"
            : "text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-gray-200"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {icon}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg flex flex-col gap-0.5 min-w-[100px]">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              unsetSize();
              setOpen(false);
            }}
            className="text-xs text-gray-600 dark:text-gray-400 hover:underline text-left px-2 py-1"
          >
            Default
          </button>
          {sizes.map((s) => (
            <button
              key={s.value}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setSize(s.value);
                setOpen(false);
              }}
              title={`${s.label}px`}
              className="text-sm px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-left transition-colors"
              style={{ fontSize: s.value }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ColorDropdown({
  editor,
  disabled,
  colors,
  icon,
  title,
  setColor,
  unsetColor,
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        title={title}
        className={`p-2 rounded transition-colors ${
          open
            ? "bg-[#456564]/20 text-[#456564] dark:bg-[#456564]/30"
            : "text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-gray-200"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {icon}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg flex flex-wrap gap-1.5 min-w-[140px]">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              unsetColor();
              setOpen(false);
            }}
            className="text-xs text-gray-600 dark:text-gray-400 hover:underline"
          >
            Clear
          </button>
          {colors.map((c) => (
            <button
              key={c.value}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setColor(c.value);
                setOpen(false);
              }}
              title={c.label}
              className="w-6 h-6 rounded border border-gray-300 dark:border-gray-500 hover:ring-2 hover:ring-[#456564]/50 transition-shadow"
              style={{ backgroundColor: c.value }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default PostRichEditor;
