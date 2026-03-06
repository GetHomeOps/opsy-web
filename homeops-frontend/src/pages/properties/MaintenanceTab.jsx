import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useContext,
} from "react";
import {createPortal} from "react-dom";
import {Settings, PanelLeftClose, ChevronRight, Menu} from "lucide-react";
import {useParams} from "react-router-dom";
import {PROPERTY_SYSTEMS} from "./constants/propertySystems";
import {
  MaintenanceTreeView,
  MaintenanceFormPanel,
} from "./partials/maintenance";
import PropertyContext from "../../context/PropertyContext";
import ModalBlank from "../../components/ModalBlank";

/**
 * MaintenanceTab - Split-view layout for maintenance record management.
 *
 * Features:
 * - Left panel: Tree view of systems with nested maintenance records
 * - Right panel: Full form for viewing/editing selected record
 * - Filtering and search by status, date, text
 * - "Open in New Tab" functionality for working with external references
 */
function MaintenanceTab({
  propertyData,
  maintenanceRecords: maintenanceRecordsArray = [],
  savedMaintenanceRecords: savedMaintenanceRecordsArray = [],
  onMaintenanceRecordsChange,
  onMaintenanceRecordAdded,
  contacts = [],
}) {
  const {uid: propertyId, accountUrl} = useParams();

  const [selectedRecord, setSelectedRecord] = useState(null);
  const [selectedSystemId, setSelectedSystemId] = useState(null);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // For mobile overlay
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [recordToDeleteId, setRecordToDeleteId] = useState(null);
  const {setMaintenanceRecords} = useContext(PropertyContext);
  // Close mobile sidebar on escape key
  useEffect(() => {
    const handleKeydown = (e) => {
      if (e.key === "Escape" && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [sidebarOpen]);

  // Determine visible systems: only those with included=true (from modal selection)
  const visibleSystemIds = propertyData.selectedSystemIds ?? [];
  const customSystemNames = propertyData.customSystemNames ?? [];

  const systemsToShow = [
    ...PROPERTY_SYSTEMS.filter((s) => visibleSystemIds.includes(s.id)),
    ...customSystemNames.map((name, index) => ({
      id: `custom-${name}-${index}`,
      name,
      icon: Settings,
    })),
  ];

  // Convert array (from parent state) to object keyed by systemId
  const maintenanceRecords = useMemo(() => {
    const records = {};
    (maintenanceRecordsArray || []).forEach((item) => {
      const systemId = item.systemId || "roof";
      if (!records[systemId]) records[systemId] = [];
      records[systemId].push({...item, systemId});
    });
    Object.keys(records).forEach((sysId) => {
      records[sysId].sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA; // descending: most recent first
      });
    });
    return records;
  }, [maintenanceRecordsArray]);

  // Tree only shows saved records; unsaved records are hidden until Save
  const maintenanceRecordsForTree = useMemo(() => {
    const records = {};
    (savedMaintenanceRecordsArray || []).forEach((item) => {
      const systemId = item.systemId || "roof";
      if (!records[systemId]) records[systemId] = [];
      records[systemId].push({...item, systemId});
    });
    Object.keys(records).forEach((sysId) => {
      records[sysId].sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA; // descending: most recent first
      });
    });
    return records;
  }, [savedMaintenanceRecordsArray]);

  const recordsToArray = useCallback((recordsObj) => {
    return Object.values(recordsObj || {}).flat();
  }, []);

  // Handle selecting a record from the tree
  const handleSelectRecord = useCallback((record) => {
    setSelectedRecord(record);
    setSelectedSystemId(record.systemId);
    setIsNewRecord(false);
  }, []);

  // Handle selecting a system (shows empty form for that system)
  const handleSelectSystem = useCallback((systemId) => {
    setSelectedRecord(null);
    setSelectedSystemId(systemId);
    setIsNewRecord(false);
  }, []);

  // Handle adding a new record for a system
  const handleAddRecord = useCallback((systemId) => {
    setSelectedRecord(null);
    setSelectedSystemId(systemId);
    setIsNewRecord(true);
  }, []);

  const handleRecordChange = useCallback(
    (recordData) => {
      if (!recordData) return;
      if (!(recordData.date != null && String(recordData.date).trim())) return;
      const sysId = recordData.systemId || "roof";
      const recordId = recordData.id;
      const updated = {...maintenanceRecords};

      // Remove from any system where it previously existed (handles system change)
      Object.keys(updated).forEach((key) => {
        updated[key] = (updated[key] || []).filter(
          (r) => String(r.id) !== String(recordId),
        );
      });

      // Add or ensure it exists in the target system
      const targetRecords = updated[sysId] || [];
      const idx = targetRecords.findIndex(
        (r) => String(r.id) === String(recordId),
      );
      const isNew = idx < 0;
      if (idx >= 0) {
        updated[sysId] = targetRecords.map((r, i) =>
          i === idx ? recordData : r,
        );
      } else {
        updated[sysId] = [...targetRecords, recordData];
      }
      const recordsArray = recordsToArray(updated);
      onMaintenanceRecordsChange?.(recordsArray);
      setMaintenanceRecords(recordsArray);
      setSelectedRecord(recordData);
      setIsNewRecord(false);
      if (isNew) {
        onMaintenanceRecordAdded?.();
      }
    },
    [
      maintenanceRecords,
      onMaintenanceRecordsChange,
      onMaintenanceRecordAdded,
      recordsToArray,
      setMaintenanceRecords,
    ],
  );

  // Open delete confirmation modal (defer to avoid click-outside handler firing)
  const handleDeleteRecord = useCallback((recordId) => {
    setRecordToDeleteId(recordId);
    setTimeout(() => setDeleteConfirmOpen(true), 0);
  }, []);

  // Confirm delete and close modal
  const handleConfirmDelete = useCallback(() => {
    if (!recordToDeleteId) return;
    const recordId = recordToDeleteId;
    setDeleteConfirmOpen(false);
    setRecordToDeleteId(null);

    const updated = {...maintenanceRecords};
    Object.keys(updated).forEach((systemId) => {
      updated[systemId] = (updated[systemId] || []).filter(
        (r) => String(r.id) !== String(recordId),
      );
    });
    const recordsArray = recordsToArray(updated);
    onMaintenanceRecordsChange?.(recordsArray);
    setMaintenanceRecords(recordsArray);

    // Clear selection if deleted record was selected
    if (selectedRecord?.id === recordId) {
      setSelectedRecord(null);
      setIsNewRecord(false);
    }
  }, [
    recordToDeleteId,
    maintenanceRecords,
    onMaintenanceRecordsChange,
    recordsToArray,
    selectedRecord,
    setMaintenanceRecords,
  ]);

  // Handle "Open in New Tab" - opens maintenance record at /:accountUrl/properties/:uid/maintenance/:systemId/:recordId
  const handleOpenInNewTab = useCallback(
    (data) => {
      const accountUrlPath = accountUrl || propertyData.accountUrl || "";
      const uid = data?.propertyId ?? propertyId;
      const sysId = data?.systemId ?? selectedSystemId;
      const recId =
        data?.record?.id ?? data?.record?.recordId ?? selectedRecord?.id;
      if (sysId && recId) {
        const path = `/${accountUrlPath}/properties/${uid}/maintenance/${encodeURIComponent(sysId)}/${encodeURIComponent(recId)}`;
        const url = `${window.location.origin}/#${path}`;
        window.open(url, "_blank");
      } else {
        const path = `/${accountUrlPath}/properties/${uid}`;
        const url = `${window.location.origin}/#${path}`;
        window.open(url, "_blank");
      }
    },
    [
      accountUrl,
      propertyData.accountUrl,
      propertyId,
      selectedSystemId,
      selectedRecord?.id,
    ],
  );

  // Get the system name for the selected system
  const getSystemName = (sysId) => {
    return systemsToShow.find((s) => s.id === sysId)?.name || "System";
  };

  // Handle record/system selection and close mobile sidebar
  const handleRecordSelect = useCallback(
    (record) => {
      handleSelectRecord(record);
      setSidebarOpen(false);
    },
    [handleSelectRecord],
  );

  /* Handle selecting a system on mobile */
  const handleSystemSelect = useCallback(
    (systemId) => {
      handleSelectSystem(systemId);
      setSidebarOpen(false);
    },
    [handleSelectSystem],
  );

  /* Handle adding a record on mobile */
  const handleAddRecordMobile = useCallback(
    (systemId) => {
      handleAddRecord(systemId);
      setSidebarOpen(false);
    },
    [handleAddRecord],
  );

  return (
    <div
      data-section-id="maintenance"
      className={`relative flex h-[calc(100vh-200px)] min-h-[600px] bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 ${sidebarCollapsed ? "" : "gap-4"}`}
    >
      {/* Delete confirmation modal - rendered via portal to escape overflow:hidden */}
      {createPortal(
        <ModalBlank
          id="maintenance-delete-modal"
          modalOpen={deleteConfirmOpen}
          setModalOpen={setDeleteConfirmOpen}
        >
          <div className="p-5 flex space-x-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-gray-100 dark:bg-gray-700">
              <svg
                className="shrink-0 fill-current text-red-500"
                width="16"
                height="16"
                viewBox="0 0 16 16"
              >
                <path d="M8 0C3.6 0 0 3.6 0 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm0 12c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1zm1-3H7V4h2v5z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="mb-2">
                <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                  Delete maintenance record?
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                Are you sure you want to delete this maintenance record? You
                will need to click the Save/Update button below to apply
                changes.
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className="btn-sm border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 text-gray-800 dark:text-gray-300"
                  onClick={() => setDeleteConfirmOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-sm bg-red-500 hover:bg-red-600 text-white"
                  onClick={handleConfirmDelete}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </ModalBlank>,
        document.body,
      )}

      {/* Mobile sidebar backdrop - scoped to tab */}
      {sidebarOpen && (
        <div
          className="lg:hidden absolute inset-0 bg-gray-900/50 z-40 rounded-lg"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Panel - Tree View */}
      {/* Desktop: inline collapsible | Mobile: overlay drawer within tab */}
      <div
        className={`
          flex-shrink-0 transition-all duration-200 ease-in-out
          lg:relative lg:z-auto
          ${sidebarCollapsed ? "lg:w-0 lg:overflow-hidden" : "lg:w-72"}
          absolute inset-y-0 left-0 z-50 lg:static
          ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }
        `}
      >
        <div className="w-72 h-full rounded-l-lg overflow-hidden">
          <MaintenanceTreeView
            systems={systemsToShow}
            maintenanceRecords={maintenanceRecordsForTree}
            selectedRecordId={selectedRecord?.id}
            selectedSystemId={isNewRecord ? selectedSystemId : null}
            onSelectRecord={handleRecordSelect}
            onSelectSystem={handleSystemSelect}
            onAddRecord={handleAddRecordMobile}
            onCollapse={() => {
              setSidebarCollapsed(true);
              setSidebarOpen(false);
            }}
            contacts={contacts}
          />
        </div>
      </div>

      {/* Expand button when collapsed (desktop only) */}
      {sidebarCollapsed && (
        <div className="hidden lg:flex flex-shrink-0 w-7 flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setSidebarCollapsed(false)}
            className="p-1.5 mt-2 mx-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded transition-colors"
            title="Expand sidebar"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Right Panel - Form */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile menu button */}
        <div className="lg:hidden flex items-center px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Open records menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Records
          </span>
        </div>

        <div className="flex-1 min-h-0">
          <MaintenanceFormPanel
            record={selectedRecord}
            systemId={selectedSystemId}
            systemName={getSystemName(selectedSystemId)}
            propertyId={propertyId}
            onRecordChange={handleRecordChange}
            onDelete={handleDeleteRecord}
            onOpenInNewTab={handleOpenInNewTab}
            contacts={contacts}
            isNewRecord={isNewRecord}
          />
        </div>
      </div>
    </div>
  );
}

export default MaintenanceTab;
