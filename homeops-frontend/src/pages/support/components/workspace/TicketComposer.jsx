import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { Send, StickyNote, ChevronDown } from "lucide-react";
import { tryExpandCannedShortcut } from "./cannedResponsesStorage";

const COMPOSER_TEXTAREA_MIN_PX = 80;

function getComposerTextareaMaxPx() {
  if (typeof window === "undefined") return 352;
  const rem =
    parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  return Math.min(22 * rem, window.innerHeight * 0.5);
}

function TicketComposer({
  ticket,
  readOnly = false,
  onReply,
  onInternalNotes,
  onSendAndMarkInProgress,
  onSendAndResolve,
  onUserReply,
  updating = false,
  internalNotes = "",
  snippetInsert = { seq: 0, text: "" },
  cannedResponses = [],
}) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState("reply");
  const [showActions, setShowActions] = useState(false);
  const textareaRef = useRef(null);
  const pendingCursorRef = useRef(null);

  const syncTextareaHeight = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const maxH = getComposerTextareaMaxPx();
    ta.style.height = "auto";
    const scrollH = ta.scrollHeight;
    const nextH = Math.min(Math.max(scrollH, COMPOSER_TEXTAREA_MIN_PX), maxH);
    ta.style.height = `${nextH}px`;
    ta.style.overflowY = scrollH > maxH ? "auto" : "hidden";
  }, []);

  useLayoutEffect(() => {
    syncTextareaHeight();
  }, [text, mode, syncTextareaHeight]);

  useEffect(() => {
    function onResize() {
      syncTextareaHeight();
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [syncTextareaHeight]);

  useEffect(() => {
    if (!snippetInsert?.seq) return;
    const next = snippetInsert.text?.trim();
    if (!next) return;
    setText((prev) => (prev?.trim() ? `${prev}\n\n${next}` : next));
  }, [snippetInsert?.seq, snippetInsert?.text]);

  useEffect(() => {
    const pos = pendingCursorRef.current;
    if (pos == null) return;
    pendingCursorRef.current = null;
    const ta = textareaRef.current;
    if (!ta) return;
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = pos;
    });
  }, [text]);

  if (readOnly && !onUserReply) return null;

  async function handleSend() {
    const trimmed = text?.trim();
    if (!trimmed) return;

    if (readOnly && onUserReply) {
      onUserReply(ticket.id, trimmed);
      setText("");
      return;
    }

    if (mode === "note") {
      const newNotes = internalNotes
        ? `${internalNotes}\n\n---\n${trimmed}`
        : trimmed;
      try {
        await onInternalNotes?.(ticket.id, newNotes);
        setText("");
      } catch {
        // parent handles error
      }
    } else {
      onReply?.(ticket.id, trimmed);
      setText("");
    }
  }

  function handleSendAndAction(action) {
    const trimmed = text?.trim();
    if (action === "in_progress") {
      onSendAndMarkInProgress?.(ticket.id, trimmed || "");
    } else if (action === "resolve") {
      onSendAndResolve?.(ticket.id, trimmed || "");
    }
    setText("");
    setShowActions(false);
  }

  const isNote = mode === "note";

  return (
    <div className="border-t border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-900/50">
      {!readOnly && (
        <div className="flex items-center gap-1 px-4 pt-3 pb-1">
          <button
            type="button"
            onClick={() => setMode("reply")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              !isNote
                ? "bg-[#456564] text-white"
                : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            Public reply
          </button>
          <button
            type="button"
            onClick={() => setMode("note")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              isNote
                ? "bg-amber-500 text-white"
                : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            <StickyNote className="w-3.5 h-3.5" />
            Internal note
          </button>
        </div>
      )}

      <div className="px-4 pb-3 pt-2">
        <div
          className={`rounded-lg border transition-colors ${
            isNote
              ? "border-amber-300 dark:border-amber-700 bg-amber-50/30 dark:bg-amber-950/20"
              : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50"
          }`}
        >
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={1}
            className="w-full border-0 bg-transparent px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-0 resize-none min-h-[80px] overflow-hidden"
            placeholder={
              readOnly
                ? "Type your reply..."
                : isNote
                  ? "Write an internal note (not visible to user)..."
                  : "Type your reply to the customer..."
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSend();
                return;
              }
              if (
                cannedResponses.length > 0 &&
                (e.key === " " || e.key === "Enter") &&
                !e.metaKey &&
                !e.ctrlKey
              ) {
                const ta = e.target;
                if (ta.tagName !== "TEXTAREA") return;
                const cursorPos = ta.selectionStart;
                const expanded = tryExpandCannedShortcut(
                  text,
                  cursorPos,
                  cannedResponses,
                  ticket,
                );
                if (expanded) {
                  e.preventDefault();
                  pendingCursorRef.current = expanded.newCursor;
                  setText(expanded.newText);
                }
              }
            }}
          />

          <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 dark:border-gray-700/50">
            <div className="text-[11px] text-gray-400 dark:text-gray-500">
              {isNote ? "Only visible to support team" : "⌘+Enter to send"}
            </div>

            <div className="flex items-center gap-2">
              {!readOnly && !isNote && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowActions((p) => !p)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-md transition-colors"
                  >
                    Actions
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {showActions && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowActions(false)}
                      />
                      <div className="absolute bottom-full right-0 mb-1 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 py-1">
                        <button
                          type="button"
                          onClick={() => handleSendAndAction("in_progress")}
                          disabled={updating}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50"
                        >
                          Send & mark In Progress
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendAndAction("resolve")}
                          disabled={updating}
                          className="w-full text-left px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-50"
                        >
                          Send & Resolve
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={handleSend}
                disabled={updating || !text?.trim()}
                className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-md transition-colors disabled:opacity-40 ${
                  isNote
                    ? "bg-amber-500 hover:bg-amber-600 text-white"
                    : "bg-[#456564] hover:bg-[#34514f] text-white"
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                {updating
                  ? "Sending..."
                  : isNote
                    ? "Add Note"
                    : "Send"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TicketComposer;
