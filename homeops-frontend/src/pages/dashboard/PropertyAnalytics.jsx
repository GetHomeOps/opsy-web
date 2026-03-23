import React, {useState, useEffect, useCallback, useMemo} from "react";
import Header from "../../partials/Header";
import Sidebar from "../../partials/Sidebar";
import AppApi from "../../api/api";
import PaginationClassic from "../../components/PaginationClassic";
import {PAGE_LAYOUT} from "../../constants/layout";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Eye,
  Users,
  RefreshCw,
  Loader2,
  FileText,
  Sparkles,
  Calendar,
  UserPlus,
} from "lucide-react";

const DEFAULT_ITEMS_PER_PAGE = 10;

function PropertyAnalytics() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);

  const paginatedProperties = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return properties.slice(start, start + itemsPerPage);
  }, [properties, currentPage, itemsPerPage]);

  const fetchProperties = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await AppApi.getPropertyAnalytics();
      setProperties(list || []);
    } catch (err) {
      setError(
        err?.messages?.[0] ||
          err?.message ||
          "Failed to load property analytics",
      );
      setProperties([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  useEffect(() => {
    const totalPages = Math.ceil(properties.length / itemsPerPage);
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [properties.length, itemsPerPage, currentPage]);

  const toggleRow = (propertyId) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(propertyId)) next.delete(propertyId);
      else next.add(propertyId);
      return next;
    });
  };

  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="relative flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <main className="flex flex-col flex-1 min-h-0 overflow-auto">
          <div className={`${PAGE_LAYOUT.listPaddingX} py-6`}>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                  Properties
                </h1>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  All properties with team members, owners, and activity per
                  member (visits on property pages, AI report analyses,
                  scheduled maintenance, invitations for this property).
                </p>
              </div>
              <button
                type="button"
                onClick={fetchProperties}
                disabled={loading}
                className="flex items-center gap-2 btn bg-[#456564] text-white hover:bg-[#3a5554] disabled:opacity-50 text-sm"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>

            {error && (
              <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            {loading && properties.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-10 h-10 text-[#456564] animate-spin" />
              </div>
            ) : properties.length === 0 ? (
              <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-8 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                  No properties found.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {paginatedProperties.map((prop) => {
                    const isExpanded = expandedIds.has(prop.propertyId);
                    const members = Array.isArray(prop.members)
                      ? prop.members
                      : [];
                    const addr = [prop.address, prop.city, prop.state]
                      .filter(Boolean)
                      .join(", ");

                    return (
                      <div
                        key={prop.propertyId}
                        className="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => toggleRow(prop.propertyId)}
                          className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                              {prop.propertyName ||
                                `Property #${prop.propertyId}`}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                              {addr || "—"}
                              {prop.accountName ? (
                                <span className="text-gray-400 dark:text-gray-500">
                                  {" "}
                                  · {prop.accountName}
                                </span>
                              ) : null}
                            </p>
                            {prop.ownerDisplay ? (
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                                Owner: {prop.ownerDisplay}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-2 shrink-0">
                            <div className="flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-gray-700/60 px-2.5 py-1">
                              <Users className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                {prop.teamCount ?? members.length} team
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-gray-700/60 px-2.5 py-1">
                              <FileText className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                {prop.documentsCount ?? 0} docs
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-gray-700/60 px-2.5 py-1">
                              <Building2 className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 font-mono">
                                {prop.propertyUid || "—"}
                              </span>
                            </div>
                          </div>
                        </button>

                        {isExpanded && members.length > 0 && (
                          <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 px-5 py-4">
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Team & activity
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                              Visits count page views under this property&apos;s
                              URL. Document total is for the whole property
                              (uploads are not stored per user).
                            </p>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600">
                                    <th className="pb-2 pr-4">Member</th>
                                    <th className="pb-2 pr-4">On property</th>
                                    <th className="pb-2 pr-4">App role</th>
                                    <th className="pb-2 pr-3 text-right">
                                      <span className="inline-flex items-center justify-end gap-1 w-full">
                                        <Eye className="w-3.5 h-3.5" />
                                        Visits
                                      </span>
                                    </th>
                                    <th className="pb-2 pr-3 text-right">
                                      <span className="inline-flex items-center justify-end gap-1 w-full">
                                        <Sparkles className="w-3.5 h-3.5" />
                                        AI
                                      </span>
                                    </th>
                                    <th className="pb-2 pr-3 text-right">
                                      <span className="inline-flex items-center justify-end gap-1 w-full">
                                        <Calendar className="w-3.5 h-3.5" />
                                        Maint.
                                      </span>
                                    </th>
                                    <th className="pb-2 text-right">
                                      <span className="inline-flex items-center justify-end gap-1 w-full">
                                        <UserPlus className="w-3.5 h-3.5" />
                                        Invites
                                      </span>
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {members.map((m) => (
                                    <tr
                                      key={m.userId}
                                      className="border-b border-gray-100 dark:border-gray-700/60 last:border-0"
                                    >
                                      <td className="py-2 pr-4">
                                        <div className="font-medium text-gray-800 dark:text-gray-200">
                                          {m.userName ||
                                            m.userEmail ||
                                            `User #${m.userId}`}
                                        </div>
                                        {m.userEmail ? (
                                          <div className="text-xs text-gray-500 dark:text-gray-400">
                                            {m.userEmail}
                                          </div>
                                        ) : null}
                                      </td>
                                      <td className="py-2 pr-4 text-gray-700 dark:text-gray-300 capitalize">
                                        {m.propertyRole || "—"}
                                      </td>
                                      <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">
                                        {m.userRole || "—"}
                                      </td>
                                      <td className="py-2 pr-3 text-right tabular-nums text-gray-800 dark:text-gray-200">
                                        {m.pageViews ?? 0}
                                      </td>
                                      <td className="py-2 pr-3 text-right tabular-nums text-gray-800 dark:text-gray-200">
                                        {m.aiAnalyses ?? 0}
                                      </td>
                                      <td className="py-2 pr-3 text-right tabular-nums text-gray-800 dark:text-gray-200">
                                        {m.maintenanceEvents ?? 0}
                                      </td>
                                      <td className="py-2 text-right tabular-nums text-gray-800 dark:text-gray-200">
                                        {m.invitationsSent ?? 0}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {isExpanded && members.length === 0 && (
                          <div className="border-t border-gray-100 dark:border-gray-700 px-5 py-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              No team members linked to this property yet.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {properties.length > 0 && (
                  <div className="mt-6">
                    <PaginationClassic
                      currentPage={currentPage}
                      totalItems={properties.length}
                      itemsPerPage={itemsPerPage}
                      onPageChange={setCurrentPage}
                      onItemsPerPageChange={handleItemsPerPageChange}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default PropertyAnalytics;
