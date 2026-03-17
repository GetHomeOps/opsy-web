import React, {useState, useEffect, useCallback, useMemo} from "react";
import {useParams, useNavigate} from "react-router-dom";
import Header from "../../partials/Header";
import Sidebar from "../../partials/Sidebar";
import AppApi from "../../api/api";
import {Loader2, RefreshCw, ArrowLeft} from "lucide-react";
import {
  TicketCard,
  KanbanColumn,
  FilterDropdownWithPills,
  TicketKpiTracker,
} from "./components";
import {PAGE_LAYOUT} from "../../constants/layout";
import {
  DATA_ADJUSTMENT_COLUMNS,
  dataAdjustmentToColumnStatus,
  columnToDataAdjustmentStatus,
} from "./kanbanConfig";

const SORT_OPTIONS = [
  {value: "newest", label: "Newest first"},
  {value: "oldest", label: "Oldest first"},
];

function DataAdjustmentManagement() {
  const {accountUrl} = useParams();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draggedTicket, setDraggedTicket] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState([]);
  const [sortBy, setSortBy] = useState("newest");
  const [admins, setAdmins] = useState([]);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await AppApi.getAllSupportTickets();
      const filtered = (list || []).filter(
        (t) => t.type === "data_adjustment",
      );
      setTickets(filtered);
    } catch (err) {
      setError(err.message || "Failed to load data adjustment tickets");
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
      .filter((t) => t.type === "data_adjustment")
      .forEach((t) => set.add((t.subscriptionTier || "Free").toLowerCase()));
    return Array.from(set).sort();
  }, [tickets]);

  const filterCategories = useMemo(
    () => [
      {type: "status", label: "Status"},
      {type: "planTier", label: "Plan"},
      {type: "assignedTo", label: "Assigned"},
    ],
    [],
  );

  const filterOptions = useMemo(
    () => ({
      status: DATA_ADJUSTMENT_COLUMNS.map((c) => ({
        value: c.id,
        label: c.title,
      })),
      planTier: planTiers.map((t) => ({value: t, label: t})),
      assignedTo: [
        {value: "__unassigned__", label: "Unassigned"},
        ...admins.map((a) => ({
          value: String(a.id),
          label: a.name || a.email,
        })),
      ],
    }),
    [planTiers, admins],
  );

  const filteredTickets = useMemo(() => {
    let list = (tickets || []).filter((t) => t.type === "data_adjustment");
    const byType = {};
    activeFilters.forEach((f) => {
      if (!byType[f.type]) byType[f.type] = [];
      byType[f.type].push(f.value);
    });
    if (byType.status?.length) {
      list = list.filter((t) =>
        byType.status.includes(dataAdjustmentToColumnStatus(t.status)),
      );
    }
    if (byType.planTier?.length) {
      list = list.filter((t) =>
        byType.planTier.includes((t.subscriptionTier || "free").toLowerCase()),
      );
    }
    if (byType.assignedTo?.length) {
      list = list.filter((t) => {
        if (byType.assignedTo.includes("__unassigned__") && t.assignedTo == null)
          return true;
        return byType.assignedTo.includes(String(t.assignedTo));
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (t) =>
          (t.subject || "").toLowerCase().includes(q) ||
          (t.description || "").toLowerCase().includes(q) ||
          (t.createdByName || "").toLowerCase().includes(q) ||
          (t.dataAdjustmentField || "").toLowerCase().includes(q) ||
          (t.assignedToName || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [tickets, activeFilters, searchQuery]);

  const ticketsByColumn = useMemo(() => {
    const acc = {};
    DATA_ADJUSTMENT_COLUMNS.forEach((col) => {
      let colTickets = filteredTickets.filter(
        (t) => dataAdjustmentToColumnStatus(t.status) === col.id,
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
    const backendStatus = columnToDataAdjustmentStatus(newStatus);
    try {
      await AppApi.updateSupportTicket(ticketId, {status: backendStatus});
      await fetchTickets();
    } catch (err) {
      setError(err.message || "Failed to update");
    }
  }

  function openDetail(ticket) {
    navigate(`/${accountUrl}/helpdesk/data-adjustments/${ticket.id}`);
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

  function handleDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverColumn(null);
    }
  }

  function handleDrop(e, targetCol) {
    e.preventDefault();
    setDragOverColumn(null);
    if (
      !draggedTicket ||
      dataAdjustmentToColumnStatus(draggedTicket.status) === targetCol.id
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

        <main className="flex flex-col flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <div className={`${PAGE_LAYOUT.listPaddingX} py-6 flex-shrink-0`}>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate(`/${accountUrl}/helpdesk`)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 text-gray-500" />
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                    Data Adjustments
                  </h1>
                  <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                    RentCast data change requests — drag cards to update status
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={fetchTickets}
                disabled={loading}
                className="flex items-center gap-2 btn bg-gray-900 text-gray-100 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-800 dark:hover:bg-white disabled:opacity-50 text-sm"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>

            <TicketKpiTracker
              variant="data_adjustment"
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
              searchPlaceholder="Search subject, description, field..."
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
              <Loader2 className="w-10 h-10 text-[#456564] animate-spin" />
            </div>
          ) : (
            <div
              className={`overflow-x-auto ${PAGE_LAYOUT.listPaddingX} pb-6`}
            >
              <div className="flex gap-4 min-w-max pb-4 items-start">
                {DATA_ADJUSTMENT_COLUMNS.map((col) => (
                  <KanbanColumn
                    key={col.id}
                    id={col.id}
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
                        variant="data_adjustment"
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

export default DataAdjustmentManagement;
