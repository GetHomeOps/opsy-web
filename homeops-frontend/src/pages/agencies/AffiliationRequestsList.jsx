import React, {useState, useEffect, useCallback, useMemo} from "react";
import {Loader2, RefreshCw, Building2} from "lucide-react";
import Header from "../../partials/Header";
import Sidebar from "../../partials/Sidebar";
import AppApi from "../../api/api";
import {PAGE_LAYOUT} from "../../constants/layout";
import SearchInput from "../../components/SearchInput";

function AffiliationRequestsList({embedded = false}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionId, setActionId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await AppApi.getPendingAffiliationRequests();
      setRequests(list || []);
    } catch (err) {
      setError(err.message || "Failed to load requests");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleApprove = async (id) => {
    setActionId(`approve-${id}`);
    try {
      await AppApi.approveAffiliationRequest(id);
      await fetchRequests();
    } catch (err) {
      setError(
        Array.isArray(err) ? err.join(" ") : err.message || "Approve failed",
      );
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (id) => {
    setActionId(`reject-${id}`);
    try {
      await AppApi.rejectAffiliationRequest(id);
      await fetchRequests();
    } catch (err) {
      setError(
        Array.isArray(err) ? err.join(" ") : err.message || "Reject failed",
      );
    } finally {
      setActionId(null);
    }
  };

  const formatParent = (req) => {
    if (req.requestType === "agency") return "—";
    const parts = [];
    if (req.agencyName) parts.push(req.agencyName);
    if (req.requestType === "team" && req.officeName)
      parts.push(req.officeName);
    return parts.join(" → ") || "—";
  };

  const formatDetails = (req) => {
    if (req.requestType === "agency") {
      const parts = [];
      const location = [req.city, req.state].filter(Boolean).join(", ");
      if (location) parts.push(location);
      if (req.website) parts.push(req.website);
      if (req.mainOfficeName) parts.push(`Office: ${req.mainOfficeName}`);
      if (req.mainTeamName) parts.push(`Team: ${req.mainTeamName}`);
      return parts.length ? parts.join(" · ") : "—";
    }
    if (req.requestType === "office") {
      const parts = [];
      if (req.addressLine1) parts.push(req.addressLine1);
      const location = [req.city, req.state].filter(Boolean).join(", ");
      if (location) parts.push(location);
      if (req.phone) parts.push(req.phone);
      return parts.length ? parts.join(" · ") : "—";
    }
    return req.notes || "—";
  };

  const filteredRequests = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter((req) => {
      const fields = [
        req.requestType,
        req.requestedName,
        req.agencyName,
        req.officeName,
        req.requestedByName,
        req.requestedByEmail,
        req.notes,
        req.addressLine1,
        req.city,
        req.state,
        req.phone,
        req.website,
        req.mainOfficeName,
        req.mainTeamName,
      ];
      return fields.some((field) =>
        String(field || "")
          .toLowerCase()
          .includes(q),
      );
    });
  }, [requests, searchTerm]);

  const tableContent = (
    <>
      {!embedded && (
        <div className="sm:flex sm:justify-between sm:items-center mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-6 h-6 text-[#456564]" />
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                Agency Affiliation Requests
              </h1>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Review pending agency, office, and team requests from agents.
            </p>
          </div>
        </div>
      )}

      <div className={`space-y-3 ${embedded ? "mb-4" : "mb-8"}`}>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <SearchInput
            placeholder="Search requests..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            inputClassName="form-input w-full pl-10 pr-9 py-2 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 focus:border-[#456564] dark:focus:border-[#456564] rounded-lg shadow-sm text-sm"
          />

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={fetchRequests}
              disabled={loading}
              className="btn border-gray-200 dark:border-gray-700 inline-flex items-center gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading requests...
          </div>
        ) : requests.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-500 dark:text-gray-400">
            No pending affiliation requests.
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-500 dark:text-gray-400">
            No requests match your search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-auto w-full dark:text-gray-300">
              <thead className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Parent</th>
                  <th className="px-4 py-3 text-left">Requested By</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Details</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-gray-200 dark:divide-gray-700">
                {filteredRequests.map((req) => (
                  <tr
                    key={req.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-900/20"
                  >
                    <td className="px-4 py-3 capitalize">{req.requestType}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {req.requestedName}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {formatParent(req)}
                    </td>
                    <td className="px-4 py-3">
                      <div>{req.requestedByName || "—"}</div>
                      <div className="text-xs text-gray-500">
                        {req.requestedByEmail}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">
                      {req.createdAt
                        ? new Date(req.createdAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3 max-w-xs text-gray-600 dark:text-gray-400">
                      <span className="line-clamp-2">{formatDetails(req)}</span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleApprove(req.id)}
                        disabled={!!actionId}
                        className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-medium mr-3 disabled:opacity-50"
                      >
                        {actionId === `approve-${req.id}` ? "..." : "Approve"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(req.id)}
                        disabled={!!actionId}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 font-medium disabled:opacity-50"
                      >
                        {actionId === `reject-${req.id}` ? "..." : "Reject"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );

  if (embedded) {
    return tableContent;
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className="grow">
          <div className={PAGE_LAYOUT.list}>{tableContent}</div>
        </main>
      </div>
    </div>
  );
}

export default AffiliationRequestsList;
