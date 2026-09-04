import React from "react";
import {formatCurrency, formatPercent} from "./financialsFormat";
import ChartSegmentPopover from "./ChartSegmentPopover";

const COLORS = ["#456564", "#6b8f8d", "#8fb3b1", "#b7d0ce", "#c4b5d4"];

function HousingCostsBar({categories = [], total}) {
  const known = categories.filter((c) => c.amount != null && Number(c.amount) > 0);
  const sum = known.reduce((acc, c) => acc + Number(c.amount), 0) || 1;

  return (
    <div className="space-y-3">
      {known.length > 0 && (
        <div className="flex h-2.5 w-full rounded-full bg-neutral-100 dark:bg-neutral-800">
          {known.map((cat, i) => {
            const amount = Number(cat.amount);
            const pctOfBar = (amount / sum) * 100;
            const pctOfTotal = total ? (amount / total) * 100 : pctOfBar;
            return (
              <ChartSegmentPopover
                key={cat.id}
                className="h-full first:rounded-l-full last:rounded-r-full cursor-pointer"
                style={{width: `${pctOfBar}%`, backgroundColor: COLORS[i % COLORS.length]}}
                label={cat.label}
                amount={amount}
                percent={pctOfTotal}
              >
                <div className="h-full w-full rounded-[inherit]" />
              </ChartSegmentPopover>
            );
          })}
        </div>
      )}
      <ul className="space-y-2">
        {categories.map((cat, i) => {
          const amount = cat.amount == null ? null : Number(cat.amount);
          const pct = amount != null && total ? (amount / total) * 100 : null;
          const body = (
            <>
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{backgroundColor: COLORS[i % COLORS.length]}}
                />
                <span className="text-neutral-600 dark:text-neutral-300 truncate">
                  {cat.label}
                </span>
              </div>
              {cat.notApplicable ? (
                <span className="text-xs text-neutral-400">No HOA</span>
              ) : amount == null ? (
                cat.action || (
                  <span className="text-xs text-neutral-400">Not added</span>
                )
              ) : (
                <span className="tabular-nums text-neutral-900 dark:text-white font-medium">
                  {formatCurrency(amount)}
                  {pct != null && (
                    <span className="text-neutral-400 font-normal ml-1.5 text-xs">
                      {formatPercent(pct, 0)}
                    </span>
                  )}
                </span>
              )}
            </>
          );
          return (
            <li key={cat.id}>
              {amount == null ? (
                <div className="flex items-center justify-between gap-3 text-sm">{body}</div>
              ) : (
                <ChartSegmentPopover
                  className="flex w-full items-center justify-between gap-3 text-sm cursor-pointer"
                  label={cat.label}
                  amount={amount}
                  percent={pct}
                >
                  {body}
                </ChartSegmentPopover>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default HousingCostsBar;
