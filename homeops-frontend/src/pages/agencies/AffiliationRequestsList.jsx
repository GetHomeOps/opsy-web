import React, {useState, useEffect, useCallback, useMemo} from "react";
import {RefreshCw, Building2} from "lucide-react";
import AppApi from "../../api/api";
import {PAGE_LAYOUT} from "../../constants/layout";
import SearchInput from "../../components/SearchInput";
import DataTable from "../../components/DataTable";
import DataTableItem from "../../components/DataTableItem";

function AffiliationRequestsList({embedded = false}) {
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

  const columns = [
    {
      key: "requestType",
      label: "Type",
      render: (value) => (
        <span className="capitalize">{value || "—"}</span>
      ),
    },
    {
      key: "requestedName",
      label: "name",
      render: (value) => (
        <span className="font-medium text-gray-800 dark:text-gray-100">
          {value || "—"}
        </span>
      ),
    },
    {
      key: "parent",
      label: "Parent",
      render: (_value, item) => formatParent(item),
    },
    {
      key: "requestedByName",
      label: "Requested By",
      render: (_value, item) => (
        <div>
          <div>{item.requestedByName || "—"}</div>
          <div className="text-xs text-gray-500">{item.requestedByEmail}</div>
        </div>
      ),
    },
    {
      key: "createdAt",
      label: "Date",
      render: (value) =>
        value ? new Date(value).toLocaleDateString() : "—",
    },
    {
      key: "details",
      label: "Details",
      className: "text-left max-w-xs",
      render: (_value, item) => (
        <span className="line-clamp-2 whitespace-normal">
          {formatDetails(item)}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      className: "text-right",
      render: (_value, item) => (
        <div
          className="text-right whitespace-nowrap"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => handleApprove(item.id)}
            disabled={!!actionId}
            className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-medium mr-3 disabled:opacity-50"
          >
            {actionId === `approve-${item.id}` ? "..." : "Approve"}
          </button>
          <button
            type="button"
            onClick={() => handleReject(item.id)}
            disabled={!!actionId}
            className="text-red-600 hover:text-red-700 dark:text-red-400 font-medium disabled:opacity-50"
          >
            {actionId === `reject-${item.id}` ? "..." : "Reject"}
          </button>
        </div>
      ),
    },
  ];

  const renderRequestRow = (item, handleSelect, selectedItems) => (
    <DataTableItem
      item={item}
      columns={columns}
      onSelect={handleSelect}
      isSelected={selectedItems.includes(item.id)}
      selectable={false}
    />
  );

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

      <DataTable
        items={filteredRequests}
        columns={columns}
        onItemClick={undefined}
        onSelect={() => {}}
        selectedItems={[]}
        totalItems={filteredRequests.length}
        title="Affiliation Requests"
        renderItem={renderRequestRow}
        selectable={false}
        loading={loading}
        emptyMessage={
          requests.length === 0
            ? "No pending affiliation requests."
            : "No requests match your search."
        }
      />
    </>
  );

  if (embedded) {
    return tableContent;
  }

  return (
            <main className="grow">
          <div className={PAGE_LAYOUT.list}>{tableContent}</div>
        </main>
      
  );
}

export default AffiliationRequestsList;
