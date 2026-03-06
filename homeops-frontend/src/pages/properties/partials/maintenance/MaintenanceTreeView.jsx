import React, {useState, useMemo} from "react";
import {format, parse, isValid} from "date-fns";
import {
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  Plus,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Settings,
  PanelLeftClose,
} from "lucide-react";

/**
 * Tree view component for browsing maintenance records organized by system.
 * Supports filtering by status, date range, and text search.
 */
function MaintenanceTreeView({
  systems = [],
  maintenanceRecords = {},
  selectedRecordId,
  selectedSystemId,
  onSelectRecord,
  onSelectSystem,
  onAddRecord,
  onCollapse,
  contacts = [],
}) {
  const [expandedSystems, setExpandedSystems] = useState(() => {
    // Auto-expand systems that have records
    const initial = {};
    systems.forEach((sys) => {
      if ((maintenanceRecords[sys.id]?.length || 0) > 0) {
        initial[sys.id] = true;
      }
    });
    return initial;
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  const statusOptions = [
    {value: "all", label: "All Status"},
    {value: "Completed", label: "Completed"},
    {value: "Scheduled", label: "Scheduled"},
    {value: "In Progress", label: "In Progress"},
    {value: "Pending Contractor", label: "Pending"},
    {value: "Cancelled", label: "Cancelled"},
  ];

  const getStatusIcon = (status) => {
    switch (status) {
      case "Completed":
        return <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />;
      case "Scheduled":
        return <Calendar className="w-3.5 h-3.5 text-blue-500" />;
      case "In Progress":
        return <Clock className="w-3.5 h-3.5 text-orange-500" />;
      case "Pending Contractor":
        return <AlertCircle className="w-3.5 h-3.5 text-amber-500" />;
      case "Cancelled":
        return <XCircle className="w-3.5 h-3.5 text-gray-400" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-gray-400" />;
    }
  };

  // Filter and search records
  const filteredRecordsBySystem = useMemo(() => {
    const result = {};
    systems.forEach((system) => {
      const records = maintenanceRecords[system.id] || [];
      result[system.id] = records.filter((record) => {
        // Status filter
        if (filterStatus !== "all" && record.status !== filterStatus) {
          return false;
        }
        // Search filter
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          const searchableText = [
            record.description,
            record.contractor,
            record.notes,
            record.workOrderNumber,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!searchableText.includes(query)) {
            return false;
          }
        }
        return true;
      });
    });
    return result;
  }, [systems, maintenanceRecords, filterStatus, searchQuery]);

  const toggleSystem = (systemId) => {
    setExpandedSystems((prev) => ({
      ...prev,
      [systemId]: !prev[systemId],
    }));
  };

  const formatDate = (dateString) => {
    if (dateString == null) return "";
    const s =
      typeof dateString === "string"
        ? dateString.trim()
        : dateString instanceof Date
          ? format(dateString, "yyyy-MM-dd")
          : String(dateString).trim();
    if (!s) return "";
    // Extract YYYY-MM-DD part (handles "2025-03-15" and "2025-03-15T00:00:00.000Z")
    const datePart = s.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      const parsed = parse(datePart, "yyyy-MM-dd", new Date());
      if (isValid(parsed)) return format(parsed, "MMM d, yyyy");
    }
    const fallback = new Date(s);
    return isValid(fallback) ? format(fallback, "MMM d, yyyy") : "";
  };

  const getTotalRecordCount = () => {
    return Object.values(filteredRecordsBySystem).reduce(
      (sum, records) => sum + records.length,
      0,
    );
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Maintenance Records
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
              {getTotalRecordCount()} records
            </span>
            {onCollapse && (
              <button
                type="button"
                onClick={onCollapse}
                className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Collapse sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search records..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-10 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#456654] focus:border-transparent"
          />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-colors ${
              showFilters || filterStatus !== "all"
                ? "text-[#456654] bg-[#456654]/10"
                : "text-gray-400 hover:text-gray-600"
            }`}
            title="Filter options"
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-2">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Filter by Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tree content */}
      <div className="flex-1 overflow-y-auto p-2">
        {systems.map((system) => {
          const systemRecords = filteredRecordsBySystem[system.id] || [];
          const isExpanded = expandedSystems[system.id];
          const isSystemSelected =
            selectedSystemId === system.id && !selectedRecordId;
          const Icon = system.icon || Settings;

          return (
            <div key={system.id} className="mb-1">
              {/* System header */}
              <div
                className={`flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors ${
                  isSystemSelected
                    ? "bg-[#456654]/10 text-[#456654]"
                    : "hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSystem(system.id);
                  }}
                  className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  )}
                </button>
                <div
                  className="flex-1 flex items-center gap-2"
                  onClick={() => onSelectSystem?.(system.id)}
                >
                  <Icon
                    className="w-4 h-4 flex-shrink-0"
                    style={{color: isSystemSelected ? "#456654" : undefined}}
                  />
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1">
                    {system.name}
                  </span>
                  {systemRecords.length > 0 && (
                    <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                      {systemRecords.length}
                    </span>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddRecord?.(system.id);
                  }}
                  className="p-1 text-gray-400 hover:text-[#456654] hover:bg-[#456654]/10 rounded transition-colors"
                  title={`Add ${system.name} record`}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Records list - extra left padding for visual distinction from system name */}
              {isExpanded && (
                <div className="ml-8 pl-2 mt-1 space-y-1">
                  {systemRecords.length > 0 ? (
                    systemRecords.map((record) => {
                      const isSelected = selectedRecordId === record.id;
                      return (
                        <div
                          key={record.id}
                          onClick={() => onSelectRecord?.(record)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors border ${
                            isSelected
                              ? "bg-slate-100/90 dark:bg-slate-700/40 border-slate-400/60 dark:border-slate-500/50"
                              : "border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                          }`}
                        >
                          {getStatusIcon(record.status)}
                          <div className="flex-1 min-w-0">
                            <div
                              className={`text-sm font-medium truncate ${
                                isSelected
                                  ? "text-slate-800 dark:text-slate-100"
                                  : "text-gray-800 dark:text-gray-200"
                              }`}
                            >
                              {formatDate(record.date)}
                            </div>
                            {record.contractor != null &&
                              record.contractor !== "" && (
                                <div
                                  className={`text-xs truncate ${
                                    isSelected
                                      ? "text-slate-600 dark:text-slate-300"
                                      : "text-gray-500 dark:text-gray-400"
                                  }`}
                                >
                                  {contacts.find(
                                    (c) =>
                                      String(c.id) ===
                                      String(record.contractor),
                                  )?.name || record.contractor}
                                </div>
                              )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500 italic">
                      No records
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MaintenanceTreeView;
