import React from "react";

const SEGMENT_COLORS = ["#456564", "#5a8a88", "#7fa3a1", "#a8c4c2"];

/** Multi-segment donut for monthly payment breakdown. */
function PaymentDonutChart({segments, total, size = 120, strokeWidth = 16}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const sum = segments.reduce((acc, s) => acc + s.value, 0) || 1;
  let accumulated = 0;

  return (
    <div className="relative shrink-0" style={{width: size, height: size}}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-neutral-100 dark:text-neutral-800"
          strokeWidth={strokeWidth}
        />
        {segments.map((seg, i) => {
          const pct = seg.value / sum;
          const dashLen = pct * circumference;
          const dashOffset = -accumulated * circumference;
          accumulated += pct;
          return (
            <circle
              key={seg.id}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={SEGMENT_COLORS[i % SEGMENT_COLORS.length]}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dashLen} ${circumference - dashLen}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              style={{
                transform: "rotate(-90deg)",
                transformOrigin: "center",
              }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        <span className="text-lg font-bold text-neutral-900 dark:text-white tabular-nums leading-none">
          {total}
        </span>
        <span className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
          /mo
        </span>
      </div>
    </div>
  );
}

export default PaymentDonutChart;
