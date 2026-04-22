/**
 * InspectionAnalysisModalContent
 * Renders inspection report AI analysis inside a modal.
 * Uses useInspectionAnalysis for fetch logic.
 * Includes per-system scheduling like AIFindingsPanel in the setup modal.
 */

import React, {useEffect, useState} from "react";
import {useNavigate, useParams} from "react-router-dom";
import {
  Loader2,
  AlertCircle,
  Calendar,
  ExternalLink,
  ArrowUpCircle,
  Upload,
  ClipboardList,
  FileCheck,
  Sparkles,
  Building,
  ChevronRight,
  X,
  RefreshCw,
} from "lucide-react";
import {useInspectionAnalysis} from "../../../hooks/useInspectionAnalysis";
import {getSystemLabelFromAiType} from "../helpers/aiSystemNormalization";
import {filterSuggestedSystemsNotOnProperty} from "../helpers/suggestedSystemsHelpers";
import InspectionChecklistPanel from "./InspectionChecklistPanel";

const CONDITION_BADGES = {
  excellent:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  good: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  fair: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  poor: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  unknown: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
};

const PRIORITY_BADGES = {
  high: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  urgent: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  medium:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  low: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
};

function formatCondition(str) {
  if (!str || typeof str !== "string") return "Not specified";
  const lower = str.toLowerCase();
  if (lower === "unknown") return "Not specified";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function formatConfidence(n) {
  if (typeof n !== "number" || Number.isNaN(n)) return "—";
  return `${Math.round(n * 100)}%`;
}

/** Parse backend quota error "AI token quota exceeded (used/quota this month)..." */
function parseQuotaFromError(errorMsg) {
  if (!errorMsg || typeof errorMsg !== "string") return null;
  const m = errorMsg.match(/\((\d+)\/(\d+)\s+this month\)/);
  if (!m) return null;
  return {used: parseInt(m[1], 10), quota: parseInt(m[2], 10)};
}

function AnalysisModalHeader({onClose, children}) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 shrink-0">
      <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
        Inspection Report Analysis
      </span>
      <div className="flex items-center gap-1">
        {children}
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 dark:hover:text-neutral-400 dark:hover:bg-neutral-800"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

const AI_ANALYSIS_FEATURES = [
  {
    icon: Sparkles,
    title: "AI-powered analysis",
    desc: "Get an intelligent summary of your inspection report with property condition rating and key findings.",
  },
  {
    icon: Building,
    title: "Systems detected",
    desc: "HVAC, plumbing, electrical, and other systems are automatically identified with condition and confidence scores.",
  },
  {
    icon: ClipboardList,
    title: "Inspection checklist",
    desc: "Track items from the report and mark them done as you complete maintenance tasks.",
  },
  {
    icon: Calendar,
    title: "Maintenance recommendations",
    desc: "Prioritized maintenance suggestions with suggested schedules you can add to your calendar.",
  },
];

export default function InspectionAnalysisModalContent({
  propertyId,
  isOpen,
  onClose,
  onScheduleMaintenance,
  onTierRestriction,
  onUploadReport,
  propertySystems = [],
  customSystemNames = [],
  onContinueToSystems,
}) {
  const navigate = useNavigate();
  const {accountUrl} = useParams();
  const professionalsPath = accountUrl
    ? `/${accountUrl}/professionals`
    : "/professionals";
  const {
    status,
    data,
    error,
    refresh,
    load,
    startAnalysis,
    analysisProgress,
    reportMeta,
    completedRunCount,
    maxAnalysisRuns,
  } = useInspectionAnalysis(propertyId);
  const [missingSystems, setMissingSystems] = useState([]);
  const [rerunNotice, setRerunNotice] = useState(null);

  useEffect(() => {
    if (!isOpen) setRerunNotice(null);
  }, [isOpen]);

  const atRunLimit = completedRunCount >= maxAnalysisRuns;

  const handleRerunClick = () => {
    setRerunNotice(null);
    if (atRunLimit) {
      setRerunNotice({
        type: "limit",
        text: `This property has already used all ${maxAnalysisRuns} analysis runs.`,
      });
      return;
    }
    const key = reportMeta?.s3Key != null ? String(reportMeta.s3Key).trim() : "";
    if (!key) {
      setRerunNotice({
        type: "report",
        text: "Add an inspection report before rerunning analysis.",
      });
      return;
    }
    startAnalysis();
  };

  useEffect(() => {
    if (isOpen && propertyId) {
      load();
    }
  }, [isOpen, propertyId, load]);

  useEffect(() => {
    if (status !== "ready" || !data || !propertyId || !isOpen) {
      setMissingSystems([]);
      return;
    }
    const raw =
      data.suggested_systems_to_add ?? data.suggestedSystemsToAdd ?? [];
    if (!Array.isArray(raw) || raw.length === 0) {
      setMissingSystems([]);
      return;
    }
    const missing = filterSuggestedSystemsNotOnProperty(
      raw,
      propertySystems,
      customSystemNames,
    );
    setMissingSystems(missing);
  }, [status, data, propertyId, isOpen, propertySystems, customSystemNames]);

  // Don't call onTierRestriction — we show the quota message inline. That avoids
  // stacking UpgradePrompt + TierLimitBanner + inline message (3 different UIs).
  // Quota is only hit when user explicitly clicks "Run AI Analysis".

  if (!propertyId) {
    return (
      <>
        <AnalysisModalHeader onClose={onClose} />
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Save the property first to analyze reports.
          </p>
        </div>
      </>
    );
  }

  if (status === "idle" || status === "loading") {
    const primary =
      analysisProgress ||
      (status === "idle" ? "Loading…" : "Preparing inspection analysis…");
    return (
      <>
        <AnalysisModalHeader onClose={onClose} />
        <div className="flex flex-col items-center justify-center py-12 px-6 max-w-lg mx-auto text-center">
        <div className="animate-pulse space-y-4 w-full max-w-md">
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4" />
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-full" />
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-5/6" />
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-2/3 mt-6" />
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-4/5" />
        </div>
        <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300 mt-6 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          {primary}
        </p>
        {analysisProgress && status === "loading" && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2 leading-relaxed">
            You can close this window — analysis keeps running. Reopen anytime
            to see live progress.
          </p>
        )}
      </div>
      </>
    );
  }

  if (status === "quota_exceeded") {
    const parsed = parseQuotaFromError(error);
    const used = parsed?.used ?? 0;
    const quota = parsed?.quota ?? 0;
    const isFreePlan = quota === 0;

    const quotaFeatures = [
      {
        icon: Sparkles,
        title: "AI-powered analysis",
        desc: "Get an intelligent summary of your inspection report with property condition rating and key findings.",
      },
      {
        icon: Building,
        title: "Systems detected",
        desc: "HVAC, plumbing, electrical, and other systems are automatically identified with condition and confidence scores.",
      },
      {
        icon: ClipboardList,
        title: "Inspection checklist",
        desc: "Track items from the report and mark them done as you complete maintenance tasks.",
      },
      {
        icon: Calendar,
        title: "Maintenance recommendations",
        desc: "Prioritized maintenance suggestions with suggested schedules you can add to your calendar.",
      },
    ];

    return (
      <>
        <AnalysisModalHeader onClose={onClose} />
        <div className="flex flex-col min-h-[60vh] p-8 sm:p-10">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center mb-4">
            <ArrowUpCircle className="w-8 h-8 text-amber-500 dark:text-amber-400" />
          </div>
          <h3 className="text-xl font-semibold text-neutral-800 dark:text-neutral-100 mb-2">
            {isFreePlan ? "AI analysis not included" : "AI usage limit reached"}
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-md">
            {isFreePlan
              ? "Your free plan does not include AI analysis. Please upgrade."
              : `You've used all your AI tokens for this month (${used.toLocaleString()}/${quota.toLocaleString()}). Upgrade your plan for more.`}
          </p>
          <button
            type="button"
            onClick={() => navigate(`/${accountUrl}/settings/upgrade`)}
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors shadow-sm"
          >
            <ArrowUpCircle className="w-4 h-4" />
            Upgrade plan
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 flex-1">
          {quotaFeatures.map(({icon: Icon, title, desc}) => (
            <div
              key={title}
              className="flex gap-4 p-5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/30"
            >
              <div className="shrink-0 w-10 h-10 rounded-lg bg-[#456564]/10 dark:bg-[#456564]/20 flex items-center justify-center">
                <Icon className="w-5 h-5 text-[#456564] dark:text-[#5a7a78]" />
              </div>
              <div className="text-left min-w-0">
                <p className="font-medium text-neutral-800 dark:text-neutral-200 text-sm mb-1">
                  {title}
                </p>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      </>
    );
  }

  if (status === "error") {
    return (
      <>
        <AnalysisModalHeader onClose={onClose} />
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <AlertCircle className="w-12 h-12 text-amber-500 dark:text-amber-400 mb-3" />
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Something went wrong
        </p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-sm">
          {error}
        </p>
        <div className="mt-4 flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#456564] hover:bg-[#34514f] text-white text-sm font-medium"
          >
            Retry
          </button>
          {onUploadReport ? (
            <button
              type="button"
              onClick={onUploadReport}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-700/80 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Upload inspection report
            </button>
          ) : null}
        </div>
      </div>
      </>
    );
  }

  if (status === "ready_to_analyze") {
    const features = [
      {
        icon: Sparkles,
        title: "AI-powered analysis",
        desc: "Get an intelligent summary of your inspection report with property condition rating and key findings.",
      },
      {
        icon: Building,
        title: "Systems detected",
        desc: "HVAC, plumbing, electrical, and other systems are automatically identified with condition and confidence scores.",
      },
      {
        icon: ClipboardList,
        title: "Inspection checklist",
        desc: "Track items from the report and mark them done as you complete maintenance tasks.",
      },
      {
        icon: Calendar,
        title: "Maintenance recommendations",
        desc: "Prioritized maintenance suggestions with suggested schedules you can add to your calendar.",
      },
    ];
    return (
      <>
        <AnalysisModalHeader onClose={onClose} />
        <div className="flex flex-col min-h-[60vh] p-8 sm:p-10">
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-[#456564]/10 dark:bg-[#456564]/20 flex items-center justify-center mb-5">
            <FileCheck className="w-8 h-8 text-[#456564] dark:text-[#5a7a78]" />
          </div>
          <h3 className="text-xl font-semibold text-neutral-800 dark:text-neutral-100 mb-2">
            Ready to analyze
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-xl">
            You have an inspection report. Run AI analysis to extract condition
            ratings, system findings, and maintenance recommendations.
          </p>
          {error && (
            <div className="mt-5 max-w-xl w-full flex items-start gap-2 px-4 py-3 rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 text-left">
              <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-red-700 dark:text-red-300">
                  Last analysis attempt failed
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5 leading-relaxed">
                  {error}
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-10 flex-1">
          {features.map(({icon: Icon, title, desc}) => (
            <div
              key={title}
              className="flex gap-4 p-5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/30"
            >
              <div className="shrink-0 w-10 h-10 rounded-lg bg-[#456564]/10 dark:bg-[#456564]/20 flex items-center justify-center">
                <Icon className="w-5 h-5 text-[#456564] dark:text-[#5a7a78]" />
              </div>
              <div className="text-left min-w-0">
                <p className="font-medium text-neutral-800 dark:text-neutral-200 text-sm mb-1">
                  {title}
                </p>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row justify-center items-center pt-4 gap-3">
          <button
            type="button"
            onClick={startAnalysis}
            disabled={atRunLimit}
            title={
              atRunLimit
                ? `Analysis can be run at most ${maxAnalysisRuns} times per property.`
                : undefined
            }
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#456564] hover:bg-[#34514f] text-white text-sm font-semibold transition-colors shadow-sm disabled:opacity-50 disabled:pointer-events-none"
          >
            <Sparkles className="w-5 h-5" />
            {error ? "Retry AI Analysis" : "Run AI Analysis"}
          </button>
          {onUploadReport ? (
            <button
              type="button"
              onClick={onUploadReport}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 text-sm font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-700/80 transition-colors"
            >
              <Upload className="w-5 h-5" />
              {error ? "Replace report" : "Upload or replace report"}
            </button>
          ) : null}
        </div>
      </div>
      </>
    );
  }

  if (status === "empty") {
    const features = [
      {
        icon: Sparkles,
        title: "AI-powered analysis",
        desc: "Get an intelligent summary of your inspection report with property condition rating and key findings.",
      },
      {
        icon: Building,
        title: "Systems detected",
        desc: "HVAC, plumbing, electrical, and other systems are automatically identified with condition and confidence scores.",
      },
      {
        icon: ClipboardList,
        title: "Inspection checklist",
        desc: "Track items from the report and mark them done as you complete maintenance tasks.",
      },
      {
        icon: Calendar,
        title: "Maintenance recommendations",
        desc: "Prioritized maintenance suggestions with suggested schedules you can add to your calendar.",
      },
    ];
    return (
      <>
        <AnalysisModalHeader onClose={onClose} />
        <div className="flex flex-col min-h-[60vh] p-8 sm:p-10">
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-[#456564]/10 dark:bg-[#456564]/20 flex items-center justify-center mb-5">
            <FileCheck className="w-8 h-8 text-[#456564] dark:text-[#5a7a78]" />
          </div>
          <h3 className="text-xl font-semibold text-neutral-800 dark:text-neutral-100 mb-2">
            No inspection report on file
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-xl">
            Upload your inspection report (PDF). Our AI will analyze it to
            extract condition ratings, system findings, maintenance
            recommendations, and more.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-10 flex-1">
          {features.map(({icon: Icon, title, desc}) => (
            <div
              key={title}
              className="flex gap-4 p-5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/30"
            >
              <div className="shrink-0 w-10 h-10 rounded-lg bg-[#456564]/10 dark:bg-[#456564]/20 flex items-center justify-center">
                <Icon className="w-5 h-5 text-[#456564] dark:text-[#5a7a78]" />
              </div>
              <div className="text-left min-w-0">
                <p className="font-medium text-neutral-800 dark:text-neutral-200 text-sm mb-1">
                  {title}
                </p>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-center pt-4 gap-3">
          {onUploadReport ? (
            <button
              type="button"
              onClick={onUploadReport}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#456564] hover:bg-[#34514f] text-white text-sm font-semibold transition-colors shadow-sm"
            >
              <Upload className="w-5 h-5" />
              Upload inspection report
            </button>
          ) : null}
        </div>
      </div>
      </>
    );
  }

  if (status === "ready" && data) {
    const condition = data.property_state ?? data.conditionRating ?? "unknown";
    const conditionClass =
      CONDITION_BADGES[condition] ?? CONDITION_BADGES.unknown;
    const rawSystems = data.systems_detected ?? data.systemsDetected ?? [];
    // Deduplicate by system type (AI may suggest same system multiple times, e.g. waterHeater twice)
    const seenKeys = new Set();
    const systems = rawSystems.filter((s) => {
      const key = (s.systemType ?? s.system_key ?? s.name ?? "")
        .toString()
        .toLowerCase()
        .trim();
      if (!key || seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });
    // Support both recommended_actions (normalized) and maintenanceSuggestions (raw API)
    const rawActions =
      data.recommended_actions ??
      data.maintenanceSuggestions ??
      data.maintenance_suggestions ??
      [];
    const actions = rawActions.map((a) => {
      const item = typeof a === "object" ? a : {title: a};
      const sysType =
        item.systemType ?? item.system_type ?? item.category ?? "general";
      return {
        task: item.task ?? item.title ?? getSystemLabelFromAiType(sysType),
        systemType: sysType,
        suggestedWhen:
          item.suggestedWhen ?? item.suggested_schedule_window ?? "",
        rationale: item.rationale ?? item.reason ?? "",
        priority: item.priority ?? "medium",
      };
    });

    return (
      <>
        <AnalysisModalHeader onClose={onClose}>
          <button
            type="button"
            onClick={handleRerunClick}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title={
              atRunLimit
                ? `Analysis can be run at most ${maxAnalysisRuns} times per property.`
                : "Run analysis again on the current report"
            }
          >
            <RefreshCw className="w-4 h-4 shrink-0" />
            Rerun analysis
          </button>
        </AnalysisModalHeader>
        {rerunNotice ? (
          <div className="mx-6 mt-3 flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50/90 dark:bg-amber-900/20 px-3 py-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-amber-900 dark:text-amber-100/90 leading-relaxed">
                {rerunNotice.text}
              </p>
              {rerunNotice.type === "report" && onUploadReport ? (
                <button
                  type="button"
                  onClick={() => {
                    setRerunNotice(null);
                    onUploadReport();
                  }}
                  className="mt-2 text-xs font-semibold text-[#456564] dark:text-[#7aa3a2] hover:underline"
                >
                  Add inspection report
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        {error ? (
          <div className="mx-6 mt-3 flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 px-3 py-2.5">
            <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
              {error}
            </p>
          </div>
        ) : null}
        <div className="p-6 space-y-6">
        {/* Summary */}
        <section>
          <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
            Summary
          </h3>
          <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
            {data.summary || "No summary available."}
          </p>
        </section>

        {/* Property Condition */}
        <section>
          <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
            Property Condition
          </h3>
          <span
            className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${conditionClass}`}
          >
            {formatCondition(condition)}
          </span>
        </section>

        {/* Systems Detected */}
        <section>
          <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3">
            Systems Detected
          </h3>
          {systems.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              No systems detected.
            </p>
          ) : (
            <div className="rounded-lg border border-neutral-100 dark:border-neutral-700/50 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-100/80 dark:bg-neutral-800/80">
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                      System
                    </th>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                      Condition
                    </th>
                    <th className="text-right py-2.5 px-3 text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                      Confidence
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {systems.map((s, i) => (
                    <tr
                      key={i}
                      className="border-t border-neutral-100 dark:border-neutral-700/50 bg-neutral-50/50 dark:bg-neutral-800/30 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                    >
                      <td className="py-2 px-3 font-medium text-neutral-800 dark:text-neutral-200">
                        {(getSystemLabelFromAiType(
                          s.systemType ?? s.system_key ?? s.name,
                        ) ||
                          s.name) ??
                          "—"}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-flex text-xs px-2 py-0.5 rounded capitalize ${
                            CONDITION_BADGES[s.condition] ??
                            CONDITION_BADGES.unknown
                          }`}
                          title={s.conditionRationale || undefined}
                        >
                          {formatCondition(s.condition)}
                        </span>
                        {s.conditionRationale && (
                          <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5 leading-tight line-clamp-2">
                            {s.conditionRationale}
                          </p>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right text-neutral-500 dark:text-neutral-400 tabular-nums">
                        {formatConfidence(s.confidence)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Inspection Checklist — trackable items */}
        <section>
          <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <ClipboardList className="w-3.5 h-3.5" />
            Inspection Checklist
          </h3>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-3">
            Track progress on items identified in the inspection report. Mark
            items as done when completed.
          </p>
          <InspectionChecklistPanel propertyId={propertyId} />
        </section>

        {/* Recommended Actions Summary (raw from analysis) */}
        <section>
          <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3">
            Recommended Actions Summary
          </h3>
          {actions.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              No recommended actions.
            </p>
          ) : (
            <ul className="space-y-2">
              {actions.map((a, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-700/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`shrink-0 text-xs px-2 py-0.5 rounded font-medium capitalize ${
                          PRIORITY_BADGES[a.priority] ?? PRIORITY_BADGES.medium
                        }`}
                      >
                        {formatCondition(a.priority)}
                      </span>
                      <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                        {a.task}
                      </p>
                    </div>
                    {(a.suggestedWhen || a.rationale) && (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                        {[a.suggestedWhen, a.rationale]
                          .filter(Boolean)
                          .join(" — ")}
                      </p>
                    )}
                  </div>
                  {onScheduleMaintenance && (
                    <div className="flex-shrink-0 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onScheduleMaintenance({
                            systemType: a.systemType,
                            systemLabel: getSystemLabelFromAiType(a.systemType),
                            task: a.task,
                            suggestedWhen: a.suggestedWhen,
                          })
                        }
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-[#456564]/10 hover:bg-[#456564]/20 text-[#456564] dark:text-[#7aa3a2] transition-colors"
                      >
                        <Calendar className="w-3 h-3" />
                        Schedule
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const origin =
                            typeof window !== "undefined"
                              ? window.location.origin
                              : "";
                          const cleanPath = (professionalsPath || "").replace(
                            /^\//,
                            "",
                          );
                          window.open(`${origin}/${cleanPath}`, "_blank");
                        }}
                        className="inline-flex items-center gap-0.5 text-[11px] text-neutral-500 hover:text-[#456564] dark:text-neutral-400 dark:hover:text-[#7aa3a2] transition-colors"
                      >
                        Professionals
                        <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
        {missingSystems.length > 0 && onContinueToSystems && (
          <section className="rounded-xl border border-[#456564]/20 dark:border-[#456564]/30 bg-[#456564]/[0.04] dark:bg-[#456564]/10 p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">
                {missingSystems.length} system
                {missingSystems.length !== 1 ? "s" : ""} identified not on your
                property
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {missingSystems
                  .map((s) =>
                    getSystemLabelFromAiType(
                      s.systemType ?? s.system_key ?? s.name,
                    ),
                  )
                  .join(", ")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onContinueToSystems(missingSystems)}
              className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#456564] hover:bg-[#34514f] text-white text-sm font-medium transition-colors"
            >
              Continue
              <ChevronRight className="w-4 h-4" />
            </button>
          </section>
        )}
        </div>
      </>
    );
  }

  return null;
}
