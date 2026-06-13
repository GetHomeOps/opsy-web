import React from "react";
import {
  FileText,
  Gauge,
  Calendar,
  AlertTriangle,
  Sparkles,
  ClipboardList,
  CheckCircle2,
  Wrench,
} from "lucide-react";
import SectionCard from "./SectionCard";
import {StatusBadge} from "./StatusBadge";
import LabelValue from "./LabelValue";
import {formatOverviewDate} from "./SystemsOverviewPanel";

function conditionTone(condition) {
  const c = String(condition ?? "").toLowerCase();
  if (c === "excellent" || c === "good") return "emerald";
  if (c === "fair") return "amber";
  if (c === "poor") return "red";
  return "neutral";
}

/**
 * Read-only card grid for a single system's detail view (Systems tab).
 * Purely presentational — data is prepared by SystemsTab.
 *
 * groups: { identity: [{label,value}], condition: [...], inspection: [...], issues: [...] }
 */
export function SystemDetailCards({
  groups = {identity: [], condition: [], inspection: [], issues: []},
  aiFindings = {needsAttention: [], maintenanceSuggestions: []},
  linkedRecords = [],
}) {
  const nextInspectionItem = (groups.inspection ?? []).find((i) =>
    /next inspection/i.test(i.label),
  );
  const otherInspectionItems = (groups.inspection ?? []).filter(
    (i) => i !== nextInspectionItem,
  );
  const issuesText = (groups.issues ?? [])
    .map((i) => i.value)
    .filter((v) => v != null && String(v).trim() !== "")
    .join("\n");
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
      {/* System Identity */}
      <SectionCard flat title="System Identity" icon={FileText}>
        <div className="grid grid-cols-1 gap-y-3">
          {(groups.identity ?? []).map((item) => (
            <LabelValue key={item.label} label={item.label} value={item.value} />
          ))}
        </div>
      </SectionCard>

      {/* Condition & Lifecycle */}
      <SectionCard flat title="Condition & Lifecycle" icon={Gauge}>
        <div className="grid grid-cols-1 gap-y-3">
          {(groups.condition ?? []).map((item) =>
            /condition/i.test(item.label) &&
            item.value != null &&
            String(item.value).trim() !== "" ? (
              <div key={item.label} className="min-w-0">
                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  {item.label}
                </div>
                <div className="mt-1">
                  <StatusBadge tone={conditionTone(item.value)}>
                    {item.value}
                  </StatusBadge>
                </div>
              </div>
            ) : (
              <LabelValue
                key={item.label}
                label={item.label}
                value={item.value}
              />
            ),
          )}
        </div>
      </SectionCard>

      {/* Inspection Schedule */}
      <SectionCard flat title="Inspection Schedule" icon={Calendar}>
        {nextInspectionItem?.value ? (
          <div className="rounded-xl bg-emerald-50/80 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 px-4 py-3 mb-3">
            <p className="text-[10px] font-medium text-emerald-700/80 dark:text-emerald-300/80 uppercase tracking-[0.08em]">
              Next Inspection
            </p>
            <p className="text-lg font-bold text-neutral-900 dark:text-white mt-0.5">
              {nextInspectionItem.value}
            </p>
          </div>
        ) : (
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-3">
            No inspection scheduled yet.
          </p>
        )}
        <div className="grid grid-cols-1 gap-y-3">
          {otherInspectionItems.map((item) => (
            <LabelValue key={item.label} label={item.label} value={item.value} />
          ))}
        </div>
      </SectionCard>

      {/* Known Issues */}
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

      {/* AI-Extracted Insights */}
      <SectionCard
        flat
        title="AI-Extracted Insights"
        description="Insights from documents, photos, and maintenance history"
        icon={Sparkles}
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

      {/* Linked Records */}
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

/** Right rail for the single-system detail view. */
export function SystemDetailRightRail({row, onEdit, isEditing}) {
  const percent = Math.round(row?.percent ?? 0);
  return (
    <>
      <SectionCard flat title="System Completion" icon={CheckCircle2}>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                percent >= 80
                  ? "bg-emerald-500"
                  : percent >= 50
                    ? "bg-emerald-400"
                    : percent >= 25
                      ? "bg-amber-400"
                      : "bg-neutral-300 dark:bg-neutral-600"
              }`}
              style={{width: `${percent}%`}}
            />
          </div>
          <span className="text-sm font-bold text-neutral-900 dark:text-white tabular-nums shrink-0">
            {percent}%
          </span>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
          {row?.filled ?? 0} of {row?.total ?? 0} fields documented
        </p>
        {!isEditing && percent < 100 && onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="mt-3 w-full inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#456564] hover:bg-[#34514f] transition-colors"
          >
            Complete Details
          </button>
        )}
      </SectionCard>

      <SectionCard flat title="Next Recommended Action" icon={Wrench}>
        {row?.nextDue ? (
          <div className="flex items-start gap-2.5">
            <Calendar
              className={`w-4 h-4 mt-0.5 shrink-0 ${
                row.nextDueOverdue ? "text-red-500" : "text-emerald-500"
              }`}
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                {row.nextDueOverdue ? "Service overdue" : "Upcoming service"}
              </p>
              <p
                className={`text-xs mt-0.5 ${
                  row.nextDueOverdue
                    ? "text-red-600 dark:text-red-400 font-medium"
                    : "text-neutral-500 dark:text-neutral-400"
                }`}
              >
                {formatOverviewDate(row.nextDue)}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            No service scheduled. Use Quick Actions or the Maintenance tab to
            plan the next visit for this system.
          </p>
        )}
      </SectionCard>
    </>
  );
}
