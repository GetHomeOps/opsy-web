import React, { useMemo, useState } from "react";
import { AlertTriangle, CalendarCheck, ClipboardList, Plus } from "lucide-react";
import { emitOpenDocumentFindings } from "../../helpers/documentAnalysisFlow";
import SectionCard from "../passport/SectionCard";
import InspectionChecklistPanel from "../InspectionChecklistPanel";
import {
  filterChecklistItemsForSystem,
  getResolvedSystemFindings,
} from "../../helpers/inspectionAnalysisHelpers";
import { getSystemStatus } from "../../helpers/systemStatusHelpers";
import { countPriorities } from "../../helpers/actionItemFormatters";
import EmptyStateCard from "../passport/EmptyStateCard";
import { formatOverviewDate } from "../passport/SystemsOverviewPanel";

function PriorityLegend({ items = [] }) {
  const counts = countPriorities(items);
  const entries = [
    { key: "high", label: "High", dot: "bg-red-500", count: counts.urgent + counts.high },
    { key: "medium", label: "Medium", dot: "bg-amber-500", count: counts.medium },
    { key: "low", label: "Low", dot: "bg-emerald-500", count: counts.low },
  ].filter((e) => e.count > 0);

  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
      {entries.map((entry) => (
        <span key={entry.key} className="inline-flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${entry.dot}`} />
          {entry.count} {entry.label}
        </span>
      ))}
    </div>
  );
}

/**
 * Action items tab: inspection checklist + attention reasons + AI recommendations.
 */
export function SystemActionItemsTab({
  systemId,
  systemLabel,
  systemName,
  propertyId,
  propertyData,
  contacts,
  maintenanceRecords,
  maintenanceEvents,
  customSystemsData,
  inspectionAnalysis,
  isNewInstall,
  onScheduleSuccess,
  onOpenAIAssistant,
  onScheduleMaintenance,
  checklistItems = [],
  onCreateRecordForChecklistItem,
  propertyDocuments = [],
  onLinkExistingRecord,
  onLinkExistingDocument,
}) {
  const [addFormOpen, setAddFormOpen] = useState(false);
  const systemChecklistKey = systemName ?? systemId;

  const systemChecklistItems = useMemo(
    () => filterChecklistItemsForSystem(checklistItems, systemChecklistKey),
    [checklistItems, systemChecklistKey],
  );

  const formStatus = useMemo(
    () =>
      getSystemStatus(
        propertyData,
        systemId,
        isNewInstall,
        customSystemsData,
        maintenanceEvents,
        maintenanceRecords,
      ),
    [
      propertyData,
      systemId,
      isNewInstall,
      customSystemsData,
      maintenanceEvents,
      maintenanceRecords,
    ],
  );

  const aiFindings = useMemo(
    () =>
      getResolvedSystemFindings(systemId, inspectionAnalysis, {
        checklistItems,
        maintenanceRecords,
      }),
    [systemId, inspectionAnalysis, checklistItems, maintenanceRecords],
  );

  const persistedFindingTitles = useMemo(() => {
    const titles = new Set();
    for (const item of systemChecklistItems) {
      if (["needs_attention", "maintenance_suggestion"].includes(item.source)) {
        if (item.title) titles.add(String(item.title).trim().toLowerCase());
      }
    }
    return titles;
  }, [systemChecklistItems]);

  const hasPersistedMaintenanceSuggestions = useMemo(
    () =>
      systemChecklistItems.some(
        (item) => item.source === "maintenance_suggestion",
      ),
    [systemChecklistItems],
  );

  const attentionItems = useMemo(() => {
    const items = (formStatus.attentionReasons ?? []).filter(
      (item) =>
        !formStatus.lastInspectionDate ||
        item !== "No inspection date recorded",
    );
    (aiFindings?.needsAttention ?? []).forEach((n) => {
      const label = n.title || n.suggestedAction || "AI finding";
      const normalized = String(label).trim().toLowerCase();
      if (
        label &&
        !items.includes(label) &&
        !persistedFindingTitles.has(normalized)
      ) {
        items.push(label);
      }
    });
    return items;
  }, [formStatus, aiFindings, persistedFindingTitles]);

  const lastInspectionLabel = formStatus.lastInspectionDate
    ? (formatOverviewDate(formStatus.lastInspectionDate) ??
      formStatus.lastInspectionDate)
    : null;

  const recommendations = useMemo(() => {
    if (hasPersistedMaintenanceSuggestions) return [];
    return (aiFindings?.maintenanceSuggestions ?? []).map((m) => ({
      text: m.task || m.rationale || "Maintenance suggestion",
      when: m.suggestedWhen,
    }));
  }, [aiFindings, hasPersistedMaintenanceSuggestions]);

  const hasContent =
    attentionItems.length > 0 ||
    recommendations.length > 0 ||
    propertyId ||
    systemChecklistItems.length > 0;

  if (!hasContent) {
    return (
      <EmptyStateCard
        title="No action items"
        description="This system has no open action items. Upload an inspection report or schedule maintenance to track follow-ups here."
        actionLabel={onScheduleMaintenance ? "Schedule maintenance" : undefined}
        onAction={onScheduleMaintenance}
      />
    );
  }

  return (
    <div className="space-y-4">
      {propertyId && (
        <SectionCard
          flat
          title="Action Items"
          description="Track and manage both inspection-based and recommended maintenance tasks."
          icon={ClipboardList}
          action={
            <div className="flex items-center gap-3">
              {systemChecklistItems.length > 0 ? (
                <PriorityLegend items={systemChecklistItems} />
              ) : null}
              {propertyId && (
                <button
                  type="button"
                  onClick={() => setAddFormOpen((open) => !open)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#456564] dark:text-[#7aa3a2] border border-[#456564]/30 dark:border-[#7aa3a2]/30 rounded-lg hover:bg-[#456564]/5 dark:hover:bg-[#7aa3a2]/10"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Action Item
                </button>
              )}
            </div>
          }
        >
          <InspectionChecklistPanel
            propertyId={propertyId}
            systemKey={systemChecklistKey}
            maintenanceRecords={maintenanceRecords}
            compact
            contacts={contacts}
            systemType={systemId}
            systemLabel={systemLabel}
            propertyData={propertyData}
            onScheduleSuccess={onScheduleSuccess}
            onOpenAIAssistant={onOpenAIAssistant}
            onCreateRecordForItem={onCreateRecordForChecklistItem}
            propertyDocuments={propertyDocuments}
            onLinkExistingRecord={onLinkExistingRecord}
            onLinkExistingDocument={onLinkExistingDocument}
            addFormOpen={addFormOpen}
            onReviewBids={(item) =>
              emitOpenDocumentFindings(propertyId, {
                systemKey: systemChecklistKey,
                systemLabel,
                categoryFilter: "bid",
                initialCategory: "bid",
                checklistItemId: item.id,
              })
            }
          />
        </SectionCard>
      )}

      {lastInspectionLabel && (
        <SectionCard flat title="Inspection Status" icon={CalendarCheck}>
          <div className="flex items-start gap-2.5 text-sm text-neutral-700 dark:text-neutral-300">
            <CalendarCheck className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
            <span>Last inspection recorded: {lastInspectionLabel}</span>
          </div>
        </SectionCard>
      )}

      {attentionItems.length > 0 && (
        <SectionCard flat title="Needs Attention" icon={AlertTriangle}>
          <ul className="space-y-2">
            {attentionItems.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2.5 text-sm text-neutral-700 dark:text-neutral-300"
              >
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {recommendations.length > 0 && (
        <SectionCard flat title="Recommendations" icon={ClipboardList}>
          <ul className="space-y-3">
            {recommendations.map((rec, i) => (
              <li key={i} className="text-sm">
                <p className="text-neutral-800 dark:text-neutral-200 font-medium">
                  {rec.text}
                </p>
                {rec.when && (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Suggested: {rec.when}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}
