import React from "react";
import {formatCurrency} from "../prePurchaseUtils";

export default function RepairRangeScale({low, high}) {
  if (low == null && high == null) return null;
  const lo = Number(low ?? high);
  const hi = Number(high ?? low);
  const mid = (lo + hi) / 2;
  const pad = Math.max((hi - lo) * 0.35, lo * 0.15, 500);
  const scaleMin = Math.max(0, lo - pad);
  const scaleMax = hi + pad;
  const span = scaleMax - scaleMin || 1;
  const loPct = ((lo - scaleMin) / span) * 100;
  const midPct = ((mid - scaleMin) / span) * 100;
  const hiPct = ((hi - scaleMin) / span) * 100;

  return (
    <div className="mt-4">
      <div className="relative h-2 rounded-full bg-neutral-100 dark:bg-neutral-800">
        <div
          className="absolute top-0 h-2 rounded-full bg-[#456564]/25"
          style={{left: `${loPct}%`, width: `${Math.max(hiPct - loPct, 2)}%`}}
        />
        <span
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#456564] border-2 border-white shadow-sm"
          style={{left: `${midPct}%`}}
        />
      </div>
      <div className="flex justify-between mt-2 text-[10px] text-neutral-500">
        <span>
          Low
          <br />
          <span className="font-semibold text-neutral-700 dark:text-neutral-300">
            {formatCurrency(lo)}
          </span>
        </span>
        <span className="text-center">
          Average
          <br />
          <span className="font-semibold text-neutral-700 dark:text-neutral-300">
            {formatCurrency(mid)}
          </span>
        </span>
        <span className="text-right">
          High
          <br />
          <span className="font-semibold text-neutral-700 dark:text-neutral-300">
            {formatCurrency(hi)}
          </span>
        </span>
      </div>
    </div>
  );
}
