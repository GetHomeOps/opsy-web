import React, { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import {
  ArrowLeft,
  User,
  FileText,
  StickyNote,
  MessageSquare,
  X,
  Zap,
  Send,
  Lock,
} from "lucide-react";
import ModalBlank from "../../../components/ModalBlank";
import StatusBadge, {
  SUPPORT_STATUS_LABELS,
  FEEDBACK_STATUS_LABELS,
} from "./StatusBadge";
import PriorityBadge from "./PriorityBadge";

/** Card styling – each section is its own elevated card (matches ContactFormContainer / ResourceFormContainer). */
const CARD =
  "bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden";
const CARD_BODY = "p-5 sm:p-6";
const SECTION_HEADER =
  "text-base font-semibold text-gray-800 dark:text-gray-100 mb-5 flex items-center gap-2";
const SECTION_ICON = "h-5 w-5 text-[#6E8276] dark:text-[#5a7a78]";

/** Button classes (matches ProfessionalFormContainer, ResourceFormContainer) */
const BTN_BACK =
  "btn text-gray-500 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-600 pl-0 focus:outline-none shadow-none inline-flex items-center gap-2";
const BTN_PRIMARY =
  "btn bg-[#456564] hover:bg-[#34514f] text-white transition-colors duration-200 shadow-sm disabled:opacity-50";
const BTN_SECONDARY =
  "btn bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-800 dark:text-gray-300 transition-colors duration-200 shadow-sm disabled:opacity-50";
const BTN_SUCCESS =
  "btn bg-emerald-600 hover:bg-emerald-700 text-white transition-colors duration-200 shadow-sm disabled:opacity-50";

/** Support ticket categories */
export const SUPPORT_CATEGORIES = [
  "Bug",
  "Billing",
  "Technical",
  "Account",
  "Other",
];

/** Map backend status to 4-column display */
const normalizeStatus = (s) => {
  if (["new", "in_progress", "completed", "closed"].includes(s)) return s;
  if (["solved", "resolved"].includes(s)) return "completed";
  if (
    ["working_on_it", "waiting_on_user", "under_review", "planned"].includes(s)
  )
    return "in_progress";
  if (s === "rejected") return "closed";
  return s || "new";
};

/** Derive priority from tier for display when priority not set */
const tierToPriority = (tier) => {
  const t = (tier || "").toLowerCase();
  if (["premium", "win"].includes(t)) return "urgent";
  if (["pro", "maintain"].includes(t)) return "high";
  if (["agent", "basic"].includes(t)) return "medium";
  return "low";
};

/** SLA hours by plan tier (placeholder for future integration) */
const SLA_BY_TIER = {
  premium: 4,
  win: 4,
  pro: 8,
  maintain: 8,
  agent: 24,
  basic: 24,
  free: 48,
};

/**
 * Build unified chatter thread: initial message + replies (Odoo-style).
 * Internal notes are shown as a separate block for admins.
 */
function buildChatterThread(ticket) {
  const items = [];
  const createdAt = ticket?.createdAt ? new Date(ticket.createdAt) : null;

  // Initial submission
  items.push({
    id: "initial",
    type: "message",
    role: "user",
    actor: ticket?.createdByName || ticket?.createdByEmail || "User",
    text: ticket?.description,
    timestamp: ticket?.createdAt,
    label: "Initial submission",
  });

  // Replies from support_ticket_replies
  const replies = ticket?.replies || [];
  replies.forEach((r, i) => {
    items.push({
      id: `reply-${r.id || i}`,
      type: "reply",
      role: r.role || "admin",
      actor: r.authorName || r.authorEmail || (r.role === "admin" ? "Support" : "User"),
      text: r.body,
      timestamp: r.createdAt,
      label: r.role === "admin" ? "Support reply" : "User reply",
    });
  });

  return items.sort(
    (a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
  );
}

/**
 * Reusable ticket form container for support and feedback.
 * Renders as a modal (default) or full page (asPage=true, Odoo-style).
 * Odoo Chatter: unified message thread + composer (Send message / Log note).
 */
function TicketFormContainer({
  ticket,
  admins = [],
  variant = "support",
  readOnly = false,
  asPage = false,
  onClose,
  onStatusChange,
  onAssign,
  onInternalNotes,
  onReply,
  onSendAndMarkInProgress,
  onSendAndResolve,
  onConvertToSupportTicket,
  onUserReply,
  onRefresh,
  updating = false,
}) {
  const [internalNotes, setInternalNotes] = useState(ticket?.internalNotes || "");
  const [composerText, setComposerText] = useState("");
  const [composerMode, setComposerMode] = useState("message"); // 'message' | 'note'
  const [notesDirty, setNotesDirty] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const chatterEndRef = useRef(null);

  const labels =
    variant === "feedback" ? FEEDBACK_STATUS_LABELS : SUPPORT_STATUS_LABELS;
  const statusDisplay = normalizeStatus(ticket?.status);
  const statusForSelect = statusDisplay;
  const priority =
    ticket?.priority ?? tierToPriority(ticket?.subscriptionTier);
  const slaHours =
    SLA_BY_TIER[(ticket?.subscriptionTier || "free").toLowerCase()] ?? 48;

  useEffect(() => {
    setInternalNotes(ticket?.internalNotes || "");
    setNotesDirty(false);
  }, [ticket?.id, ticket?.internalNotes]);

  const chatterItems = buildChatterThread(ticket);

  useEffect(() => {
    chatterEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatterItems.length]);

  async function handleSaveNotes() {
    if (!notesDirty) return;
    try {
      await onInternalNotes?.(ticket.id, internalNotes);
      setNotesDirty(false);
    } catch {
      // Parent handles error display
    }
  }

  async function handleSendMessage() {
    const text = composerText?.trim();
    if (!text) return;
    if (composerMode === "note") {
      const newNotes = internalNotes ? `${internalNotes}\n\n---\n${text}` : text;
      setInternalNotes(newNotes);
      try {
        await onInternalNotes?.(ticket.id, newNotes);
        setComposerText("");
      } catch {
        // Parent handles error display
      }
    } else {
      onReply?.(ticket.id, text);
      setComposerText("");
    }
  }

  const backButton = (
    <button
      type="button"
      onClick={onClose}
      className={BTN_BACK}
    >
      <ArrowLeft className="w-5 h-5 shrink-0" />
      <span className="text-lg">Back to list</span>
    </button>
  );

  const cardContent = (
    <div className="space-y-5">
      {/* Header card */}
      <div className={CARD}>
        <div className="px-5 sm:px-6 py-5 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                #{ticket?.id}
              </h2>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                {ticket?.subject}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2.5">
              <StatusBadge status={statusDisplay} labels={labels} />
              {variant === "support" && (
                <PriorityBadge priority={priority} />
              )}
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Created{" "}
                {ticket?.createdAt &&
                  format(new Date(ticket.createdAt), "MMM d, yyyy HH:mm")}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Updated{" "}
                {ticket?.updatedAt &&
                  format(new Date(ticket.updatedAt), "MMM d, yyyy HH:mm")}
              </span>
            </div>
          </div>
          {!asPage && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700/50 transition-colors shrink-0"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* User Info card (admin only) */}
      {!readOnly && (
        <div className={CARD}>
          <div className={CARD_BODY}>
            <h3 className={SECTION_HEADER}>
              <User className={SECTION_ICON} />
              User Info
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4 text-sm">
              <div>
                <span className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                  Name
                </span>
                <p className="font-medium text-gray-900 dark:text-white">
                  {ticket?.createdByName || "—"}
                </p>
              </div>
              <div>
                <span className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                  Email
                </span>
                <p className="font-medium text-gray-900 dark:text-white">
                  {ticket?.createdByEmail || "—"}
                </p>
              </div>
              <div>
                <span className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                  Role
                </span>
                <p className="font-medium text-gray-900 dark:text-white capitalize">
                  {ticket?.createdByRole || "Homeowner"}
                </p>
              </div>
              <div>
                <span className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                  Payment Plan
                </span>
                <p className="font-medium text-gray-900 dark:text-white">
                  {ticket?.subscriptionTier || "Free"}
                </p>
              </div>
              <div>
                <span className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                  Account ID
                </span>
                <p className="font-medium text-gray-900 dark:text-white">
                  {ticket?.accountId || "—"}
                </p>
              </div>
              <div>
                <span className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                  Properties
                </span>
                <p className="font-medium text-gray-900 dark:text-white">
                  {ticket?.propertyCount ?? "—"}
                </p>
              </div>
              <div>
                <span className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                  Est. MRR
                </span>
                <p className="font-medium text-gray-900 dark:text-white">
                  {ticket?.estimatedMrr ?? "—"}
                </p>
              </div>
              <div>
                <span className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                  SLA Target
                </span>
                <p className="font-medium text-gray-900 dark:text-white">
                  {slaHours}h response
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Details card */}
      <div className={CARD}>
        <div className={CARD_BODY}>
          <h3 className={SECTION_HEADER}>
            <FileText className={SECTION_ICON} />
            Ticket Details
          </h3>
          <div className="space-y-4">
            {variant === "support" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category
                </label>
                <p className="text-sm text-gray-900 dark:text-white">
                  {ticket?.category || "Other"}
                </p>
              </div>
            )}
            {variant === "feedback" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Feature Category
                  </label>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {ticket?.featureCategory || "—"}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Impact Estimate (admin)
                  </label>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {ticket?.impactEstimate ?? "—"}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Upvotes
                  </label>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {ticket?.upvoteCount ?? 0}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Roadmap Tag
                  </label>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {ticket?.roadmapTag || "—"}
                  </p>
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                {ticket?.description || "—"}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Attachments
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                (Placeholder — future integration)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions card (admin only) */}
      {!readOnly && (
        <div className={CARD}>
          <div className={CARD_BODY}>
            <h3 className={SECTION_HEADER}>
              <Zap className={SECTION_ICON} />
              Quick Actions
            </h3>
            <div className="flex flex-wrap gap-6 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={statusForSelect}
                  onChange={(e) =>
                    onStatusChange?.(ticket.id, e.target.value)
                  }
                  disabled={updating}
                  className="form-select text-sm w-40"
                >
                  <option value="new">New</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Assign to
                </label>
                <select
                  value={ticket?.assignedTo || ""}
                  onChange={(e) =>
                    onAssign?.(
                      ticket.id,
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                  disabled={updating}
                  className="form-select text-sm w-44"
                >
                  <option value="">Unassigned</option>
                  {admins.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name || a.email}
                    </option>
                  ))}
                </select>
              </div>
              {variant === "feedback" && (
                <button
                  type="button"
                  onClick={onConvertToSupportTicket}
                  className={BTN_SECONDARY}
                >
                  Convert to Support Ticket
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Discussion card */}
      <div className={CARD}>
        <div className={CARD_BODY}>
          <h3 className={SECTION_HEADER}>
            <MessageSquare className={SECTION_ICON} />
            Discussion
          </h3>

          {/* Chatter thread */}
          <div className="space-y-4 mb-6 max-h-[400px] overflow-y-auto pr-2">
            {chatterItems.map((item) => (
              <div
                key={item.id}
                className={`flex gap-3 ${
                  item.role === "admin" ? "pl-3 border-l-2 border-[#456564]/40" : ""
                }`}
              >
                <div
                  className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${
                    item.role === "admin"
                      ? "bg-[#456564] dark:bg-[#5a7a78]"
                      : "bg-gray-400 dark:bg-gray-500"
                  }`}
                />
                <div className="flex-1 min-w-0 pb-4 border-b border-gray-100 dark:border-gray-700/60 last:border-0 last:pb-0">
                  {item.label && (
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
                      {item.label}
                    </span>
                  )}
                  <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap mt-0.5">
                    {item.text}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {item.actor} ·{" "}
                    {item.timestamp &&
                      format(new Date(item.timestamp), "MMM d, yyyy HH:mm")}
                  </p>
                </div>
              </div>
            ))}
            {chatterItems.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                No messages yet.
              </p>
            )}
            <div ref={chatterEndRef} />
          </div>

          {/* Internal notes block (admin only, shown when notes exist) */}
          {!readOnly && internalNotes?.trim() && !editingNotes && (
            <div className="mb-6 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-600 dark:text-amber-500" />
                  <span className="text-xs font-medium text-amber-800 dark:text-amber-200 uppercase tracking-wider">
                    Internal notes (not visible to user)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingNotes(true)}
                  className="text-xs font-medium text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100"
                >
                  Edit
                </button>
              </div>
              <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                {internalNotes}
              </p>
            </div>
          )}
          {!readOnly && internalNotes?.trim() && editingNotes && (
            <div className="mb-6 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-4 h-4 text-amber-600 dark:text-amber-500" />
                <span className="text-xs font-medium text-amber-800 dark:text-amber-200 uppercase tracking-wider">
                  Internal notes (not visible to user)
                </span>
              </div>
              <textarea
                value={internalNotes}
                onChange={(e) => {
                  setInternalNotes(e.target.value);
                  setNotesDirty(true);
                }}
                className="form-input w-full min-h-[80px] text-sm"
              />
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={async () => {
                    await handleSaveNotes();
                    setEditingNotes(false);
                  }}
                  disabled={updating || !notesDirty}
                  className={`${BTN_PRIMARY} min-w-[100px]`}
                >
                  {updating ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingNotes(false);
                    setInternalNotes(ticket?.internalNotes || "");
                    setNotesDirty(false);
                  }}
                  className={BTN_SECONDARY}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Composer */}
          {!readOnly ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setComposerMode("message")}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    composerMode === "message"
                      ? "bg-[#456564] text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  <Send className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                  Send message
                </button>
                <button
                  type="button"
                  onClick={() => setComposerMode("note")}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                    composerMode === "note"
                      ? "bg-amber-600 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  <StickyNote className="w-4 h-4" />
                  Log note
                </button>
              </div>
              <textarea
                value={composerText}
                onChange={(e) => setComposerText(e.target.value)}
                className="form-input w-full min-h-[100px] text-sm"
                placeholder={
                  composerMode === "message"
                    ? "Type your message to the user..."
                    : "Add an internal note (visible only to support team)..."
                }
              />
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={updating || !composerText?.trim()}
                  className={`${BTN_PRIMARY} min-w-[120px]`}
                >
                  {composerMode === "note"
                    ? updating
                      ? "Saving..."
                      : "Log note"
                    : updating
                      ? "Sending..."
                      : "Send"}
                </button>
                {composerMode === "message" && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        if (composerText?.trim()) {
                          onSendAndMarkInProgress?.(ticket.id, composerText);
                        }
                      }}
                      disabled={updating}
                      className={`${BTN_SECONDARY} min-w-[140px]`}
                    >
                      Send & mark In Progress
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (composerText?.trim()) {
                          onSendAndResolve?.(ticket.id, composerText);
                        }
                      }}
                      disabled={updating}
                      className={`${BTN_SUCCESS} min-w-[120px]`}
                    >
                      Send & Resolve
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            onUserReply && (
              <div className="space-y-3">
                <textarea
                  value={composerText}
                  onChange={(e) => setComposerText(e.target.value)}
                  className="form-input w-full min-h-[80px] text-sm"
                  placeholder="Type your reply..."
                />
                <button
                  type="button"
                  onClick={() => {
                    if (composerText?.trim()) {
                      onUserReply?.(ticket.id, composerText);
                      setComposerText("");
                    }
                  }}
                  disabled={updating || !composerText?.trim()}
                  className={`${BTN_PRIMARY} min-w-[100px]`}
                >
                  {updating ? "Sending..." : "Send Reply"}
                </button>
              </div>
            )
          )}

          {/* Internal notes editor when no notes yet (admin) */}
          {!readOnly && !internalNotes?.trim() && (
            <div className="mt-5 pt-5 border-t border-gray-200 dark:border-gray-700">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Internal notes
              </label>
              <textarea
                value={internalNotes}
                onChange={(e) => {
                  setInternalNotes(e.target.value);
                  setNotesDirty(true);
                }}
                className="form-input w-full min-h-[60px] text-sm"
                placeholder="Add internal notes (visible only to support team)..."
              />
              {notesDirty && (
                <button
                  type="button"
                  onClick={handleSaveNotes}
                  disabled={updating}
                  className={`mt-2 ${BTN_PRIMARY} min-w-[100px]`}
                >
                  {updating ? "Saving..." : "Save Internal Note"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (asPage) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-5">
          {backButton}
        </div>
        {cardContent}
      </div>
    );
  }

  return (
    <ModalBlank
      id="ticket-form-modal"
      modalOpen={!!ticket}
      setModalOpen={onClose}
      contentClassName="max-w-4xl"
    >
      <div className="max-h-[90vh] overflow-y-auto p-1">{cardContent}</div>
    </ModalBlank>
  );
}

export default TicketFormContainer;
