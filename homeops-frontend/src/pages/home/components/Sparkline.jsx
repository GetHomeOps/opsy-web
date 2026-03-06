import React from "react";

/**
 * Small SVG sparkline for trend visualization.
 */
function Sparkline({ data, height = 48, color = "#456564" }) {
  if (!data?.length || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 200;
  const pad = 2;

  const points = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (w - pad * 2);
      const y = pad + (1 - (v - min) / range) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const firstX = pad;
  const lastX = pad + ((data.length - 1) / (data.length - 1)) * (w - pad * 2);
  const areaPath = `M${firstX},${height} L${points
    .split(" ")
    .map((p) => `L${p}`)
    .join(" ")} L${lastX},${height} Z`.replace("LL", "L");

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      className="w-full"
      style={{ maxHeight: height }}
    >
      <defs>
        <linearGradient
          id={`sparkFill-${color.replace("#", "")}`}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path
        d={areaPath}
        fill={`url(#sparkFill-${color.replace("#", "")})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default Sparkline;
