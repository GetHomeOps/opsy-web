import React, {useState, useEffect, useCallback, useMemo} from "react";
import {useParams, useNavigate} from "react-router-dom";
import Header from "../../partials/Header";
import Sidebar from "../../partials/Sidebar";
import AppApi from "../../api/api";
import {
  TicketCard,
  KanbanColumn,
  FilterDropdownWithPills,
  TicketKpiTracker,
} from "./components";
import {PAGE_LAYOUT} from "../../constants/layout";
import {
  SUPPORT_COLUMNS,
  supportToColumnStatus,
  columnToSupportStatus,
} from "./kanbanConfig";

function SupportManagement() {
  const {accountUrl} = useParams();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draggedTicket, setDraggedTicket] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const [admins, setAdmins] = useState([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState([]);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await AppApi.getAllSupportTickets();
      const filtered = (list || []).filter((t) => t.type === "support");
      setTickets(filtered);
    } catch (err) {
      setError(err.message || "Failed to load tickets");
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

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

  const tierToPriority = (tier) => {
    const t = (tier || "").toLowerCase();
    if (["premium", "win"].includes(t)) return "urgent";
    if (["pro", "maintain"].includes(t)) return "high";
    if (["agent", "basic"].includes(t)) return "medium";
    return "low";
  };

  const planTiers = useMemo(() => {
    const set = new Set();
    (tickets || []).forEach((t) =>
      set.add((t.subscriptionTier || "Free").toLowerCase()),
    );
    return Array.from(set).sort();
  }, [tickets]);

  const filterCategories = useMemo(
    () => [
      {type: "status", label: "Status"},
      {type: "priority", label: "Priority"},
      {type: "planTier", label: "Plan"},
      {type: "assignedTo", label: "Assigned"},
    ],
    [],
  );

  const filterOptions = useMemo(
    () => ({
      status: SUPPORT_COLUMNS.map((c) => ({value: c.id, label: c.title})),
      priority: [
        {value: "urgent", label: "Urgent"},
        {value: "high", label: "High"},
        {value: "medium", label: "Medium"},
        {value: "low", label: "Low"},
      ],
      planTier: planTiers.map((t) => ({value: t, label: t})),
      assignedTo: admins.map((a) => ({
        value: String(a.id),
        label: a.name || a.email,
      })),
    }),
    [planTiers, admins],
  );

  const filteredTickets = useMemo(() => {
    let list = tickets || [];
    const byType = {};
    activeFilters.forEach((f) => {
      if (!byType[f.type]) byType[f.type] = [];
      byType[f.type].push(f.value);
    });
    if (byType.status?.length) {
      list = list.filter((t) =>
        byType.status.includes(supportToColumnStatus(t.status)),
      );
    }
    if (byType.priority?.length) {
      list = list.filter((t) =>
        byType.priority.includes(tierToPriority(t.subscriptionTier)),
      );
    }
    if (byType.planTier?.length) {
      list = list.filter((t) =>
        byType.planTier.includes((t.subscriptionTier || "free").toLowerCase()),
      );
    }
    if (byType.assignedTo?.length) {
      list = list.filter((t) =>
        byType.assignedTo.includes(String(t.assignedTo)),
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (t) =>
          (t.subject || "").toLowerCase().includes(q) ||
          (t.description || "").toLowerCase().includes(q) ||
          (t.createdByName || "").toLowerCase().includes(q) ||
          (t.createdByEmail || "").toLowerCase().includes(q) ||
          (t.accountName || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [tickets, activeFilters, searchQuery]);

  const ticketsByColumn = useMemo(() => {
    const acc = {};
    SUPPORT_COLUMNS.forEach((col) => {
      let colTickets = filteredTickets.filter(
        (t) => supportToColumnStatus(t.status) === col.id,
      );
      // Sort: priorityScore desc, then createdAt oldest first
      colTickets.sort((a, b) => {
        const pa = a.priorityScore ?? 0;
        const pb = b.priorityScore ?? 0;
        if (pa !== pb) return pb - pa;
        return new Date(a.createdAt) - new Date(b.createdAt);
      });
      acc[col.id] = colTickets;
    });
    return acc;
  }, [filteredTickets]);

  function addFilter(f) {
    if (activeFilters.some((x) => x.type === f.type && x.value === f.value))
      return;
    setActiveFilters((prev) => [...prev, f]);
  }

  function removeFilter(f) {
    setActiveFilters((prev) =>
      prev.filter((x) => !(x.type === f.type && x.value === f.value)),
    );
  }

  function clearFilters() {
    setActiveFilters([]);
    setSearchQuery("");
  }

  async function handleStatusChange(ticketId, newStatus) {
    const backendStatus = columnToSupportStatus(newStatus);
    try {
      await AppApi.updateSupportTicket(ticketId, {status: backendStatus});
      await fetchTickets();
    } catch (err) {
      setError(err.message || "Failed to update");
    }
  }

  function openDetail(ticket) {
    navigate(`/${accountUrl}/support-management/${ticket.id}`);
  }

  function handleDragStart(e, ticket) {
    setDraggedTicket(ticket);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(ticket.id));
  }

  function handleDragOver(e, columnId) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(columnId);
  }

  function handleDragLeave() {
    setDragOverColumn(null);
  }

  function handleDrop(e, targetCol) {
    e.preventDefault();
    setDragOverColumn(null);
    if (
      !draggedTicket ||
      supportToColumnStatus(draggedTicket.status) === targetCol.id
    ) {
      setDraggedTicket(null);
      return;
    }
    handleStatusChange(draggedTicket.id, targetCol.id);
    setDraggedTicket(null);
  }

  function handleDragEnd() {
    setDraggedTicket(null);
    setDragOverColumn(null);
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="relative flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <main className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className={`${PAGE_LAYOUT.listPaddingX} py-6 flex-shrink-0`}>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                  Support Management
                </h1>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  Click a ticket to open it. Use the grip handle to drag between
                  columns.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchTickets}
                disabled={loading}
                className="btn bg-gray-900 text-gray-100 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-800 dark:hover:bg-white disabled:opacity-50 text-sm"
              >
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>

            <TicketKpiTracker
              variant="support"
              tickets={tickets}
              loading={loading}
              tierToPriority={tierToPriority}
            />

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <FilterDropdownWithPills
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search subject, description, user..."
              filterCategories={filterCategories}
              filterOptions={filterOptions}
              activeFilters={activeFilters}
              onAddFilter={addFilter}
              onRemoveFilter={removeFilter}
              onClearFilters={clearFilters}
            />
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center px-6">
              <p className="text-gray-500 dark:text-gray-400">Loading...</p>
            </div>
          ) : (
            <div
              className={`flex-1 min-h-0 overflow-x-auto overflow-y-hidden ${PAGE_LAYOUT.listPaddingX} pb-6`}
            >
              <div
                className="flex gap-4 min-w-max pb-4"
                style={{minHeight: "calc(100vh - 280px)"}}
              >
                {SUPPORT_COLUMNS.map((col) => (
                  <KanbanColumn
                    key={col.id}
                    title={col.title}
                    count={ticketsByColumn[col.id]?.length || 0}
                    isDragOver={dragOverColumn === col.id}
                    onDragOver={(e) => handleDragOver(e, col.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, col)}
                  >
                    {(ticketsByColumn[col.id] || []).map((ticket) => (
                      <TicketCard
                        key={ticket.id}
                        ticket={{
                          ...ticket,
                          priority: tierToPriority(ticket.subscriptionTier),
                        }}
                        onClick={() => openDetail(ticket)}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        isDragging={draggedTicket?.id === ticket.id}
                        variant="support"
                      />
                    ))}
                  </KanbanColumn>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default SupportManagement;
