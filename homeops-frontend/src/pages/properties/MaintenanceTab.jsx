import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useContext,
} from "react";
import {createPortal} from "react-dom";
import {
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  HeartPulse,
  Sparkles,
  Send,
  Wrench,
  ChevronRight,
  Filter,
} from "lucide-react";
import {useParams, useSearchParams} from "react-router-dom";
import {PROPERTY_SYSTEMS, CUSTOM_SYSTEM_DEFAULT_ICON} from "./constants/propertySystems";
import {
  MaintenanceRecordsTableView,
  MaintenanceRecordReadView,
  CreateMaintenanceRecordPanel,
} from "./partials/maintenance";
import {
  isNewMaintenanceRecord,
  resolveMaintenanceRecordForView,
  isCompletedMaintenanceRecord,
} from "./helpers/maintenanceRecordMapping";
import PropertyContext from "../../context/PropertyContext";
import {useAuth} from "../../context/AuthContext";
import ModalBlank from "../../components/ModalBlank";
import SectionCard from "./partials/passport/SectionCard";
import ComingSoonCard from "./partials/passport/ComingSoonCard";
import EmptyStateCard from "./partials/passport/EmptyStateCard";
import {StatusBadge} from "./partials/passport/StatusBadge";

function formatStatDate(value) {
  if (!value) return null;
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {month: "short", day: "numeric"});
}

/** Compact summary stat card shown above the maintenance list. */
function MaintenanceStatCard({
  icon: Icon,
  iconClass,
  value,
  label,
  detail,
  linkLabel,
  linkClass = "text-emerald-600 dark:text-emerald-400",
  onLinkClick,
  comingSoon = false,
}) {
  return (
    <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/50 bg-white dark:bg-neutral-900 px-4 py-3.5 flex items-start gap-3">
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${iconClass}`}
      >
        <Icon className="w-[18px] h-[18px]" />
      </div>
      <div className="min-w-0 flex-1 flex flex-col">
        <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 truncate">
          {label}
        </p>
        {comingSoon ? (
          <>
            <p className="text-2xl font-bold text-neutral-300 dark:text-neutral-600 leading-tight tabular-nums mt-0.5">
              —
            </p>
            <StatusBadge tone="neutral" className="mt-1.5 w-fit">
              Coming Soon
            </StatusBadge>
          </>
        ) : (
          <>
            <p className="text-2xl font-bold text-neutral-900 dark:text-white leading-tight tabular-nums mt-0.5">
              {value}
            </p>
            {detail && (
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
                {detail}
              </p>
            )}
            {linkLabel && (
              <button
                type="button"
                onClick={onLinkClick}
                className={`inline-flex items-center gap-0.5 text-xs font-semibold mt-2 hover:underline w-fit ${linkClass}`}
              >
                {linkLabel}
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * MaintenanceTab — list + read/detail layout for maintenance record management.
 */
function MaintenanceTab({
  propertyData,
  maintenanceRecords: maintenanceRecordsArray = [],
  savedMaintenanceRecords: savedMaintenanceRecordsArray = [],
  onMaintenanceRecordsChange,
  onMaintenanceRecordAdded,
  onFormDirty,
  contacts = [],
  initialRecordId = null,
  onInitialRecordConsumed,
}) {
  const {uid: propertyId, accountUrl} = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const recordIdFromUrl = searchParams.get("recordId");

  const [viewMode, setViewMode] = useState("list");
  const [maintenanceSubTab, setMaintenanceSubTab] = useState("records");
  const [quickFilter, setQuickFilter] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [createPanelOpen, setCreatePanelOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [recordToDeleteId, setRecordToDeleteId] = useState(null);
  const {setMaintenanceRecords} = useContext(PropertyContext);
  const {currentUser} = useAuth();
  const propertyAddress = useMemo(() => {
    const p = propertyData || {};
    return [p.address, p.city, p.state].filter(Boolean).join(", ") || "";
  }, [propertyData?.address, propertyData?.city, propertyData?.state]);
  const senderName = currentUser?.data?.name || currentUser?.name || "";

  const visibleSystemIds = propertyData.selectedSystemIds ?? [];
  const customSystemNames = propertyData.customSystemNames ?? [];

  const systemsToShow = useMemo(() => {
    const systems = [
      ...PROPERTY_SYSTEMS.filter((s) => visibleSystemIds.includes(s.id)),
      ...customSystemNames.map((name, index) => ({
        id: `custom-${name}-${index}`,
        name,
        icon: CUSTOM_SYSTEM_DEFAULT_ICON,
      })),
    ];
    return systems.sort((a, b) =>
      (a.name || "").localeCompare(b.name || "", undefined, {
        sensitivity: "base",
      }),
    );
  }, [visibleSystemIds, customSystemNames]);

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
        return dateB - dateA;
      });
    });
    return records;
  }, [maintenanceRecordsArray]);

  const recordsToArray = useCallback((recordsObj) => {
    return Object.values(recordsObj || {}).flat();
  }, []);

  const allRecords = useMemo(
    () => recordsToArray(maintenanceRecords),
    [maintenanceRecords, recordsToArray],
  );

  const handleQuickFilterApplied = useCallback(() => {
    setQuickFilter(null);
  }, []);

  const handleSelectRecord = useCallback(
    (record) => {
      setSelectedRecord(
        resolveMaintenanceRecordForView(record, savedMaintenanceRecordsArray),
      );
      setViewMode("detail");
      setSuccessMessage(null);
    },
    [savedMaintenanceRecordsArray],
  );

  const handleOpenCreatePanel = useCallback(() => {
    setEditingRecord(null);
    setCreatePanelOpen(true);
  }, []);

  const handleOpenEditPanel = useCallback(() => {
    setEditingRecord(selectedRecord);
    setCreatePanelOpen(true);
  }, [selectedRecord]);

  const handleCloseCreatePanel = useCallback(() => {
    setCreatePanelOpen(false);
    setEditingRecord(null);
  }, []);

  const handleBackToList = useCallback(() => {
    setViewMode("list");
    setSelectedRecord(null);
    setSuccessMessage(null);
  }, []);

  useEffect(() => {
    const targetId = initialRecordId ?? recordIdFromUrl;
    if (!targetId) return;
    const record = (maintenanceRecordsArray ?? []).find(
      (r) => String(r.id) === String(targetId),
    );
    if (record) {
      setSelectedRecord(
        resolveMaintenanceRecordForView(record, savedMaintenanceRecordsArray),
      );
      setViewMode("detail");
      setSuccessMessage(null);
      if (initialRecordId) {
        onInitialRecordConsumed?.();
      }
      if (recordIdFromUrl) {
        const next = new URLSearchParams(searchParams);
        next.delete("recordId");
        setSearchParams(next, {replace: true});
      }
    }
  }, [
    initialRecordId,
    recordIdFromUrl,
    maintenanceRecordsArray,
    savedMaintenanceRecordsArray,
    onInitialRecordConsumed,
    searchParams,
    setSearchParams,
  ]);

  useEffect(() => {
    if (!selectedRecord || !isNewMaintenanceRecord(selectedRecord)) return;

    const resolved = resolveMaintenanceRecordForView(
      selectedRecord,
      savedMaintenanceRecordsArray,
    );
    if (resolved && String(resolved.id) !== String(selectedRecord.id)) {
      setSelectedRecord(resolved);
    }
  }, [savedMaintenanceRecordsArray, selectedRecord]);

  const handleRecordChange = useCallback(
    (recordData, options = {}) => {
      if (!recordData) return;
      if (!(recordData.date != null && String(recordData.date).trim())) return;
      const sysId = recordData.systemId || "roof";
      const recordId = recordData.id;
      const updated = {...maintenanceRecords};

      Object.keys(updated).forEach((key) => {
        updated[key] = (updated[key] || []).filter((r) => {
          if (String(r.id) === String(recordId)) return false;
          if (
            options.replaceTempId &&
            String(r.id) === String(options.replaceTempId)
          ) {
            return false;
          }
          return true;
        });
      });

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
      onMaintenanceRecordsChange?.(recordsArray, options);
      setMaintenanceRecords(recordsArray);
      setSelectedRecord(recordData);
      if (isNew) {
        onMaintenanceRecordAdded?.();
      }
      return {isNew};
    },
    [
      maintenanceRecords,
      onMaintenanceRecordsChange,
      onMaintenanceRecordAdded,
      recordsToArray,
      setMaintenanceRecords,
    ],
  );

  const handleCreateOrUpdate = useCallback(
    (recordData, options = {}) => {
      const wasEditing = Boolean(editingRecord);
      const {isNew} = handleRecordChange(recordData, options) ?? {};
      if (!options.keepPanelOpen) {
        setCreatePanelOpen(false);
        setEditingRecord(null);
      }
      if (!options.sendToContractor) {
        setViewMode("detail");
        if (!options.silent) {
          setSuccessMessage(
            wasEditing
              ? "Record updated successfully."
              : "Record created successfully.",
          );
        }
      }
      if (isNew || options.replaceTempId) {
        onFormDirty?.(true);
      }
    },
    [editingRecord, handleRecordChange, onFormDirty],
  );

  const handleSendToContractorPending = useCallback(() => {
    setCreatePanelOpen(false);
    setEditingRecord(null);
    setViewMode("detail");
    setSuccessMessage(
      "Report link sent to contractor! They'll receive an email shortly.",
    );
  }, []);

  const handleDeleteRecord = useCallback((recordId) => {
    setRecordToDeleteId(recordId);
    setTimeout(() => setDeleteConfirmOpen(true), 0);
  }, []);

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

    if (selectedRecord?.id === recordId) {
      handleBackToList();
    }
  }, [
    recordToDeleteId,
    maintenanceRecords,
    onMaintenanceRecordsChange,
    recordsToArray,
    selectedRecord,
    setMaintenanceRecords,
    handleBackToList,
  ]);

  const handleAttachFiles = useCallback(
    (uploadedFiles) => {
      if (!selectedRecord || !uploadedFiles?.length) return;
      const existing = Array.isArray(selectedRecord.files)
        ? selectedRecord.files
        : [];
      const updatedRecord = {
        ...selectedRecord,
        files: [...existing, ...uploadedFiles],
      };
      handleRecordChange(updatedRecord);
      onFormDirty?.(true);
      setSuccessMessage(
        "Documents attached. Save the property to file them in the Documents tab.",
      );
    },
    [selectedRecord, handleRecordChange, onFormDirty],
  );

  const handleOpenInNewTab = useCallback(() => {
    if (!selectedRecord) return;
    const accountUrlPath = accountUrl || propertyData.accountUrl || "";
    const sysId = selectedRecord.systemId;
    const recId = selectedRecord.id;
    if (sysId && recId) {
      const path = `/${accountUrlPath}/properties/${propertyId}/maintenance/${encodeURIComponent(sysId)}/${encodeURIComponent(recId)}`;
      window.open(`${window.location.origin}${path}`, "_blank");
    }
  }, [accountUrl, propertyData.accountUrl, propertyId, selectedRecord]);

  const handleOpenRecordInNewTab = useCallback(
    (record) => {
      const accountUrlPath = accountUrl || propertyData.accountUrl || "";
      if (record?.systemId && record?.id) {
        const path = `/${accountUrlPath}/properties/${propertyId}/maintenance/${encodeURIComponent(record.systemId)}/${encodeURIComponent(record.id)}`;
        window.open(`${window.location.origin}${path}`, "_blank");
      }
    },
    [accountUrl, propertyData.accountUrl, propertyId],
  );

  const getSystemName = useCallback(
    (sysId) => systemsToShow.find((s) => s.id === sysId)?.name || "System",
    [systemsToShow],
  );

  const getSystemCondition = useCallback(
    (sysId) => {
      const systems = propertyData?.systems ?? {};
      const key = sysId?.replace(/^custom-/, "") ?? sysId;
      return systems[sysId]?.condition ?? systems[key]?.condition ?? null;
    },
    [propertyData?.systems],
  );

  const maintenanceStats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const year = String(new Date().getFullYear());
    const records = maintenanceRecordsArray ?? [];
    const upcoming = records
      .filter(
        (r) =>
          !isCompletedMaintenanceRecord(r) &&
          r.nextServiceDate &&
          String(r.nextServiceDate).slice(0, 10) >= today,
      )
      .slice()
      .sort((a, b) =>
        String(a.nextServiceDate).localeCompare(String(b.nextServiceDate)),
      );
    const overdue = records.filter(
      (r) =>
        !isCompletedMaintenanceRecord(r) &&
        r.nextServiceDate &&
        String(r.nextServiceDate).slice(0, 10) < today,
    );
    const completedThisYear = records.filter(
      (r) =>
        isCompletedMaintenanceRecord(r) &&
        r.date &&
        String(r.date).slice(0, 4) === year,
    );
    return {upcoming, overdue, completedThisYear};
  }, [maintenanceRecordsArray]);

  const recommendedTasks = useMemo(
    () =>
      [
        ...maintenanceStats.overdue.map((record) => ({record, overdue: true})),
        ...maintenanceStats.upcoming.map((record) => ({
          record,
          overdue: false,
        })),
      ].slice(0, 4),
    [maintenanceStats],
  );

  const contractorRequests = useMemo(
    () =>
      (maintenanceRecordsArray ?? [])
        .filter((r) => r.requestStatus)
        .slice(0, 3),
    [maintenanceRecordsArray],
  );

  const rightRail = (
    <div className="space-y-4 min-w-0">
      <SectionCard flat title="Recommended Next Tasks" icon={Sparkles}>
        {recommendedTasks.length > 0 ? (
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {recommendedTasks.map(({record, overdue}) => (
              <li key={`task-${record.id}`}>
                <button
                  type="button"
                  onClick={() => handleSelectRecord(record)}
                  className="w-full flex items-center gap-2.5 py-2 first:pt-0 last:pb-0 text-left group"
                >
                  <Wrench className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate">
                      {record.description || getSystemName(record.systemId)}
                    </p>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                      Due {formatStatDate(record.nextServiceDate) ?? "—"}
                    </p>
                  </div>
                  <StatusBadge tone={overdue ? "red" : "emerald"}>
                    {overdue ? "Overdue" : "Upcoming"}
                  </StatusBadge>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyStateCard
            icon={CalendarClock}
            title="No tasks due"
            description="Records with a next-service date will surface here."
          />
        )}
      </SectionCard>

      <ComingSoonCard
        title="Smart Record Intake"
        icon={Sparkles}
        placeholder="Upload invoices or service reports and we'll extract the details"
      />

      <SectionCard flat title="Recent Contractor Requests" icon={Send}>
        {contractorRequests.length > 0 ? (
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {contractorRequests.map((record) => (
              <li
                key={`request-${record.id}`}
                className="flex items-center gap-2.5 py-2 first:pt-0 last:pb-0"
              >
                <Send className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate">
                    {record.description || getSystemName(record.systemId)}
                  </p>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                    {record.contractor || "Contractor"}
                  </p>
                </div>
                <StatusBadge tone="brand" className="capitalize">
                  {String(record.requestStatus).replace(/_/g, " ")}
                </StatusBadge>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyStateCard
            icon={Send}
            title="No contractor requests"
            description="Requests sent to contractors from maintenance records will appear here."
          />
        )}
      </SectionCard>
    </div>
  );

  return (
    <div className="space-y-4" data-section-id="maintenance">
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

      <CreateMaintenanceRecordPanel
        open={createPanelOpen}
        onClose={handleCloseCreatePanel}
        systems={systemsToShow}
        record={editingRecord}
        propertyId={propertyId}
        numericPropertyId={
          propertyData?.identity?.id ?? propertyData?.id ?? null
        }
        contacts={contacts}
        propertyAddress={propertyAddress}
        senderName={senderName}
        savedMaintenanceRecords={savedMaintenanceRecordsArray ?? []}
        onSubmit={handleCreateOrUpdate}
        onSendToContractor={handleSendToContractorPending}
      />

      {viewMode === "list" ? (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_19rem] gap-4 items-start">
          <div className="space-y-4 min-w-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMaintenanceSubTab("records")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  maintenanceSubTab === "records"
                    ? "bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white shadow-sm"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                }`}
              >
                Records
              </button>
              <button
                type="button"
                onClick={() => setMaintenanceSubTab("contractor-requests")}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  maintenanceSubTab === "contractor-requests"
                    ? "bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white shadow-sm"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                Contractor Requests
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <MaintenanceStatCard
                icon={CalendarClock}
                iconClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                value={maintenanceStats.upcoming.length}
                label="Upcoming Services"
                detail={
                  maintenanceStats.upcoming[0]?.nextServiceDate
                    ? `Next: ${formatStatDate(maintenanceStats.upcoming[0].nextServiceDate)}`
                    : "No services scheduled"
                }
                linkLabel="View schedule"
                linkClass="text-emerald-600 dark:text-emerald-400"
                onLinkClick={() => {
                  setMaintenanceSubTab("records");
                  setQuickFilter("upcoming");
                }}
              />
              <MaintenanceStatCard
                icon={AlertTriangle}
                iconClass="bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                value={maintenanceStats.overdue.length}
                label="Overdue Items"
                detail={
                  maintenanceStats.overdue.length > 0
                    ? "Needs attention"
                    : "All caught up"
                }
                linkLabel="View overdue"
                linkClass="text-amber-600 dark:text-amber-400"
                onLinkClick={() => {
                  setMaintenanceSubTab("records");
                  setQuickFilter("overdue");
                }}
              />
              <MaintenanceStatCard
                icon={CheckCircle2}
                iconClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                value={maintenanceStats.completedThisYear.length}
                label="Completed This Year"
                detail={
                  maintenanceStats.completedThisYear.length > 0
                    ? `${maintenanceStats.completedThisYear.length} completed`
                    : "No completions yet"
                }
                linkLabel="View completed"
                linkClass="text-emerald-600 dark:text-emerald-400"
                onLinkClick={() => {
                  setMaintenanceSubTab("records");
                  setQuickFilter("completed");
                }}
              />
              <MaintenanceStatCard
                icon={HeartPulse}
                iconClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                label="Avg. Maintenance Health"
                comingSoon
              />
            </div>

            <MaintenanceRecordsTableView
              records={allRecords}
              systems={systemsToShow}
              getSystemName={getSystemName}
              onSelectRecord={handleSelectRecord}
              onOpenInNewTab={handleOpenRecordInNewTab}
              onDelete={handleDeleteRecord}
              onNewRecord={handleOpenCreatePanel}
              contractorRequestsOnly={maintenanceSubTab === "contractor-requests"}
              quickFilter={quickFilter}
              onQuickFilterApplied={handleQuickFilterApplied}
            />
          </div>

          {rightRail}
        </div>
      ) : (
        selectedRecord && (
          <MaintenanceRecordReadView
            record={selectedRecord}
            propertyId={
              propertyData?.id ??
              propertyData?.property_id ??
              selectedRecord?.property_id ??
              propertyId
            }
            propertyUid={propertyId}
            accountUrl={accountUrl || propertyData?.accountUrl || ""}
            systemName={getSystemName(selectedRecord.systemId)}
            systemCondition={getSystemCondition(selectedRecord.systemId)}
            successMessage={successMessage}
            onBack={handleBackToList}
            onEdit={handleOpenEditPanel}
            onDelete={handleDeleteRecord}
            onOpenInNewTab={handleOpenInNewTab}
            onDismissSuccess={() => setSuccessMessage(null)}
            onAttachFiles={handleAttachFiles}
          />
        )
      )}
    </div>
  );
}

export default MaintenanceTab;
