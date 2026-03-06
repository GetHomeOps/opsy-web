import React, {useState, useMemo} from "react";
import {
  X,
  Sparkles,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  FileCheck,
  Upload,
} from "lucide-react";
import ModalBlank from "../../../components/ModalBlank";
import {PROPERTY_SYSTEMS} from "../constants/propertySystems";
import {getSystemFindingsFromAnalysis} from "../helpers/inspectionAnalysisHelpers";

const CONDITION_COLORS = {
  excellent: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  good: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  fair: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  poor: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

const SEVERITY_COLORS = {
  high: "text-red-600 dark:text-red-400",
  critical: "text-red-700 dark:text-red-300 font-medium",
  medium: "text-amber-600 dark:text-amber-400",
  low: "text-gray-600 dark:text-gray-400",
};

function formatDate(dateString) {
  if (!dateString) return null;
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function InspectionReportModal({
  isOpen,
  onClose,
  analysis,
  onChatWithAI,
  onUploadReport,
  systemId,
  systemLabel,
}) {
  const [needsAttentionExpanded, setNeedsAttentionExpanded] = useState(true);
  const [maintenanceExpanded, setMaintenanceExpanded] = useState(true);
  const [suggestedSystemsExpanded, setSuggestedSystemsExpanded] = useState(true);

  const filteredAnalysis = useMemo(() => {
    if (!systemId || !analysis) return analysis;
    const findings = getSystemFindingsFromAnalysis(systemId, analysis);
    return {
      ...analysis,
      needsAttention: findings.needsAttention,
      maintenanceSuggestions: findings.maintenanceSuggestions,
      suggestedSystemsToAdd: [], // Hide when filtered - not relevant to single system
      citations: [], // Hide when filtered - citations may not be system-specific
    };
  }, [analysis, systemId]);

  const displayAnalysis = systemId ? filteredAnalysis : analysis;
  const hasAnalysis = displayAnalysis && (
    displayAnalysis.conditionRating ||
    displayAnalysis.summary ||
    (displayAnalysis.needsAttention?.length > 0) ||
    (displayAnalysis.maintenanceSuggestions?.length > 0)
  );
  const needsAttention = displayAnalysis?.needsAttention ?? [];
  const maintenanceSuggestions = displayAnalysis?.maintenanceSuggestions ?? [];
  const suggestedSystemsToAdd = displayAnalysis?.suggestedSystemsToAdd ?? [];
  const citations = displayAnalysis?.citations ?? [];

  const getSystemLabel = (systemKey) => {
    const key = typeof systemKey === "string" ? systemKey : systemKey?.systemType ?? systemKey?.system_key;
    const sys = PROPERTY_SYSTEMS.find((s) => s.id === key);
    return sys?.name || key || "—";
  };

  return (
    <ModalBlank
      modalOpen={isOpen}
      setModalOpen={(open) => !open && onClose?.()}
      contentClassName="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
    >
      <div className="flex flex-col h-full max-h-[90vh]">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#456564]/10 dark:bg-[#456564]/20 flex items-center justify-center">
              <FileCheck className="w-5 h-5 text-[#456564] dark:text-[#5a7a78]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {systemLabel ? `${systemLabel} — ` : ""}Inspection Report Analysis
              </h2>
              {displayAnalysis?.createdAt && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Analyzed {formatDate(displayAnalysis.createdAt)}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {!hasAnalysis ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {systemId
                  ? `No inspection findings for ${systemLabel || "this system"}`
                  : "No inspection report analysis available"}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mb-4">
                {systemId
                  ? "The inspection report does not mention any issues or maintenance suggestions for this system."
                  : "Upload an inspection report PDF in the Documents tab to generate an AI analysis."}
              </p>
              {onUploadReport && (
                <button
                  type="button"
                  onClick={onUploadReport}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#456564] hover:bg-[#34514f] text-white text-sm font-medium"
                >
                  <Upload className="w-4 h-4" />
                  Upload report
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Condition & Summary — only show when full analysis (not system-filtered) */}
              {!systemId && (
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    {displayAnalysis.conditionRating && (
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium capitalize ${
                          CONDITION_COLORS[displayAnalysis.conditionRating] || CONDITION_COLORS.good
                        }`}
                      >
                        {displayAnalysis.conditionRating}
                      </span>
                    )}
                    {displayAnalysis.conditionConfidence != null && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {Math.round(displayAnalysis.conditionConfidence * 100)}% confidence
                      </span>
                    )}
                  </div>
                  {displayAnalysis.conditionRationale && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {displayAnalysis.conditionRationale}
                    </p>
                  )}
                  {displayAnalysis.summary && (
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {displayAnalysis.summary}
                    </p>
                  )}
                </div>
              )}

              {/* Needs Attention */}
              {needsAttention.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setNeedsAttentionExpanded(!needsAttentionExpanded)}
                    className="flex items-center gap-2 w-full text-left text-sm font-semibold text-gray-800 dark:text-gray-200"
                  >
                    {needsAttentionExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    Needs attention ({needsAttention.length})
                  </button>
                  {needsAttentionExpanded && (
                    <ul className="mt-2 space-y-2">
                      {needsAttention.map((item, idx) => (
                        <li
                          key={idx}
                          className="flex flex-col gap-0.5 pl-6 py-2 rounded-lg bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30"
                        >
                          <span
                            className={`text-sm font-medium ${
                              SEVERITY_COLORS[item.severity] || ""
                            }`}
                          >
                            {item.title}
                          </span>
                          {item.suggestedAction && (
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                              {item.suggestedAction}
                            </span>
                          )}
                          {item.evidence && (
                            <span className="text-xs text-gray-500 dark:text-gray-500 italic">
                              "{item.evidence}"
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Maintenance Suggestions */}
              {maintenanceSuggestions.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setMaintenanceExpanded(!maintenanceExpanded)}
                    className="flex items-center gap-2 w-full text-left text-sm font-semibold text-gray-800 dark:text-gray-200"
                  >
                    {maintenanceExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    Maintenance suggestions ({maintenanceSuggestions.length})
                  </button>
                  {maintenanceExpanded && (
                    <ul className="mt-2 space-y-2">
                      {maintenanceSuggestions.map((item, idx) => (
                        <li
                          key={idx}
                          className="pl-6 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700"
                        >
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                            {item.task || getSystemLabel(item.systemType)}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {item.suggestedWhen && <span>{item.suggestedWhen}</span>}
                            {item.rationale && (
                              <span className="ml-1">— {item.rationale}</span>
                            )}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Suggested Systems to Add */}
              {suggestedSystemsToAdd.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setSuggestedSystemsExpanded(!suggestedSystemsExpanded)}
                    className="flex items-center gap-2 w-full text-left text-sm font-semibold text-gray-800 dark:text-gray-200"
                  >
                    {suggestedSystemsExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    Suggested systems to add ({suggestedSystemsToAdd.length})
                  </button>
                  {suggestedSystemsExpanded && (
                    <div className="mt-2 pl-6 flex flex-wrap gap-2">
                      {suggestedSystemsToAdd.map((s, idx) => {
                        const sysKey = s.systemType || s.system_key;
                        const label = getSystemLabel(sysKey);
                        return (
                          <span
                            key={idx}
                            className="inline-flex px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs font-medium text-gray-700 dark:text-gray-300"
                          >
                            {label}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Citations */}
              {citations.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
                    Report citations
                  </p>
                  <ul className="space-y-1">
                    {citations.map((c, idx) => (
                      <li
                        key={idx}
                        className="text-xs text-gray-600 dark:text-gray-400 pl-4 border-l-2 border-gray-200 dark:border-gray-600"
                      >
                        {c.page != null && (
                          <span className="font-medium">Page {c.page}: </span>
                        )}
                        {c.excerpt}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <button
            type="button"
            onClick={onClose}
            className="btn-sm border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Close
          </button>
          {onChatWithAI && (
            <button
              type="button"
              onClick={() => {
                onChatWithAI();
                onClose?.();
              }}
              className="btn-sm bg-[#456564] hover:bg-[#34514f] text-white flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Chat with AI
            </button>
          )}
        </div>
      </div>
    </ModalBlank>
  );
}

export default InspectionReportModal;
