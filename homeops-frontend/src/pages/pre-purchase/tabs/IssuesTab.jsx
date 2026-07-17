import React, {useEffect, useMemo, useState} from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Info,
  Search,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import SectionCard from "../../properties/partials/passport/SectionCard";
import {StatusBadge} from "../../properties/partials/passport/StatusBadge";
import EmptyStateCard from "../../properties/partials/passport/EmptyStateCard";
import SummaryStatCard from "../components/SummaryStatCard";
import RepairRangeScale from "../components/RepairRangeScale";
import SegmentDonut from "../components/SegmentDonut";
import TabSplitLayout from "../components/TabSplitLayout";
import {
  PRE_PURCHASE_DISCLAIMER,
  SEVERITY_BADGE,
  SEVERITY_COLORS,
  URGENCY_BADGE,
  URGENCY_LABELS,
  formatCostRange,
  findingMidCost,
  negotiationImplication,
} from "../prePurchaseUtils";

const SEVERITY_RANK = {major: 0, moderate: 1, minor: 2};
const URGENCY_RANK = {immediate: 0, near_term: 1, long_term: 2, monitor: 3};

const FROM_LABELS = {
  recommendations: "Recommendations",
  systems: "Systems",
  overview: "Overview",
};

function IssueExpandPanel({finding, onAskAI}) {
  const excerpt = finding.sourceExcerpt || null;
  const evidenceNote =
    finding.evidence && finding.evidence !== finding.sourceExcerpt
      ? finding.evidence
      : null;
  const impactedArea =
    finding.impactedArea || finding.systemLabel || "Unspecified system";
  const impactedDetail = finding.evidence
    ? String(finding.evidence).slice(0, 180) +
      (String(finding.evidence).length > 180 ? "…" : "")
    : null;

  return (
    <div className="ml-8 sm:ml-9 rounded-xl border border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Evidence */}
        <div className="lg:col-span-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Evidence
          </p>
          {excerpt || evidenceNote ? (
            <div className="space-y-2">
              {excerpt && (
                <p className="text-xs text-neutral-600 dark:text-neutral-400 italic leading-relaxed">
                  “{excerpt}”
                </p>
              )}
              {evidenceNote && (
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  {evidenceNote}
                </p>
              )}
              {finding.pageReference && (
                <p className="text-[11px] text-neutral-500">
                  {finding.pageReference}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-neutral-500">
              No source evidence attached.
            </p>
          )}
        </div>

        {/* Impacted + Negotiation */}
        <div className="lg:col-span-7 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1.5">
              Impacted Area
            </p>
            <p className="text-sm font-medium text-neutral-900 dark:text-white">
              {impactedArea}
            </p>
            {impactedDetail && (
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1 leading-snug">
                {impactedDetail}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1.5">
              Negotiation Implication
            </p>
            <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
              {negotiationImplication(finding)}
            </p>
          </div>
          {finding.recommendedAction && (
            <p className="text-sm text-[#456564] dark:text-[#7aa3a2]">
              <span className="font-semibold">Recommended: </span>
              {finding.recommendedAction}
            </p>
          )}
        </div>

        {/* Compact AI affordance */}
        <div className="lg:col-span-1 flex lg:justify-end lg:items-start">
          <button
            type="button"
            title="Ask AI about this issue"
            aria-label="Ask AI about this issue"
            className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-[#456564] dark:text-[#7aa3a2] hover:bg-[#456564]/10 dark:hover:bg-[#456564]/20 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onAskAI?.(finding);
            }}
          >
            <Sparkles className="w-4 h-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function IssuesTab({
  analysis,
  initialSystemKey,
  highlightFindingId,
  navigationFrom,
  onNavigateTab,
  onAskAI,
}) {
  const findings = analysis?.findings || [];
  const recommendations = analysis?.recommendations || [];
  const counts = analysis?.issueCounts || {
    major: findings.filter((f) => f.severity === "major").length,
    moderate: findings.filter((f) => f.severity === "moderate").length,
    minor: findings.filter((f) => f.severity === "minor").length,
  };

  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("all");
  const [systemKey, setSystemKey] = useState(initialSystemKey || "all");
  const [urgency, setUrgency] = useState("all");
  const [sort, setSort] = useState("severity");
  const [openId, setOpenId] = useState(highlightFindingId || null);

  useEffect(() => {
    if (initialSystemKey) setSystemKey(initialSystemKey);
  }, [initialSystemKey]);

  useEffect(() => {
    if (highlightFindingId) setOpenId(highlightFindingId);
  }, [highlightFindingId]);

  const highlightedFinding = useMemo(
    () =>
      highlightFindingId
        ? findings.find((f) => f.id === highlightFindingId)
        : null,
    [findings, highlightFindingId]
  );

  const fromLabel = navigationFrom ? FROM_LABELS[navigationFrom] : null;
  const showBreadcrumb = Boolean(fromLabel && onNavigateTab);

  const systems = useMemo(() => {
    const map = new Map();
    for (const f of findings) {
      if (f.systemKey) map.set(f.systemKey, f.systemLabel || f.systemKey);
    }
    return [...map.entries()];
  }, [findings]);

  const immediateCount = useMemo(
    () => findings.filter((f) => f.urgency === "immediate").length,
    [findings]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = [...findings];
    if (severity !== "all") rows = rows.filter((f) => f.severity === severity);
    if (systemKey !== "all") rows = rows.filter((f) => f.systemKey === systemKey);
    if (urgency !== "all") rows = rows.filter((f) => f.urgency === urgency);
    if (q) {
      rows = rows.filter((f) => {
        const hay = [f.title, f.description, f.systemLabel, f.evidence, f.sourceExcerpt]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    rows.sort((a, b) => {
      if (sort === "cost") {
        return findingMidCost(b) - findingMidCost(a);
      }
      if (sort === "urgency") {
        return (URGENCY_RANK[a.urgency] ?? 9) - (URGENCY_RANK[b.urgency] ?? 9);
      }
      return (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9);
    });
    return rows;
  }, [findings, severity, systemKey, urgency, sort, search]);

  const severitySegments = useMemo(
    () =>
      [
        {key: "major", label: "Major", color: SEVERITY_COLORS.major},
        {key: "moderate", label: "Moderate", color: SEVERITY_COLORS.moderate},
        {key: "minor", label: "Minor", color: SEVERITY_COLORS.minor},
      ]
        .map((s) => ({...s, value: counts[s.key] || 0}))
        .filter((s) => s.value > 0),
    [counts]
  );

  const watchlist = useMemo(() => {
    return [...findings]
      .filter((f) => f.severity === "major" || f.urgency === "immediate")
      .sort((a, b) => findingMidCost(b) - findingMidCost(a))
      .slice(0, 5);
  }, [findings]);

  if (!findings.length) {
    return (
      <EmptyStateCard
        title="No issues found"
        description="Detected issues will appear here after analysis."
      />
    );
  }

  const main = (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <SummaryStatCard
          title="Major Issues"
          icon={ShieldAlert}
          iconClassName="text-red-600 bg-red-50 dark:bg-red-950/40"
        >
          <p className="text-3xl font-bold tabular-nums text-neutral-900 dark:text-white">
            {counts.major || 0}
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            Require immediate attention.
          </p>
        </SummaryStatCard>
        <SummaryStatCard
          title="Moderate Issues"
          icon={ShieldAlert}
          iconClassName="text-amber-600 bg-amber-50 dark:bg-amber-950/40"
        >
          <p className="text-3xl font-bold tabular-nums text-neutral-900 dark:text-white">
            {counts.moderate || 0}
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            Should be addressed in near term.
          </p>
        </SummaryStatCard>
        <SummaryStatCard
          title="Minor Issues"
          icon={ShieldAlert}
          iconClassName="text-sky-600 bg-sky-50 dark:bg-sky-950/40"
        >
          <p className="text-3xl font-bold tabular-nums text-neutral-900 dark:text-white">
            {counts.minor || 0}
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            Low cost or low priority fixes.
          </p>
        </SummaryStatCard>
        <SummaryStatCard
          title="Estimated Repair Range"
          icon={DollarSign}
          iconClassName="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
        >
          <p className="text-lg font-bold tabular-nums text-neutral-900 dark:text-white leading-tight">
            {formatCostRange(analysis?.repairCostLow, analysis?.repairCostHigh)}
          </p>
          <RepairRangeScale
            low={analysis?.repairCostLow}
            high={analysis?.repairCostHigh}
          />
        </SummaryStatCard>
        <SummaryStatCard
          title="Immediate Attention"
          icon={AlertTriangle}
          iconClassName="text-violet-600 bg-violet-50 dark:bg-violet-950/40"
        >
          <p className="text-3xl font-bold tabular-nums text-neutral-900 dark:text-white">
            {immediateCount}
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            High risk or safety concerns.
          </p>
        </SummaryStatCard>
      </div>

      {showBreadcrumb && (
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-sm min-w-0"
        >
          <button
            type="button"
            onClick={() =>
              onNavigateTab(navigationFrom, {
                systemKey:
                  initialSystemKey && initialSystemKey !== "all"
                    ? initialSystemKey
                    : undefined,
              })
            }
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 -ml-2 font-semibold text-[#456564] dark:text-[#7fa3a1] hover:bg-[#456564]/10 hover:text-[#3a5453] dark:hover:bg-[#5a7a78]/15 dark:hover:text-[#9bc0be] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#456564]/50 shrink-0"
          >
            {fromLabel}
          </button>
          <ChevronRight
            className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 shrink-0"
            aria-hidden
          />
          <span className="text-neutral-600 dark:text-neutral-300 truncate">
            {highlightedFinding?.title || "Issues"}
          </span>
        </nav>
      )}

      <SectionCard title="Issues">
        <div className="flex flex-col gap-3 mb-4">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400"
              aria-hidden
            />
            <input
              type="search"
              className="form-input w-full pl-9 py-2 text-sm"
              placeholder="Search issues..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search issues"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              className="form-select py-1.5 text-sm"
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              aria-label="Filter by severity"
            >
              <option value="all">All severities</option>
              <option value="major">Major</option>
              <option value="moderate">Moderate</option>
              <option value="minor">Minor</option>
            </select>
            <select
              className="form-select py-1.5 text-sm"
              value={systemKey}
              onChange={(e) => setSystemKey(e.target.value)}
              aria-label="Filter by system"
            >
              <option value="all">All systems</option>
              {systems.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <select
              className="form-select py-1.5 text-sm"
              value={urgency}
              onChange={(e) => setUrgency(e.target.value)}
              aria-label="Filter by urgency"
            >
              <option value="all">All urgencies</option>
              <option value="immediate">Immediate</option>
              <option value="near_term">Near term</option>
              <option value="long_term">Long term</option>
              <option value="monitor">Monitor</option>
            </select>
            <select
              className="form-select py-1.5 text-sm"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sort issues"
            >
              <option value="severity">Sort: Severity High → Low</option>
              <option value="urgency">Sort: Urgency</option>
              <option value="cost">Sort: Cost</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-500 border-b border-neutral-100 dark:border-neutral-800">
                <th className="py-2 pl-3 pr-1 font-semibold w-8" aria-hidden />
                <th className="py-2 pl-1 pr-3 font-semibold">Issue</th>
                <th className="py-2 pr-3 font-semibold">Severity</th>
                <th className="py-2 pr-3 font-semibold">System</th>
                <th className="py-2 pr-3 font-semibold">Cost Range</th>
                <th className="py-2 pr-3 font-semibold">Urgency</th>
                <th className="py-2 font-semibold">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {filtered.map((f) => {
                const open = openId === f.id;
                const source =
                  f.pageReference ||
                  (f.systemLabel ? `${f.systemLabel}` : null);
                return (
                  <React.Fragment key={f.id}>
                    <tr
                      className={`hover:bg-neutral-50/80 dark:hover:bg-neutral-800/30 cursor-pointer ${
                        f.severity === "major"
                          ? "bg-red-50/30 dark:bg-red-950/10"
                          : ""
                      }`}
                      onClick={() => setOpenId(open ? null : f.id)}
                    >
                      <td className="py-3 pl-3 pr-1 align-middle w-8">
                        <span className="inline-flex items-center justify-center text-neutral-400">
                          {open ? (
                            <ChevronDown className="w-4 h-4" aria-hidden />
                          ) : (
                            <ChevronRight className="w-4 h-4" aria-hidden />
                          )}
                        </span>
                      </td>
                      <td className="py-3 pl-1 pr-3 align-middle">
                        <div className="min-w-0">
                          <p className="font-semibold text-neutral-900 dark:text-white">
                            {f.title}
                          </p>
                          {f.description && (
                            <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1 max-w-md">
                              {f.description}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-3 align-middle">
                        <StatusBadge
                          tone={SEVERITY_BADGE[f.severity] || "neutral"}
                          className="capitalize"
                        >
                          {f.severity}
                        </StatusBadge>
                      </td>
                      <td className="py-3 pr-3 align-middle text-neutral-600 dark:text-neutral-400">
                        {f.systemLabel || "—"}
                      </td>
                      <td className="py-3 pr-3 align-middle tabular-nums whitespace-nowrap text-neutral-700 dark:text-neutral-300">
                        {formatCostRange(
                          f.estimatedCostLow,
                          f.estimatedCostHigh
                        )}
                      </td>
                      <td className="py-3 pr-3 align-middle">
                        {f.urgency ? (
                          <StatusBadge
                            tone={URGENCY_BADGE[f.urgency] || "neutral"}
                          >
                            {URGENCY_LABELS[f.urgency] || f.urgency}
                          </StatusBadge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3 align-middle text-xs text-neutral-500 max-w-[160px] truncate">
                        {source || f.sourceExcerpt?.slice(0, 40) || "—"}
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={7} className="pb-4 pt-0">
                          <IssueExpandPanel
                            finding={f}
                            onAskAI={onAskAI}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <p className="text-sm text-neutral-500 py-6 text-center">
            No issues match the current filters.
          </p>
        )}
      </SectionCard>

      <p className="text-xs text-neutral-500 flex gap-1.5 items-start px-1">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
        {PRE_PURCHASE_DISCLAIMER}
      </p>
    </>
  );

  const rail = (
    <>
      <SectionCard title="Issue Severity Breakdown">
        <SegmentDonut
          segments={
            severitySegments.length
              ? severitySegments
              : [{label: "None", value: 1, color: "#d1d5db", showPct: false}]
          }
          size={132}
          centerLabel={
            (counts.major || 0) + (counts.moderate || 0) + (counts.minor || 0)
          }
          centerSubLabel="issues"
        />
      </SectionCard>

      <SectionCard title="Negotiation Watchlist">
        {watchlist.length === 0 ? (
          <p className="text-sm text-neutral-500">No high-leverage items.</p>
        ) : (
          <ul className="space-y-2.5">
            {watchlist.map((f) => (
              <li key={f.id} className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
                    {f.title}
                  </p>
                  <p className="text-xs text-neutral-500">{f.systemLabel}</p>
                </div>
                <span className="text-xs font-semibold tabular-nums text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                  {formatCostRange(f.estimatedCostLow, f.estimatedCostHigh)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Recommended Next Steps">
        {recommendations.length === 0 ? (
          <p className="text-sm text-neutral-500">No recommendations yet.</p>
        ) : (
          <ul className="space-y-2">
            {recommendations.slice(0, 4).map((r, i) => (
              <li key={r.id} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 w-4 h-4 rounded border border-neutral-300 dark:border-neutral-600 shrink-0 flex items-center justify-center text-[10px] text-neutral-400">
                  {i + 1}
                </span>
                <span className="text-neutral-700 dark:text-neutral-300 leading-snug">
                  {r.title}
                </span>
              </li>
            ))}
          </ul>
        )}
        {onNavigateTab && (
          <button
            type="button"
            className="mt-3 w-full btn-sm border text-xs"
            onClick={() => onNavigateTab("recommendations")}
          >
            View Recommendations
          </button>
        )}
      </SectionCard>
    </>
  );

  return <TabSplitLayout main={main} rail={rail} />;
}
