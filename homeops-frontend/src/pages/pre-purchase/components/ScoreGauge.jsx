import React from "react";
import {StatusBadge} from "../../properties/partials/passport/StatusBadge";
import {CONDITION_BADGE, formatConditionRating} from "../prePurchaseUtils";

function scoreColor(rating) {
  if (rating === "excellent" || rating === "very_good" || rating === "good") {
    return "#059669";
  }
  if (rating === "fair" || rating === "needs_attention") return "#d97706";
  if (rating === "poor" || rating === "critical") return "#dc2626";
  return "#6b7280";
}

/** Semi-circular gauge for overall condition score. */
export default function ScoreGauge({score, rating, compact = false}) {
  const value = score == null ? null : Math.max(0, Math.min(100, Number(score)));
  const color = scoreColor(rating);

  const cx = 60;
  const cy = 58;
  const r = 46;
  const startX = cx - r;
  const endX = cx + r;
  const trackPath = `M ${startX} ${cy} A ${r} ${r} 0 0 1 ${endX} ${cy}`;

  const pct = value == null ? 0 : value / 100;
  const angle = Math.PI * (1 - pct);
  const needleX = cx + r * Math.cos(angle);
  const needleY = cy - r * Math.sin(angle);

  const arcLength = Math.PI * r;
  const progressLength = pct * arcLength;

  return (
    <div className="flex flex-col items-center">
      <div className={`relative w-full ${compact ? "max-w-[160px]" : "max-w-[200px]"}`}>
        <svg viewBox="0 0 120 78" className="w-full h-auto" aria-hidden>
          <path
            d={trackPath}
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            strokeLinecap="round"
            className="text-neutral-100 dark:text-neutral-800"
          />
          <path
            d={trackPath}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${progressLength} ${arcLength}`}
          />
          {value != null && (
            <circle
              cx={needleX}
              cy={needleY}
              r="5"
              fill={color}
              stroke="white"
              strokeWidth="2"
            />
          )}
        </svg>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center pb-0.5">
          <span
            className={`${compact ? "text-2xl" : "text-3xl"} font-bold text-neutral-900 dark:text-white tabular-nums leading-none`}
          >
            {value ?? "—"}
            <span className="text-sm font-semibold text-neutral-400 ml-1">
              / 100
            </span>
          </span>
          {rating && (
            <StatusBadge
              tone={CONDITION_BADGE[rating] || "neutral"}
              className="mt-1.5"
            >
              {formatConditionRating(rating)}
            </StatusBadge>
          )}
        </div>
        <div className="flex justify-between px-1 -mt-1 text-[10px] text-neutral-400 tabular-nums">
          <span>0</span>
          <span>100</span>
        </div>
      </div>
    </div>
  );
}
