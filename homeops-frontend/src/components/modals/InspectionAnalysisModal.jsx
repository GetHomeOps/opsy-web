import React, { useState } from "react";
import {
  X,
  RefreshCw,
  Copy,
  Download,
  FileCheck,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Calendar,
  Plus,
} from "lucide-react";
import ModalBlank from "../ModalBlank";
import { PROPERTY_SYSTEMS } from "../../pages/properties/constants/propertySystems";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "systems", label: "Systems" },
  { id: "maintenance", label: "Maintenance" },
  { id: "risks", label: "Risks" },
  { id: "source", label: "Source" },
];

const CONDITION_COLORS = {
  excellent: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  good: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  fair: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  poor: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  unknown: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
};

const PRIORITY_COLORS = {
  high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  low: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  urgent: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const SEVERITY_COLORS = {
  critical: "text-red-700 dark:text-red-300 font-medium",
  high: "text-red-600 dark:text-red-400",
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

function getSystemLabel(key) {
  if (!key) return "—";
  const k = typeof key === "string" ? key : key?.systemType ?? key?.system_key ?? key?.name;
  const sys = PROPERTY_SYSTEMS.find((s) => s.id === k);
  return sys?.name || k || "—";
}

function InspectionAnalysisModal({
  open,
  onClose,
  reportMeta,
  state: { status, data, error },
  handlers: { onRefresh, onAddSystems, onSchedule, onCopy, onDownload },
  onScrollToUpload,
}) {
  const [activeTab, setActiveTab] = useState("overview");
  const [evidenceExpanded, setEvidenceExpanded] = useState({});
  const [errorDetailsExpanded, setErrorDetailsExpanded] = useState(false);

  const toggleEvidence = (idx) => {
    setEvidenceExpanded((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleCopy = () => {
    const text = data?.summary ?? "";
    if (text && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      onCopy?.();
    }
  };

  const handleDownload = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inspection-analysis-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onDownload?.();
  };

  const subheader = reportMeta
    ? [reportMeta.fileName, reportMeta.document_date && formatDate(reportMeta.document_date)]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <ModalBlank
      modalOpen={open}
      setModalOpen={(isOpen) => !isOpen && onClose?.()}
      contentClassName="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
    >
      <div className="flex flex-col h-full max-h-[90vh]">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-[#456564]/10 dark:bg-[#456564]/20 flex items-center justify-center shrink-0">
              <FileCheck className="w-5 h-5 text-[#456564] dark:text-[#5a7a78]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Inspection Report Analysis
              </h2>
              {subheader && (
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {subheader}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {status === "ready" && (
              <>
                <button
                  type="button"
                  onClick={onRefresh}
                  className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400 transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400 transition-colors"
                  title="Copy summary"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {status === "empty" && (
            <div className="flex-1 flex flex-col items-center justify-center py-12 px-6 text-center">
              <AlertCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Upload an inspection report to generate insights
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mb-4">
                Go to the Documents tab and upload a PDF inspection report. Once uploaded, you can run AI analysis here.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose?.();
                  onScrollToUpload?.();
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#456564] hover:bg-[#34514f] text-white text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Go to Documents
              </button>
            </div>
          )}

          {(status === "idle" || status === "loading") && (
            <div className="flex-1 flex flex-col items-center justify-center py-12 px-6">
              <div className="animate-pulse space-y-4 w-full max-w-sm">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-6 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing report…
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-400"
              >
                Cancel
              </button>
            </div>
          )}

          {status === "error" && (
            <div className="flex-1 flex flex-col items-center justify-center py-12 px-6 text-center">
              <AlertCircle className="w-12 h-12 text-amber-500 dark:text-amber-400 mb-3" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Something went wrong
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
                {error}
              </p>
              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={onRefresh}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#456564] hover:bg-[#34514f] text-white text-sm font-medium"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => setErrorDetailsExpanded(!errorDetailsExpanded)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm"
                >
                  {errorDetailsExpanded ? "Hide" : "View"} raw error details
                </button>
              </div>
              {errorDetailsExpanded && (
                <pre className="mt-4 p-3 text-left text-xs bg-gray-100 dark:bg-gray-800 rounded-lg overflow-auto max-h-32 w-full">
                  {error}
                </pre>
              )}
            </div>
          )}

          {status === "ready" && data && (
            <>
              {/* Tabs */}
              <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 px-4">
                <nav className="flex gap-1">
                  {TABS.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`py-3 px-3 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === tab.id
                          ? "border-[#456564] text-[#456564] dark:text-[#5a7a78]"
                          : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-400"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                {activeTab === "overview" && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium capitalize ${
                          CONDITION_COLORS[data.property_state] ?? CONDITION_COLORS.unknown
                        }`}
                      >
                        {data.property_state}
                      </span>
                      {data.confidence != null && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {Math.round(data.confidence * 100)}% confidence
                        </span>
                      )}
                    </div>
                    {data.conditionRationale && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {data.conditionRationale}
                      </p>
                    )}
                    {data.summary && (
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {data.summary}
                      </p>
                    )}
                  </div>
                )}

                {activeTab === "systems" && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
                        Systems detected
                      </h3>
                      <ul className="space-y-2">
                        {(data.systems_detected ?? data.systemsDetected ?? []).map((s, idx) => {
                          const sys = typeof s === "object" ? s : { name: s };
                          const name = sys.name ?? sys.systemType ?? getSystemLabel(sys);
                          const condition = sys.condition ?? "unknown";
                          const confidence = sys.confidence ?? 0.5;
                          const quotes = sys.evidence_quotes ?? (sys.evidence ? [sys.evidence] : []);
                          const pageRefs = sys.page_refs ?? [];
                          const isExpanded = evidenceExpanded[`sys-${idx}`];
                          return (
                            <li
                              key={idx}
                              className="py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700"
                            >
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-gray-800 dark:text-gray-200">
                                  {getSystemLabel(name)}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded text-xs capitalize ${
                                    CONDITION_COLORS[condition] ?? CONDITION_COLORS.unknown
                                  }`}
                                >
                                  {condition}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {Math.round(confidence * 100)}%
                                </span>
                                <span className="text-xs text-gray-400">
                                  {pageRefs.length ? `(p. ${pageRefs.join(", ")})` : ""}
                                </span>
                              </div>
                              {quotes.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => toggleEvidence(`sys-${idx}`)}
                                  className="mt-1 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                                >
                                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                  Evidence
                                </button>
                              )}
                              {isExpanded && quotes.length > 0 && (
                                <div className="mt-2 pl-4 border-l-2 border-gray-200 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-400 italic">
                                  {quotes.map((q, i) => (
                                    <p key={i} className="mb-1">
                                      "{q}"
                                    </p>
                                  ))}
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
                        Systems to consider adding
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {(data.systems_missing_suspected ?? data.suggestedSystemsToAdd ?? []).map((s, idx) => {
                          const name = s.name ?? s.systemType ?? s.system_key ?? "—";
                          return (
                            <span
                              key={idx}
                              className="inline-flex px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs font-medium text-gray-700 dark:text-gray-300"
                            >
                              {getSystemLabel(name)}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "maintenance" && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      Recommended actions
                    </h3>
                    <ul className="space-y-2">
                      {(data.recommended_actions ?? data.maintenanceSuggestions ?? []).map((action, idx) => {
                        const a = typeof action === "object" ? action : { title: action, task: action };
                        const title = a.title ?? a.task ?? "—";
                        const priority = a.priority ?? "medium";
                        const rationale = a.rationale ?? a.rationale ?? "";
                        const schedule = a.suggested_schedule_window ?? a.suggestedWhen ?? "";
                        return (
                          <li
                            key={idx}
                            className="flex items-start gap-2 py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700"
                          >
                            <input type="checkbox" className="mt-1 shrink-0" readOnly />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                {title}
                              </span>
                              <span
                                className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                                  PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.medium
                                }`}
                              >
                                {priority}
                              </span>
                              {(rationale || schedule) && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                  {[schedule, rationale].filter(Boolean).join(" — ")}
                                </p>
                              )}
                              <button
                                type="button"
                                onClick={() => onSchedule?.({ systemLabel: title, systemType: a.category ?? "general" })}
                                className="mt-1 inline-flex items-center gap-1 text-xs text-[#456564] hover:underline"
                              >
                                <Calendar className="w-3 h-3" />
                                Schedule
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {activeTab === "risks" && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      Risks & items needing attention
                    </h3>
                    <ul className="space-y-2">
                      {(data.risks ?? data.needsAttention ?? []).map((r, idx) => {
                        const item = typeof r === "object" ? r : { title: r };
                        const title = item.title ?? "—";
                        const severity = item.severity ?? "medium";
                        const rationale = item.rationale ?? item.suggestedAction ?? item.evidence ?? "";
                        const pageRefs = item.page_refs ?? [];
                        return (
                          <li
                            key={idx}
                            className="py-2 px-3 rounded-lg bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30"
                          >
                            <span>
                              <span className={`text-sm font-medium ${SEVERITY_COLORS[severity] ?? ""}`}>
                                {title}
                              </span>
                              {pageRefs.length ? (
                                <span className="ml-1 text-xs text-gray-500">(p. {pageRefs.join(", ")})</span>
                              ) : null}
                            </span>
                            {rationale && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                                {rationale}
                              </p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {activeTab === "source" && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      Citations
                    </h3>
                    <ul className="space-y-1">
                      {(data.citations ?? []).map((c, idx) => (
                        <li
                          key={idx}
                          className="text-xs text-gray-600 dark:text-gray-400 pl-4 border-l-2 border-gray-200 dark:border-gray-600"
                        >
                          {c.page != null && (
                            <span className="font-medium">Page {c.page}: </span>
                          )}
                          {c.quote ?? c.excerpt ?? ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer - only when ready */}
        {status === "ready" && data && (
          <div className="flex-shrink-0 flex flex-wrap items-center justify-end gap-3 px-5 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <button
              type="button"
              onClick={() => onAddSystems?.(data)}
              className="btn-sm bg-[#456564] hover:bg-[#34514f] text-white flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add recommended systems
            </button>
            <button
              type="button"
              onClick={() => onSchedule?.()}
              className="btn-sm border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              Schedule maintenance
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="btn-sm border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download JSON
            </button>
          </div>
        )}
      </div>
    </ModalBlank>
  );
}

export default InspectionAnalysisModal;
