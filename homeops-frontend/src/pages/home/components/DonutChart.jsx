import React from "react";

/**
 * SVG donut chart for segment breakdowns (e.g. subscriptions).
 */
function DonutChart({ segments, size = 140, strokeWidth = 20 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  let accumulated = 0;

  return (
    <svg width={size} height={size} className="mx-auto">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        className="text-gray-100 dark:text-gray-700"
        strokeWidth={strokeWidth}
      />
      {segments.map((seg, i) => {
        const pct = seg.value / total;
        const dashLen = pct * circumference;
        const dashOffset = -accumulated * circumference;
        accumulated += pct;
        return (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dashLen} ${circumference - dashLen}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            className="transition-all duration-700"
            style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
          />
        );
      })}
      <text
        x={size / 2}
        y={size / 2 - 6}
        textAnchor="middle"
        className="fill-gray-900 dark:fill-white text-lg font-bold"
        fontSize="22"
        fontWeight="700"
      >
        {total}
      </text>
      <text
        x={size / 2}
        y={size / 2 + 14}
        textAnchor="middle"
        className="fill-gray-400 dark:fill-gray-500"
        fontSize="10"
      >
        total
      </text>
    </svg>
  );
}

export default DonutChart;
