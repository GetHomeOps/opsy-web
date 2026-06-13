import React from "react";

const TONES = {
  brand:
    "bg-[#456564]/10 text-[#456564] border border-[#456564]/20 dark:bg-[#5a7a78]/20 dark:text-[#7fa3a1] dark:border-[#5a7a78]/30",
  emerald:
    "bg-emerald-500/15 text-emerald-700 border border-emerald-400/30 dark:text-emerald-300",
  amber:
    "bg-amber-500/15 text-amber-700 border border-amber-400/30 dark:text-amber-300",
  red: "bg-red-500/15 text-red-700 border border-red-400/30 dark:text-red-300",
  neutral:
    "bg-neutral-100 text-neutral-600 border border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700",
};

/** Small pill badge for statuses, conditions, and counts. */
export function StatusBadge({tone = "neutral", children, className = ""}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${TONES[tone] ?? TONES.neutral} ${className}`}
    >
      {children}
    </span>
  );
}

/** Compact stat tile: icon + value + label. Used in header strips and summary rows. */
export function StatChip({icon: Icon, value, label, className = ""}) {
  return (
    <div
      className={`flex flex-col rounded-xl border border-neutral-200/60 dark:border-neutral-700/50 bg-neutral-50/60 dark:bg-neutral-800/40 px-3 py-2 min-w-[5.5rem] ${className}`}
    >
      <div className="flex items-center gap-1.5">
        {Icon && (
          <Icon className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 shrink-0" />
        )}
        <span className="text-sm font-bold text-neutral-900 dark:text-white tabular-nums truncate">
          {value ?? "—"}
        </span>
      </div>
      <span className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.08em] mt-0.5 truncate">
        {label}
      </span>
    </div>
  );
}

export default StatusBadge;
