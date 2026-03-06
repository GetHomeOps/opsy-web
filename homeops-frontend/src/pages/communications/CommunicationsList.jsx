import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Sidebar from "../../partials/Sidebar";
import Header from "../../partials/Header";
import ModalBlank from "../../components/ModalBlank";
import DataTable from "../../components/DataTable";
import DataTableItem from "../../components/DataTableItem";
import AppApi from "../../api/api";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import { Plus, Trash2, Clock, Send, FileEdit } from "lucide-react";
import { PAGE_LAYOUT } from "../../constants/layout";

const STATUS_STYLES = {
  draft: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
  scheduled: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  sent: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
};

const STATUS_ICONS = {
  draft: FileEdit,
  scheduled: Clock,
  sent: Send,
};

function CommunicationsList() {
  const { accountUrl } = useParams();
  const navigate = useNavigate();
  const { currentAccount } = useCurrentAccount();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [comms, setComms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchComms = useCallback(async () => {
    if (!currentAccount?.id) return;
    try {
      setLoading(true);
      const list = await AppApi.getCommunications(currentAccount.id);
      setComms(list || []);
    } catch {
      setComms([]);
    } finally {
      setLoading(false);
    }
  }, [currentAccount?.id]);

  useEffect(() => {
    fetchComms();
  }, [fetchComms]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setSubmitting(true);
    try {
      await AppApi.deleteCommunication(deleteId);
      setDeleteModalOpen(false);
      setDeleteId(null);
      fetchComms();
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const handleToggleSelect = (idOrIds, add) => {
    if (Array.isArray(idOrIds)) {
      setSelectedItems((prev) =>
        add ? [...new Set([...prev, ...idOrIds])] : prev.filter((x) => !idOrIds.includes(x))
      );
    } else {
      setSelectedItems((prev) =>
        prev.includes(idOrIds) ? prev.filter((x) => x !== idOrIds) : [...prev, idOrIds]
      );
    }
  };

  const columns = [
    {
      key: "subject",
      label: "Subject",
      sortable: false,
      render: (v) => (
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[260px]">
          {v || "—"}
        </p>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: false,
      render: (v) => {
        const Icon = STATUS_ICONS[v] || FileEdit;
        return (
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
              STATUS_STYLES[v] || STATUS_STYLES.draft
            }`}
          >
            <Icon className="w-3 h-3" />
            {v === "sent" ? "Sent" : v === "scheduled" ? "Scheduled" : "Draft"}
          </span>
        );
      },
    },
    {
      key: "recipientCount",
      label: "Recipients",
      sortable: false,
      render: (v) => v ?? "—",
    },
    {
      key: "sentAt",
      label: "Sent",
      sortable: false,
      render: (v, item) => formatDate(v || item.scheduledAt),
    },
    { key: "createdByName", label: "Created By", sortable: false },
    {
      key: "actions",
      label: "",
      sortable: false,
      className: "text-right",
      render: (_, item) => (
        <div onClick={(e) => e.stopPropagation()} className="text-right">
          {item.status !== "sent" && (
            <button
              type="button"
              onClick={() => {
                setDeleteId(item.id);
                setDeleteModalOpen(true);
              }}
              className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const renderRow = (item, handleSelect, selectedItems, onItemClick) => (
    <DataTableItem
      item={item}
      columns={columns}
      onSelect={handleSelect}
      isSelected={selectedItems.includes(item.id)}
      onItemClick={() => onItemClick(item)}
    />
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="relative flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className="flex-1 overflow-y-auto">
          <div className={PAGE_LAYOUT.list}>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Communications
                </h1>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Compose and send messages to your homeowners and agents.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/${accountUrl}/communications/new`)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Communication
              </button>
            </div>

            <DataTable
              items={loading ? [] : comms}
              columns={columns}
              onItemClick={(item) => navigate(`/${accountUrl}/communications/${item.id}`)}
              onSelect={handleToggleSelect}
              selectedItems={selectedItems}
              totalItems={loading ? 0 : comms.length}
              title="Communications"
              renderItem={renderRow}
              emptyMessage={loading ? "Loading…" : "No communications yet. Create your first one!"}
            />
          </div>
        </main>
      </div>

      <ModalBlank id="comm-delete-modal" modalOpen={deleteModalOpen} setModalOpen={setDeleteModalOpen}>
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Delete Communication
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Are you sure? This cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteModalOpen(false)}
              className="px-4 py-2 text-gray-600 dark:text-gray-400"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={submitting}
              className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium disabled:opacity-50"
            >
              {submitting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </ModalBlank>
    </div>
  );
}

export default CommunicationsList;
