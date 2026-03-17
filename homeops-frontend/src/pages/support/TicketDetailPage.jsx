import React, {useState, useEffect, useCallback} from "react";
import {useParams, useNavigate} from "react-router-dom";
import Header from "../../partials/Header";
import Sidebar from "../../partials/Sidebar";
import AppApi from "../../api/api";
import {TicketWorkspace} from "./components/workspace";
import {
  supportToColumnStatus,
  columnToSupportStatus,
  feedbackToColumnStatus,
  columnToFeedbackStatus,
  dataAdjustmentToColumnStatus,
  columnToDataAdjustmentStatus,
} from "./kanbanConfig";

function tierToPriority(tier) {
  const t = (tier || "").toLowerCase();
  if (["premium", "win"].includes(t)) return "urgent";
  if (["pro", "maintain"].includes(t)) return "high";
  if (["agent", "basic"].includes(t)) return "medium";
  return "low";
}

function TicketDetailPage({variant = "support"}) {
  const {accountUrl, ticketId} = useParams();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [updating, setUpdating] = useState(false);

  const listPath =
    variant === "support"
      ? `/${accountUrl}/helpdesk/support`
      : variant === "feedback"
        ? `/${accountUrl}/helpdesk/feedback`
        : `/${accountUrl}/helpdesk/data-adjustments`;

  const fetchTicket = useCallback(async () => {
    const id = Number(ticketId);
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const t = await AppApi.getSupportTicket(id);
      const toColumnStatus =
        variant === "support"
          ? supportToColumnStatus
          : variant === "feedback"
            ? feedbackToColumnStatus
            : dataAdjustmentToColumnStatus;
      setTicket({
        ...t,
        status: toColumnStatus(t.status),
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
    const toBackendStatus =
      variant === "support"
        ? columnToSupportStatus
        : variant === "feedback"
          ? columnToFeedbackStatus
          : columnToDataAdjustmentStatus;
    const backendStatus = toBackendStatus(newStatus);
    setUpdating(true);
    try {
      await AppApi.updateSupportTicket(ticketIdVal, {status: backendStatus});
      setTicket((prev) => (prev ? {...prev, status: newStatus} : null));
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
        prev ? {...prev, assignedTo: assignedTo || null} : null,
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
      await AppApi.updateSupportTicket(ticketIdVal, {internalNotes});
      setTicket((prev) => (prev ? {...prev, internalNotes} : null));
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

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="relative flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        {loading && (
          <main className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-2 border-[#456564] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Loading ticket...
              </p>
            </div>
          </main>
        )}

        {error && !ticket && !loading && (
          <main className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-sm">
              <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={fetchTicket}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-[#456564] text-white hover:bg-[#34514f] transition-colors"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Back to list
                </button>
              </div>
            </div>
          </main>
        )}

        {ticket && !loading && (
          <main className="flex-1 overflow-hidden p-0 sm:p-2 lg:p-3">
            <TicketWorkspace
              ticket={ticket}
              admins={admins}
              variant={variant}
              readOnly={false}
              onClose={handleClose}
              onStatusChange={handleStatusChange}
              onAssign={handleAssign}
              onInternalNotes={handleInternalNotes}
              onReply={handleReply}
              onSendAndMarkInProgress={handleSendAndMarkInProgress}
              onSendAndResolve={handleSendAndResolve}
              onConvertToSupportTicket={
                variant === "feedback"
                  ? handleConvertToSupportTicket
                  : undefined
              }
              onRefresh={fetchTicket}
              updating={updating}
            />
          </main>
        )}
      </div>
    </div>
  );
}

export default TicketDetailPage;
