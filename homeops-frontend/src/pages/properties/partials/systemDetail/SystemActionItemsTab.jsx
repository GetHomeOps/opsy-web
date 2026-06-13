import React, { useMemo } from "react";
import { AlertTriangle, Wrench, Sparkles } from "lucide-react";
import SectionCard from "../passport/SectionCard";
import InspectionChecklistPanel from "../InspectionChecklistPanel";
import { getSystemFindingsFromAnalysis } from "../../helpers/inspectionAnalysisHelpers";
import { getSystemStatus } from "../../helpers/systemStatusHelpers";
import EmptyStateCard from "../passport/EmptyStateCard";

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
}) {
  const formStatus = useMemo(
    () =>
      getSystemStatus(
        propertyData,
        systemId,
        isNewInstall,
        customSystemsData,
        maintenanceEvents,
      ),
    [propertyData, systemId, isNewInstall, customSystemsData, maintenanceEvents],
  );

  const aiFindings = useMemo(
    () => getSystemFindingsFromAnalysis(systemId, inspectionAnalysis),
    [systemId, inspectionAnalysis],
  );

  const attentionItems = useMemo(() => {
    const items = [...(formStatus.attentionReasons ?? [])];
    (aiFindings?.needsAttention ?? []).forEach((n) => {
      const label = n.title || n.suggestedAction || "AI finding";
      if (label && !items.includes(label)) items.push(label);
    });
    return items;
  }, [formStatus, aiFindings]);

  const recommendations = [
    ...(aiFindings?.maintenanceSuggestions ?? []).map((m) => ({
      text: m.task || m.rationale || "Maintenance suggestion",
      when: m.suggestedWhen,
    })),
  ];

  const hasContent =
    attentionItems.length > 0 ||
    recommendations.length > 0 ||
    propertyId;

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
        <SectionCard flat title="Inspection Checklist" icon={Wrench}>
          <InspectionChecklistPanel
            propertyId={propertyId}
            systemKey={systemName ?? systemId}
            maintenanceRecords={maintenanceRecords}
            compact
            contacts={contacts}
            systemType={systemId}
            systemLabel={systemLabel}
            propertyData={propertyData}
            onScheduleSuccess={onScheduleSuccess}
            onOpenAIAssistant={onOpenAIAssistant}
          />
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
        <SectionCard flat title="Recommendations" icon={Sparkles}>
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
