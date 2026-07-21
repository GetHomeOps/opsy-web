import React, {useMemo, useState} from "react";
import {
  ChevronDown,
  ChevronRight,
  DoorOpen,
  Droplets,
  Fan,
  Home,
  Layers,
  Plug,
  Square,
  Wrench,
  Zap,
} from "lucide-react";
import SectionCard from "../../properties/partials/passport/SectionCard";
import {StatusBadge} from "../../properties/partials/passport/StatusBadge";
import EmptyStateCard from "../../properties/partials/passport/EmptyStateCard";
import ScoreGauge from "../components/ScoreGauge";
import SummaryStatCard from "../components/SummaryStatCard";
import SegmentDonut from "../components/SegmentDonut";
import MatchedProfessionalsList from "../components/MatchedProfessionalsList";
import TabSplitLayout from "../components/TabSplitLayout";
import {
  CONDITION_BADGE,
  CONDITION_COLORS,
  URGENCY_BADGE,
  URGENCY_LABELS,
  countSystemsByCondition,
  formatCostRange,
  formatRemainingLife,
  highPrioritySystems,
  selectRailProfessionals,
} from "../prePurchaseUtils";

const SYSTEM_ICONS = {
  roof: Home,
  foundation: Layers,
  exterior: Square,
  hvac: Fan,
  plumbing: Droplets,
  electrical: Zap,
  windows_doors: DoorOpen,
  interior: Home,
  appliances: Plug,
  other: Wrench,
};

function SystemIcon({systemKey}) {
  const Icon = SYSTEM_ICONS[systemKey] || Wrench;
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 shrink-0">
      <Icon className="w-4 h-4" aria-hidden />
    </span>
  );
}

export default function SystemsTab({analysis, onNavigateTab}) {
  const systems = analysis?.systems || [];
  const findings = analysis?.findings || [];
  const recommendations = analysis?.recommendations || [];
  const professionalMatches = analysis?.professionalMatches || [];

  const [openId, setOpenId] = useState(null);

  const healthCounts = useMemo(
    () => countSystemsByCondition(systems),
    [systems]
  );
  const priority = useMemo(() => highPrioritySystems(systems), [systems]);

  const findingsBySystem = useMemo(() => {
    const map = new Map();
    for (const f of findings) {
      const keys = [f.systemId, f.systemKey].filter(
        (k) => k != null && k !== ""
      );
      for (const key of new Set(keys)) {
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(f);
      }
    }
    return map;
  }, [findings]);

  const recsBySystem = useMemo(() => {
    const map = new Map();
    for (const r of recommendations) {
      if (!r.systemKey) continue;
      if (!map.has(r.systemKey)) map.set(r.systemKey, []);
      map.get(r.systemKey).push(r);
    }
    return map;
  }, [recommendations]);

  const healthSegments = useMemo(
    () =>
      ["excellent", "good", "fair", "poor"]
        .filter((k) => healthCounts[k] > 0)
        .map((k) => ({
          label: k.charAt(0).toUpperCase() + k.slice(1),
          value: healthCounts[k],
          color: CONDITION_COLORS[k],
        })),
    [healthCounts]
  );

  const railPros = useMemo(
    () => selectRailProfessionals(professionalMatches, systems, 4),
    [professionalMatches, systems]
  );

  if (!systems.length) {
    return (
      <EmptyStateCard
        title="No systems detected"
        description="Systems will appear here after analysis completes."
      />
    );
  }

  const main = (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <SummaryStatCard title="Systems Overview">
          <ScoreGauge
            score={analysis?.overallConditionScore}
            rating={analysis?.overallConditionRating}
            compact
          />
        </SummaryStatCard>

        <SummaryStatCard title="Systems by Health">
          <ul className="space-y-2">
            {[
              ["excellent", "Excellent"],
              ["good", "Good"],
              ["fair", "Fair"],
              ["poor", "Poor"],
            ].map(([key, label]) => (
              <li
                key={key}
                className="flex items-center justify-between text-sm gap-2"
              >
                <span className="inline-flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{backgroundColor: CONDITION_COLORS[key]}}
                  />
                  {label}
                </span>
                <span className="font-bold tabular-nums text-neutral-900 dark:text-white">
                  {healthCounts[key] || 0}
                </span>
              </li>
            ))}
          </ul>
        </SummaryStatCard>

        <SummaryStatCard title="Estimated Total Repair Range">
          <p className="text-xl font-bold text-neutral-900 dark:text-white tabular-nums">
            {formatCostRange(analysis?.repairCostLow, analysis?.repairCostHigh)}
          </p>
          {analysis?.repairConfidence && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-neutral-500">Confidence</span>
              <StatusBadge
                tone={
                  analysis.repairConfidence === "high"
                    ? "emerald"
                    : analysis.repairConfidence === "medium"
                      ? "amber"
                      : "neutral"
                }
                className="capitalize"
              >
                {analysis.repairConfidence}
              </StatusBadge>
            </div>
          )}
        </SummaryStatCard>

        <SummaryStatCard title="High Priority Systems">
          {priority.length === 0 ? (
            <p className="text-sm text-neutral-500">No high-priority systems.</p>
          ) : (
            <ul className="space-y-2">
              {priority.slice(0, 4).map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="font-medium text-neutral-800 dark:text-neutral-200 truncate">
                    {s.systemLabel}
                  </span>
                  <StatusBadge
                    tone={URGENCY_BADGE[s.urgency] || "red"}
                    className="capitalize shrink-0"
                  >
                    {URGENCY_LABELS[s.urgency] || s.condition || "High"}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </SummaryStatCard>
      </div>

      <SectionCard title="Property Systems" description="Expand a system for findings, actions, and evidence">
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-500 border-b border-neutral-100 dark:border-neutral-800">
                <th className="py-2 pr-2 font-semibold w-8" />
                <th className="py-2 pr-3 font-semibold">System</th>
                <th className="py-2 pr-3 font-semibold">Condition</th>
                <th className="py-2 pr-3 font-semibold">Urgency</th>
                <th className="py-2 pr-3 font-semibold">Issues</th>
                <th className="py-2 pr-3 font-semibold">Est. Repair Range</th>
                <th className="py-2 font-semibold">Remaining Life / Next Service</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {systems.map((s) => {
                const open = openId === s.id;
                const systemFindings =
                  findingsBySystem.get(s.id) ||
                  findingsBySystem.get(s.systemKey) ||
                  [];
                const systemRecs = recsBySystem.get(s.systemKey) || [];
                const life = formatRemainingLife(s);
                return (
                  <React.Fragment key={s.id}>
                    <tr
                      className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/30 cursor-pointer"
                      onClick={() => setOpenId(open ? null : s.id)}
                    >
                      <td className="py-3 pr-1 align-middle text-neutral-400">
                        {open ? (
                          <ChevronDown className="w-4 h-4" aria-hidden />
                        ) : (
                          <ChevronRight className="w-4 h-4" aria-hidden />
                        )}
                      </td>
                      <td className="py-3 pr-3 align-middle">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <SystemIcon systemKey={s.systemKey} />
                          <span className="font-semibold text-neutral-900 dark:text-white truncate">
                            {s.systemLabel}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-3 align-middle">
                        {s.condition ? (
                          <StatusBadge
                            tone={CONDITION_BADGE[s.condition] || "neutral"}
                            className="capitalize"
                          >
                            {s.condition}
                          </StatusBadge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3 pr-3 align-middle">
                        {s.urgency ? (
                          <StatusBadge
                            tone={URGENCY_BADGE[s.urgency] || "neutral"}
                          >
                            {URGENCY_LABELS[s.urgency] || s.urgency}
                          </StatusBadge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3 pr-3 align-middle tabular-nums text-neutral-700 dark:text-neutral-300">
                        {s.issuesCount ?? systemFindings.length ?? 0}
                      </td>
                      <td className="py-3 pr-3 align-middle tabular-nums text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                        {formatCostRange(s.repairCostLow, s.repairCostHigh)}
                      </td>
                      <td className="py-3 align-middle">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 whitespace-nowrap">
                            {life.primary}
                          </p>
                          {life.secondary && (
                            <p className="text-[11px] text-neutral-500 mt-0.5">
                              Next: {life.secondary}
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={7} className="pb-4 pt-0">
                          <div className="ml-8 rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-800/30 p-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">
                                  Key Findings
                                </p>
                                {systemFindings.length === 0 ? (
                                  <p className="text-sm text-neutral-500">
                                    No findings linked to this system.
                                  </p>
                                ) : (
                                  <ul className="space-y-1.5">
                                    {systemFindings.slice(0, 4).map((f) => (
                                      <li
                                        key={f.id}
                                        className="text-sm text-neutral-700 dark:text-neutral-300 leading-snug"
                                      >
                                        • {f.title}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                {onNavigateTab && (
                                  <button
                                    type="button"
                                    className="mt-2 text-xs font-semibold text-[#456564] hover:underline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onNavigateTab("issues", {
                                        systemKey: s.systemKey,
                                        from: "systems",
                                      });
                                    }}
                                  >
                                    View full details →
                                  </button>
                                )}
                              </div>
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">
                                  Recommended Actions
                                </p>
                                {systemRecs.length === 0 ? (
                                  <p className="text-sm text-neutral-500">
                                    No recommendations for this system.
                                  </p>
                                ) : (
                                  <ul className="space-y-1.5">
                                    {systemRecs.slice(0, 4).map((r) => (
                                      <li
                                        key={r.id}
                                        className="text-sm text-neutral-700 dark:text-neutral-300 leading-snug"
                                      >
                                        • {r.title}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                {onNavigateTab && (
                                  <button
                                    type="button"
                                    className="mt-2 text-xs font-semibold text-[#456564] hover:underline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onNavigateTab("recommendations", {
                                        systemKey: s.systemKey,
                                      });
                                    }}
                                  >
                                    View recommendations →
                                  </button>
                                )}
                              </div>
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">
                                  Evidence
                                </p>
                                <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                                  {s.evidenceSummary ||
                                    "No evidence summary available."}
                                </p>
                                {Array.isArray(s.evidenceSources) &&
                                  s.evidenceSources.length > 0 && (
                                    <ul className="mt-2 space-y-1">
                                      {s.evidenceSources
                                        .slice(0, 3)
                                        .map((src, i) => (
                                          <li
                                            key={i}
                                            className="text-xs text-neutral-600 dark:text-neutral-400 italic"
                                          >
                                            “{src.excerpt || src}”
                                            {src.pageReference
                                              ? ` — ${src.pageReference}`
                                              : ""}
                                          </li>
                                        ))}
                                    </ul>
                                  )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </>
  );

  const rail = (
    <>
      <SectionCard title="Systems Health Overview">
        <SegmentDonut
          segments={
            healthSegments.length
              ? healthSegments
              : [
                  {
                    label: "Unknown",
                    value: systems.length,
                    color: CONDITION_COLORS.unknown,
                  },
                ]
          }
          size={132}
          centerLabel={systems.length}
          centerSubLabel="systems"
        />
      </SectionCard>

      <SectionCard title="Top Priority Systems">
        {priority.length === 0 ? (
          <p className="text-sm text-neutral-500">No priority systems flagged.</p>
        ) : (
          <ul className="space-y-2.5">
            {priority.slice(0, 5).map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-neutral-900 dark:text-white truncate">
                    {s.systemLabel}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {s.issuesCount ?? 0} issues
                  </p>
                </div>
                <StatusBadge tone={URGENCY_BADGE[s.urgency] || "red"}>
                  {URGENCY_LABELS[s.urgency] || "High"}
                </StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Matched Professionals">
        <MatchedProfessionalsList
          matches={railPros}
          limit={4}
          emptyMessage="Add professionals to your directory to see matches."
        />
        <p className="text-[11px] text-neutral-400 mt-3">
          Pre-screened from your directory based on system needs and location.
        </p>
      </SectionCard>
    </>
  );

  return <TabSplitLayout main={main} rail={rail} />;
}
