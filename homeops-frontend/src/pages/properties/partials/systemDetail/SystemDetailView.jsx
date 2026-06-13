import React, { useState, useMemo, useCallback, useEffect } from "react";
import { ChevronRight, Sparkles, Pencil, Check } from "lucide-react";
import AppApi from "../../../../api/api";
import { StatusBadge } from "../passport/StatusBadge";
import { SystemDetailRightRail } from "../passport/SystemDetailCards";
import { SystemDetailSubNav } from "./SystemDetailSubNav";
import { SystemEditableFormCards } from "./SystemEditableFormCards";
import { SystemCustomFormCards } from "./SystemCustomFormCards";
import { SystemInspectionsFormCards } from "./SystemInspectionsFormCards";
import { SystemActionItemsTab } from "./SystemActionItemsTab";
import { SystemMaintenanceTab } from "./SystemMaintenanceTab";
import { SystemDocumentsTab } from "./SystemDocumentsTab";
import { SystemHistoryTab } from "./SystemHistoryTab";
import { SystemQuickActionsCard } from "./SystemQuickActionsCard";
import SectionCard from "../passport/SectionCard";
import {
  getSystemFindingsFromAnalysis,
  filterChecklistItemsForSystem,
  filterPropertyDocumentsForSystem,
} from "../../helpers/inspectionAnalysisHelpers";
import {
  resolveCustomSystemBackendKey,
  getDisplayNamesWithCounters,
} from "../../helpers/systemKeyUtils";
import { SYSTEM_FIELDS_BY_ID } from "../../constants/systemFieldConfig";
import {
  buildStandardSystemReadOnlyGroups,
  buildCustomSystemReadOnlyGroups,
  buildInspectionsReadOnlyGroups,
} from "../../helpers/systemFieldDisplay";
import {
  SystemReadOnlyFormCards,
  SystemCustomReadOnlyFormCards,
  SystemInspectionsReadOnlyFormCards,
} from "./SystemReadOnlyFormCards";

const INSPECTION_CHECKLIST_UPDATED_EVENT = "inspection-checklist:updated";

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
}) {
  const [activeTab, setActiveTab] = useState("overview");
  const [isOverviewEditing, setIsOverviewEditing] = useState(
    initialOverviewEditing,
  );
  const [uploadTrigger, setUploadTrigger] = useState(0);
  const [scheduleTrigger, setScheduleTrigger] = useState(0);
  const [actionItemCount, setActionItemCount] = useState(0);

  useEffect(() => {
    setIsOverviewEditing(initialOverviewEditing);
  }, [selectedSystemId, initialOverviewEditing]);

  const isCustom = !SYSTEM_FIELDS_BY_ID[selectedSystemId];
  const customNames = propertyData?.customSystemNames ?? [];
  const displayNames = getDisplayNamesWithCounters(customNames);
  const customNameIndex = customNames.findIndex(
    (_, i) =>
      resolveCustomSystemBackendKey(customNames[i], systems) === selectedSystemId,
  );
  const customSystemName =
    customNameIndex >= 0 ? customNames[customNameIndex] : null;
  const customDisplayName =
    customNameIndex >= 0 ? displayNames[customNameIndex] : null;

  const systemLabel =
    selectedRow?.name ?? customDisplayName ?? selectedSystemId;
  const isNewInstall = isNewInstallForSystem(selectedSystemId);

  const aiFindings = useMemo(
    () => getSystemFindingsFromAnalysis(selectedSystemId, inspectionAnalysis),
    [selectedSystemId, inspectionAnalysis],
  );

  const systemChecklistKey = customSystemName ?? selectedSystemId;

  const loadActionItemCount = useCallback(async () => {
    if (!propertyId || !systemChecklistKey) {
      setActionItemCount(0);
      return;
    }
    try {
      const items = await AppApi.getInspectionChecklist(propertyId);
      const sysItems = filterChecklistItemsForSystem(items, systemChecklistKey);
      const openCount = sysItems.filter((item) => {
        const status = String(item.status ?? "").toLowerCase();
        return status === "pending" || status === "in_progress";
      }).length;
      setActionItemCount(openCount);
    } catch {
      setActionItemCount(0);
    }
  }, [propertyId, systemChecklistKey]);

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

  const recommendations = aiFindings?.maintenanceSuggestions ?? [];
  const linkedRecords = systemDetail?.linkedRecords ?? [];
  const systemDocuments = useMemo(
    () => filterPropertyDocumentsForSystem(propertyDocuments, selectedSystemId),
    [propertyDocuments, selectedSystemId],
  );
  const aiInsightCount = documentAnalysisCounts?.[selectedSystemId] ?? 0;

  const openUpload = useCallback(() => setUploadTrigger((n) => n + 1), []);

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
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 truncate">
            {propertyData?.propertyName || propertyData?.address || "Property"} ·
            System ID: {selectedSystemId}
          </p>
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
            />
          )}
          {activeTab === "maintenance" && (
            <SystemMaintenanceTab
              systemId={selectedSystemId}
              maintenanceEvents={maintenanceEvents}
              maintenanceRecords={maintenanceRecords}
              onSchedule={() => setScheduleTrigger((n) => n + 1)}
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
              maintenanceRecords={maintenanceRecords}
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
              handleNewInstallChange(
                selectedSystemId,
                v,
                customSystemName,
              )
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
                  <li key={i} className="text-sm text-neutral-700 dark:text-neutral-300">
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
    </div>
  );
}
