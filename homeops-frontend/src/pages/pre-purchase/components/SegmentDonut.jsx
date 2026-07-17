import React, {useMemo} from "react";

/**
 * Multi-segment donut chart.
 * @param {{label: string, value: number, color: string}[]} segments
 */
export default function SegmentDonut({
  segments = [],
  size = 140,
  strokeWidth = 14,
  centerLabel,
  centerSubLabel,
  className = "",
  formatValue,
}) {
  const total = useMemo(
    () => segments.reduce((sum, s) => sum + (Number(s.value) || 0), 0),
    [segments]
  );

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const cx = size / 2;
  const cy = size / 2;

  let offset = 0;
  const arcs = segments
    .filter((s) => Number(s.value) > 0)
    .map((s) => {
      const value = Number(s.value) || 0;
      const length = total > 0 ? (value / total) * circumference : 0;
      const dashOffset = -offset;
      offset += length;
      return {...s, length, dashOffset};
    });

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="relative" style={{width: size, height: size}}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
            className="text-neutral-100 dark:text-neutral-800"
          />
          {arcs.map((arc) => (
            <circle
              key={arc.label}
              cx={cx}
              cy={cy}
              r={radius}
              stroke={arc.color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${arc.length} ${circumference - arc.length}`}
              strokeDashoffset={arc.dashOffset}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        {(centerLabel != null || centerSubLabel) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
            {centerLabel != null && (
              <span className="text-xl font-bold text-neutral-900 dark:text-white tabular-nums leading-none">
                {centerLabel}
              </span>
            )}
            {centerSubLabel && (
              <span className="text-[10px] text-neutral-500 mt-1 leading-tight">
                {centerSubLabel}
              </span>
            )}
          </div>
        )}
      </div>
      <ul className="mt-3 w-full space-y-1.5">
        {segments.map((s) => (
          <li
            key={s.label}
            className="flex items-center justify-between gap-2 text-xs"
          >
            <span className="inline-flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400 min-w-0">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{backgroundColor: s.color}}
              />
              <span className="truncate">{s.label}</span>
            </span>
            <span className="tabular-nums font-semibold text-neutral-800 dark:text-neutral-200 shrink-0">
              {formatValue ? formatValue(s.value) : s.value}
              {total > 0 && s.showPct !== false
                ? ` (${Math.round((Number(s.value) / total) * 100)}%)`
                : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
