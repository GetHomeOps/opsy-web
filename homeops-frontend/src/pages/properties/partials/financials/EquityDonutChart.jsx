import React, {useState} from "react";
import {formatPercent} from "./financialsFormat";
import {ChartHoverTooltip} from "./ChartSegmentPopover";

const EQUITY_COLOR = "#456564";
const DEBT_COLOR = "#2f3f3e";
const LIEN_COLOR = "#d4d4d4";

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad)};
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const delta = ((endAngle - startAngle) % 360 + 360) % 360;
  const largeArc = delta > 180 ? 1 : 0;
  return {
    d: `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`,
    delta,
  };
}

/**
 * Single equity donut. Center shows equity %, never LTV.
 * Segments are independent arc paths so hover hit-testing works.
 */
function EquityDonutChart({
  equityPercent,
  equityAmount,
  ltvPercent,
  debtAmount,
  otherLiensPercent = 0,
  otherLiensAmount,
  size = 148,
  strokeWidth = 16,
}) {
  const [hover, setHover] = useState(null);
  const [cursor, setCursor] = useState(null);
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const equity = Math.max(0, Number(equityPercent) || 0) / 100;
  const debt = Math.max(0, Number(ltvPercent) || 0) / 100;
  const liens = Math.max(0, Number(otherLiensPercent) || 0) / 100;
  const segments = [
    {id: "equity", label: "Equity", value: equity, percent: equityPercent, amount: equityAmount, color: EQUITY_COLOR},
    {id: "debt", label: "Debt (mortgage)", value: debt, percent: ltvPercent, amount: debtAmount, color: DEBT_COLOR},
    {id: "liens", label: "Other liens", value: liens, percent: otherLiensPercent, amount: otherLiensAmount, color: LIEN_COLOR},
  ].filter((s) => s.value > 0.001);

  const sum = segments.reduce((acc, s) => acc + s.value, 0) || 1;
  let accumulated = 0;

  return (
    <div className="relative shrink-0" style={{width: size, height: size}}>
      <svg width={size} height={size} aria-hidden>
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-neutral-100 dark:text-neutral-800"
          strokeWidth={strokeWidth}
        />
        {segments.map((seg) => {
          const pct = seg.value / sum;
          const startAngle = accumulated * 360;
          const endAngle = (accumulated + pct) * 360;
          accumulated += pct;
          const {d, delta} = describeArc(cx, cy, radius, startAngle, endAngle);
          const handlers = {
            onMouseEnter: (e) => {
              setHover(seg);
              setCursor({x: e.clientX, y: e.clientY});
            },
            onMouseMove: (e) => setCursor({x: e.clientX, y: e.clientY}),
            onMouseLeave: () => {
              setHover(null);
              setCursor(null);
            },
            onFocus: (e) => {
              setHover(seg);
              const rect = e.currentTarget.getBoundingClientRect();
              setCursor({x: rect.left + rect.width / 2, y: rect.top});
            },
            onBlur: () => {
              setHover(null);
              setCursor(null);
            },
          };
          if (delta >= 359.5) {
            return (
              <circle
                key={seg.id}
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={strokeWidth}
                pointerEvents="stroke"
                tabIndex={0}
                className="outline-none cursor-pointer"
                {...handlers}
              />
            );
          }
          return (
            <path
              key={seg.id}
              d={d}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeLinecap="butt"
              pointerEvents="stroke"
              tabIndex={0}
              className="outline-none cursor-pointer"
              {...handlers}
            />
          );
        })}
      </svg>
      {hover && (
        <ChartHoverTooltip
          label={hover.label}
          amount={hover.amount}
          percent={hover.percent}
          x={cursor?.x}
          y={cursor?.y}
        />
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        <span className="text-xl font-bold text-neutral-900 dark:text-white tabular-nums leading-none">
          {formatPercent(equityPercent, 0) ?? "—"}
        </span>
        <span className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1 uppercase tracking-[0.08em]">
          Equity
        </span>
      </div>
    </div>
  );
}

export default EquityDonutChart;
