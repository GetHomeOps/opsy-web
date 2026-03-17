import React, { useState } from "react";
import { User, Clock, Lock, FileText, Pencil, Paperclip, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import ContextTabs from "./ContextTabs";
import CustomerInfoCard from "./CustomerInfoCard";
import MarkdownText from "../MarkdownText";
import AppApi from "../../../../api/api";

const TABS = [
  { id: "customer", label: "Customer", icon: User },
  { id: "history", label: "History", icon: Clock },
  { id: "attachments", label: "Attachments", icon: Paperclip },
  { id: "notes", label: "Notes", icon: Lock },
];

function HistoryTab({ ticket }) {
  const events = [];

  if (ticket?.createdAt) {
    events.push({
      id: "created",
      label: "Ticket created",
      time: ticket.createdAt,
      actor: ticket.createdByName || ticket.createdByEmail || "User",
    });
  }

  const replies = ticket?.replies || [];
  replies.forEach((r, i) => {
    events.push({
      id: `reply-${r.id || i}`,
      label: r.role === "admin" ? "Support replied" : "Customer replied",
      time: r.createdAt,
      actor:
        r.authorName ||
        r.authorEmail ||
        (r.role === "admin" ? "Support" : "Customer"),
    });
  });

  if (ticket?.updatedAt && ticket.updatedAt !== ticket.createdAt) {
    events.push({
      id: "updated",
      label: "Last updated",
      time: ticket.updatedAt,
    });
  }

  events.sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));

  if (events.length === 0) {
    return (
      <p className="text-sm text-gray-400 dark:text-gray-500 italic p-4">
        No history available.
      </p>
    );
  }

  return (
    <div className="px-4 py-3">
      <div className="space-y-0">
        {events.map((event, idx) => (
          <div
            key={event.id}
            className="flex gap-3 py-2.5 relative"
          >
            {idx < events.length - 1 && (
              <div className="absolute left-[7px] top-[22px] bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
            )}
            <div className="w-[15px] flex justify-center shrink-0 pt-0.5">
              <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                {event.label}
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {event.actor && <span>{event.actor} · </span>}
                {event.time &&
                  format(new Date(event.time), "MMM d, yyyy h:mm a")}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AttachmentsTab({ ticket }) {
  const keys = Array.isArray(ticket?.attachmentKeys) ? ticket.attachmentKeys : [];
  const [loadingKey, setLoadingKey] = useState(null);

  async function handleOpen(key) {
    if (!key) return;
    setLoadingKey(key);
    try {
      const url = await AppApi.getPresignedPreviewUrl(key);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      // Parent/global error handling
    } finally {
      setLoadingKey(null);
    }
  }

  if (keys.length === 0) {
    return (
      <div className="px-4 py-6">
        <p className="text-sm text-gray-400 dark:text-gray-500 italic">
          No attachments for this ticket.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-2">
      <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
        {keys.length} file{keys.length !== 1 ? "s" : ""} attached
      </p>
      {keys.map((key, i) => {
        const filename = key.split("/").pop() || `Document ${i + 1}`;
        const isLoading = loadingKey === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => handleOpen(key)}
            disabled={isLoading}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
          >
            <FileText className="w-4 h-4 shrink-0 text-gray-400 dark:text-gray-500" />
            <span className="flex-1 min-w-0 text-sm text-gray-700 dark:text-gray-300 truncate">
              {filename}
            </span>
            <ExternalLink className="w-3.5 h-3.5 shrink-0 text-gray-400 dark:text-gray-500" />
          </button>
        );
      })}
      <p className="mt-3 text-[11px] text-gray-400 dark:text-gray-500">
        Files are stored on AWS. Click to open in a new tab.
      </p>
    </div>
  );
}

function NotesTab({
  ticket,
  internalNotes,
  onInternalNotes,
  updating,
  notesDirty,
  setNotesDirty,
  setInternalNotes,
}) {
  const [editing, setEditing] = useState(false);

  async function handleSave() {
    try {
      await onInternalNotes?.(ticket.id, internalNotes);
      setNotesDirty(false);
      setEditing(false);
    } catch {
      // parent handles error
    }
  }

  const hasNotes = internalNotes?.trim();

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
            Internal Only
          </span>
        </div>
        {hasNotes && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1"
          >
            <Pencil className="w-3 h-3" />
            Edit
          </button>
        )}
      </div>

      {editing || !hasNotes ? (
        <div>
          <textarea
            value={internalNotes}
            onChange={(e) => {
              setInternalNotes(e.target.value);
              setNotesDirty(true);
            }}
            className="w-full border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800/50 px-3 py-2.5 text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-1 focus:ring-[#456564] focus:border-[#456564] resize-none min-h-[100px]"
            placeholder="Add internal notes visible only to the support team..."
          />
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={updating || !notesDirty}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-[#456564] hover:bg-[#34514f] text-white disabled:opacity-40 transition-colors"
            >
              {updating ? "Saving..." : "Save"}
            </button>
            {editing && (
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setInternalNotes(ticket?.internalNotes || "");
                  setNotesDirty(false);
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30">
          <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
            <MarkdownText>{internalNotes}</MarkdownText>
          </div>
        </div>
      )}
    </div>
  );
}

function TicketContextPanel({
  ticket,
  readOnly = false,
  internalNotes = "",
  onInternalNotes,
  updating = false,
  notesDirty,
  setNotesDirty,
  setInternalNotes,
  isOpen = true,
  onToggle,
}) {
  const [activeTab, setActiveTab] = useState("customer");

  if (!isOpen) return null;

  return (
    <aside className="flex flex-col h-full border-l border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-900/30">
      <ContextTabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 overflow-y-auto">
        {activeTab === "customer" && (
          <div className="px-4 py-4">
            <CustomerInfoCard ticket={ticket} />

            {/* Extra details section */}
            {ticket?.description && ticket?.type !== "data_adjustment" && (
              <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700/50">
                <div className="flex items-center gap-1.5 mb-2">
                  <FileText className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Description
                  </span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  <MarkdownText className="block whitespace-pre-wrap">
                    {ticket.description}
                  </MarkdownText>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "history" && <HistoryTab ticket={ticket} />}

        {activeTab === "attachments" && <AttachmentsTab ticket={ticket} />}

        {activeTab === "notes" && !readOnly && (
          <NotesTab
            ticket={ticket}
            internalNotes={internalNotes}
            onInternalNotes={onInternalNotes}
            updating={updating}
            notesDirty={notesDirty}
            setNotesDirty={setNotesDirty}
            setInternalNotes={setInternalNotes}
          />
        )}

        {activeTab === "notes" && readOnly && (
          <div className="p-4 text-sm text-gray-400 italic">
            Notes are only visible to support team.
          </div>
        )}
      </div>
    </aside>
  );
}

export default TicketContextPanel;
