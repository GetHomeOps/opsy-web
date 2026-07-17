import React, {useEffect, useMemo, useState} from "react";
import {Link, useParams} from "react-router-dom";
import {
  Clock,
  DollarSign,
  Fan,
  Home,
  Lightbulb,
  ShieldAlert,
  Sparkles,
  Wrench,
} from "lucide-react";
import AppApi from "../../../api/api";
import SectionCard from "../../properties/partials/passport/SectionCard";
import {StatusBadge} from "../../properties/partials/passport/StatusBadge";
import EmptyStateCard from "../../properties/partials/passport/EmptyStateCard";
import SummaryStatCard from "../components/SummaryStatCard";
import SegmentDonut from "../components/SegmentDonut";
import MatchedProfessionalsList from "../components/MatchedProfessionalsList";
import TabSplitLayout from "../components/TabSplitLayout";
import {
  flattenCategoryHierarchy,
  buildProfessionalsSearchPath,
} from "../systemCategoryMap";
import {
  URGENCY_BADGE,
  URGENCY_LABELS,
  URGENCY_TIMING,
  formatCostRange,
  formatCurrency,
  findingMidCost,
  sumFindingCostsByUrgency,
} from "../prePurchaseUtils";

const GROUP_ORDER = ["immediate", "near_term", "long_term", "monitor"];

const GROUP_META = {
  immediate: {
    label: "Immediate Actions",
    subtitle: "High priority items that need attention",
    tone: "red",
    iconClass: "text-red-600 bg-red-50 dark:bg-red-950/40",
    Icon: ShieldAlert,
    color: "#dc2626",
  },
  near_term: {
    label: "Near-Term Improvements",
    subtitle: "Important upgrades in the next 6 months",
    tone: "amber",
    iconClass: "text-amber-600 bg-amber-50 dark:bg-amber-950/40",
    Icon: Clock,
    color: "#d97706",
  },
  long_term: {
    label: "Longer-Term Projects",
    subtitle: "Plan within 1–2 years",
    tone: "brand",
    iconClass: "text-[#456564] bg-[#456564]/10",
    Icon: Wrench,
    color: "#456564",
  },
  monitor: {
    label: "Preventive Maintenance",
    subtitle: "Routine items to protect your home",
    tone: "neutral",
    iconClass: "text-sky-600 bg-sky-50 dark:bg-sky-950/40",
    Icon: Lightbulb,
    color: "#0284c7",
  },
};

const SYSTEM_ICONS = {
  roof: Home,
  hvac: Fan,
  other: Wrench,
};

function RecIcon({systemKey, urgencyGroup}) {
  const Icon = SYSTEM_ICONS[systemKey] || GROUP_META[urgencyGroup]?.Icon || Sparkles;
  const iconClass =
    GROUP_META[urgencyGroup]?.iconClass ||
    "text-[#456564] bg-[#456564]/10";
  return (
    <span
      className={`inline-flex items-center justify-center w-10 h-10 rounded-lg shrink-0 ${iconClass}`}
    >
      <Icon className="w-5 h-5" aria-hidden />
    </span>
  );
}

export default function RecommendationsTab({
  analysis,
  initialSystemKey,
  onNavigateTab,
}) {
  const {accountUrl} = useParams();
  const recommendations = analysis?.recommendations || [];
  const findings = analysis?.findings || [];
  const professionalMatches = analysis?.professionalMatches || [];

  const [priority, setPriority] = useState("all");
  const [systemKey, setSystemKey] = useState(initialSystemKey || "all");
  const [sort, setSort] = useState("priority");
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    if (initialSystemKey) setSystemKey(initialSystemKey);
  }, [initialSystemKey]);

  useEffect(() => {
    let cancelled = false;
    async function loadCats() {
      try {
        const hierarchy = await AppApi.getProfessionalCategoryHierarchy();
        if (!cancelled) {
          setCategories(flattenCategoryHierarchy(hierarchy || []));
        }
      } catch {
        if (!cancelled) setCategories([]);
      }
    }
    loadCats();
    return () => {
      cancelled = true;
    };
  }, []);

  const systems = useMemo(() => {
    const map = new Map();
    for (const r of recommendations) {
      if (r.systemKey) {
        map.set(
          r.systemKey,
          String(r.systemKey).replace(/_/g, " ")
        );
      }
    }
    for (const f of findings) {
      if (f.systemKey) map.set(f.systemKey, f.systemLabel || f.systemKey);
    }
    return [...map.entries()];
  }, [recommendations, findings]);

  const findingsById = useMemo(() => {
    const map = new Map();
    for (const f of findings) map.set(f.id, f);
    return map;
  }, [findings]);

  const findingsBySystem = useMemo(() => {
    const map = new Map();
    for (const f of findings) {
      if (!f.systemKey) continue;
      if (!map.has(f.systemKey)) map.set(f.systemKey, []);
      map.get(f.systemKey).push(f);
    }
    return map;
  }, [findings]);

  function linkedFinding(r) {
    if (r.findingId && findingsById.has(r.findingId)) {
      return findingsById.get(r.findingId);
    }
    const list = findingsBySystem.get(r.systemKey) || [];
    return list.find((f) => f.severity === "major") || list[0] || null;
  }

  function estCost(r) {
    const f = linkedFinding(r);
    if (!f) return {low: null, high: null};
    return {low: f.estimatedCostLow, high: f.estimatedCostHigh};
  }

  const counts = useMemo(() => {
    const c = {immediate: 0, near_term: 0, long_term: 0, monitor: 0};
    for (const r of recommendations) {
      const key = GROUP_ORDER.includes(r.urgencyGroup)
        ? r.urgencyGroup
        : "near_term";
      c[key] += 1;
    }
    return c;
  }, [recommendations]);

  const budgetTotal =
    analysis?.repairCostHigh != null
      ? Number(analysis.repairCostHigh)
      : findings.reduce((sum, f) => sum + findingMidCost(f), 0);

  const costByUrgency = useMemo(
    () => sumFindingCostsByUrgency(findings),
    [findings]
  );

  const filtered = useMemo(() => {
    let rows = [...recommendations];
    if (priority !== "all") {
      rows = rows.filter((r) => r.urgencyGroup === priority);
    }
    if (systemKey !== "all") {
      rows = rows.filter((r) => r.systemKey === systemKey);
    }

    const resolveFinding = (r) => {
      if (r.findingId && findingsById.has(r.findingId)) {
        return findingsById.get(r.findingId);
      }
      const list = findingsBySystem.get(r.systemKey) || [];
      return list.find((f) => f.severity === "major") || list[0] || null;
    };

    rows.sort((a, b) => {
      if (sort === "cost") {
        return findingMidCost(resolveFinding(b) || {}) - findingMidCost(resolveFinding(a) || {});
      }
      const ai = GROUP_ORDER.indexOf(a.urgencyGroup);
      const bi = GROUP_ORDER.indexOf(b.urgencyGroup);
      return (ai < 0 ? 9 : ai) - (bi < 0 ? 9 : bi);
    });
    return rows;
  }, [recommendations, priority, systemKey, sort, findingsById, findingsBySystem]);

  const grouped = useMemo(() => {
    const map = Object.fromEntries(GROUP_ORDER.map((k) => [k, []]));
    for (const r of filtered) {
      const key = GROUP_ORDER.includes(r.urgencyGroup)
        ? r.urgencyGroup
        : "near_term";
      map[key].push(r);
    }
    return map;
  }, [filtered]);

  const timelineBuckets = useMemo(() => {
    return [
      {key: "immediate", label: "Now", amount: costByUrgency.immediate},
      {key: "near_term", label: "6 Months", amount: costByUrgency.near_term},
      {key: "long_term", label: "1–2 Years", amount: costByUrgency.long_term},
      {key: "monitor", label: "Ongoing", amount: costByUrgency.monitor},
    ];
  }, [costByUrgency]);

  const budgetSegments = useMemo(
    () =>
      GROUP_ORDER.map((key) => ({
        label: GROUP_META[key].label,
        value: Math.round(costByUrgency[key] || 0),
        color: GROUP_META[key].color,
        showPct: true,
      })).filter((s) => s.value > 0),
    [costByUrgency]
  );

  function prosPath(systemKeyForRec) {
    return buildProfessionalsSearchPath({
      accountUrl,
      systemKey: systemKeyForRec || "other",
      categories,
      city: analysis?.city,
      state: analysis?.state,
    });
  }

  if (!recommendations.length) {
    return (
      <EmptyStateCard
        title="No recommendations yet"
        description="Recommendations will appear after analysis completes."
      />
    );
  }

  const main = (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <SummaryStatCard
          title="Immediate Actions"
          icon={ShieldAlert}
          iconClassName={GROUP_META.immediate.iconClass}
        >
          <p className="text-3xl font-bold tabular-nums text-neutral-900 dark:text-white">
            {counts.immediate}
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            High priority items that need attention.
          </p>
        </SummaryStatCard>
        <SummaryStatCard
          title="Near-Term Improvements"
          icon={Clock}
          iconClassName={GROUP_META.near_term.iconClass}
        >
          <p className="text-3xl font-bold tabular-nums text-neutral-900 dark:text-white">
            {counts.near_term}
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            Important upgrades in the next 6 months.
          </p>
        </SummaryStatCard>
        <SummaryStatCard
          title="Preventive Maintenance"
          icon={Lightbulb}
          iconClassName={GROUP_META.monitor.iconClass}
        >
          <p className="text-3xl font-bold tabular-nums text-neutral-900 dark:text-white">
            {counts.monitor + counts.long_term}
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            Routine maintenance items to protect your home.
          </p>
        </SummaryStatCard>
        <SummaryStatCard
          title="Estimated Budget Plan"
          icon={DollarSign}
          iconClassName="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
        >
          <p className="text-2xl font-bold tabular-nums text-neutral-900 dark:text-white">
            {formatCurrency(budgetTotal)}
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            Total recommended investment.
          </p>
        </SummaryStatCard>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/80 dark:bg-neutral-800/40 px-3 py-2.5">
        <select
          className="form-select py-1.5 text-sm"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          aria-label="Filter by priority"
        >
          <option value="all">All Priorities</option>
          {GROUP_ORDER.map((k) => (
            <option key={k} value={k}>
              {GROUP_META[k].label}
            </option>
          ))}
        </select>
        <select
          className="form-select py-1.5 text-sm"
          value={systemKey}
          onChange={(e) => setSystemKey(e.target.value)}
          aria-label="Filter by system"
        >
          <option value="all">All Systems</option>
          {systems.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <select
          className="form-select py-1.5 text-sm"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          aria-label="Sort recommendations"
        >
          <option value="priority">Sort: Priority (High → Low)</option>
          <option value="cost">Sort: Cost</option>
        </select>
        <span className="inline-flex items-center text-xs text-neutral-500 px-2">
          Group by Urgency
        </span>
      </div>

      <div className="space-y-5">
        {GROUP_ORDER.map((key) => {
          const items = grouped[key];
          if (!items?.length) return null;
          const meta = GROUP_META[key];
          return (
            <SectionCard
              key={key}
              title={`${meta.label} (${items.length})`}
              description={meta.subtitle}
            >
              <ul className="space-y-2">
                {items.map((r) => {
                  const finding = linkedFinding(r);
                  const cost = estCost(r);
                  const systemLabel =
                    finding?.systemLabel ||
                    (r.systemKey
                      ? String(r.systemKey).replace(/_/g, " ")
                      : null);
                  return (
                    <li
                      key={r.id}
                      className="rounded-xl border border-neutral-200 dark:border-neutral-700 px-3 py-2.5 md:px-4 md:py-3"
                    >
                      <div className="flex flex-col xl:flex-row xl:items-center gap-3">
                        <div className="flex gap-3 min-w-0 flex-1">
                          <RecIcon
                            systemKey={r.systemKey}
                            urgencyGroup={r.urgencyGroup}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-sm font-semibold text-neutral-900 dark:text-white leading-snug">
                                {r.title}
                              </h4>
                              <StatusBadge
                                tone={URGENCY_BADGE[r.urgencyGroup] || "neutral"}
                              >
                                {URGENCY_LABELS[r.urgencyGroup] || r.urgencyGroup}
                              </StatusBadge>
                            </div>
                            <p className="text-xs text-neutral-500 mt-0.5 capitalize">
                              {systemLabel ? `System: ${systemLabel}` : null}
                              {finding?.title
                                ? `${systemLabel ? " • " : ""}Issue: ${finding.title}`
                                : null}
                            </p>
                            {r.description && (
                              <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 leading-snug line-clamp-2">
                                {r.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 shrink-0 xl:pl-2">
                          <div className="min-w-[7rem]">
                            <p className="text-[10px] uppercase tracking-wide text-neutral-400">
                              Recommended Timing
                            </p>
                            <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 whitespace-nowrap">
                              {URGENCY_TIMING[r.urgencyGroup] || "—"}
                            </p>
                          </div>
                          <div className="min-w-[7rem]">
                            <p className="text-[10px] uppercase tracking-wide text-neutral-400">
                              Est. Cost Range
                            </p>
                            <p className="text-sm font-semibold tabular-nums text-neutral-900 dark:text-white whitespace-nowrap">
                              {formatCostRange(cost.low, cost.high)}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 ml-auto xl:ml-0">
                            {onNavigateTab && (
                              <button
                                type="button"
                                className="btn-sm border text-xs"
                                onClick={() =>
                                  onNavigateTab("issues", {
                                    systemKey: r.systemKey,
                                    findingId: finding?.id || r.findingId,
                                    from: "recommendations",
                                  })
                                }
                              >
                                View Issue
                              </button>
                            )}
                            <Link
                              to={prosPath(r.systemKey)}
                              className="btn-sm bg-[#456564] text-white hover:bg-[#3a5554] text-xs border-transparent"
                            >
                              Match Pros
                            </Link>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </SectionCard>
          );
        })}
      </div>

      <SectionCard title="Your Recommended Action Plan">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {timelineBuckets.map((b) => (
            <div
              key={b.key}
              className="rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-800/30 px-3 py-3 text-center"
            >
              <p className="text-[11px] uppercase tracking-wide text-neutral-500">
                {b.label}
              </p>
              <p className="text-lg font-bold tabular-nums text-neutral-900 dark:text-white mt-1">
                {formatCurrency(b.amount)}
              </p>
            </div>
          ))}
        </div>
      </SectionCard>
    </>
  );

  const activeGroups = GROUP_ORDER.filter((k) => counts[k] > 0).length;

  const rail = (
    <>
      <SectionCard title="Budget Allocation">
        <SegmentDonut
          segments={
            budgetSegments.length
              ? budgetSegments
              : [
                  {
                    label: "Budget",
                    value: Math.round(budgetTotal) || 1,
                    color: "#456564",
                    showPct: false,
                  },
                ]
          }
          size={140}
          centerLabel={formatCurrency(budgetTotal)}
          centerSubLabel="total"
          formatValue={formatCurrency}
        />
      </SectionCard>

      <SectionCard title="Action Plan Summary">
        <p className="text-3xl font-bold tabular-nums text-neutral-900 dark:text-white">
          {recommendations.length}
        </p>
        <p className="text-sm text-neutral-500 mt-1">
          actions across {activeGroups} urgency{" "}
          {activeGroups === 1 ? "group" : "groups"}
        </p>
      </SectionCard>

      <SectionCard title="Top Matched Professionals">
        <MatchedProfessionalsList
          matches={professionalMatches}
          limit={4}
          emptyMessage="Add professionals to your directory to see matches."
        />
      </SectionCard>
    </>
  );

  return <TabSplitLayout main={main} rail={rail} />;
}
