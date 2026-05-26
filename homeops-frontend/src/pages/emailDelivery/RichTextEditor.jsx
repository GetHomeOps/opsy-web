import React, {useEffect, useMemo, useRef, useState} from "react";
import {EditorContent, useEditor} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Heading2,
  Heading3,
  Link as LinkIcon,
  List as ListIcon,
  ListOrdered,
  Pilcrow,
  Redo2,
  Undo2,
  Variable,
} from "lucide-react";

function ToolbarButton({onClick, active, disabled, title, children}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        if (!disabled && onClick) onClick();
      }}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-md text-sm transition-colors border ${
        active
          ? "bg-[#456564] text-white border-[#456564]"
          : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-transparent hover:border-gray-200 dark:hover:border-gray-600"
      } disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

/**
 * Keep base typography aligned with backend `services/emailComposer.js` wrapper
 * (`DEFAULT_CONTAINER_STYLE`: system UI font, 16px context) so the editor matches SES preview.
 *
 * Props:
 *  - value (string): HTML
 *  - onChange (fn): called with HTML on each edit
 *  - mergeVariables ([{key, description}]): inserted as `{{key}}` plain text
 *  - placeholder
 *  - documentKey (any): when this changes the editor's content is reset
 */
export default function RichTextEditor({
  value,
  onChange,
  mergeVariables = [],
  placeholder = "Start writing your email…",
  documentKey,
}) {
  const [variableMenuOpen, setVariableMenuOpen] = useState(false);
  const variableMenuRef = useRef(null);

  useEffect(() => {
    if (!variableMenuOpen) return undefined;
    function handlePointerDown(e) {
      if (variableMenuRef.current && !variableMenuRef.current.contains(e.target)) {
        setVariableMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [variableMenuOpen]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {levels: [2, 3]},
        link: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
          style: "color: #456564; text-decoration: underline;",
        },
      }),
      Placeholder.configure({placeholder}),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "email-rte min-h-[260px] max-h-[600px] overflow-auto px-4 py-[16px] focus:outline-none",
      },
    },
    onUpdate({editor: ed}) {
      if (onChange) onChange(ed.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = value || "";
    if (current !== next) {
      editor.commands.setContent(next, false);
    }
    
  }, [documentKey, editor]);

  useEffect(() => () => editor?.destroy(), [editor]);

  const isActive = useMemo(() => {
    if (!editor) return () => false;
    return (name, attrs) => editor.isActive(name, attrs);
  }, [editor]);

  function insertMerge(key) {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertContent(`{{${key}}}`)
      .run();
  }

  function setLink() {
    if (!editor) return;
    const prev = editor.getAttributes("link").href || "";
    
    const url = window.prompt("Link URL (use {{viewUrl}} for merge tags):", prev);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({href: url}).run();
  }

  if (!editor) return null;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden shadow-sm dark:shadow-none">
      <style>{`
        .email-rte {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 16px;
          line-height: 1.6;
          color: #111827;
          max-width: 560px;
          margin: 0 auto;
          box-sizing: border-box;
        }
        /* Match default Opsy SES snippets: paragraphs use 12px vertical rhythm (inline margins win when present). */
        .email-rte p { margin: 12px 0; line-height: 1.6; }
        /* Let UA + inline heading styles dictate size/color like the preview (templates style h2 teal inline). */
        .email-rte h2 {
          margin: 0 0 12px;
          line-height: 1.3;
          font-weight: 600;
        }
        .email-rte h3 {
          margin: 16px 0 8px;
          line-height: 1.3;
          font-weight: 600;
        }
        .email-rte ul, .email-rte ol { margin: 12px 0; padding-left: 20px; }
        .email-rte li { margin: 4px 0; line-height: 1.6; }
        /* Button-style links keep template inline styles; plain links align with branded preview. */
        .email-rte a { color: #456564; text-decoration: underline; }
        .email-rte strong { font-weight: 600; }
        .email-rte em { font-style: italic; }
        .email-rte p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #9ca3af;
          pointer-events: none;
          height: 0;
        }
      `}</style>
      <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 rounded-t-lg">
        <ToolbarButton
          title="Bold"
          active={isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <BoldIcon className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Italic"
          active={isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <ItalicIcon className="w-4 h-4" />
        </ToolbarButton>
        <span className="w-px h-5 bg-gray-200 dark:bg-gray-600 mx-1" />
        <ToolbarButton
          title="Paragraph"
          active={isActive("paragraph")}
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          <Pilcrow className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Heading"
          active={isActive("heading", {level: 2})}
          onClick={() => editor.chain().focus().toggleHeading({level: 2}).run()}
        >
          <Heading2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Subheading"
          active={isActive("heading", {level: 3})}
          onClick={() => editor.chain().focus().toggleHeading({level: 3}).run()}
        >
          <Heading3 className="w-4 h-4" />
        </ToolbarButton>
        <span className="w-px h-5 bg-gray-200 dark:bg-gray-600 mx-1" />
        <ToolbarButton
          title="Bullet list"
          active={isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <ListIcon className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Numbered list"
          active={isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>
        <span className="w-px h-5 bg-gray-200 dark:bg-gray-600 mx-1" />
        <ToolbarButton
          title="Link"
          active={isActive("link")}
          onClick={setLink}
        >
          <LinkIcon className="w-4 h-4" />
        </ToolbarButton>
        {mergeVariables.length > 0 && (
          <div className="relative ml-auto" ref={variableMenuRef}>
            <button
              type="button"
              aria-expanded={variableMenuOpen}
              aria-haspopup="listbox"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setVariableMenuOpen((open) => !open)}
              className="cursor-pointer inline-flex items-center gap-1.5 px-2 h-8 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs font-medium text-gray-700 dark:text-gray-200 hover:border-[#456564]"
            >
              <Variable className="w-3.5 h-3.5" />
              Insert variable
            </button>
            {variableMenuOpen && (
              <div
                role="listbox"
                aria-label="Insert merge variable"
                className="absolute right-0 z-20 mt-1 w-72 max-h-80 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg p-1"
              >
                {mergeVariables.map((v) => (
                  <button
                    key={v.key}
                    role="option"
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      insertMerge(v.key);
                      setVariableMenuOpen(false);
                    }}
                    className="w-full text-left px-2 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 text-xs"
                  >
                    <code className="text-[#456564] font-medium">{`{{${v.key}}}`}</code>
                    {v.description && (
                      <span className="block text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                        {v.description}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <span className="w-px h-5 bg-gray-200 dark:bg-gray-600 mx-1" />
        <ToolbarButton
          title="Undo"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Redo"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 className="w-4 h-4" />
        </ToolbarButton>
      </div>
      <div className="rounded-b-lg bg-white [&_.ProseMirror]:min-h-[260px]">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
