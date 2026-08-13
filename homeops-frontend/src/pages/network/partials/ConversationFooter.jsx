import React, {useState, useRef, useCallback, useEffect} from "react";
import {Send, Plus, Loader2, User} from "lucide-react";
import SharePicker from "./SharePicker";
import AppApi from "../../../api/api";

function ConversationFooter({conversationId, onMessageSent, accountId, focusNonce = 0}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [sharePickerOpen, setSharePickerOpen] = useState(false);
  const textareaRef = useRef(null);
  const attachWrapRef = useRef(null);

  useEffect(() => {
    if (!focusNonce) return;
    textareaRef.current?.focus();
  }, [focusNonce, conversationId]);

  useEffect(() => {
    if (!attachMenuOpen) return undefined;
    const handler = (e) => {
      if (attachWrapRef.current?.contains(e.target)) return;
      setAttachMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [attachMenuOpen]);

  useEffect(() => {
    if (!attachMenuOpen) return undefined;
    const handler = (e) => {
      if (e.key === "Escape") setAttachMenuOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [attachMenuOpen]);

  const handleSend = useCallback(async () => {
    if (!text.trim() || sending || !conversationId) return;
    setSending(true);
    try {
      await AppApi.sendConversationMessage(conversationId, {
        kind: "text",
        message: text.trim(),
      });
      setText("");
      onMessageSent?.();
      textareaRef.current?.focus();
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  }, [text, sending, conversationId, onMessageSent]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleShareContact = useCallback(
    async (contactId) => {
      if (!conversationId) return;
      try {
        await AppApi.sendConversationMessage(conversationId, {
          kind: "share_contact",
          contactId,
        });
        setSharePickerOpen(false);
        setAttachMenuOpen(false);
        onMessageSent?.();
      } catch (err) {
        console.error("Failed to share contact:", err);
      }
    },
    [conversationId, onMessageSent],
  );

  const handleShareProfessional = useCallback(
    async (professionalId) => {
      if (!conversationId) return;
      try {
        await AppApi.sendConversationMessage(conversationId, {
          kind: "share_professional",
          professionalId,
        });
        setSharePickerOpen(false);
        setAttachMenuOpen(false);
        onMessageSent?.();
      } catch (err) {
        console.error("Failed to share professional:", err);
      }
    },
    [conversationId, onMessageSent],
  );

  const handlePlusClick = () => {
    if (sharePickerOpen) {
      setSharePickerOpen(false);
      return;
    }
    setAttachMenuOpen((prev) => !prev);
  };

  return (
    <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700/60">
      <div className="flex items-center gap-2 px-4 sm:px-6 md:px-5 py-3">
        {/* Attachment / Share button */}
        <div className="relative shrink-0" ref={attachWrapRef}>
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={handlePlusClick}
            className="p-2 rounded-lg text-gray-400 hover:text-[#456564] dark:hover:text-[#6fb5b4] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Attach"
            aria-expanded={attachMenuOpen || sharePickerOpen}
            aria-haspopup="menu"
          >
            <Plus className="w-5 h-5" />
          </button>

          {attachMenuOpen && (
            <div
              className="absolute bottom-full left-0 mb-2 w-52 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-30"
              role="menu"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setAttachMenuOpen(false);
                  setSharePickerOpen(true);
                }}
                className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <User className="w-4 h-4 text-[#456564] dark:text-[#6fb5b4] shrink-0" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Share a contact
                </span>
              </button>
            </div>
          )}

          {sharePickerOpen && (
            <SharePicker
              accountId={accountId}
              onShareContact={handleShareContact}
              onShareProfessional={handleShareProfessional}
              onClose={() => setSharePickerOpen(false)}
            />
          )}
        </div>

        {/* Text input */}
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Aa"
            rows={1}
            className="w-full resize-none rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#456564]/30 dark:focus:ring-[#6fb5b4]/30 focus:border-[#456564] dark:focus:border-[#6fb5b4] max-h-32 overflow-y-auto"
            style={{minHeight: "40px"}}
            onInput={(e) => {
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 128) + "px";
            }}
          />
        </div>

        {/* Send button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="p-2.5 rounded-xl btn-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          aria-label="Send"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}

export default ConversationFooter;
