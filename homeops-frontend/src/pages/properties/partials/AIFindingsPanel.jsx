import React from "react";
import {useNavigate, useParams} from "react-router-dom";
import {
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Calendar,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import {PROPERTY_SYSTEMS} from "../constants/propertySystems";

const CONDITION_COLORS = {
  excellent: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  good: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  fair: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  poor: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  unknown: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
};

const SEVERITY_COLORS = {
  high: "text-red-600 dark:text-red-400",
  critical: "text-red-700 dark:text-red-300 font-medium",
  medium: "text-amber-600 dark:text-amber-400",
  low: "text-gray-600 dark:text-gray-400",
};

function AIFindingsPanel({
  status,
  progress,
  errorMessage,
  result,
  suggestedSystemsToAdd = [],
  selectedSuggestedSystems = [],
  onToggleSuggestedSystem,
  onToggleSelectAllSuggested,
  onScheduleMaintenance,
  onRetry,
}) {
  const navigate = useNavigate();
  const {accountUrl} = useParams();
  const professionalsPath = accountUrl ? `/${accountUrl}/professionals` : "/professionals";
  const [needsAttentionExpanded, setNeedsAttentionExpanded] = React.useState(true);
  const [maintenanceExpanded, setMaintenanceExpanded] = React.useState(true);

  if (status === "queued" || status === "processing") {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/30 p-5">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-[#456564]" />
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
              Analyzing report…
            </p>
            {progress && (
              <p className="text-xs text-gray-500 dark:text-gray-400">{progress}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/20 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              Analysis failed
            </p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              {errorMessage || "Something went wrong."}
            </p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-100 hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/60 text-red-700 dark:text-red-200 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry analysis
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (status !== "completed" || !result) return null;

  const {
    conditionRating,
    needsAttention = [],
    maintenanceSuggestions = [],
    summary,
  } = result;

  const topNeeds = needsAttention.slice(0, 3);
  const hasMoreNeeds = needsAttention.length > 3;

  const getSystemLabel = (systemKey) => {
    const sys = PROPERTY_SYSTEMS.find((s) => s.id === systemKey);
    if (sys?.name) return sys.name;
    if (typeof systemKey === "string" && systemKey) {
      return systemKey.charAt(0).toUpperCase() + systemKey.slice(1).replace(/([A-Z])/g, " $1").trim();
    }
    return systemKey;
  };

  return (
    <div
      className="rounded-xl border border-[#456564]/30 dark:border-[#456564]/50 bg-[#456564]/[0.03] dark:bg-[#456564]/10 p-5 space-y-4"
      style={{animation: "systemsStepFadeIn 0.3s ease-out forwards"}}
    >
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-[#456564]" />
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          AI Findings
        </span>
      </div>

      {/* Condition badge */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium capitalize ${
            CONDITION_COLORS[conditionRating] ?? CONDITION_COLORS.unknown
          }`}
          title={
            (conditionRating || "").toLowerCase() === "unknown"
              ? "The AI could not determine an overall condition from the report."
              : undefined
          }
        >
          {(conditionRating || "").toLowerCase() === "unknown" ? "Not specified" : conditionRating}
        </span>
        {summary && (
          <p className="text-xs text-gray-600 dark:text-gray-400 max-w-md">
            {summary}
          </p>
        )}
      </div>

      {/* Needs attention */}
      {topNeeds.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setNeedsAttentionExpanded(!needsAttentionExpanded)}
            className="flex items-center gap-2 w-full text-left text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {needsAttentionExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            Needs attention ({topNeeds.length})
          </button>
          {needsAttentionExpanded && (
            <ul className="mt-2 space-y-2">
              {topNeeds.map((item, idx) => (
                <li
                  key={idx}
                  className="flex flex-col gap-0.5 text-xs pl-6"
                >
                  <span
                    className={`font-medium ${
                      SEVERITY_COLORS[item.severity] || ""
                    }`}
                  >
                    {item.title}
                  </span>
                  {item.suggestedAction && (
                    <span className="text-gray-500 dark:text-gray-400">
                      {item.suggestedAction}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Suggested systems to add */}
      {suggestedSystemsToAdd.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-3">
            Suggested systems to add (select to include)
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
            {suggestedSystemsToAdd.map((s, idx) => {
              const sysKey = s.systemType || s.system_key;
              const label = getSystemLabel(sysKey);
              const isSelected = selectedSuggestedSystems.includes(sysKey);
              const sys = PROPERTY_SYSTEMS.find((p) => p.id === sysKey);
              const Icon = sys?.icon;
              return (
                <button
                  key={`${sysKey}-${idx}`}
                  type="button"
                  onClick={() => onToggleSuggestedSystem?.(sysKey)}
                  className={`group relative flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all duration-200 ${
                    isSelected
                      ? "border-[#456564] bg-[#456564]/[0.06] dark:bg-[#456564]/15 ring-1 ring-[#456564]/20"
                      : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  {Icon && (
                    <div
                      className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${
                        isSelected
                          ? "bg-[#456564] text-white"
                          : "bg-gray-100 dark:bg-gray-700/70 text-gray-500"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                  )}
                  <span
                    className={`text-sm font-medium block leading-tight pt-0.5 ${
                      isSelected ? "text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {label}
                  </span>
                  <div
                    className={`absolute top-2.5 right-2.5 w-[18px] h-[18px] rounded flex items-center justify-center shrink-0 transition-all ${
                      isSelected
                        ? "bg-[#456564] text-white"
                        : "border border-gray-300 dark:border-gray-600"
                    }`}
                  >
                    {isSelected && (
                      <svg
                        className="w-2.5 h-2.5 text-white"
                        fill="currentColor"
                        viewBox="0 0 12 12"
                      >
                        <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7a1 1 0 10-1.414-1.414z" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={onToggleSelectAllSuggested}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#456564] hover:bg-[#34514f] text-white transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {suggestedSystemsToAdd.every((s) =>
              selectedSuggestedSystems.includes(s.systemType || s.system_key)
            )
              ? "Deselect Suggested Systems"
              : "Select Suggested Systems"}
          </button>
        </div>
      )}

      {/* Maintenance suggestions */}
      {maintenanceSuggestions.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setMaintenanceExpanded(!maintenanceExpanded)}
            className="flex items-center gap-2 w-full text-left text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {maintenanceExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            Suggested maintenance
          </button>
          {maintenanceExpanded && (
            <ul className="mt-2 space-y-2">
              {maintenanceSuggestions.map((item, idx) => (
                <li
                  key={idx}
                  className="flex items-center justify-between gap-3 pl-6 py-1.5 rounded-lg bg-white/50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                      {item.task || getSystemLabel(item.systemType)}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      {item.suggestedWhen && (
                        <span>{item.suggestedWhen}</span>
                      )}
                      {item.rationale && (
                        <span className="ml-1">— {item.rationale}</span>
                      )}
                    </p>
                  </div>
                  {onScheduleMaintenance && (
                    <div className="flex-shrink-0 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onScheduleMaintenance({
                            systemType: item.systemType,
                            systemLabel: getSystemLabel(item.systemType),
                            task: item.task,
                            suggestedWhen: item.suggestedWhen,
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
                          const base = typeof window !== "undefined" ? window.location.href.split("#")[0] : "";
                          const cleanPath = (professionalsPath || "").replace(/^\//, "");
                          window.open(`${base}#/${cleanPath}`, "_blank");
                        }}
                        className="inline-flex items-center gap-0.5 text-[11px] text-gray-500 hover:text-[#456564] dark:text-gray-400 dark:hover:text-[#7aa3a2] transition-colors"
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
        </div>
      )}
    </div>
  );
}

export default AIFindingsPanel;
