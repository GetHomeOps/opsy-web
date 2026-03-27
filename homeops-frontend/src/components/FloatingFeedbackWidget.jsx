import React, { useState, useRef, useCallback, useEffect, useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import { X, Bug, MessageSquareText, Send, CheckCircle2, Paperclip, GripVertical } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import useCurrentAccount from "../hooks/useCurrentAccount";
import AppApi from "../api/api";
import opsyWritingIcon from "../images/opsy_writing.webp";

const POSITION_KEY = "feedback-widget-pos";
const MAX_FILES = 1;
const VIEWPORT_EDGE_PAD = 8;
const PANEL_LAUNCHER_GAP_PX = 8;
/** Fallback before layout measure; real position comes from clampPanelPosition */
const PANEL_ABOVE_LAUNCHER_PX = 52;

function getStoredPosition() {
  try {
    const raw = localStorage.getItem(POSITION_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

/** Keep { right, bottom } within viewport for an element of size w×h (fixed; right/bottom offsets). */
function clampPositionToViewport(pos, w, h, vw, vh) {
  const pad = VIEWPORT_EDGE_PAD;
  const maxRight = Math.max(pad, vw - w - pad);
  const maxBottom = Math.max(pad, vh - h - pad);
  return {
    right: Math.min(Math.max(pad, pos.right), maxRight),
    bottom: Math.min(Math.max(pad, pos.bottom), maxBottom),
  };
}

function FloatingFeedbackWidget() {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { currentAccount } = useCurrentAccount();

  const [open, setOpen] = useState(false);
  const [type, setType] = useState("feedback");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [attachmentFiles, setAttachmentFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const stored = getStoredPosition();
  const [position, setPosition] = useState(stored || { right: 24, bottom: 24 });
  const [dragging, setDragging] = useState(false);
  const dragState = useRef(null);
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const wasDragged = useRef(false);
  const [panelClamp, setPanelClamp] = useState({ right: null, bottom: null });

  const onPointerDown = useCallback((e) => {
    if (e.button !== 0) return;
    wasDragged.current = false;
    const rect = btnRef.current.getBoundingClientRect();
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      initRight: window.innerWidth - rect.right,
      initBottom: window.innerHeight - rect.bottom,
      width: rect.width,
      height: rect.height,
    };
    setDragging(true);
    e.preventDefault();
  }, []);

  const onPointerMove = useCallback(
    (e) => {
      if (!dragging || !dragState.current) return;
      const dx = e.clientX - dragState.current.startX;
      const dy = e.clientY - dragState.current.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) wasDragged.current = true;

      const w = dragState.current.width ?? 56;
      const h = dragState.current.height ?? 56;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const newRight = dragState.current.initRight - dx;
      const newBottom = dragState.current.initBottom - dy;

      setPosition(
        clampPositionToViewport({ right: newRight, bottom: newBottom }, w, h, vw, vh),
      );
    },
    [dragging],
  );

  const onPointerUp = useCallback(() => {
    if (!dragging) return;
    setDragging(false);
    dragState.current = null;
    setPosition((pos) => {
      localStorage.setItem(POSITION_KEY, JSON.stringify(pos));
      return pos;
    });
  }, [dragging]);

  useEffect(() => {
    if (!dragging) return;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [dragging, onPointerMove, onPointerUp]);

  function resetForm() {
    setType("feedback");
    setSubject("");
    setDescription("");
    setAttachmentFiles([]);
    setError(null);
    setSuccess(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleToggle() {
    if (wasDragged.current) return;
    if (open) {
      setOpen(false);
      resetForm();
    } else {
      setOpen(true);
    }
  }

  function handleLauncherKeyDown(e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleToggle();
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!subject.trim()) {
      setError(t("support.subjectRequired") || "Subject is required");
      return;
    }
    if (!description.trim()) {
      setError(t("support.descriptionRequired") || "Description is required");
      return;
    }

    const accountId = currentAccount?.id;
    if (!accountId) {
      setError(t("support.selectAccount") || "No account found");
      return;
    }

    setSubmitting(true);
    try {
      const attachmentKeys = [];
      for (const file of attachmentFiles) {
        try {
          const doc = await AppApi.uploadDocument(file);
          if (doc?.key) attachmentKeys.push(doc.key);
        } catch (uploadErr) {
          console.warn("File upload failed:", uploadErr);
        }
      }

      await AppApi.createSupportTicket({
        type: type === "bug" ? "support" : "feedback",
        subject: `[${type === "bug" ? "Bug" : "Feedback"}] ${subject.trim()}`,
        description: description.trim(),
        accountId,
        attachmentKeys: attachmentKeys.length ? attachmentKeys : undefined,
      });
      setSuccess(true);
      setTimeout(() => {
        setOpen(false);
        resetForm();
      }, 2000);
    } catch (err) {
      setError(err.message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  useLayoutEffect(() => {
    if (!open) {
      setPanelClamp({ right: null, bottom: null });
      return;
    }

    function clampPanelPosition() {
      const panel = panelRef.current;
      const btn = btnRef.current;
      if (!panel || !btn) return;

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const { width: pw, height: ph } = panel.getBoundingClientRect();
      if (pw <= 0 || ph <= 0) return;

      const maxRight = Math.max(VIEWPORT_EDGE_PAD, vw - pw - VIEWPORT_EDGE_PAD);
      const right = Math.min(Math.max(position.right, VIEWPORT_EDGE_PAD), maxRight);

      const b = btn.getBoundingClientRect();
      const aboveTop = b.top - PANEL_LAUNCHER_GAP_PX - ph;
      const belowBottomY = b.bottom + PANEL_LAUNCHER_GAP_PX + ph;

      let bottom;
      if (aboveTop >= VIEWPORT_EDGE_PAD) {
        bottom = vh - b.top + PANEL_LAUNCHER_GAP_PX;
      } else if (belowBottomY <= vh - VIEWPORT_EDGE_PAD) {
        bottom = vh - b.bottom - PANEL_LAUNCHER_GAP_PX - ph;
      } else {
        bottom = vh - VIEWPORT_EDGE_PAD - ph;
      }

      setPanelClamp((prev) => {
        if (prev.right === right && prev.bottom === bottom) return prev;
        return { right, bottom };
      });
    }

    clampPanelPosition();
    const ro = new ResizeObserver(() => clampPanelPosition());
    if (panelRef.current) ro.observe(panelRef.current);
    window.addEventListener("resize", clampPanelPosition);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", clampPanelPosition);
    };
  }, [open, position.right, position.bottom]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target) &&
        btnRef.current &&
        !btnRef.current.contains(e.target)
      ) {
        setOpen(false);
        resetForm();
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  useLayoutEffect(() => {
    if (!currentUser) return;
    const el = btnRef.current;
    if (!el) return;

    function reclampLauncher() {
      const rect = el.getBoundingClientRect();
      const w = rect.width || 56;
      const h = rect.height || 56;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setPosition((prev) => {
        const next = clampPositionToViewport(prev, w, h, vw, vh);
        if (next.right === prev.right && next.bottom === prev.bottom) return prev;
        try {
          localStorage.setItem(POSITION_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
    }

    reclampLauncher();
    const ro = new ResizeObserver(reclampLauncher);
    ro.observe(el);
    window.addEventListener("resize", reclampLauncher);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", reclampLauncher);
    };
  }, [currentUser]);

  // Hide until onboarding/activation is complete (same gate as app shell access).
  if (!currentUser || currentUser.onboardingCompleted === false) return null;

  return (
    <>
      {/* Floating icon with label */}
      <div
        ref={btnRef}
        onPointerDown={onPointerDown}
        onClick={handleToggle}
        onKeyDown={handleLauncherKeyDown}
        role="button"
        tabIndex={0}
        className={`fixed z-[300] flex items-center gap-1.5 rounded-full shadow-lg transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white/40 bg-[#456564] border border-[#34514f] pl-1.5 pr-3 py-1 ${
          dragging ? "cursor-grabbing scale-105 ring-2 ring-white/50" : "cursor-grab"
        } ${open && !dragging ? "ring-2 ring-white/40" : ""}`}
        style={{
          right: position.right,
          bottom: position.bottom,
          touchAction: "none",
        }}
        title={`${t("widget.feedbackToggle")} — ${t("widget.dragHint")}`}
        aria-label={t("widget.feedbackToggle") || "Submit feedback or report a bug"}
      >
        <GripVertical
          className="w-4 h-4 shrink-0 text-white/70 pointer-events-none select-none"
          aria-hidden
        />
        <img
          src={opsyWritingIcon}
          alt="Opsy"
          className="w-9 h-9 rounded-full object-cover pointer-events-none select-none shrink-0 ring-2 ring-white/30"
          draggable={false}
        />
        <span className="text-[11px] font-semibold leading-tight text-white whitespace-nowrap pointer-events-none select-none pr-0.5">
          {t("widget.label") || "Bugs & Feedback"}
        </span>
      </div>

      {/* Popup panel */}
      {open && (
        <div
          ref={panelRef}
          className="fixed z-[301] w-80 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden animate-[slideUp_0.2s_ease-out]"
          style={{
            right: panelClamp.right ?? position.right,
            bottom: panelClamp.bottom ?? position.bottom + PANEL_ABOVE_LAUNCHER_PX,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-[#456564] to-[#34514f]">
            <h3 className="text-sm font-semibold text-white">
              {t("widget.title") || "How can we help?"}
            </h3>
            <button
              onClick={() => { setOpen(false); resetForm(); }}
              className="text-white/70 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {success ? (
            <div className="px-4 py-8 flex flex-col items-center gap-3 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                {t("widget.success") || "Thank you! We received your submission."}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="px-4 py-3 space-y-3">
              {/* Type toggle */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setType("feedback")}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                    type === "feedback"
                      ? "bg-[#456564] text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  <MessageSquareText className="w-3.5 h-3.5" />
                  {t("widget.feedback") || "Feedback"}
                </button>
                <button
                  type="button"
                  onClick={() => setType("bug")}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                    type === "bug"
                      ? "bg-[#456564] text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  <Bug className="w-3.5 h-3.5" />
                  {t("widget.bug") || "Bug Report"}
                </button>
              </div>

              {/* Subject */}
              <div>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="form-input w-full text-sm rounded-lg"
                  placeholder={t("widget.subjectPlaceholder") || "Brief summary"}
                  required
                />
              </div>

              {/* Description */}
              <div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="form-input w-full text-sm rounded-lg min-h-[80px] resize-y"
                  placeholder={
                    type === "bug"
                      ? t("widget.bugPlaceholder") || "What happened? Steps to reproduce..."
                      : t("widget.feedbackPlaceholder") || "Share your thoughts or suggestions..."
                  }
                  required
                />
              </div>

              {/* File attachment */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target?.files?.[0];
                    setAttachmentFiles(file ? [file] : []);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={attachmentFiles.length >= MAX_FILES}
                  className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-[#456564] dark:hover:text-[#6b9897] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  {t("widget.attach") || "Attach file"}
                </button>
                {attachmentFiles.length > 0 && (
                  <ul className="mt-1.5 space-y-1">
                    {attachmentFiles.map((f, i) => (
                      <li key={i} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                        <Paperclip className="w-3 h-3 shrink-0 text-gray-400" />
                        <span className="truncate flex-1">{f.name}</span>
                        <button
                          type="button"
                          onClick={() => setAttachmentFiles((prev) => prev.filter((_, idx) => idx !== i))}
                          className="text-red-500 hover:text-red-600 dark:text-red-400 shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {error && (
                <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#456564] hover:bg-[#34514f] text-white text-sm font-medium py-2 transition-colors disabled:opacity-50"
              >
                {submitting ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                {submitting
                  ? t("widget.submitting") || "Sending..."
                  : t("widget.submit") || "Send"}
              </button>
            </form>
          )}
        </div>
      )}
    </>
  );
}

export default FloatingFeedbackWidget;
