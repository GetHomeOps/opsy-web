import React, {useState, useEffect, useCallback} from "react";
import {useParams, useNavigate} from "react-router-dom";
import Sidebar from "../../partials/Sidebar";
import Header from "../../partials/Header";
import ModalBlank from "../../components/ModalBlank";
import DataTable from "../../components/DataTable";
import DataTableItem from "../../components/DataTableItem";
import AppApi from "../../api/api";
import {Plus, Trash2} from "lucide-react";
import {PAGE_LAYOUT} from "../../constants/layout";

const RESOURCE_TYPES = {
  post: "Post",
  web_link: "Web link",
  video_link: "Video Link",
  pdf: "PDF",
  article_link: "Web link", // legacy migration
};

function ResourcesManagement() {
  const {accountUrl} = useParams();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedResources, setSelectedResources] = useState([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchResources = useCallback(async () => {
    try {
      setLoading(true);
      const list = await AppApi.getResourcesAdmin();
      setResources(list || []);
    } catch {
      setResources([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setSubmitting(true);
    try {
      await AppApi.deleteResource(deleteId);
      setDeleteModalOpen(false);
      setDeleteId(null);
      fetchResources();
    } catch (err) {
      console.error("Resource delete failed:", err);
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
    });
  };

  const handleResourceClick = (item) => {
    navigate(`/${accountUrl}/resources/${item.id}`);
  };

  const handleToggleSelect = (idOrIds, add) => {
    if (Array.isArray(idOrIds)) {
      if (add) {
        setSelectedResources((prev) => [...new Set([...prev, ...idOrIds])]);
      } else {
        setSelectedResources((prev) => prev.filter((x) => !idOrIds.includes(x)));
      }
    } else {
      setSelectedResources((prev) =>
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
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[200px]">
          {v || "—"}
        </p>
      ),
    },
    {
      key: "type",
      label: "Type",
      sortable: false,
      render: (v) => RESOURCE_TYPES[v] || v || "—",
    },
    {
      key: "status",
      label: "Status",
      sortable: false,
      render: (v) => (
        <span
          className={`inline-flex items-center text-xs font-medium px-2 py-1 rounded ${
            v === "sent"
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
              : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
          }`}
        >
          {v === "sent" ? "Sent" : "Draft"}
        </span>
      ),
    },
    {
      key: "sentAt",
      label: "Sent date",
      sortable: false,
      render: (v) => formatDate(v),
    },
    {key: "createdByName", label: "Created By", sortable: false},
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      className: "text-right",
      render: (_, item) => (
        <div onClick={(e) => e.stopPropagation()} className="text-right">
          {item.status === "draft" && (
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

  const renderResourceRow = (item, handleSelect, selectedItems, onItemClick) => (
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
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Communications
              </h1>
              <button
                type="button"
                onClick={() => navigate(`/${accountUrl}/resources/new`)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100"
              >
                <Plus className="w-4 h-4" />
                New Communication
              </button>
            </div>

            <DataTable
              items={loading ? [] : resources}
              columns={columns}
              onItemClick={handleResourceClick}
              onSelect={handleToggleSelect}
              selectedItems={selectedResources}
              totalItems={loading ? 0 : resources.length}
              title="Communications"
              renderItem={renderResourceRow}
              emptyMessage={loading ? "Loading…" : "No communications found"}
            />
          </div>
        </main>
      </div>

      <ModalBlank
        id="resource-delete-modal"
        modalOpen={deleteModalOpen}
        setModalOpen={setDeleteModalOpen}
      >
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

export default ResourcesManagement;
