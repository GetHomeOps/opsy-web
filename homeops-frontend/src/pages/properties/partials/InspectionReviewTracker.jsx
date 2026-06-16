/**
 * InspectionReviewTracker
 * Domino's-style progress tracker shown to customers while their AI inspection
 * analysis is being reviewed by Opsy's team. Findings stay hidden until approved.
 */

import React from "react";
import {CheckCircle2, Sparkles, Clock, ShieldCheck, FileCheck} from "lucide-react";

const STAGES = [
  {
    key: "complete",
    title: "Analysis Complete",
    description: "The AI has finished analyzing the inspection report.",
    icon: Sparkles,
  },
  {
    key: "review",
    title: "Under Review",
    description:
      "Opsy's team is reviewing the analysis to ensure accuracy and quality.",
    icon: Clock,
  },
  {
    key: "ready",
    title: "Approved & Ready",
    description:
      "The review has been completed and the results are now available.",
    icon: FileCheck,
  },
];

/**
 * @param {object} props
 * @param {'pending_review'|'revision_requested'|'approved'} props.reviewStatus
 */
export default function InspectionReviewTracker({reviewStatus = "pending_review"}) {
  const isApproved = reviewStatus === "approved";
  // Stage index that is currently active (0-based). When approved, all stages are done.
  const activeIndex = isApproved ? STAGES.length : 1;

  return (
    <div className="flex flex-col px-6 py-8 sm:px-10 sm:py-10 max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-[#456564]/10 dark:bg-[#456564]/20 flex items-center justify-center mb-5 mx-auto">
          <ShieldCheck className="w-8 h-8 text-[#456564] dark:text-[#5a7a78]" />
        </div>
        <h3 className="text-xl font-semibold text-neutral-800 dark:text-neutral-100 mb-2">
          We're reviewing your inspection.
        </h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-md mx-auto">
          Your report is in good hands.
        </p>
      </div>

      {/* Stage tracker */}
      <ol className="relative mb-8">
        {STAGES.map((stage, idx) => {
          const isDone = idx < activeIndex;
          const isActive = idx === activeIndex && !isApproved;
          const Icon = stage.icon;
          const isLast = idx === STAGES.length - 1;
          return (
            <li key={stage.key} className="relative flex gap-4 pb-8 last:pb-0">
              {/* Connector line */}
              {!isLast && (
                <span
                  className={`absolute left-[19px] top-10 bottom-0 w-0.5 ${
                    isDone
                      ? "bg-[#456564] dark:bg-[#5a7a78]"
                      : "bg-neutral-200 dark:bg-neutral-700"
                  }`}
                  aria-hidden="true"
                />
              )}
              {/* Node */}
              <span
                className={`relative z-10 shrink-0 w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                  isDone
                    ? "bg-[#456564] border-[#456564] text-white"
                    : isActive
                      ? "bg-[#456564]/10 border-[#456564] text-[#456564] dark:text-[#5a7a78]"
                      : "bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600 text-neutral-400 dark:text-neutral-500"
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </span>
              <div className="pt-1.5 min-w-0">
                <p
                  className={`text-sm font-semibold ${
                    isDone || isActive
                      ? "text-neutral-800 dark:text-neutral-100"
                      : "text-neutral-500 dark:text-neutral-400"
                  }`}
                >
                  {stage.title}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed">
                  {stage.description}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Body */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/60 dark:bg-neutral-800/30 p-5 space-y-3">
        <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
          Opsy has completed the initial AI analysis and is now validating the
          findings to ensure accuracy and relevance.
        </p>
        <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
          This process typically takes only a few minutes. We'd rather get it
          right than get it fast.
        </p>
        <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
          We'll notify you as soon as your results are ready.
        </p>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-6 leading-relaxed">
        Opsy uses both AI and human review to analyze inspection reports. Our
        findings are intended to help inform decisions, not replace professional
        judgment. Always review important findings with a qualified inspector,
        contractor, or real estate professional before making decisions
        regarding a property.
      </p>
    </div>
  );
}
