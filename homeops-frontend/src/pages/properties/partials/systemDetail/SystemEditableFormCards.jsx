import React from "react";
import {
  FileText,
  Gauge,
  Calendar,
  AlertTriangle,
  Sparkles,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import SectionCard from "../passport/SectionCard";
import { StatusBadge } from "../passport/StatusBadge";
import Tooltip from "../../../../utils/Tooltip";
import { Info } from "lucide-react";
import {
  getAgeFromInstallDate,
  formatAgeFromInstallDate,
} from "../../constants/systemSections";
import {
  SYSTEM_FIELD_DEFINITIONS,
  SYSTEM_FIELDS_BY_ID,
  INSTALL_DATE_FIELD_BY_SYSTEM,
} from "../../constants/systemFieldConfig";
import { SystemEditableField } from "./SystemEditableField";
import { formatOverviewDate } from "../passport/SystemsOverviewPanel";
import { resolveDisplayNextInspectionDate } from "../../helpers/systemStatusHelpers";

const GROUP_META = {
  identity: { title: "System Identity", icon: FileText },
  condition: { title: "Condition & Lifecycle", icon: Gauge },
  inspection: { title: "Inspection Schedule", icon: Calendar },
  issues: { title: "Known Issues", icon: AlertTriangle },
};

function groupFields(systemId) {
  const fieldNames = SYSTEM_FIELDS_BY_ID[systemId] ?? [];
  const groups = { identity: [], condition: [], inspection: [], issues: [] };
  for (const name of fieldNames) {
    const def = SYSTEM_FIELD_DEFINITIONS[name];
    if (!def) continue;
    groups[def.group]?.push(name);
  }
  return groups;
}

/**
 * Editable identity-card layout for a standard system (Overview tab).
 */
export function SystemEditableFormCards({
  systemId,
  propertyData,
  handleInputChange,
  contacts,
  isNewInstall = false,
  aiFindings,
  linkedRecords = [],
  onUploadDocument,
  lastInspectionDate,
}) {
  const groups = groupFields(systemId);
  const installDateField = INSTALL_DATE_FIELD_BY_SYSTEM[systemId];

  const aiItems = [
    ...(aiFindings?.needsAttention ?? []).map((n) => ({
      key: `attn-${n.title ?? n.suggestedAction}`,
      tone: "amber",
      text: n.title || n.suggestedAction || "AI finding",
    })),
    ...(aiFindings?.maintenanceSuggestions ?? []).map((m) => ({
      key: `maint-${m.task ?? m.systemType}`,
      tone: "neutral",
      text: m.task || m.rationale || "Maintenance suggestion",
    })),
  ];

  const nextInspectionField = groups.inspection.find((f) =>
    /NextInspection$/.test(f) || /NextCleaning/.test(SYSTEM_FIELD_DEFINITIONS[f]?.label ?? ""),
  );
  const nextInspectionValue = nextInspectionField
    ? propertyData?.[nextInspectionField]
    : null;
  const displayNextInspection = resolveDisplayNextInspectionDate(
    nextInspectionValue,
    lastInspectionDate,
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
      {["identity", "condition", "inspection", "issues"].map((groupKey) => {
        const fields = groups[groupKey];
        if (!fields?.length && groupKey !== "inspection") return null;
        const meta = GROUP_META[groupKey];

        if (groupKey === "inspection") {
          const inspectionFields = groups.inspection.filter(
            (f) => f !== nextInspectionField,
          );
          return (
            <SectionCard flat key={groupKey} title={meta.title} icon={meta.icon}>
              {displayNextInspection ? (
                <div className="rounded-xl bg-emerald-50/80 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 px-4 py-3 mb-3">
                  <p className="text-[10px] font-medium text-emerald-700/80 dark:text-emerald-300/80 uppercase tracking-[0.08em]">
                    {SYSTEM_FIELD_DEFINITIONS[nextInspectionField]?.label ??
                      "Next Inspection"}
                  </p>
                  <p className="text-lg font-bold text-neutral-900 dark:text-white mt-0.5">
                    {formatOverviewDate(displayNextInspection) ?? displayNextInspection}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-3">
                  No inspection scheduled yet.
                </p>
              )}
              <div className="grid grid-cols-1 gap-4">
                {inspectionFields.map((fieldName) => (
                  <SystemEditableField
                    key={fieldName}
                    fieldName={fieldName}
                    definition={SYSTEM_FIELD_DEFINITIONS[fieldName]}
                    propertyData={propertyData}
                    handleInputChange={handleInputChange}
                    contacts={contacts}
                    disabled={isNewInstall}
                  />
                ))}
                {nextInspectionField && (
                  <SystemEditableField
                    fieldName={nextInspectionField}
                    definition={SYSTEM_FIELD_DEFINITIONS[nextInspectionField]}
                    propertyData={propertyData}
                    handleInputChange={handleInputChange}
                    contacts={contacts}
                  />
                )}
              </div>
            </SectionCard>
          );
        }

        return (
          <SectionCard flat key={groupKey} title={meta.title} icon={meta.icon}>
            <div className="grid grid-cols-1 gap-4">
              {fields.map((fieldName) => (
                <SystemEditableField
                  key={fieldName}
                  fieldName={fieldName}
                  definition={SYSTEM_FIELD_DEFINITIONS[fieldName]}
                  propertyData={propertyData}
                  handleInputChange={handleInputChange}
                  contacts={contacts}
                  disabled={isNewInstall}
                />
              ))}
              {groupKey === "identity" && installDateField && (
                <div>
                  <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                    Age{" "}
                    <Tooltip content="Calculated from install date" position="right">
                      <Info className="w-3.5 h-3.5 inline-block ml-0.5 align-middle text-gray-400 cursor-help" />
                    </Tooltip>
                  </label>
                  <div className="form-input w-full bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700">
                    {formatAgeFromInstallDate(
                      getAgeFromInstallDate(propertyData?.[installDateField]),
                    )}
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        );
      })}

      <SectionCard
        flat
        title="AI-Extracted Insights"
        description="Insights from documents, photos, and maintenance history"
        icon={Sparkles}
        action={
          onUploadDocument ? (
            <button
              type="button"
              onClick={onUploadDocument}
              className="text-xs font-medium text-[#456564] hover:text-[#34514f] dark:text-[#7fa3a1]"
            >
              Upload Document
            </button>
          ) : null
        }
      >
        {aiItems.length > 0 ? (
          <ul className="space-y-2">
            {aiItems.slice(0, 5).map((item) => (
              <li key={item.key} className="flex items-start gap-2.5">
                {item.tone === "amber" ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                )}
                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                  {item.text}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            No AI insights for this system yet. Upload inspection reports or
            documents to generate findings.
          </p>
        )}
      </SectionCard>

      <SectionCard flat title="Linked Records" icon={ClipboardList}>
        <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {linkedRecords.map((rec) => (
            <li
              key={rec.label}
              className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
            >
              <span className="text-sm text-neutral-700 dark:text-neutral-300 flex-1">
                {rec.label}
              </span>
              <span className="text-sm font-semibold text-neutral-900 dark:text-white tabular-nums">
                {rec.count}
              </span>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}
