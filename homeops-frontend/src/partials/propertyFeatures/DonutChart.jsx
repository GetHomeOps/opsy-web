import React from "react";

/**
 * DonutChart Component
 * A reusable donut chart component for displaying percentages
 *
 * @param {number} percentage - The percentage value to display (0-100)
 * @param {number} size - The size of the donut chart in pixels (default: 160)
 * @param {number} strokeWidth - The width of the stroke in pixels (default: 12)
 * @param {string} className - Additional CSS classes for the container
 * @param {string} colorClass - Custom color class for the progress circle (default: "text-green-400 dark:text-green-500")
 */
function DonutChart({
  percentage,
  size = 160,
  strokeWidth = 12,
  className = "",
  colorClass = "text-green-400 dark:text-green-500",
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  // Adjust text size based on chart size
  const textSizeClass = size <= 80 ? "text-xl" : "text-4xl";

  return (
    <div className={`relative ${className}`} style={{width: size, height: size}}>
      <svg className="transform -rotate-90" width={size} height={size}>
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
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div
            className={`${textSizeClass} font-bold text-gray-900 dark:text-white`}
          >
            {percentage}%
          </div>
        </div>
      </div>
    </div>
  );
}

export default DonutChart;
