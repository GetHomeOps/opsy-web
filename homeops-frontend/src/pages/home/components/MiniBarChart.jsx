import React from "react";

/**
 * Small SVG bar chart for compact KPI displays (e.g. SuperAdmin growth/role charts).
 */
function MiniBarChart({ data, height = 120, barColor = "#456564" }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  const barWidth = Math.min(32, Math.floor(200 / data.length) - 4);
  const chartWidth = data.length * (barWidth + 6);

  return (
    <svg
      viewBox={`0 0 ${chartWidth} ${height}`}
      className="w-full"
      style={{ maxHeight: height }}
      preserveAspectRatio="xMidYMax meet"
    >
      {data.map((d, i) => {
        const barH = (d.value / max) * (height - 24);
        return (
          <g key={i}>
            <rect
              x={i * (barWidth + 6) + 3}
              y={height - barH - 16}
              width={barWidth}
              height={barH}
              rx={4}
              fill={barColor}
              opacity={0.85}
              className="transition-all duration-500"
            />
            <text
              x={i * (barWidth + 6) + 3 + barWidth / 2}
              y={height - 2}
              textAnchor="middle"
              className="fill-gray-400 dark:fill-gray-500"
              fontSize="9"
              fontWeight="500"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default MiniBarChart;
