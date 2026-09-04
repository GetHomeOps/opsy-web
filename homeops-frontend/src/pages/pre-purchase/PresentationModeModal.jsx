import React, {useCallback, useEffect, useState} from "react";
import {createPortal} from "react-dom";
import {ChevronLeft, ChevronRight, X} from "lucide-react";
import Transition from "../../utils/Transition";
import {buildScoutTakeaways} from "./scoutTakeaways";

const BRAND = "#456564";

function SeverityDot({severity}) {
  const color =
    severity === "major"
      ? "bg-red-500"
      : severity === "moderate"
        ? "bg-amber-500"
        : "bg-neutral-400";
  return (
    <span
      className={`mt-2 w-2 h-2 rounded-full shrink-0 ${color}`}
      aria-hidden
    />
  );
}

function SlideTitle({takeaways}) {
  return (
    <div className="flex flex-col items-center justify-center text-center h-full px-6">
      <p
        className="text-sm font-semibold uppercase tracking-[0.2em] mb-6"
        style={{color: BRAND}}
      >
        Opsy Scout
      </p>
      <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold text-neutral-900 tracking-tight max-w-4xl leading-tight">
        {takeaways.name}
      </h2>
      {takeaways.address ? (
        <p className="mt-4 text-lg sm:text-xl text-neutral-600 max-w-2xl">
          {takeaways.address}
        </p>
      ) : null}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <span
          className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold text-white"
          style={{backgroundColor: BRAND}}
        >
          {takeaways.ratingLabel}
        </span>
        <span className="text-sm text-neutral-500">
          Analyzed {takeaways.analysisDate}
        </span>
      </div>
    </div>
  );
}

function SlideSnapshot({takeaways}) {
  const {issueCounts} = takeaways;
  return (
    <div className="flex flex-col h-full px-6 sm:px-10 justify-center">
      <p
        className="text-xs font-semibold uppercase tracking-[0.18em] mb-3"
        style={{color: BRAND}}
      >
        Snapshot
      </p>
      <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 mb-10">
        Condition at a glance
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6">
        <div>
          <p className="text-sm text-neutral-500 mb-2">Condition score</p>
          <p className="text-6xl sm:text-7xl font-bold tabular-nums text-neutral-900">
            {takeaways.score != null ? takeaways.score : "—"}
          </p>
          <p className="mt-3 text-sm text-neutral-600">
            {takeaways.ratingLabel}
          </p>
          <p className="mt-2 text-sm text-neutral-500 leading-relaxed max-w-xs">
            {takeaways.scoreBlurb}
          </p>
        </div>
        <div>
          <p className="text-sm text-neutral-500 mb-4">Issues</p>
          <ul className="space-y-4">
            <li className="flex items-baseline justify-between gap-4 border-b border-neutral-200 pb-3">
              <span className="text-neutral-700">Major</span>
              <span className="text-4xl font-bold tabular-nums text-red-600">
                {issueCounts.major}
              </span>
            </li>
            <li className="flex items-baseline justify-between gap-4 border-b border-neutral-200 pb-3">
              <span className="text-neutral-700">Moderate</span>
              <span className="text-4xl font-bold tabular-nums text-amber-600">
                {issueCounts.moderate}
              </span>
            </li>
            <li className="flex items-baseline justify-between gap-4">
              <span className="text-neutral-700">Minor</span>
              <span className="text-4xl font-bold tabular-nums text-sky-600">
                {issueCounts.minor}
              </span>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-sm text-neutral-500 mb-2">Estimated repair range</p>
          <p className="text-3xl sm:text-4xl font-bold text-neutral-900 leading-snug">
            {takeaways.repairRange}
          </p>
          {takeaways.repairConfidence ? (
            <p className="mt-3 text-sm text-neutral-500 capitalize">
              Confidence: {takeaways.repairConfidence}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SlideSummary({takeaways}) {
  return (
    <div className="flex flex-col h-full px-6 sm:px-10 justify-center max-w-4xl mx-auto">
      <p
        className="text-xs font-semibold uppercase tracking-[0.18em] mb-3"
        style={{color: BRAND}}
      >
        Overview
      </p>
      <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 mb-8">
        Executive summary
      </h2>
      <p className="text-xl sm:text-2xl text-neutral-700 leading-relaxed whitespace-pre-wrap">
        {takeaways.executiveSummary}
      </p>
    </div>
  );
}

function SlideConcernsPositives({takeaways}) {
  return (
    <div className="flex flex-col h-full px-6 sm:px-10 justify-center">
      <p
        className="text-xs font-semibold uppercase tracking-[0.18em] mb-3"
        style={{color: BRAND}}
      >
        Findings
      </p>
      <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 mb-8">
        Concerns & positives
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-12">
        <div>
          <h3 className="text-lg font-semibold text-red-700 mb-4">
            Top concerns
          </h3>
          {takeaways.concerns.length === 0 ? (
            <p className="text-neutral-500">No top concerns listed.</p>
          ) : (
            <ul className="space-y-4">
              {takeaways.concerns.map((c, i) => (
                <li key={`${c.title}-${i}`} className="flex items-start gap-3">
                  <SeverityDot severity={c.severity} />
                  <div>
                    <p className="text-lg text-neutral-800 leading-snug">
                      {c.title}
                    </p>
                    {c.severity ? (
                      <p className="text-xs uppercase tracking-wide text-neutral-500 mt-1 capitalize">
                        {c.severity}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-emerald-700 mb-4">
            Positive findings
          </h3>
          {takeaways.positives.length === 0 ? (
            <p className="text-neutral-500">No positive findings listed.</p>
          ) : (
            <ul className="space-y-4">
              {takeaways.positives.map((p, i) => (
                <li key={`${p}-${i}`} className="flex items-start gap-3">
                  <span
                    className="mt-2 w-2 h-2 rounded-full shrink-0 bg-emerald-500"
                    aria-hidden
                  />
                  <p className="text-lg text-neutral-800 leading-snug">{p}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function SlideRecommendations({takeaways}) {
  return (
    <div className="flex flex-col h-full px-6 sm:px-10 justify-center">
      <p
        className="text-xs font-semibold uppercase tracking-[0.18em] mb-3"
        style={{color: BRAND}}
      >
        Next steps
      </p>
      <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 mb-8">
        Key recommendations
      </h2>
      {takeaways.recommendations.length === 0 ? (
        <p className="text-neutral-500 text-lg">No recommendations yet.</p>
      ) : (
        <ol className="space-y-5 max-w-3xl">
          {takeaways.recommendations.map((r, i) => (
            <li key={`${r}-${i}`} className="flex items-start gap-4">
              <span
                className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold text-white shrink-0 mt-0.5"
                style={{backgroundColor: BRAND}}
              >
                {i + 1}
              </span>
              <p className="text-xl text-neutral-800 leading-snug">{r}</p>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-10 text-sm text-neutral-500 leading-relaxed max-w-3xl border-t border-neutral-200 pt-6">
        {takeaways.disclaimer}
      </p>
    </div>
  );
}

const SLIDES = [
  {id: "title", render: SlideTitle},
  {id: "snapshot", render: SlideSnapshot},
  {id: "summary", render: SlideSummary},
  {id: "findings", render: SlideConcernsPositives},
  {id: "recommendations", render: SlideRecommendations},
];

export default function PresentationModeModal({open, onClose, analysis}) {
  const [index, setIndex] = useState(0);
  const takeaways = buildScoutTakeaways(analysis);
  const total = SLIDES.length;

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const prev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const next = useCallback(() => {
    setIndex((i) => Math.min(total - 1, i + 1));
  }, [total]);

  useEffect(() => {
    if (!open) return undefined;
    function handleKey(e) {
      if (e.key === "Escape") onClose?.();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        next();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose, prev, next]);

  if (!takeaways || typeof document === "undefined") return null;

  const Slide = SLIDES[index].render;

  return createPortal(
    <Transition
      show={open}
      unmountOnExit
      enter="transition ease-out duration-200"
      enterStart="opacity-0"
      enterEnd="opacity-100"
      leave="transition ease-in duration-150"
      leaveStart="opacity-100"
      leaveEnd="opacity-0"
      className="fixed inset-0 z-[300] bg-neutral-950/80 flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Opsy Scout presentation mode"
    >
      <div className="relative w-full h-full max-w-6xl max-h-[92vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-neutral-100 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="text-xs font-semibold uppercase tracking-wider shrink-0"
              style={{color: BRAND}}
            >
              Presentation
            </span>
            <span className="text-sm text-neutral-500 tabular-nums">
              {index + 1} / {total}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-[#456564]/40"
            aria-label="Close presentation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto py-6 sm:py-10">
          <Slide takeaways={takeaways} />
        </div>

        <div className="flex items-center justify-between gap-4 px-4 sm:px-6 py-3 border-t border-neutral-100 shrink-0">
          <button
            type="button"
            onClick={prev}
            disabled={index === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
            aria-label="Previous slide"
          >
            <ChevronLeft className="w-5 h-5" />
            Prev
          </button>

          <div className="flex items-center gap-2" role="tablist" aria-label="Slides">
            {SLIDES.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  i === index ? "bg-[#456564]" : "bg-neutral-300 hover:bg-neutral-400"
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={next}
            disabled={index === total - 1}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
            aria-label="Next slide"
          >
            Next
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </Transition>,
    document.body
  );
}
