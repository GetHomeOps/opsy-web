import React, {useState, useEffect, useCallback, useMemo, useRef} from "react";
import {useParams, useNavigate, useLocation} from "react-router-dom";
import Header from "../../partials/Header";
import Sidebar from "../../partials/Sidebar";
import AppApi from "../../api/api";
import {PAGE_LAYOUT} from "../../constants/layout";
import {
  Loader2,
  ClipboardCheck,
  CheckCircle2,
  ArrowLeft,
  RefreshCw,
  Inbox,
} from "lucide-react";
import {KanbanColumn, FilterDropdownWithPills} from "../support/components";
import {
  INSPECTION_REVIEW_COLUMNS,
  inspectionReviewToColumnStatus,
} from "../support/kanbanConfig";
import InspectionReviewCard from "./InspectionReviewCard";

function mergeJustApproved(list, justApproved) {
  if (!justApproved) return list;
  const idx = list.findIndex((i) => i.id === justApproved.id);
  const approvedItem = {...justApproved, reviewStatus: "approved"};
  if (idx >= 0) {
    const next = [...list];
    next[idx] = {...next[idx], ...approvedItem};
    return next;
  }
  return [...list, approvedItem];
}

function InspectionReviewQueue() {
  const {accountUrl} = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState([]);
  const pendingApprovedRef = useRef(null);

  const fetchQueue = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await AppApi.getInspectionReviewQueue();
      const merged = mergeJustApproved(
        list || [],
        pendingApprovedRef.current,
      );
      if (pendingApprovedRef.current) {
        pendingApprovedRef.current = null;
      }
      setItems(merged);
    } catch (err) {
      setError(err?.message || "Failed to load reviews");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (location.state?.justApproved) {
      pendingApprovedRef.current = location.state.justApproved;
      navigate(location.pathname, {replace: true, state: null});
    }
    fetchQueue();
  }, [location.key, fetchQueue, location.pathname, navigate]);

  const stats = useMemo(() => {
    const newCount = items.filter(
      (i) => inspectionReviewToColumnStatus(i.reviewStatus) === "new",
    ).length;
    const furtherReview = items.filter(
      (i) => inspectionReviewToColumnStatus(i.reviewStatus) === "in_progress",
    ).length;
    const approved = items.filter(
      (i) => inspectionReviewToColumnStatus(i.reviewStatus) === "completed",
    ).length;
    return {total: items.length, newCount, furtherReview, approved};
  }, [items]);

  const filterCategories = useMemo(
    () => [{type: "status", label: "Status"}],
    [],
  );

  const filterOptions = useMemo(
    () => ({
      status: INSPECTION_REVIEW_COLUMNS.map((c) => ({
        value: c.id,
        label: c.title,
      })),
    }),
    [],
  );

  const filteredItems = useMemo(() => {
    let list = items || [];
    const statusFilters = activeFilters
      .filter((f) => f.type === "status")
      .map((f) => f.value);
    if (statusFilters.length) {
      list = list.filter((item) =>
        statusFilters.includes(
          inspectionReviewToColumnStatus(item.reviewStatus),
        ),
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (item) =>
          (item.propertyAddress || "").toLowerCase().includes(q) ||
          (item.customerName || "").toLowerCase().includes(q) ||
          (item.fileName || "").toLowerCase().includes(q) ||
          String(item.id).includes(q),
      );
    }
    return list;
  }, [items, activeFilters, searchQuery]);

  const itemsByColumn = useMemo(() => {
    const acc = {};
    INSPECTION_REVIEW_COLUMNS.forEach((col) => {
      acc[col.id] = filteredItems
        .filter(
          (item) =>
            inspectionReviewToColumnStatus(item.reviewStatus) === col.id,
        )
        .sort((a, b) => {
          if (col.id === "completed" || col.id === "in_progress") {
            return (
              new Date(b.reviewedAt || b.uploadedAt || 0) -
              new Date(a.reviewedAt || a.uploadedAt || 0)
            );
          }
          return new Date(a.uploadedAt || 0) - new Date(b.uploadedAt || 0);
        });
    });
    return acc;
  }, [filteredItems]);

  function addFilter(f) {
    if (activeFilters.some((x) => x.type === f.type && x.value === f.value)) {
      return;
    }
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

  async function handleStatusChange(itemId, columnId) {
    try {
      if (columnId === "completed") {
        await AppApi.approveInspectionReview(itemId);
      } else if (columnId === "in_progress") {
        await AppApi.updateInspectionReviewStatus(itemId, "revision_requested");
      } else {
        await AppApi.updateInspectionReviewStatus(itemId, "pending_review");
      }
      await fetchQueue();
    } catch (err) {
      setError(err?.message || "Failed to update status");
    }
  }

  function openDetail(item) {
    navigate(`/${accountUrl}/helpdesk/inspection-reviews/${item.id}`);
  }

  function handleDragStart(e, item) {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(item.id));
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
      !draggedItem ||
      inspectionReviewToColumnStatus(draggedItem.reviewStatus) === targetCol.id
    ) {
      setDraggedItem(null);
      return;
    }
    handleStatusChange(draggedItem.id, targetCol.id);
    setDraggedItem(null);
  }

  function handleDragEnd() {
    setDraggedItem(null);
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
                    Inspection Report Reviews
                  </h1>
                  <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                    Drag cards between columns to update review stage
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={fetchQueue}
                disabled={loading}
                className="flex items-center gap-2 btn bg-gray-900 text-gray-100 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-800 dark:hover:bg-white disabled:opacity-50 text-sm"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>

            <div className="flex flex-wrap gap-3 mb-6">
              {[
                {
                  label: "Total",
                  value: loading ? "—" : stats.total,
                  icon: ClipboardCheck,
                  bg: "bg-slate-50 dark:bg-slate-800/50",
                  ic: "text-slate-500",
                },
                {
                  label: "New",
                  value: loading ? "—" : stats.newCount,
                  icon: Inbox,
                  bg: "bg-blue-50 dark:bg-blue-900/20",
                  ic: "text-blue-500",
                },
                {
                  label: "Further review",
                  value: loading ? "—" : stats.furtherReview,
                  icon: ClipboardCheck,
                  bg: "bg-amber-50 dark:bg-amber-900/20",
                  ic: "text-amber-500",
                },
                {
                  label: "Approved",
                  value: loading ? "—" : stats.approved,
                  icon: CheckCircle2,
                  bg: "bg-emerald-50 dark:bg-emerald-900/20",
                  ic: "text-emerald-500",
                },
              ]
                .map((kpi) => {
                  const Icon = kpi.icon;
                  return (
                    <div
                      key={kpi.label}
                      className={`inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-gray-200/60 dark:border-gray-700/40 ${kpi.bg}`}
                    >
                      <Icon className={`w-4 h-4 ${kpi.ic}`} strokeWidth={2} />
                      <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                        {kpi.value}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {kpi.label}
                      </span>
                    </div>
                  );
                })}
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <FilterDropdownWithPills
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search address, customer, file..."
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
              <Loader2 className="w-10 h-10 text-[#456564] animate-spin" />
            </div>
          ) : (
            <div className={`overflow-x-auto ${PAGE_LAYOUT.listPaddingX} pb-6`}>
              <div className="flex gap-4 min-w-max pb-4 items-start">
                {INSPECTION_REVIEW_COLUMNS.map((col) => (
                  <KanbanColumn
                    key={col.id}
                    id={col.id}
                    title={col.title}
                    count={itemsByColumn[col.id]?.length || 0}
                    isDragOver={dragOverColumn === col.id}
                    onDragOver={(e) => handleDragOver(e, col.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, col)}
                  >
                    {(itemsByColumn[col.id] || []).map((item) => (
                      <InspectionReviewCard
                        key={item.id}
                        item={item}
                        suggestFurtherReview={
                          col.id === "new" &&
                          item.reviewStatus === "pending_review" &&
                          Boolean(item.reviewNotes?.trim())
                        }
                        onClick={() => openDetail(item)}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        isDragging={draggedItem?.id === item.id}
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

export default InspectionReviewQueue;
