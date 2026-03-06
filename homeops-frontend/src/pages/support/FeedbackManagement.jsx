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
  FEEDBACK_COLUMNS,
  feedbackToColumnStatus,
  columnToFeedbackStatus,
} from "./kanbanConfig";

const SORT_OPTIONS = [
  {value: "newest", label: "Newest first"},
  {value: "oldest", label: "Oldest first"},
];

function FeedbackManagement() {
  const {accountUrl} = useParams();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [draggedTicket, setDraggedTicket] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState([]);
  const [sortBy, setSortBy] = useState("newest");

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await AppApi.getAllSupportTickets();
      const filtered = (list || []).filter((t) => t.type === "feedback");
      setTickets(filtered);
    } catch (err) {
      setError(err.message || "Failed to load feedback");
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

  const planTiers = useMemo(() => {
    const set = new Set();
    (tickets || [])
      .filter((t) => t.type === "feedback")
      .forEach((t) => set.add((t.subscriptionTier || "Free").toLowerCase()));
    return Array.from(set).sort();
  }, [tickets]);

  const filterCategories = useMemo(
    () => [
      {type: "status", label: "Status"},
      {type: "planTier", label: "Plan"},
    ],
    [],
  );

  const filterOptions = useMemo(
    () => ({
      status: FEEDBACK_COLUMNS.map((c) => ({value: c.id, label: c.title})),
      planTier: planTiers.map((t) => ({value: t, label: t})),
    }),
    [planTiers],
  );

  const filteredTickets = useMemo(() => {
    let list = (tickets || []).filter((t) => t.type === "feedback");
    const byType = {};
    activeFilters.forEach((f) => {
      if (!byType[f.type]) byType[f.type] = [];
      byType[f.type].push(f.value);
    });
    if (byType.status?.length) {
      list = list.filter((t) =>
        byType.status.includes(feedbackToColumnStatus(t.status)),
      );
    }
    if (byType.planTier?.length) {
      list = list.filter((t) =>
        byType.planTier.includes((t.subscriptionTier || "free").toLowerCase()),
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (t) =>
          (t.subject || "").toLowerCase().includes(q) ||
          (t.description || "").toLowerCase().includes(q) ||
          (t.createdByName || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [tickets, activeFilters, searchQuery]);

  const ticketsByColumn = useMemo(() => {
    const acc = {};
    FEEDBACK_COLUMNS.forEach((col) => {
      let colTickets = filteredTickets.filter(
        (t) => feedbackToColumnStatus(t.status) === col.id,
      );
      if (sortBy === "oldest")
        colTickets.sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
        );
      else
        colTickets.sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
        );
      acc[col.id] = colTickets;
    });
    return acc;
  }, [filteredTickets, sortBy]);

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
    const backendStatus = columnToFeedbackStatus(newStatus);
    try {
      await AppApi.updateSupportTicket(ticketId, {status: backendStatus});
      await fetchTickets();
    } catch (err) {
      setError(err.message || "Failed to update");
    }
  }

  function openDetail(ticket) {
    navigate(`/${accountUrl}/feedback-management/${ticket.id}`);
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
      feedbackToColumnStatus(draggedTicket.status) === targetCol.id
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
                  Feedback Management
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
              variant="feedback"
              tickets={tickets}
              loading={loading}
            />

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <FilterDropdownWithPills
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search subject, description..."
              filterCategories={filterCategories}
              filterOptions={filterOptions}
              activeFilters={activeFilters}
              onAddFilter={addFilter}
              onRemoveFilter={removeFilter}
              onClearFilters={clearFilters}
              sortOptions={SORT_OPTIONS}
              sortBy={sortBy}
              onSortChange={setSortBy}
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
                {FEEDBACK_COLUMNS.map((col) => (
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
                        ticket={ticket}
                        onClick={() => openDetail(ticket)}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        isDragging={draggedTicket?.id === ticket.id}
                        variant="feedback"
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

export default FeedbackManagement;
