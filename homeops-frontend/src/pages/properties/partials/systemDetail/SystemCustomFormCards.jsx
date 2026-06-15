import React from "react";
import {
  FileText,
  Gauge,
  Calendar,
  AlertTriangle,
  Sparkles,
  ClipboardList,
  CheckCircle2,
  AlertTriangle as AlertTri,
} from "lucide-react";
import SectionCard from "../passport/SectionCard";
import Tooltip from "../../../../utils/Tooltip";
import { Info } from "lucide-react";
import DatePickerInput from "../../../../components/DatePickerInput";
import InstallerSelect from "../InstallerSelect";
import { STANDARD_CUSTOM_SYSTEM_FIELDS } from "../../constants/propertySystems";
import {
  getAgeFromInstallDate,
  formatAgeFromInstallDate,
} from "../../constants/systemSections";
import { formatOverviewDate } from "../passport/SystemsOverviewPanel";
import { resolveDisplayNextInspectionDate } from "../../helpers/systemStatusHelpers";

const GROUP_FOR_KEY = {
  material: "identity",
  installDate: "identity",
  installer: "identity",
  age: "identity",
  condition: "condition",
  warranty: "condition",
  lastInspection: "inspection",
  nextInspection: "inspection",
  issues: "issues",
};

const GROUP_META = {
  identity: { title: "System Identity", icon: FileText },
  condition: { title: "Condition & Lifecycle", icon: Gauge },
  inspection: { title: "Inspection Schedule", icon: Calendar },
  issues: { title: "Known Issues", icon: AlertTriangle },
};

function CustomField({
  field,
  systemName,
  systemData,
  handleInputChange,
  contacts,
  isNewInstall,
}) {
  const name = `customSystem_${systemName}::${field.key}`;
  const value = systemData[field.key] ?? "";

  const labelEl = (
    <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
      {field.label}
      {field.key === "age" && (
        <>
          {" "}
          <Tooltip content="Calculated from install date" position="right">
            <Info className="w-3.5 h-3.5 inline-block ml-0.5 align-middle text-gray-400 cursor-help" />
          </Tooltip>
        </>
      )}
      {field.key === "lastInspection" && (
        <>
          {" "}
          <Tooltip content="Disabled when marked as new installation" position="right">
            <Info className="w-3.5 h-3.5 inline-block ml-0.5 align-middle text-gray-400 cursor-help" />
          </Tooltip>
        </>
      )}
    </label>
  );

  if (field.type === "computed-age") {
    return (
      <div>
        {labelEl}
        <div className="form-input w-full bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
          {formatAgeFromInstallDate(
            getAgeFromInstallDate(systemData.installDate),
          )}
        </div>
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div>
        {labelEl}
        <select
          name={name}
          value={value}
          onChange={handleInputChange}
          className="form-select w-full"
        >
          <option value="">Select…</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === "warranty-select") {
    return (
      <div>
        {labelEl}
        <select name={name} value={value} onChange={handleInputChange} className="form-select w-full">
          <option value="">Select</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </div>
    );
  }

  if (field.type === "date") {
    return (
      <div>
        {labelEl}
        <DatePickerInput
          name={name}
          value={value}
          onChange={handleInputChange}
          disabled={field.key === "lastInspection" && isNewInstall}
        />
      </div>
    );
  }

  if (field.type === "installer") {
    return (
      <div>
        {labelEl}
        <InstallerSelect name={name} value={value} onChange={handleInputChange} contacts={contacts} />
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div className="md:col-span-2">
        {labelEl}
        <textarea
          name={name}
          value={value}
          onChange={handleInputChange}
          className="form-input w-full min-h-[80px]"
        />
      </div>
    );
  }

  return (
    <div>
      {labelEl}
      <input
        type="text"
        name={name}
        value={value}
        onChange={handleInputChange}
        className="form-input w-full"
      />
    </div>
  );
}

export function SystemCustomFormCards({
  systemName,
  systemData = {},
  handleInputChange,
  contacts,
  isNewInstall = false,
  aiFindings,
  linkedRecords = [],
  onUploadDocument,
  lastInspectionDate,
}) {
  const grouped = { identity: [], condition: [], inspection: [], issues: [] };
  for (const field of STANDARD_CUSTOM_SYSTEM_FIELDS) {
    const g = GROUP_FOR_KEY[field.key] ?? "identity";
    grouped[g].push(field);
  }

  const nextInspectionVal = systemData.nextInspection;
  const displayNextInspection = resolveDisplayNextInspectionDate(
    nextInspectionVal,
    lastInspectionDate,
  );
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
      {["identity", "condition", "inspection", "issues"].map((groupKey) => {
        const fields = grouped[groupKey];
        if (!fields?.length) return null;
        const meta = GROUP_META[groupKey];

        if (groupKey === "inspection") {
          const otherFields = fields.filter((f) => f.key !== "nextInspection");
          return (
            <SectionCard flat key={groupKey} title={meta.title} icon={meta.icon}>
              {displayNextInspection ? (
                <div className="rounded-xl bg-emerald-50/80 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 px-4 py-3 mb-3">
                  <p className="text-[10px] font-medium text-emerald-700/80 dark:text-emerald-300/80 uppercase tracking-[0.08em]">
                    Next Inspection
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
                {otherFields.map((field) => (
                  <CustomField
                    key={field.key}
                    field={field}
                    systemName={systemName}
                    systemData={systemData}
                    handleInputChange={handleInputChange}
                    contacts={contacts}
                    isNewInstall={isNewInstall}
                  />
                ))}
                {fields.find((f) => f.key === "nextInspection") && (
                  <CustomField
                    field={fields.find((f) => f.key === "nextInspection")}
                    systemName={systemName}
                    systemData={systemData}
                    handleInputChange={handleInputChange}
                    contacts={contacts}
                    isNewInstall={isNewInstall}
                  />
                )}
              </div>
            </SectionCard>
          );
        }

        return (
          <SectionCard flat key={groupKey} title={meta.title} icon={meta.icon}>
            <div className="grid grid-cols-1 gap-4">
              {fields.map((field) => (
                <CustomField
                  key={field.key}
                  field={field}
                  systemName={systemName}
                  systemData={systemData}
                  handleInputChange={handleInputChange}
                  contacts={contacts}
                  isNewInstall={isNewInstall}
                />
              ))}
            </div>
          </SectionCard>
        );
      })}

      <SectionCard
        flat
        title="AI-Extracted Insights"
        icon={Sparkles}
        action={
          onUploadDocument ? (
            <button
              type="button"
              onClick={onUploadDocument}
              className="text-xs font-medium text-[#456564] hover:text-[#34514f]"
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
                  <AlertTri className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
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
            No AI insights for this system yet.
          </p>
        )}
      </SectionCard>

      <SectionCard flat title="Linked Records" icon={ClipboardList}>
        <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {linkedRecords.map((rec) => (
            <li key={rec.label} className="flex items-center gap-3 py-2">
              <span className="text-sm text-neutral-700 dark:text-neutral-300 flex-1">
                {rec.label}
              </span>
              <span className="text-sm font-semibold tabular-nums">{rec.count}</span>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}
