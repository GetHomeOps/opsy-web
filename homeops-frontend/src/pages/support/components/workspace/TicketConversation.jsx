import React, { useRef, useEffect } from "react";
import { FileText } from "lucide-react";
import ConversationMessage from "./ConversationMessage";
import TicketComposer from "./TicketComposer";
import DataAdjustmentStructured from "../DataAdjustmentStructured";
import StatusBadge, { SUPPORT_STATUS_LABELS, FEEDBACK_STATUS_LABELS } from "../StatusBadge";
import PriorityBadge from "../PriorityBadge";
import TicketAttachmentIndicator from "../TicketAttachmentIndicator";

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
    (a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0),
  );
}

function TicketConversation({
  ticket,
  variant = "support",
  readOnly = false,
  onReply,
  onInternalNotes,
  onSendAndMarkInProgress,
  onSendAndResolve,
  onUserReply,
  updating = false,
  internalNotes = "",
}) {
  const scrollRef = useRef(null);
  const endRef = useRef(null);
  const chatterItems = buildChatterThread(ticket);
  const labels =
    variant === "feedback" ? FEEDBACK_STATUS_LABELS : SUPPORT_STATUS_LABELS;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatterItems.length]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900/30">
      {/* Header with ticket subject */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-900/50">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white leading-tight">
              {ticket?.subject || "Untitled Ticket"}
            </h1>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <StatusBadge status={ticket?.status} labels={labels} />
              {variant === "support" && ticket?.priority && (
                <PriorityBadge priority={ticket.priority} />
              )}
              <TicketAttachmentIndicator
                attachmentKeys={ticket?.attachmentKeys}
                className="text-gray-500 dark:text-gray-400"
              />
              {variant === "feedback" && ticket?.impactEstimate != null && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Impact: {ticket.impactEstimate}
                </span>
              )}
              {variant === "feedback" && ticket?.upvoteCount != null && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {ticket.upvoteCount} upvote{ticket.upvoteCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Data adjustment details (shown above conversation for context) */}
      {variant === "data_adjustment" && (
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-800/30">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Request Details
            </span>
          </div>
          <DataAdjustmentStructured ticket={ticket} />
        </div>
      )}

      {/* Conversation messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5">
        {chatterItems.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-gray-400 dark:text-gray-500 italic">
              No messages yet.
            </p>
          </div>
        ) : (
          <div className="space-y-5 max-w-3xl">
            {chatterItems.map((item) => (
              <ConversationMessage key={item.id} item={item} />
            ))}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Composer */}
      <TicketComposer
        ticket={ticket}
        readOnly={readOnly}
        onReply={onReply}
        onInternalNotes={onInternalNotes}
        onSendAndMarkInProgress={onSendAndMarkInProgress}
        onSendAndResolve={onSendAndResolve}
        onUserReply={onUserReply}
        updating={updating}
        internalNotes={internalNotes}
      />
    </div>
  );
}

export default TicketConversation;
