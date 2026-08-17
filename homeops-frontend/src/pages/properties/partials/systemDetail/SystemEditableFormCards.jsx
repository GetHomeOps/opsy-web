import React from "react";
import {
  FileText,
  Gauge,
  Calendar,
  AlertTriangle,
  ClipboardList,
} from "lucide-react";
import SectionCard from "../passport/SectionCard";
import Tooltip from "../../../../utils/Tooltip";
import {Info} from "lucide-react";
import {
  getAgeFromInstallDate,
  formatAgeFromInstallDate,
} from "../../constants/systemSections";
import {
  SYSTEM_FIELD_DEFINITIONS,
  SYSTEM_FIELDS_BY_ID,
  INSTALL_DATE_FIELD_BY_SYSTEM,
} from "../../constants/systemFieldConfig";
import {SystemEditableField} from "./SystemEditableField";
import {formatOverviewDate} from "../passport/SystemsOverviewPanel";
import {resolveDisplayNextInspectionDate} from "../../helpers/systemStatusHelpers";
import {SystemAdditionalDetailsCard} from "./SystemAdditionalDetailsCard";

const GROUP_META = {
  identity: {title: "System Identity", icon: FileText},
  condition: {title: "Condition & Lifecycle", icon: Gauge},
  inspection: {title: "Inspection Schedule", icon: Calendar},
  issues: {title: "Known Issues", icon: AlertTriangle},
};

function groupFields(systemId) {
  const fieldNames = SYSTEM_FIELDS_BY_ID[systemId] ?? [];
  const groups = {identity: [], condition: [], inspection: [], issues: []};
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
  additionalDetails = [],
  propertyDocuments = [],
  linkedRecords = [],
  lastInspectionDate,
}) {
  const groups = groupFields(systemId);
  const installDateField = INSTALL_DATE_FIELD_BY_SYSTEM[systemId];

  const nextInspectionField = groups.inspection.find(
    (f) =>
      /NextInspection$/.test(f) ||
      /NextCleaning/.test(SYSTEM_FIELD_DEFINITIONS[f]?.label ?? ""),
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
            <SectionCard
              flat
              key={groupKey}
              title={meta.title}
              icon={meta.icon}
            >
              {displayNextInspection ? (
                <div className="rounded-xl bg-emerald-50/80 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 px-4 py-3 mb-3">
                  <p className="text-[10px] font-medium text-emerald-700/80 dark:text-emerald-300/80 uppercase tracking-[0.08em]">
                    {SYSTEM_FIELD_DEFINITIONS[nextInspectionField]?.label ??
                      "Next Inspection"}
                  </p>
                  <p className="text-lg font-bold text-neutral-900 dark:text-white mt-0.5">
                    {formatOverviewDate(displayNextInspection) ??
                      displayNextInspection}
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
                    <Tooltip
                      content="Calculated from install date"
                      position="right"
                    >
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

      <SystemAdditionalDetailsCard
        items={additionalDetails}
        propertyDocuments={propertyDocuments}
      />

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
