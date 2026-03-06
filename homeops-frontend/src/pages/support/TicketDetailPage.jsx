import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Header from "../../partials/Header";
import Sidebar from "../../partials/Sidebar";
import AppApi from "../../api/api";
import { TicketFormContainer } from "./components";
import { PAGE_LAYOUT } from "../../constants/layout";
import {
  supportToColumnStatus,
  columnToSupportStatus,
} from "./kanbanConfig";
import {
  feedbackToColumnStatus,
  columnToFeedbackStatus,
} from "./kanbanConfig";

function tierToPriority(tier) {
  const t = (tier || "").toLowerCase();
  if (["premium", "win"].includes(t)) return "urgent";
  if (["pro", "maintain"].includes(t)) return "high";
  if (["agent", "basic"].includes(t)) return "medium";
  return "low";
}

/**
 * Full-page ticket detail view (Odoo-style).
 * Clicking a ticket on the Kanban navigates here instead of opening a modal.
 */
function TicketDetailPage({ variant = "support" }) {
  const { accountUrl, ticketId } = useParams();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [updating, setUpdating] = useState(false);

  const listPath =
    variant === "support"
      ? `/${accountUrl}/support-management`
      : `/${accountUrl}/feedback-management`;

  const fetchTicket = useCallback(async () => {
    const id = Number(ticketId);
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const t = await AppApi.getSupportTicket(id);
      setTicket({
        ...t,
        status:
          variant === "support"
            ? supportToColumnStatus(t.status)
            : feedbackToColumnStatus(t.status),
        priority: tierToPriority(t.subscriptionTier),
      });
    } catch (err) {
      setError(err.message || "Failed to load ticket");
      setTicket(null);
    } finally {
      setLoading(false);
    }
  }, [ticketId, variant]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  useEffect(() => {
    async function fetchAdmins() {
      try {
        const list = await AppApi.getSupportAssignmentAdmins();
        setAdmins(list || []);
      } catch {
        setAdmins([]);
      }
    }
    fetchAdmins();
  }, []);

  async function handleStatusChange(ticketIdVal, newStatus) {
    const backendStatus =
      variant === "support"
        ? columnToSupportStatus(newStatus)
        : columnToFeedbackStatus(newStatus);
    setUpdating(true);
    try {
      await AppApi.updateSupportTicket(ticketIdVal, { status: backendStatus });
      setTicket((prev) => (prev ? { ...prev, status: newStatus } : null));
    } catch (err) {
      setError(err.message || "Failed to update");
    } finally {
      setUpdating(false);
    }
  }

  async function handleAssign(ticketIdVal, assignedTo) {
    setUpdating(true);
    try {
      await AppApi.updateSupportTicket(ticketIdVal, {
        assignedTo: assignedTo || null,
      });
      setTicket((prev) =>
        prev ? { ...prev, assignedTo: assignedTo || null } : null
      );
    } catch (err) {
      setError(err.message || "Failed to assign");
    } finally {
      setUpdating(false);
    }
  }

  async function handleInternalNotes(ticketIdVal, internalNotes) {
    setUpdating(true);
    try {
      await AppApi.updateSupportTicket(ticketIdVal, { internalNotes });
      setTicket((prev) => (prev ? { ...prev, internalNotes } : null));
    } catch (err) {
      setError(err.message || "Failed to save notes");
    } finally {
      setUpdating(false);
    }
  }

  async function handleReply(ticketIdVal, responseText) {
    if (!responseText?.trim()) return;
    setUpdating(true);
    try {
      await AppApi.addSupportTicketReply(ticketIdVal, responseText.trim());
      await fetchTicket();
    } catch (err) {
      setError(err.message || "Failed to send reply");
    } finally {
      setUpdating(false);
    }
  }

  async function handleSendAndMarkInProgress(ticketIdVal, responseText) {
    setUpdating(true);
    try {
      if (responseText?.trim()) {
        await AppApi.addSupportTicketReply(ticketIdVal, responseText.trim());
      }
      await handleStatusChange(ticketIdVal, "in_progress");
      navigate(listPath);
    } catch (err) {
      setError(err.message || "Failed to send reply");
    } finally {
      setUpdating(false);
    }
  }

  async function handleSendAndResolve(ticketIdVal, responseText) {
    setUpdating(true);
    try {
      if (responseText?.trim()) {
        await AppApi.addSupportTicketReply(ticketIdVal, responseText.trim());
      }
      await handleStatusChange(ticketIdVal, "completed");
      navigate(listPath);
    } catch (err) {
      setError(err.message || "Failed to send reply");
    } finally {
      setUpdating(false);
    }
  }

  function handleConvertToSupportTicket() {
    navigate(listPath);
  }

  function handleClose() {
    navigate(listPath);
  }

  if (loading) {
    return (
      <div className="flex h-[100dvh] overflow-hidden">
        <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <div className="relative flex flex-col flex-1 min-w-0 overflow-hidden">
          <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
          <main className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
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
                  className="btn bg-violet-600 text-white hover:bg-violet-700"
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
              admins={admins}
              variant={variant}
              asPage
              readOnly={false}
              onClose={handleClose}
              onStatusChange={handleStatusChange}
              onAssign={handleAssign}
              onInternalNotes={handleInternalNotes}
              onReply={handleReply}
              onSendAndMarkInProgress={handleSendAndMarkInProgress}
              onSendAndResolve={handleSendAndResolve}
              onConvertToSupportTicket={
                variant === "feedback" ? handleConvertToSupportTicket : undefined
              }
              onRefresh={fetchTicket}
              updating={updating}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default TicketDetailPage;
