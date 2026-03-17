import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  User,
  FileText,
  MessageSquare,
  StickyNote,
  Send,
} from "lucide-react";
import ModalBlank from "../../../components/ModalBlank";
import StatusBadge, {
  SUPPORT_STATUS_LABELS,
  FEEDBACK_STATUS_LABELS,
} from "./StatusBadge";
import PriorityBadge from "./PriorityBadge";
import TicketHeaderBar from "./TicketHeaderBar";
import MetadataCollapsible from "./MetadataCollapsible";
import DataAdjustmentStructured from "./DataAdjustmentStructured";
import DiscussionTimeline, { InternalNotesBlock } from "./DiscussionTimeline";
import MarkdownText from "./MarkdownText";

const CARD =
  "bg-white dark:bg-gray-800/95 rounded-xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 overflow-hidden";
const CARD_BODY = "p-5 sm:p-6";
const SECTION_HEADER =
  "text-base font-semibold text-gray-800 dark:text-gray-100 mb-5 flex items-center gap-2";
const SECTION_ICON = "h-5 w-5 text-[#6E8276] dark:text-[#5a7a78]";

const BTN_BACK =
  "btn text-gray-500 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-600 pl-0 focus:outline-none shadow-none inline-flex items-center gap-2";
const BTN_PRIMARY =
  "btn bg-[#456564] hover:bg-[#34514f] text-white transition-colors duration-200 shadow-sm disabled:opacity-50";
const BTN_SECONDARY =
  "btn bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-800 dark:text-gray-300 transition-colors duration-200 shadow-sm disabled:opacity-50";
const BTN_SUCCESS =
  "btn bg-emerald-600 hover:bg-emerald-700 text-white transition-colors duration-200 shadow-sm disabled:opacity-50";

export const SUPPORT_CATEGORIES = [
  "Bug",
  "Billing",
  "Technical",
  "Account",
  "Other",
];

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

const tierToPriority = (tier) => {
  const t = (tier || "").toLowerCase();
  if (["premium", "win"].includes(t)) return "urgent";
  if (["pro", "maintain"].includes(t)) return "high";
  if (["agent", "basic"].includes(t)) return "medium";
  return "low";
};

const SLA_BY_TIER = {
  premium: 4,
  win: 4,
  pro: 8,
  maintain: 8,
  agent: 24,
  basic: 24,
  free: 48,
};

/** Parse reason from data adjustment description (after **Reason:**) */
function extractDataAdjustmentReason(desc) {
  if (!desc || typeof desc !== "string") return null;
  const match = desc.match(/\*\*Reason:\*\*\s*\n?([\s\S]*?)(?:\n\n|$)/i);
  if (match) return match[1].trim();
  if (desc.includes("Reason:")) {
    const idx = desc.indexOf("Reason:");
    return desc.slice(idx + 7).trim();
  }
  return null;
}

/**
 * Build unified chatter thread. For data_adjustment, initial text is just the reason to avoid duplication.
 */
function buildChatterThread(ticket) {
  const items = [];
  const desc = ticket?.description || "";

  let initialText = desc;
  if (ticket?.type === "data_adjustment") {
    const reason = extractDataAdjustmentReason(desc);
    if (reason) initialText = reason;
  }

  items.push({
    id: "initial",
    type: "initial",
    role: "user",
    actor: ticket?.createdByName || ticket?.createdByEmail || "User",
    text: initialText || "—",
    timestamp: ticket?.createdAt,
    label: "Initial submission",
  });

  const replies = ticket?.replies || [];
  replies.forEach((r, i) => {
    items.push({
      id: `reply-${r.id || i}`,
      type: "reply",
      role: r.role || "admin",
      actor:
        r.authorName ||
        r.authorEmail ||
        (r.role === "admin" ? "Support" : "User"),
      text: r.body,
      timestamp: r.createdAt,
      label: r.role === "admin" ? "Support reply" : "User reply",
    });
  });

  return items.sort(
    (a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
  );
}

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
  const [internalNotes, setInternalNotes] = useState(
    ticket?.internalNotes || ""
  );
  const [composerText, setComposerText] = useState("");
  const [composerMode, setComposerMode] = useState("message");
  const [notesDirty, setNotesDirty] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const chatterEndRef = useRef(null);

  const labels =
    variant === "feedback" ? FEEDBACK_STATUS_LABELS : SUPPORT_STATUS_LABELS;
  const statusDisplay = normalizeStatus(ticket?.status);
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

  const hasSecondaryMetadata =
    ticket?.createdByName ||
    ticket?.createdByEmail ||
    ticket?.subscriptionTier ||
    ticket?.accountId != null;

  return (
    <div className="space-y-5">
      <TicketHeaderBar
        ticket={ticket}
        labels={labels}
        statusDisplay={statusDisplay}
        priority={variant === "support" ? priority : null}
        admins={admins}
        readOnly={readOnly}
        asPage={asPage}
        onClose={onClose}
        onStatusChange={onStatusChange}
        onAssign={onAssign}
        variant={variant}
        onConvertToSupportTicket={onConvertToSupportTicket}
        updating={updating}
      />

      {!readOnly && hasSecondaryMetadata && (
        <MetadataCollapsible title="User & account info" icon={User}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            <div>
              <span className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Name</span>
              <p className="font-medium text-gray-900 dark:text-white">
                {ticket?.createdByName || "—"}
              </p>
            </div>
            <div>
              <span className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Email</span>
              <p className="font-medium text-gray-900 dark:text-white">
                {ticket?.createdByEmail || "—"}
              </p>
            </div>
            <div>
              <span className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Plan</span>
              <p className="font-medium text-gray-900 dark:text-white">
                {ticket?.subscriptionTier || "Free"}
              </p>
            </div>
            <div>
              <span className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Account ID</span>
              <p className="font-medium text-gray-900 dark:text-white">
                {ticket?.accountId ?? "—"}
              </p>
            </div>
            <div>
              <span className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">SLA</span>
              <p className="font-medium text-gray-900 dark:text-white">
                {slaHours}h response
              </p>
            </div>
          </div>
        </MetadataCollapsible>
      )}

      {variant === "data_adjustment" ? (
        <div className={CARD}>
          <div className={CARD_BODY}>
            <h3 className={SECTION_HEADER}>
              <FileText className={SECTION_ICON} />
              Request details
            </h3>
            <DataAdjustmentStructured ticket={ticket} />
          </div>
        </div>
      ) : (
        <div className={CARD}>
          <div className={CARD_BODY}>
            <h3 className={SECTION_HEADER}>
              <FileText className={SECTION_ICON} />
              Details
            </h3>
            <div className="space-y-4">
              {variant === "support" && (
                <div>
                  <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Category</span>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {ticket?.category || "Other"}
                  </p>
                </div>
              )}
              {variant === "feedback" && (
                <>
                  {(ticket?.featureCategory || ticket?.impactEstimate != null || ticket?.upvoteCount != null || ticket?.roadmapTag) && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {ticket?.featureCategory && (
                        <div>
                          <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Feature</span>
                          <p className="text-sm text-gray-900 dark:text-white">{ticket.featureCategory}</p>
                        </div>
                      )}
                      {ticket?.impactEstimate != null && (
                        <div>
                          <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Impact</span>
                          <p className="text-sm text-gray-900 dark:text-white">{ticket.impactEstimate}</p>
                        </div>
                      )}
                      {ticket?.upvoteCount != null && (
                        <div>
                          <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Upvotes</span>
                          <p className="text-sm text-gray-900 dark:text-white">{ticket.upvoteCount}</p>
                        </div>
                      )}
                      {ticket?.roadmapTag && (
                        <div>
                          <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Roadmap</span>
                          <p className="text-sm text-gray-900 dark:text-white">{ticket.roadmapTag}</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
              {ticket?.description && (
                <div>
                  <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Description</span>
                  <div className="text-sm text-gray-900 dark:text-white">
                    <MarkdownText className="block whitespace-pre-wrap">
                      {ticket.description}
                    </MarkdownText>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className={CARD}>
        <div className={CARD_BODY}>
          <h3 className={SECTION_HEADER}>
            <MessageSquare className={SECTION_ICON} />
            Discussion
          </h3>

          <div className="space-y-4 mb-6 max-h-[400px] overflow-y-auto pr-2">
            <DiscussionTimeline items={chatterItems} />
            <div ref={chatterEndRef} />
          </div>

          {!readOnly && (
            <>
              <InternalNotesBlock
                notes={internalNotes}
                isEditing={editingNotes}
                onEdit={() => setEditingNotes(true)}
                onSave={async () => {
                  await handleSaveNotes();
                  setEditingNotes(false);
                }}
                onCancel={() => {
                  setEditingNotes(false);
                  setInternalNotes(ticket?.internalNotes || "");
                  setNotesDirty(false);
                }}
                value={internalNotes}
                onChange={(v) => {
                  setInternalNotes(v);
                  setNotesDirty(true);
                }}
                dirty={notesDirty}
                saving={updating}
              />

              {!internalNotes?.trim() && (
                <div className="mb-6 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30">
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
                      {updating ? "Saving..." : "Save"}
                    </button>
                  )}
                </div>
              )}

              <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setComposerMode("message")}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                      composerMode === "message"
                        ? "bg-[#456564] text-white"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                    }`}
                  >
                    <Send className="w-4 h-4" />
                    Reply to user
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
                    Internal note
                  </button>
                </div>
                <textarea
                  value={composerText}
                  onChange={(e) => setComposerText(e.target.value)}
                  className="form-input w-full min-h-[100px] text-sm"
                  placeholder={
                    composerMode === "message"
                      ? "Type your reply to the user..."
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
                        : "Add note"
                      : updating
                        ? "Sending..."
                        : "Send"}
                  </button>
                  {composerMode === "message" && (
                    <>
                      <button
                        type="button"
                        onClick={() => composerText?.trim() && onSendAndMarkInProgress?.(ticket.id, composerText)}
                        disabled={updating}
                        className={`${BTN_SECONDARY} min-w-[140px]`}
                      >
                        Send & mark In Progress
                      </button>
                      <button
                        type="button"
                        onClick={() => composerText?.trim() && onSendAndResolve?.(ticket.id, composerText)}
                        disabled={updating}
                        className={`${BTN_SUCCESS} min-w-[120px]`}
                      >
                        Send & Resolve
                      </button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          {readOnly && onUserReply && (
            <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
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
          )}
        </div>
      </div>
    </div>
  );
}

function TicketFormContainerWrapper({
  ticket,
  admins = [],
  variant = "support",
  readOnly = false,
  asPage = false,
  ...rest
}) {
  const backButton =
    asPage &&
    (variant === "support" ||
      variant === "feedback" ||
      variant === "data_adjustment") ? (
      <div className="flex justify-between items-center mb-5">
        <button
          type="button"
          onClick={rest.onClose}
          className={BTN_BACK}
        >
          <ArrowLeft className="w-5 h-5 shrink-0" />
          <span className="text-lg">Back to list</span>
        </button>
      </div>
    ) : null;

  const content = (
    <>
      {backButton}
      <TicketFormContainer
        ticket={ticket}
        admins={admins}
        variant={variant}
        readOnly={readOnly}
        asPage={asPage}
        {...rest}
      />
    </>
  );

  if (asPage) {
    return <div className="max-w-5xl mx-auto">{content}</div>;
  }

  return (
    <ModalBlank
      id="ticket-form-modal"
      modalOpen={!!ticket}
      setModalOpen={rest.onClose}
      contentClassName="max-w-4xl"
    >
      <div className="max-h-[90vh] overflow-y-auto p-1">{content}</div>
    </ModalBlank>
  );
}

export default TicketFormContainerWrapper;
