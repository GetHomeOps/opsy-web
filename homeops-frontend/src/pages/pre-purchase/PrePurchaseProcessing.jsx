import React from "react";
import {AlertCircle, CheckCircle2, Loader2, RefreshCw} from "lucide-react";
import SectionCard from "../properties/partials/passport/SectionCard";
import {ANALYSIS_STAGES, isInProgress} from "./prePurchaseUtils";

function stageIndex(status) {
  if (status === "failed") return -1;
  if (status === "draft") return -1;
  const idx = ANALYSIS_STAGES.findIndex((s) => s.key === status);
  if (idx >= 0) return idx;
  if (status === "completed") return ANALYSIS_STAGES.length - 1;
  return 0;
}

export default function PrePurchaseProcessing({
  analysis,
  onRetry,
  retrying = false,
  inWizard = false,
}) {
  const currentIdx = stageIndex(analysis?.status);
  const failed = analysis?.status === "failed";
  const completed = analysis?.status === "completed";
  const pct = analysis?.progressPct ?? 0;

  const title = completed
    ? "Analysis complete"
    : failed
      ? "Analysis failed"
      : "Analysis in progress";
  const description = inWizard
    ? completed
      ? "Review the results on the analysis page."
      : failed
        ? "You can retry here or continue and try again later."
        : "Stay on this step while we analyze your inspection report."
    : "You can leave this page — progress is saved.";

  return (
    <SectionCard title={title} description={description}>
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-neutral-500 mb-1.5">
          <span>{analysis?.progressMessage || "Working…"}</span>
          <span className="tabular-nums">{pct}%</span>
        </div>
        <div
          className="h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Analysis progress"
        >
          <div
            className={`h-full transition-all duration-500 ${
              failed ? "bg-red-500" : "bg-[#456564]"
            }`}
            style={{width: `${Math.min(100, Math.max(failed ? 100 : pct, 4))}%`}}
          />
        </div>
      </div>

      <ol className="space-y-3">
        {ANALYSIS_STAGES.map((stage, idx) => {
          const done = !failed && currentIdx > idx;
          const active = !failed && currentIdx === idx && isInProgress(analysis?.status);
          const isCompleteStage = stage.key === "completed" && analysis?.status === "completed";

          return (
            <li key={stage.key} className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0" aria-hidden>
                {done || isCompleteStage ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : active ? (
                  <Loader2 className="w-5 h-5 text-[#456564] animate-spin" />
                ) : (
                  <span className="w-5 h-5 rounded-full border-2 border-neutral-300 dark:border-neutral-600 block" />
                )}
              </span>
              <div>
                <p
                  className={`text-sm font-medium ${
                    done || active || isCompleteStage
                      ? "text-neutral-900 dark:text-white"
                      : "text-neutral-400"
                  }`}
                >
                  {stage.label}
                </p>
                {active && (
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {analysis?.progressMessage || "Processing…"}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {failed && (
        <div
          className="mt-5 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-4"
          role="alert"
        >
          <div className="flex items-start gap-2 text-red-700 dark:text-red-300">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-sm">Analysis failed</p>
              <p className="text-sm mt-1 break-words">
                {analysis?.errorMessage || "Something went wrong while processing documents."}
              </p>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  disabled={retrying}
                  className="btn-sm btn-primary mt-3 inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {retrying ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  Retry analysis
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
