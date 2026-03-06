import React from "react";

/**
 * CircularProgress Component
 * A reusable circular progress indicator component
 *
 * @param {number} percentage - The percentage value to display (0-100)
 * @param {number} size - The size of the circular progress in pixels (default: 120)
 * @param {number} strokeWidth - The width of the stroke in pixels (default: 8)
 * @param {string} label - Optional label text to display below the percentage (default: "HPS")
 * @param {string} className - Additional CSS classes for the container
 * @param {string} colorClass - Tailwind class for progress stroke, e.g. text-green-500 (default: green)
 */
function CircularProgress({
  percentage,
  size = 120,
  strokeWidth = 8,
  label = "HPS",
  className = "",
  colorClass = "text-green-400 dark:text-green-500",
  innerTextClass = "text-white",
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{width: size, height: size}}
    >
      <svg
        className="transform -rotate-90 absolute inset-0"
        width={size}
        height={size}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-gray-200 dark:text-gray-700"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={`${colorClass} transition-all duration-500`}
        />
      </svg>
      <div className="relative z-10 flex flex-col items-center justify-center">
        <div className={`text-2xl font-bold leading-none ${innerTextClass}`}>
          {percentage}
        </div>
        <div className={`text-[10px] font-semibold uppercase tracking-wider mt-0.5 ${innerTextClass}`}>
          {label}
        </div>
      </div>
    </div>
  );
}

export default CircularProgress;
