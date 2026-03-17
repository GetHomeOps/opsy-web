import React, { useState, useEffect } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import TicketSidebar from "./TicketSidebar";
import TicketConversation from "./TicketConversation";
import TicketContextPanel from "./TicketContextPanel";

function TicketWorkspace({
  ticket,
  admins = [],
  variant = "support",
  readOnly = false,
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
    ticket?.internalNotes || "",
  );
  const [notesDirty, setNotesDirty] = useState(false);
  const [contextOpen, setContextOpen] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    setInternalNotes(ticket?.internalNotes || "");
    setNotesDirty(false);
  }, [ticket?.id, ticket?.internalNotes]);

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth < 1024) {
        setContextOpen(false);
        setSidebarOpen(false);
      } else if (window.innerWidth < 1280) {
        setContextOpen(false);
        setSidebarOpen(true);
      } else {
        setContextOpen(true);
        setSidebarOpen(true);
      }
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  async function handleInternalNotes(ticketId, notes) {
    await onInternalNotes?.(ticketId, notes);
    setInternalNotes(notes);
    setNotesDirty(false);
  }

  return (
    <div className="flex h-full bg-gray-50 dark:bg-gray-950 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
      {/* Left sidebar */}
      {sidebarOpen && (
        <div className="w-[280px] min-w-[280px] bg-white dark:bg-gray-900/50 border-r border-gray-200 dark:border-gray-700/60 hidden lg:flex flex-col">
          <TicketSidebar
            ticket={ticket}
            admins={admins}
            variant={variant}
            readOnly={readOnly}
            onClose={onClose}
            onStatusChange={onStatusChange}
            onAssign={onAssign}
            onConvertToSupportTicket={
              variant === "feedback" ? onConvertToSupportTicket : undefined
            }
            updating={updating}
          />
        </div>
      )}

      {/* Middle conversation */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile/tablet header */}
        <div className="lg:hidden flex items-center gap-2 px-4 py-2.5 border-b border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-900/50">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ← Back
          </button>
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
            #{ticket?.id}
          </span>
        </div>

        <TicketConversation
          ticket={ticket}
          variant={variant}
          readOnly={readOnly}
          onReply={onReply}
          onInternalNotes={handleInternalNotes}
          onSendAndMarkInProgress={onSendAndMarkInProgress}
          onSendAndResolve={onSendAndResolve}
          onUserReply={onUserReply}
          updating={updating}
          internalNotes={internalNotes}
        />
      </div>

      {/* Context panel toggle */}
      <div className="hidden xl:flex items-start">
        <button
          type="button"
          onClick={() => setContextOpen((o) => !o)}
          className="p-2 mt-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          aria-label={contextOpen ? "Close context panel" : "Open context panel"}
        >
          {contextOpen ? (
            <PanelRightClose className="w-4 h-4" />
          ) : (
            <PanelRightOpen className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Right context panel */}
      {contextOpen && (
        <div className="w-[300px] min-w-[300px] hidden xl:flex flex-col">
          <TicketContextPanel
            ticket={ticket}
            readOnly={readOnly}
            internalNotes={internalNotes}
            onInternalNotes={handleInternalNotes}
            updating={updating}
            notesDirty={notesDirty}
            setNotesDirty={setNotesDirty}
            setInternalNotes={setInternalNotes}
            isOpen={contextOpen}
            onToggle={() => setContextOpen((o) => !o)}
          />
        </div>
      )}
    </div>
  );
}

export default TicketWorkspace;
