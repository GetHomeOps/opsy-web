import React from "react";
import { ArrowLeft } from "lucide-react";
import CustomerInfoCard from "./CustomerInfoCard";
import TicketMetaPanel from "./TicketMetaPanel";

function TicketSidebar({
  ticket,
  admins,
  variant,
  readOnly,
  onClose,
  onStatusChange,
  onAssign,
  onConvertToSupportTicket,
  updating,
}) {
  return (
    <aside className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700/60 flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 -ml-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
          aria-label="Back to list"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
          Ticket #{ticket?.id}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4">
          <div className="mb-5">
            <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
              Requester
            </h3>
            <CustomerInfoCard ticket={ticket} />
          </div>

          <div className="border-t border-gray-100 dark:border-gray-700/50 pt-4">
            <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
              Ticket Properties
            </h3>
            <TicketMetaPanel
              ticket={ticket}
              admins={admins}
              variant={variant}
              readOnly={readOnly}
              onStatusChange={onStatusChange}
              onAssign={onAssign}
              onConvertToSupportTicket={onConvertToSupportTicket}
              updating={updating}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}

export default TicketSidebar;
