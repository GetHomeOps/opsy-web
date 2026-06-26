import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useContext,
  useRef,
} from "react";
import {createPortal} from "react-dom";
import {
  ChevronRight,
  Sparkles,
  Pencil,
  Check,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import AppApi from "../../../../api/api";
import {useAuth} from "../../../../context/AuthContext";
import PropertyContext from "../../../../context/PropertyContext";
import ModalBlank from "../../../../components/ModalBlank";
import {StatusBadge} from "../passport/StatusBadge";
import {SystemDetailRightRail} from "../passport/SystemDetailCards";
import {SystemDetailSubNav} from "./SystemDetailSubNav";
import {SystemEditableFormCards} from "./SystemEditableFormCards";
import {SystemCustomFormCards} from "./SystemCustomFormCards";
import {SystemInspectionsFormCards} from "./SystemInspectionsFormCards";
import {SystemActionItemsTab} from "./SystemActionItemsTab";
import {SystemMaintenanceTab} from "./SystemMaintenanceTab";
import {SystemDocumentsTab} from "./SystemDocumentsTab";
import {SystemHistoryTab} from "./SystemHistoryTab";
import {SystemQuickActionsCard} from "./SystemQuickActionsCard";
import {ScheduledEventDetailsModal} from "./ScheduledEventDetailsModal";
import {NextRecommendedActionModal} from "./NextRecommendedActionModal";
import ScheduleSystemModal from "../ScheduleSystemModal";
import {CreateMaintenanceRecordPanel} from "../maintenance";
import SectionCard from "../passport/SectionCard";
import {
  getResolvedSystemFindings,
  filterChecklistItemsForSystem,
  filterPropertyDocumentsForSystem,
  countOpenSystemActionItems,
} from "../../helpers/inspectionAnalysisHelpers";
import {
  resolveCustomSystemBackendKey,
  getDisplayNamesWithCounters,
} from "../../helpers/systemKeyUtils";
import {SYSTEM_FIELDS_BY_ID} from "../../constants/systemFieldConfig";
import {
  buildStandardSystemReadOnlyGroups,
  buildCustomSystemReadOnlyGroups,
  buildInspectionsReadOnlyGroups,
} from "../../helpers/systemFieldDisplay";
import {
  getPersistedMaintenanceId,
  toMaintenanceRecordPayload,
  fromMaintenanceRecordBackend,
} from "../../helpers/maintenanceRecordMapping";
import {
  getLatestCompletedInspectionDateForSystem,
  resolveDisplayNextInspectionDate,
  getConditionFieldName,
  getCurrentConditionValue,
} from "../../helpers/systemStatusHelpers";
import {
  SystemReadOnlyFormCards,
  SystemCustomReadOnlyFormCards,
  SystemInspectionsReadOnlyFormCards,
} from "./SystemReadOnlyFormCards";

const INSPECTION_CHECKLIST_UPDATED_EVENT = "inspection-checklist:updated";

function notifyChecklistUpdated() {
  window.dispatchEvent(new CustomEvent(INSPECTION_CHECKLIST_UPDATED_EVENT));
}

function isPersistedMaintenanceEvent(event) {
  const id = event?.id;
  if (id == null) return false;
  return !String(id).startsWith("record-");
}

function readScheduledEventField(event, ...keys) {
  for (const key of keys) {
    const value = event?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return null;
}

function getScheduledEventTitle(event) {
  return (
    readScheduledEventField(
      event,
      "checklist_item_title",
      "checklistItemTitle",
    ) ??
    readScheduledEventField(event, "title", "system_name", "systemName") ??
    "this scheduled event"
  );
}

function eventToRecordDefaults(event, systemId) {
  const eventType = String(
    readScheduledEventField(event, "event_type", "eventType") ?? "",
  ).toLowerCase();
  const title =
    readScheduledEventField(
      event,
      "checklist_item_title",
      "checklistItemTitle",
    ) ??
    readScheduledEventField(event, "title") ??
    "";
  const checklistItemId = readScheduledEventField(
    event,
    "checklist_item_id",
    "checklistItemId",
  );
  return {
    systemId,
    description: title,
    recordType: eventType === "inspection" ? "Inspection" : "Maintenance",
    contractor:
      readScheduledEventField(event, "contractor_name", "contractorName") ?? "",
    status: "Completed",
    date:
      readScheduledEventField(event, "scheduled_date", "scheduledDate") ??
      new Date().toISOString().slice(0, 10),
    ...(checklistItemId != null ? {checklist_item_id: checklistItemId} : {}),
  };
}

/**
 * Full detail view for a single system: sub-nav tabs, editable overview cards,
 * action items, maintenance, documents, and history.
 */
export function SystemDetailView({
  selectedSystemId,
  selectedRow,
  propertyData,
  propertyId,
  contacts,
  handleInputChange,
  handleNewInstallChange,
  handleScheduleInspection,
  handleBackToSystems,
  maintenanceRecords,
  maintenanceEvents,
  customSystemsData,
  systems,
  inspectionAnalysis,
  onScheduleSuccess,
  onOpenAIAssistant,
  onOpenDocumentFindings,
  documentAnalysisCounts,
  propertyDocuments = [],
  newInstallStates,
  systemsToShow,
  isNewInstallForSystem,
  nextInspectionFieldForSystem,
  systemDetail,
  resolveInstaller,
  initialOverviewEditing = false,
  onOverviewEditingChange,
  savedMaintenanceRecords = [],
  onMaintenanceRecordsChange,
  onMaintenanceRecordAdded,
  onFormDirty,
  onOpenMaintenanceRecord,
  checklistItems = [],
}) {
  const {currentUser} = useAuth();
  const {setMaintenanceRecords} = useContext(PropertyContext);
  const [activeTab, setActiveTab] = useState("overview");
  const [isOverviewEditing, setIsOverviewEditing] = useState(
    initialOverviewEditing,
  );
  const [uploadTrigger, setUploadTrigger] = useState(0);
  const [scheduleTrigger, setScheduleTrigger] = useState(0);
  const [actionItemCount, setActionItemCount] = useState(0);
  const [rescheduleEvent, setRescheduleEvent] = useState(null);
  const [detailsEvent, setDetailsEvent] = useState(null);
  const [createRecordOpen, setCreateRecordOpen] = useState(false);
  const [createRecordDefaults, setCreateRecordDefaults] = useState(null);
  const [completeEventPrompt, setCompleteEventPrompt] = useState(null);
  const [completingScheduledEvent, setCompletingScheduledEvent] =
    useState(false);
  const [nextActionModalOpen, setNextActionModalOpen] = useState(false);
  const sourceScheduledEventRef = useRef(null);

  const propertyAddress = useMemo(() => {
    const p = propertyData || {};
    return [p.address, p.city, p.state].filter(Boolean).join(", ") || "";
  }, [propertyData?.address, propertyData?.city, propertyData?.state]);
  const senderName = currentUser?.data?.name || currentUser?.name || "";

  useEffect(() => {
    setIsOverviewEditing(initialOverviewEditing);
  }, [selectedSystemId, initialOverviewEditing]);

  const isCustom = !SYSTEM_FIELDS_BY_ID[selectedSystemId];
  const customNames = propertyData?.customSystemNames ?? [];
  const displayNames = getDisplayNamesWithCounters(customNames);
  const customNameIndex = customNames.findIndex(
    (_, i) =>
      resolveCustomSystemBackendKey(customNames[i], systems) ===
      selectedSystemId,
  );
  const customSystemName =
    customNameIndex >= 0 ? customNames[customNameIndex] : null;
  const customDisplayName =
    customNameIndex >= 0 ? displayNames[customNameIndex] : null;

  const systemLabel =
    selectedRow?.name ?? customDisplayName ?? selectedSystemId;
  const isNewInstall = isNewInstallForSystem(selectedSystemId);

  const aiFindings = useMemo(
    () =>
      getResolvedSystemFindings(selectedSystemId, inspectionAnalysis, {
        checklistItems,
        maintenanceRecords,
      }),
    [selectedSystemId, inspectionAnalysis, checklistItems, maintenanceRecords],
  );

  const systemChecklistKey = customSystemName ?? selectedSystemId;

  const loadActionItemCount = useCallback(async () => {
    if (!propertyId || !systemChecklistKey) {
      setActionItemCount(0);
      return;
    }
    try {
      const items =
        checklistItems.length > 0
          ? checklistItems
          : await AppApi.getInspectionChecklist(propertyId);
      setActionItemCount(
        countOpenSystemActionItems(
          systemChecklistKey,
          items,
          maintenanceRecords,
        ),
      );
    } catch {
      setActionItemCount(0);
    }
  }, [propertyId, systemChecklistKey, checklistItems, maintenanceRecords]);

  useEffect(() => {
    loadActionItemCount();
  }, [loadActionItemCount]);

  useEffect(() => {
    const handleChecklistUpdated = () => loadActionItemCount();
    window.addEventListener(
      INSPECTION_CHECKLIST_UPDATED_EVENT,
      handleChecklistUpdated,
    );
    return () =>
      window.removeEventListener(
        INSPECTION_CHECKLIST_UPDATED_EVENT,
        handleChecklistUpdated,
      );
  }, [loadActionItemCount]);

  // Keep the stored condition field in sync with the authoritative, reconciled
  // condition (inspection report analysis as the source of truth, reconciled by
  // action-item completion). selectedRow.condition is that resolved value.
  useEffect(() => {
    if (!handleInputChange || !selectedSystemId) return;
    const effective = selectedRow?.condition;
    if (!effective) return;
    const stored = getCurrentConditionValue(propertyData, selectedSystemId);
    if (effective === stored) return;
    const fieldName = getConditionFieldName(selectedSystemId, customSystemName);
    if (!fieldName) return;
    handleInputChange({
      target: {name: fieldName, value: effective},
    });
  }, [
    handleInputChange,
    selectedSystemId,
    selectedRow,
    propertyData,
    customSystemName,
  ]);

  const recommendations = aiFindings?.maintenanceSuggestions ?? [];
  const linkedRecords = systemDetail?.linkedRecords ?? [];
  const systemDocuments = useMemo(
    () => filterPropertyDocumentsForSystem(propertyDocuments, selectedSystemId),
    [propertyDocuments, selectedSystemId],
  );
  const aiInsightCount = documentAnalysisCounts?.[selectedSystemId] ?? 0;
  const latestCompletedInspectionDate = useMemo(
    () =>
      getLatestCompletedInspectionDateForSystem(
        maintenanceRecords,
        selectedSystemId,
      ),
    [maintenanceRecords, selectedSystemId],
  );

  const openUpload = useCallback(() => setUploadTrigger((n) => n + 1), []);

  const handleCreateRecordForChecklistItem = useCallback(
    (item, lastPerformedDate) => {
      const recordType =
        item.source === "maintenance_suggestion" ? "Maintenance" : "Inspection";
      const performedDate =
        lastPerformedDate != null
          ? String(lastPerformedDate).slice(0, 10)
          : new Date().toISOString().slice(0, 10);
      setCreateRecordDefaults({
        systemId: selectedSystemId,
        description: item.title,
        recordType,
        status: "Completed",
        date: performedDate,
        checklist_item_id: item.id,
        notes: item.description || "",
      });
      setCreateRecordOpen(true);
    },
    [selectedSystemId],
  );

  const numericPropertyId =
    propertyData?.identity?.id ?? propertyData?.id ?? propertyId;

  const handleLinkExistingRecordToChecklistItem = useCallback(
    async (item, record, lastPerformedDate) => {
      if (!numericPropertyId || !record?.id) return;
      const performedDate =
        lastPerformedDate != null
          ? String(lastPerformedDate).slice(0, 10)
          : record.date;
      const payload = toMaintenanceRecordPayload(
        {
          ...record,
          checklist_item_id: item.id,
          status: "Completed",
          date: performedDate,
        },
        numericPropertyId,
      );
      const updated = await AppApi.updateMaintenanceRecord(record.id, payload);
      const uiRecord = fromMaintenanceRecordBackend(updated);
      const nextRecords = (maintenanceRecords ?? []).map((r) =>
        String(r.id) === String(record.id) ? uiRecord : r,
      );
      onMaintenanceRecordsChange?.(nextRecords, {silent: true});
      setMaintenanceRecords(nextRecords);
      onFormDirty?.(true);
      notifyChecklistUpdated();
    },
    [
      numericPropertyId,
      maintenanceRecords,
      onMaintenanceRecordsChange,
      setMaintenanceRecords,
      onFormDirty,
    ],
  );

  const handleLinkExistingDocumentToChecklistItem = useCallback(
    async (item, doc, lastPerformedDate) => {
      if (!numericPropertyId) return;
      const performedDate =
        lastPerformedDate != null
          ? String(lastPerformedDate).slice(0, 10)
          : null;
      const linkedRecordId =
        doc.maintenance_record_id ?? doc.maintenanceRecordId;
      if (linkedRecordId) {
        const record = (maintenanceRecords ?? []).find(
          (r) => String(r.id) === String(linkedRecordId),
        );
        if (record) {
          await handleLinkExistingRecordToChecklistItem(
            item,
            record,
            performedDate,
          );
          return;
        }
      }
      const recordType =
        String(doc.document_type ?? "").toLowerCase() === "inspection"
          ? "Inspection"
          : "Maintenance";
      const created = await AppApi.createMaintenanceRecord({
        ...toMaintenanceRecordPayload(
          {
            systemId: selectedSystemId,
            description: item.title,
            notes:
              item.description ||
              `Linked document: ${doc.document_name || "Document"}`,
            status: "Completed",
            date:
              performedDate ||
              doc.document_date ||
              new Date().toISOString().slice(0, 10),
            checklist_item_id: item.id,
            recordType,
          },
          numericPropertyId,
        ),
        property_id: numericPropertyId,
      });
      const uiRecord = fromMaintenanceRecordBackend(created);
      const nextRecords = [...(maintenanceRecords ?? []), uiRecord];
      onMaintenanceRecordsChange?.(nextRecords, {silent: true});
      setMaintenanceRecords(nextRecords);
      onMaintenanceRecordAdded?.();
      onFormDirty?.(true);
      notifyChecklistUpdated();
    },
    [
      numericPropertyId,
      selectedSystemId,
      maintenanceRecords,
      handleLinkExistingRecordToChecklistItem,
      onMaintenanceRecordsChange,
      setMaintenanceRecords,
      onMaintenanceRecordAdded,
      onFormDirty,
    ],
  );

  const setOverviewEditing = useCallback(
    (editing) => {
      setIsOverviewEditing(editing);
      onOverviewEditingChange?.(editing);
    },
    [onOverviewEditingChange],
  );

  const scheduleHandler = handleScheduleInspection(
    selectedSystemId,
    nextInspectionFieldForSystem(selectedSystemId, customSystemName),
  );

  const handleMaintenanceRecordSubmit = useCallback(
    (recordData, options = {}) => {
      if (!recordData) return;
      if (!(recordData.date != null && String(recordData.date).trim())) return;

      let records = [...(maintenanceRecords ?? [])];
      if (options.replaceTempId) {
        records = records.filter(
          (r) => String(r.id) !== String(options.replaceTempId),
        );
      }
      const recordId = recordData.id;
      const sysId = recordData.systemId || selectedSystemId;
      const idx = records.findIndex((r) => String(r.id) === String(recordId));
      let nextRecords;
      if (idx >= 0) {
        nextRecords = records.map((r, i) => (i === idx ? recordData : r));
      } else {
        nextRecords = [...records, {...recordData, systemId: sysId}];
      }
      onMaintenanceRecordsChange?.(nextRecords, options);
      setMaintenanceRecords(nextRecords);
      if (idx < 0 && !options.silent) {
        onMaintenanceRecordAdded?.();
      }
      if (!options.keepPanelOpen) {
        setCreateRecordOpen(false);
        setCreateRecordDefaults(null);

        const linkedEvent = sourceScheduledEventRef.current;
        if (linkedEvent && isPersistedMaintenanceEvent(linkedEvent)) {
          sourceScheduledEventRef.current = null;
          setCompleteEventPrompt({
            event: linkedEvent,
            recordId: getPersistedMaintenanceId(recordData.id),
          });
        }
      }
      if (!options.silent) {
        onFormDirty?.(true);
      }

      if (recordData.checklist_item_id != null) {
        notifyChecklistUpdated();
      }

      const isInspectionRecord =
        /inspection/i.test(String(recordData.recordType ?? "")) ||
        /inspection/i.test(String(recordData.description ?? ""));
      const recordStatus = String(recordData.status ?? "")
        .trim()
        .toLowerCase();
      const isCompletedRecord =
        recordStatus === "completed" ||
        String(recordData.record_status ?? "").toLowerCase() ===
          "user_completed" ||
        String(recordData.record_status ?? "").toLowerCase() ===
          "contractor_completed";
      if (
        sysId === selectedSystemId &&
        isInspectionRecord &&
        isCompletedRecord &&
        recordData.date
      ) {
        const nextField = nextInspectionFieldForSystem(
          selectedSystemId,
          customSystemName,
        );
        const currentNext = customSystemName
          ? customSystemsData[customSystemName]?.nextInspection
          : propertyData?.[nextField];
        const recordDate = String(recordData.date).slice(0, 10);
        if (
          currentNext &&
          resolveDisplayNextInspectionDate(currentNext, recordDate) === null
        ) {
          handleScheduleInspection(selectedSystemId, nextField)("");
        }
      }
    },
    [
      maintenanceRecords,
      onMaintenanceRecordsChange,
      onMaintenanceRecordAdded,
      onFormDirty,
      handleScheduleInspection,
      selectedSystemId,
      customSystemName,
      customSystemsData,
      propertyData,
      nextInspectionFieldForSystem,
      setMaintenanceRecords,
    ],
  );

  const handleCloseCreateRecordPanel = useCallback(() => {
    setCreateRecordOpen(false);
    setCreateRecordDefaults(null);
    sourceScheduledEventRef.current = null;
  }, []);

  const handleConfirmCompleteScheduledEvent = useCallback(async () => {
    const prompt = completeEventPrompt;
    if (!prompt?.event?.id || completingScheduledEvent) return;

    setCompletingScheduledEvent(true);
    try {
      await AppApi.updateMaintenanceEvent(prompt.event.id, {
        status: "completed",
      });

      const checklistItemId = readScheduledEventField(
        prompt.event,
        "checklist_item_id",
        "checklistItemId",
      );
      if (checklistItemId) {
        try {
          const maintenanceId = getPersistedMaintenanceId(prompt.recordId);
          await AppApi.completeChecklistItem(checklistItemId, {
            maintenanceId,
          });
          window.dispatchEvent(
            new CustomEvent(INSPECTION_CHECKLIST_UPDATED_EVENT),
          );
          loadActionItemCount();
        } catch (err) {
          console.error("Failed to complete linked checklist item:", err);
        }
      }

      onScheduleSuccess?.();
      setCompleteEventPrompt(null);
    } catch (err) {
      console.error("Failed to complete scheduled event:", err);
    } finally {
      setCompletingScheduledEvent(false);
    }
  }, [
    completeEventPrompt,
    completingScheduledEvent,
    loadActionItemCount,
    onScheduleSuccess,
  ]);

  const handleRescheduleEvent = useCallback((event) => {
    if (isPersistedMaintenanceEvent(event)) {
      setRescheduleEvent(event);
      return;
    }
    setScheduleTrigger((n) => n + 1);
  }, []);

  const handleViewEventDetails = useCallback((event) => {
    setDetailsEvent(event);
  }, []);

  const handleAddReportFromEvent = useCallback(
    (event) => {
      sourceScheduledEventRef.current = event;
      setCreateRecordDefaults(eventToRecordDefaults(event, selectedSystemId));
      setCreateRecordOpen(true);
    },
    [selectedSystemId],
  );

  const overviewReadOnlyContent = () => {
    if (selectedSystemId === "inspections") {
      return (
        <SystemInspectionsReadOnlyFormCards
          groups={buildInspectionsReadOnlyGroups(propertyData)}
          aiFindings={aiFindings}
          linkedRecords={linkedRecords}
          onUploadDocument={openUpload}
        />
      );
    }
    if (isCustom && customSystemName) {
      const systemData = customSystemsData[customSystemName] ?? {};
      return (
        <SystemCustomReadOnlyFormCards
          groups={buildCustomSystemReadOnlyGroups(systemData, resolveInstaller)}
          nextInspectionValue={systemData.nextInspection}
          lastInspectionValue={latestCompletedInspectionDate}
          aiFindings={aiFindings}
          linkedRecords={linkedRecords}
          onUploadDocument={openUpload}
        />
      );
    }
    return (
      <SystemReadOnlyFormCards
        systemId={selectedSystemId}
        propertyData={propertyData}
        groups={buildStandardSystemReadOnlyGroups(
          selectedSystemId,
          propertyData,
          resolveInstaller,
        )}
        lastInspectionDate={latestCompletedInspectionDate}
        aiFindings={aiFindings}
        linkedRecords={linkedRecords}
        onUploadDocument={openUpload}
      />
    );
  };

  const overviewEditableContent = () => {
    if (selectedSystemId === "inspections") {
      return (
        <SystemInspectionsFormCards
          propertyData={propertyData}
          handleInputChange={handleInputChange}
        />
      );
    }
    if (isCustom && customSystemName) {
      return (
        <SystemCustomFormCards
          systemName={customSystemName}
          systemData={customSystemsData[customSystemName] ?? {}}
          handleInputChange={handleInputChange}
          contacts={contacts}
          isNewInstall={isNewInstall}
          aiFindings={aiFindings}
          linkedRecords={linkedRecords}
          onUploadDocument={openUpload}
          lastInspectionDate={latestCompletedInspectionDate}
        />
      );
    }
    return (
      <SystemEditableFormCards
        systemId={selectedSystemId}
        propertyData={propertyData}
        handleInputChange={handleInputChange}
        contacts={contacts}
        isNewInstall={isNewInstall}
        aiFindings={aiFindings}
        linkedRecords={linkedRecords}
        onUploadDocument={openUpload}
        lastInspectionDate={latestCompletedInspectionDate}
      />
    );
  };

  const overviewContent = () =>
    isOverviewEditing ? overviewEditableContent() : overviewReadOnlyContent();

  return (
    <div className="space-y-4" data-systems-detail>
      <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
        <button
          type="button"
          onClick={handleBackToSystems}
          className="font-medium hover:text-[#456564] dark:hover:text-[#7fa3a1] transition-colors"
        >
          Systems
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-neutral-300 dark:text-neutral-600" />
        <span className="font-medium text-neutral-800 dark:text-neutral-200">
          {systemLabel}
        </span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white tracking-tight">
              {systemLabel}
            </h2>
            {selectedRow?.condition && (
              <StatusBadge
                tone={(() => {
                  const c = String(selectedRow.condition).toLowerCase();
                  if (c === "excellent" || c === "good") return "emerald";
                  if (c === "fair") return "amber";
                  if (c === "poor") return "red";
                  return "neutral";
                })()}
              >
                {selectedRow.condition}
              </StatusBadge>
            )}
          </div>
        </div>
        {activeTab === "overview" && (
          <button
            type="button"
            onClick={() => setOverviewEditing(!isOverviewEditing)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-[#456564]/50 hover:text-[#456564] dark:hover:text-[#7fa3a1] transition-colors shrink-0"
          >
            {isOverviewEditing ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Done
              </>
            ) : (
              <>
                <Pencil className="w-3.5 h-3.5" />
                Edit Details
              </>
            )}
          </button>
        )}
      </div>

      <SystemDetailSubNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        actionItemCount={actionItemCount}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_19rem] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          {activeTab === "overview" && overviewContent()}
          {activeTab === "action-items" && (
            <SystemActionItemsTab
              systemId={selectedSystemId}
              systemLabel={systemLabel}
              systemName={customSystemName ?? selectedSystemId}
              propertyId={propertyId}
              propertyData={propertyData}
              contacts={contacts}
              maintenanceRecords={maintenanceRecords}
              maintenanceEvents={maintenanceEvents}
              customSystemsData={customSystemsData}
              inspectionAnalysis={inspectionAnalysis}
              isNewInstall={isNewInstall}
              onScheduleSuccess={onScheduleSuccess}
              onOpenAIAssistant={onOpenAIAssistant}
              onScheduleMaintenance={() => setActiveTab("maintenance")}
              checklistItems={checklistItems}
              onCreateRecordForChecklistItem={
                handleCreateRecordForChecklistItem
              }
              propertyDocuments={propertyDocuments}
              onLinkExistingRecord={handleLinkExistingRecordToChecklistItem}
              onLinkExistingDocument={handleLinkExistingDocumentToChecklistItem}
            />
          )}
          {activeTab === "maintenance" && (
            <SystemMaintenanceTab
              systemId={selectedSystemId}
              systemLabel={systemLabel}
              maintenanceEvents={maintenanceEvents}
              maintenanceRecords={maintenanceRecords}
              actionItemCount={actionItemCount}
              onSchedule={() => setScheduleTrigger((n) => n + 1)}
              onReschedule={handleRescheduleEvent}
              onViewDetails={handleViewEventDetails}
              onAddReport={handleAddReportFromEvent}
              onViewAllRecords={() => setActiveTab("history")}
              onViewActionItems={() => setActiveTab("action-items")}
              onOpenRecord={onOpenMaintenanceRecord}
            />
          )}
          {activeTab === "documents" && (
            <SystemDocumentsTab
              systemLabel={systemLabel}
              documents={systemDocuments}
              aiInsightCount={aiInsightCount}
              onUploadDocument={openUpload}
              onOpenDocumentFindings={() =>
                onOpenDocumentFindings?.(selectedSystemId, systemLabel)
              }
            />
          )}
          {activeTab === "history" && (
            <SystemHistoryTab
              systemId={selectedSystemId}
              systemLabel={systemLabel}
              maintenanceRecords={maintenanceRecords}
              maintenanceEvents={maintenanceEvents}
              recommendations={recommendations}
              onOpenRecord={onOpenMaintenanceRecord}
            />
          )}
        </div>

        <div className="space-y-4 min-w-0">
          {selectedRow && (
            <SystemDetailRightRail
              row={selectedRow}
              isEditing={isOverviewEditing}
              onEdit={() => {
                setActiveTab("overview");
                setOverviewEditing(true);
              }}
              onNextActionClick={() => setNextActionModalOpen(true)}
            />
          )}

          <SystemQuickActionsCard
            systemId={selectedSystemId}
            systemLabel={systemLabel}
            propertyId={propertyId}
            propertyData={propertyData}
            systemsToShow={systemsToShow}
            propertySystems={systems}
            contacts={contacts}
            isNewInstall={isNewInstall}
            onNewInstallChange={(v) =>
              handleNewInstallChange(selectedSystemId, v, customSystemName)
            }
            onScheduleInspection={scheduleHandler}
            onScheduleSuccess={onScheduleSuccess}
            uploadTrigger={uploadTrigger}
            scheduleTrigger={scheduleTrigger}
          />

          {recommendations.length > 0 && (
            <SectionCard flat title="Recommendations" icon={Sparkles}>
              <ul className="space-y-2">
                {recommendations.slice(0, 2).map((rec, i) => (
                  <li
                    key={i}
                    className="text-sm text-neutral-700 dark:text-neutral-300"
                  >
                    {rec.task || rec.rationale || "Maintenance suggestion"}
                  </li>
                ))}
              </ul>
              {recommendations.length > 2 && (
                <button
                  type="button"
                  onClick={() => setActiveTab("action-items")}
                  className="mt-2 text-xs font-medium text-[#456564] hover:text-[#34514f]"
                >
                  View all ({recommendations.length})
                </button>
              )}
            </SectionCard>
          )}
        </div>
      </div>

      {rescheduleEvent &&
        createPortal(
          <ScheduleSystemModal
            isOpen
            mode="reschedule"
            existingEvent={rescheduleEvent}
            onClose={() => setRescheduleEvent(null)}
            systemLabel={systemLabel}
            systemType={selectedSystemId}
            contacts={contacts}
            onSchedule={scheduleHandler}
            onScheduleSuccess={() => {
              onScheduleSuccess?.();
              setRescheduleEvent(null);
            }}
            propertyId={propertyId}
            propertyData={propertyData}
          />,
          document.body,
        )}

      {detailsEvent &&
        createPortal(
          <ScheduledEventDetailsModal
            isOpen
            event={detailsEvent}
            systemLabel={systemLabel}
            onClose={() => setDetailsEvent(null)}
          />,
          document.body,
        )}

      <NextRecommendedActionModal
        isOpen={nextActionModalOpen}
        onClose={() => setNextActionModalOpen(false)}
        systemLabel={systemLabel}
        nextDue={selectedRow?.nextDue}
        nextDueOverdue={selectedRow?.nextDueOverdue}
        lastService={selectedRow?.lastService}
        onViewMaintenance={() => {
          setNextActionModalOpen(false);
          setActiveTab("maintenance");
        }}
        onSchedule={() => {
          setNextActionModalOpen(false);
          setScheduleTrigger((n) => n + 1);
        }}
      />

      <CreateMaintenanceRecordPanel
        open={createRecordOpen}
        onClose={handleCloseCreateRecordPanel}
        systems={systemsToShow}
        defaultValues={createRecordDefaults}
        propertyId={propertyId}
        numericPropertyId={
          propertyData?.identity?.id ?? propertyData?.id ?? null
        }
        contacts={contacts}
        propertyAddress={propertyAddress}
        senderName={senderName}
        savedMaintenanceRecords={savedMaintenanceRecords}
        onSubmit={handleMaintenanceRecordSubmit}
        onSendToContractor={handleCloseCreateRecordPanel}
      />

      {completeEventPrompt &&
        createPortal(
          <ModalBlank
            id="complete-scheduled-event-modal"
            modalOpen
            setModalOpen={() =>
              !completingScheduledEvent && setCompleteEventPrompt(null)
            }
            backdropZClassName="z-[160]"
            dialogZClassName="z-[160]"
            contentClassName="max-w-lg"
            closeOnEscape={!completingScheduledEvent}
            closeOnClickOutside={!completingScheduledEvent}
          >
            <div className="p-5 flex gap-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-emerald-100 dark:bg-emerald-900/40">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                  Mark scheduled event as complete?
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                  Your maintenance record was saved. Would you like to mark{" "}
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    {getScheduledEventTitle(completeEventPrompt.event)}
                  </span>{" "}
                  as complete? It will be removed from the scheduled panel.
                </p>
                <div className="flex flex-wrap justify-end gap-2 mt-6">
                  <button
                    type="button"
                    disabled={completingScheduledEvent}
                    onClick={() => setCompleteEventPrompt(null)}
                    className="btn-sm border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 text-gray-800 dark:text-gray-300 disabled:opacity-50"
                  >
                    Keep scheduled
                  </button>
                  <button
                    type="button"
                    disabled={completingScheduledEvent}
                    onClick={handleConfirmCompleteScheduledEvent}
                    className="btn-sm bg-[#456564] hover:bg-[#34514f] text-white disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    {completingScheduledEvent && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    )}
                    Mark complete
                  </button>
                </div>
              </div>
            </div>
          </ModalBlank>,
          document.body,
        )}
    </div>
  );
}
