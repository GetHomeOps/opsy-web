import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import Header from "../../partials/Header";
import Sidebar from "../../partials/Sidebar";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import { useAuth } from "../../context/AuthContext";
import AppApi from "../../api/api";
import { PAGE_LAYOUT } from "../../constants/layout";
import { TicketsList } from "./components";

/**
 * Support tickets list page (like PropertiesList, ContactsList, ResourcesManagement).
 * Shows list of user's tickets. Click ticket → TicketFormContainer. "Submit ticket" → new form.
 */
function SupportList() {
  const { t } = useTranslation();
  const { accountUrl } = useParams();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { currentAccount } = useCurrentAccount();
  const { currentUser } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  const accountId = currentAccount?.id;

  function handleTicketClick(ticket) {
    navigate(`/${accountUrl || currentAccount?.url}/settings/support/${ticket.id}`);
  }

  function handleNewTicket() {
    navigate(`/${accountUrl || currentAccount?.url}/settings/support/new`);
  }

  useEffect(() => {
    if (!currentUser?.id) return;
    async function fetchTickets() {
      try {
        setLoading(true);
        const list = await AppApi.getMySupportTickets();
        setTickets(list || []);
      } catch {
        setTickets([]);
      } finally {
        setLoading(false);
      }
    }
    fetchTickets();
  }, [currentUser?.id]);

  const statusBadgeClass = (status) => {
    switch (status) {
      case "new":
        return "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300";
      case "working_on_it":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300";
      case "solved":
        return "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300";
      default:
        return "bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300";
    }
  };

  const statusLabel = (status) => {
    switch (status) {
      case "new":
        return t("support.statusNew") || "New";
      case "working_on_it":
        return t("support.statusWorking") || "Working on It";
      case "solved":
        return t("support.statusSolved") || "Solved";
      default:
        return status || "—";
    }
  };

  if (!accountId) {
    return (
      <div className="flex h-[100dvh] overflow-hidden">
        <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <div className="relative flex flex-col flex-1 overflow-y-auto">
          <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
          <main className={`grow ${PAGE_LAYOUT.settings}`}>
            <p className="text-gray-600 dark:text-gray-400">
              {t("support.selectAccount") ||
                "Select an account to submit a support ticket."}
            </p>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="relative flex-col flex-1 min-w-0 overflow-hidden flex">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className="flex-1 overflow-y-auto">
          <div className={PAGE_LAYOUT.list}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {t("support.title") || "Support & Feedback"}
                </h1>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  {t("support.description") ||
                    "Submit a support request or share feedback. We'll get back to you as soon as possible."}
                </p>
              </div>
              <button
                type="button"
                onClick={handleNewTicket}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#456564] hover:bg-[#34514f] text-white rounded-lg text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                {t("support.submitTicket") || "Submit a Ticket"}
              </button>
            </div>

            <TicketsList
              tickets={tickets}
              loading={loading}
              onTicketClick={handleTicketClick}
              statusBadgeClass={statusBadgeClass}
              statusLabel={statusLabel}
            />
          </div>
        </main>
      </div>
    </div>
  );
}

export default SupportList;
