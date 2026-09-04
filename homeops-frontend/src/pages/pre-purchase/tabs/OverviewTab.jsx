import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Lightbulb,
  ShieldAlert,
  Sparkles,
  ThumbsUp,
} from "lucide-react";
import SectionCard from "../../properties/partials/passport/SectionCard";
import {StatusBadge} from "../../properties/partials/passport/StatusBadge";
import ScoreGauge from "../components/ScoreGauge";
import RepairRangeScale from "../components/RepairRangeScale";
import MatchedProfessionalsList from "../components/MatchedProfessionalsList";
import ScoutNotesCard from "../components/ScoutNotesCard";
import {
  PRE_PURCHASE_DISCLAIMER,
  SCORE_BLURBS,
  SEVERITY_BADGE,
  formatCostRange,
  selectRailProfessionals,
} from "../prePurchaseUtils";

function ViewAllLink({onClick, children}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 text-xs font-semibold text-[#456564] hover:underline inline-flex items-center gap-0.5"
    >
      {children}
    </button>
  );
}

const ISSUE_ROWS = [
  {
    key: "major",
    label: "Major Issues",
    iconClass: "text-red-600 bg-red-50 dark:bg-red-950/40",
    Icon: ShieldAlert,
  },
  {
    key: "moderate",
    label: "Moderate Issues",
    iconClass: "text-amber-600 bg-amber-50 dark:bg-amber-950/40",
    Icon: ShieldAlert,
  },
  {
    key: "minor",
    label: "Minor Issues",
    iconClass: "text-sky-600 bg-sky-50 dark:bg-sky-950/40",
    Icon: ShieldAlert,
  },
];

export default function OverviewTab({
  analysis,
  onNavigateTab,
  notes = [],
  notesLoading = false,
  onAddNote,
  onOpenNotes,
}) {
  const counts = analysis?.issueCounts || {major: 0, moderate: 0, minor: 0};
  const totalIssues =
    (counts.major || 0) + (counts.moderate || 0) + (counts.minor || 0);
  const positives = analysis?.positiveFindings || [];
  const concerns = analysis?.topConcerns || [];
  const recommendations = analysis?.recommendations || [];
  const professionals = selectRailProfessionals(
    analysis?.professionalMatches || [],
    analysis?.systems || [],
    4
  );
  const rating = analysis?.overallConditionRating;
  const blurb = SCORE_BLURBS[rating] || SCORE_BLURBS.unknown;

  return (
    <div className="space-y-4">
      <div
        className="rounded-xl border border-amber-200/80 bg-amber-50/80 dark:bg-amber-950/20 dark:border-amber-900/50 px-4 py-3 flex gap-2 text-sm text-amber-900 dark:text-amber-200"
        role="note"
      >
        <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
        <p>{PRE_PURCHASE_DISCLAIMER}</p>
      </div>

      {/* Top row: Summary | Score | Issues | Repair range */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <SectionCard title="Executive Summary" className="xl:col-span-1">
          <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-wrap">
            {analysis?.executiveSummary || "No summary available yet."}
          </p>
        </SectionCard>

        <SectionCard title="Overall Condition Score">
          <ScoreGauge
            score={analysis?.overallConditionScore}
            rating={rating}
          />
          <p className="text-xs text-neutral-500 mt-3 text-center leading-relaxed">
            {blurb}
          </p>
          <p className="text-[11px] text-center text-neutral-400 mt-2">
            Score reflects estimated repair burden, system condition, safety,
            and major inspection findings.
          </p>
        </SectionCard>

        <SectionCard title="Issues Summary">
          <ul className="space-y-2.5">
            {ISSUE_ROWS.map(({key, label, iconClass, Icon}) => (
              <li key={key} className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${iconClass}`}
                >
                  <Icon className="w-4 h-4" aria-hidden />
                </span>
                <div className="flex-1 min-w-0 flex items-baseline justify-between gap-2">
                  <span className="text-sm text-neutral-700 dark:text-neutral-300">
                    {label}
                  </span>
                  <span className="text-lg font-bold tabular-nums text-neutral-900 dark:text-white">
                    {counts[key] ?? 0}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {onNavigateTab && (
            <ViewAllLink onClick={() => onNavigateTab("issues")}>
              View all {totalIssues} issues →
            </ViewAllLink>
          )}
        </SectionCard>

        <SectionCard title="Estimated Repair Range">
          <p className="text-2xl font-bold text-neutral-900 dark:text-white">
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
          <RepairRangeScale
            low={analysis?.repairCostLow}
            high={analysis?.repairCostHigh}
          />
          <p className="text-xs text-neutral-500 mt-3">
            Estimates from uploaded documents — verify with contractor quotes.
          </p>
        </SectionCard>
      </div>

      {/* Second row: Concerns | Positives | Recommendations | Professionals */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <SectionCard
          title="Top Concerns"
          icon={AlertTriangle}
          iconClassName="text-red-500"
          className="bg-red-50/70 dark:bg-red-950/20 border-red-100/80 dark:border-red-900/40"
        >
          {concerns.length === 0 ? (
            <p className="text-sm text-neutral-500">No top concerns listed.</p>
          ) : (
            <ul className="space-y-2.5">
              {concerns.slice(0, 4).map((c, i) => {
                const title = typeof c === "string" ? c : c.title;
                const severity = typeof c === "object" ? c.severity : null;
                return (
                  <li
                    key={`${title}-${i}`}
                    className="flex items-start gap-2 text-sm"
                  >
                    <span
                      className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                        severity === "major"
                          ? "bg-red-500"
                          : severity === "moderate"
                            ? "bg-amber-500"
                            : "bg-neutral-400"
                      }`}
                    />
                    <span className="flex-1 text-neutral-800 dark:text-neutral-200 leading-snug">
                      {title}
                    </span>
                    {severity && (
                      <StatusBadge
                        tone={SEVERITY_BADGE[severity] || "neutral"}
                        className="capitalize shrink-0"
                      >
                        {severity}
                      </StatusBadge>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {onNavigateTab && (
            <ViewAllLink onClick={() => onNavigateTab("issues")}>
              View all issues →
            </ViewAllLink>
          )}
        </SectionCard>

        <SectionCard
          title="Positive Findings"
          icon={ThumbsUp}
          iconClassName="text-emerald-600"
          className="bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-100/80 dark:border-emerald-900/40"
        >
          {positives.length === 0 ? (
            <p className="text-sm text-neutral-500">No positive findings listed.</p>
          ) : (
            <ul className="space-y-2.5">
              {positives.slice(0, 4).map((p, i) => (
                <li key={`${p}-${i}`} className="flex items-start gap-2 text-sm">
                  <CheckCircle2
                    className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5"
                    aria-hidden
                  />
                  <span className="text-neutral-800 dark:text-neutral-200 leading-snug">
                    {typeof p === "string" ? p : p.title || p}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="AI Recommendations"
          icon={Lightbulb}
          iconClassName="text-violet-600"
          badge={
            <StatusBadge tone="brand" className="!bg-violet-500/15 !text-violet-700 !border-violet-400/30">
              <Sparkles className="w-3 h-3" aria-hidden />
              AI
            </StatusBadge>
          }
          className="bg-violet-50/70 dark:bg-violet-950/20 border-violet-100/80 dark:border-violet-900/40"
        >
          {recommendations.length === 0 ? (
            <p className="text-sm text-neutral-500">No recommendations yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {recommendations.slice(0, 4).map((r) => (
                <li key={r.id} className="flex items-start gap-2 text-sm">
                  <Sparkles
                    className="w-4 h-4 text-violet-500 shrink-0 mt-0.5"
                    aria-hidden
                  />
                  <span className="text-neutral-800 dark:text-neutral-200 leading-snug">
                    {r.title}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {onNavigateTab && (
            <ViewAllLink onClick={() => onNavigateTab("recommendations")}>
              View full recommendations →
            </ViewAllLink>
          )}
        </SectionCard>

        <SectionCard
          title="Recommended Professionals"
          action={
            onNavigateTab ? (
              <button
                type="button"
                onClick={() => onNavigateTab("recommendations")}
                className="text-xs font-semibold text-[#456564] hover:underline"
              >
                View all →
              </button>
            ) : null
          }
        >
          <MatchedProfessionalsList
            matches={professionals}
            limit={4}
            scoutTab="overview"
            emptyMessage="No professional matches yet. Add contacts to your directory to see suggestions."
          />
        </SectionCard>
      </div>

      <ScoutNotesCard
        notes={notes}
        loading={notesLoading}
        onAddNote={onAddNote}
        onOpenNotes={onOpenNotes}
      />
    </div>
  );
}
