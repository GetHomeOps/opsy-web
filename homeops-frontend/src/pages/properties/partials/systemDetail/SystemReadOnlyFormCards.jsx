import React from "react";
import {
  FileText,
  Gauge,
  Calendar,
  AlertTriangle,
  ClipboardList,
  CheckCircle2,
} from "lucide-react";
import SectionCard from "../passport/SectionCard";
import {StatusBadge} from "../passport/StatusBadge";
import LabelValue from "../passport/LabelValue";
import {formatOverviewDate} from "../passport/SystemsOverviewPanel";
import {SYSTEM_FIELD_DEFINITIONS} from "../../constants/systemFieldConfig";
import {
  findNextInspectionFieldName,
  groupFieldsBySystemId,
  conditionTone,
} from "../../helpers/systemFieldDisplay";
import {resolveDisplayNextInspectionDate} from "../../helpers/systemStatusHelpers";
import {SystemAdditionalDetailsCard} from "./SystemAdditionalDetailsCard";
import ContactLinkIcon from "../ContactLinkIcon";

const GROUP_META = {
  identity: {title: "System Identity", icon: FileText},
  condition: {title: "Condition & Lifecycle", icon: Gauge},
  inspection: {title: "Inspection Schedule", icon: Calendar},
  issues: {title: "Known Issues", icon: AlertTriangle},
};

function AdditionalAndLinkedCards({
  additionalDetails = [],
  propertyDocuments = [],
  linkedRecords,
}) {
  return (
    <>
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
    </>
  );
}

function ReadOnlyField({item}) {
  if (
    item.isCondition &&
    item.value != null &&
    String(item.value).trim() !== ""
  ) {
    return (
      <div className="min-w-0">
        <div className="text-xs text-neutral-500 dark:text-neutral-400">
          {item.label}
        </div>
        <div className="mt-1">
          <StatusBadge tone={conditionTone(item.value)}>
            {item.value}
          </StatusBadge>
        </div>
      </div>
    );
  }
  const displayValue =
    item.contactId != null && item.value != null && String(item.value).trim() !== "" ? (
      <span className="inline-flex items-center gap-1.5">
        {item.value}
        <ContactLinkIcon contactId={item.contactId} />
      </span>
    ) : (
      item.value
    );
  return <LabelValue label={item.label} value={displayValue} />;
}

/**
 * Read-only overview cards — same fields and layout as SystemEditableFormCards.
 */
export function SystemReadOnlyFormCards({
  systemId,
  propertyData,
  groups,
  additionalDetails = [],
  propertyDocuments = [],
  linkedRecords = [],
  lastInspectionDate,
}) {
  const fieldGroups = groupFieldsBySystemId(systemId);
  const lastInspectionField = fieldGroups.inspection?.find((f) =>
    /LastInspection$/.test(f),
  );
  const nextInspectionField =
    findNextInspectionFieldName(fieldGroups) ??
    fieldGroups.inspection?.find((f) => /NextInspection$/.test(f));
  const nextInspectionDef = nextInspectionField
    ? SYSTEM_FIELD_DEFINITIONS[nextInspectionField]
    : null;
  const nextInspectionRaw = nextInspectionField
    ? propertyData?.[nextInspectionField]
    : null;
  const displayNextInspection = resolveDisplayNextInspectionDate(
    nextInspectionRaw,
    lastInspectionDate,
  );
  const nextInspectionLabel = nextInspectionDef?.label ?? "Next Inspection";

  const issuesItems = groups.issues ?? [];
  const issuesText = issuesItems
    .map((i) => i.value)
    .filter((v) => v != null && String(v).trim() !== "")
    .join("\n");

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
      {["identity", "condition", "inspection"].map((groupKey) => {
        const items = groups[groupKey] ?? [];
        if (!items.length && groupKey !== "inspection") return null;
        const meta = GROUP_META[groupKey];

        if (groupKey === "inspection") {
          const otherItems = items.filter(
            (i) => i.fieldName !== nextInspectionField,
          );
          const displayItems = otherItems.map((item) =>
            item.fieldName === lastInspectionField && lastInspectionDate
              ? {
                  ...item,
                  value:
                    formatOverviewDate(lastInspectionDate) ??
                    lastInspectionDate,
                }
              : item,
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
                    {nextInspectionLabel}
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
              <div className="grid grid-cols-1 gap-y-3">
                {displayItems.map((item) => (
                  <ReadOnlyField key={item.fieldName} item={item} />
                ))}
                {nextInspectionField &&
                  items.some((i) => i.fieldName === nextInspectionField) && (
                    <ReadOnlyField
                      key={nextInspectionField}
                      item={items.find(
                        (i) => i.fieldName === nextInspectionField,
                      )}
                    />
                  )}
              </div>
            </SectionCard>
          );
        }

        return (
          <SectionCard flat key={groupKey} title={meta.title} icon={meta.icon}>
            <div className="grid grid-cols-1 gap-y-3">
              {items.map((item) => (
                <ReadOnlyField key={item.fieldName} item={item} />
              ))}
            </div>
          </SectionCard>
        );
      })}

      <SectionCard flat title="Known Issues" icon={AlertTriangle}>
        {issuesText ? (
          <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-line">
            {issuesText}
          </p>
        ) : (
          <div className="flex items-start gap-2.5 text-sm text-neutral-600 dark:text-neutral-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
            <span>
              No known issues reported. Continue regular inspections to keep
              this system in good shape.
            </span>
          </div>
        )}
      </SectionCard>

      <AdditionalAndLinkedCards
        additionalDetails={additionalDetails}
        propertyDocuments={propertyDocuments}
        linkedRecords={linkedRecords}
      />
    </div>
  );
}

/** Read-only custom system — mirrors SystemCustomFormCards field layout. */
export function SystemCustomReadOnlyFormCards({
  groups,
  additionalDetails = [],
  propertyDocuments = [],
  linkedRecords = [],
  nextInspectionValue,
  lastInspectionValue,
}) {
  const displayNextInspection = resolveDisplayNextInspectionDate(
    nextInspectionValue,
    lastInspectionValue,
  );
  const issuesText = (groups.issues ?? [])
    .map((i) => i.value)
    .filter((v) => v != null && String(v).trim() !== "")
    .join("\n");

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
      {["identity", "condition", "inspection"].map((groupKey) => {
        const items = (groups[groupKey] ?? [])
          .filter((i) => i.fieldName !== "nextInspection")
          .map((item) =>
            item.fieldName === "lastInspection" && lastInspectionValue
              ? {
                  ...item,
                  value:
                    formatOverviewDate(lastInspectionValue) ??
                    lastInspectionValue,
                }
              : item,
          );
        if (!items.length && groupKey !== "inspection") return null;
        const meta = GROUP_META[groupKey];

        if (groupKey === "inspection") {
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
                    Next Inspection
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
              <div className="grid grid-cols-1 gap-y-3">
                {items.map((item) => (
                  <ReadOnlyField key={item.fieldName} item={item} />
                ))}
                {(groups.inspection ?? []).find(
                  (i) => i.fieldName === "nextInspection",
                ) && (
                  <ReadOnlyField
                    item={groups.inspection.find(
                      (i) => i.fieldName === "nextInspection",
                    )}
                  />
                )}
              </div>
            </SectionCard>
          );
        }

        return (
          <SectionCard flat key={groupKey} title={meta.title} icon={meta.icon}>
            <div className="grid grid-cols-1 gap-y-3">
              {items.map((item) => (
                <ReadOnlyField key={item.fieldName} item={item} />
              ))}
            </div>
          </SectionCard>
        );
      })}

      <SectionCard flat title="Known Issues" icon={AlertTriangle}>
        {issuesText ? (
          <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-line">
            {issuesText}
          </p>
        ) : (
          <div className="flex items-start gap-2.5 text-sm text-neutral-600 dark:text-neutral-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
            <span>No known issues reported.</span>
          </div>
        )}
      </SectionCard>

      <AdditionalAndLinkedCards
        additionalDetails={additionalDetails}
        propertyDocuments={propertyDocuments}
        linkedRecords={linkedRecords}
      />
    </div>
  );
}

/** Read-only inspections system — mirrors SystemInspectionsFormCards. */
export function SystemInspectionsReadOnlyFormCards({
  groups,
  additionalDetails = [],
  propertyDocuments = [],
  linkedRecords = [],
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
      <SectionCard
        flat
        title="Property Inspections"
        icon={FileText}
        className="md:col-span-2 xl:col-span-3"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6">
          {(groups.identity ?? []).map((item) => (
            <ReadOnlyField key={item.fieldName} item={item} />
          ))}
        </div>
      </SectionCard>

      <AdditionalAndLinkedCards
        additionalDetails={additionalDetails}
        propertyDocuments={propertyDocuments}
        linkedRecords={linkedRecords}
      />
    </div>
  );
}
