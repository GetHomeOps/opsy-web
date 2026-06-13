import React from "react";

function MiniSparkline({points, className = ""}) {
  if (!points?.length) return null;
  const w = 72;
  const h = 28;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const coords = points.map((v, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  });
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={`w-[72px] h-7 shrink-0 ${className}`}
      aria-hidden
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={coords.join(" ")}
        className="text-emerald-500/80"
      />
    </svg>
  );
}

/** Top-row KPI tile: label, value, trend, optional sparkline. */
function FinancialKpiCard({
  icon: Icon,
  label,
  value,
  change,
  changeTone = "positive",
  sparkline,
  suffix,
}) {
  const changeColors = {
    positive: "text-emerald-600 dark:text-emerald-400",
    negative: "text-emerald-600 dark:text-emerald-400",
    neutral: "text-neutral-500 dark:text-neutral-400",
  };

  return (
    <section className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/50 bg-white dark:bg-neutral-900 px-4 py-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            {Icon && (
              <Icon className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 shrink-0" />
            )}
            <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.06em] truncate">
              {label}
            </span>
          </div>
          <p className="text-xl font-bold text-neutral-900 dark:text-white tabular-nums leading-tight">
            {value}
            {suffix && (
              <span className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 ml-0.5">
                {suffix}
              </span>
            )}
          </p>
          {change && (
            <p
              className={`text-[11px] font-medium mt-1 ${changeColors[changeTone] ?? changeColors.neutral}`}
            >
              {change}
            </p>
          )}
        </div>
        {sparkline && <MiniSparkline points={sparkline} />}
      </div>
    </section>
  );
}

export default FinancialKpiCard;
