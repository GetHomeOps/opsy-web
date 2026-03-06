import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Header from "../../partials/Header";
import Sidebar from "../../partials/Sidebar";
import AppApi from "../../api/api";
import { TicketFormContainer } from "./components";
import { PAGE_LAYOUT } from "../../constants/layout";
import useCurrentAccount from "../../hooks/useCurrentAccount";

/**
 * Full-page ticket detail view (like Contact.jsx for contacts).
 * User views their own ticket, can add replies.
 */
function SupportTicket() {
  const { accountUrl, ticketId } = useParams();
  const navigate = useNavigate();
  const { currentAccount } = useCurrentAccount();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [replyUpdating, setReplyUpdating] = useState(false);

  const listPath = `/${accountUrl || currentAccount?.url}/settings/support`;

  const fetchTicket = useCallback(async () => {
    const id = Number(ticketId);
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const t = await AppApi.getSupportTicket(id);
      setTicket(t);
    } catch (err) {
      setError(err.message || "Failed to load ticket");
      setTicket(null);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  function handleClose() {
    navigate(listPath);
  }

  async function handleUserReply(ticketIdVal, body) {
    setReplyUpdating(true);
    try {
      const updated = await AppApi.addSupportTicketReply(ticketIdVal, body);
      setTicket(updated);
    } catch (err) {
      setError(err.message || "Failed to send reply");
    } finally {
      setReplyUpdating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-[100dvh] overflow-hidden">
        <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <div className="relative flex flex-col flex-1 min-w-0 overflow-hidden">
          <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
          <main className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-2 border-[#456564] border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-600 dark:text-gray-400">Loading ticket...</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (error && !ticket) {
    return (
      <div className="flex h-[100dvh] overflow-hidden">
        <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <div className="relative flex flex-col flex-1 min-w-0 overflow-hidden">
          <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
          <main className={`flex-1 overflow-y-auto ${PAGE_LAYOUT.listPaddingX} py-8`}>
            <div className="max-w-2xl">
              <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={fetchTicket}
                  className="btn bg-[#456564] text-white hover:bg-[#34514f]"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="btn bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                >
                  Back to list
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="relative flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className={`flex-1 overflow-y-auto ${PAGE_LAYOUT.listPaddingX} py-8`}>
          {ticket && (
            <TicketFormContainer
              ticket={ticket}
              variant={ticket.type || "support"}
              readOnly
              asPage
              onClose={handleClose}
              onUserReply={handleUserReply}
              onRefresh={fetchTicket}
              updating={replyUpdating}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default SupportTicket;
