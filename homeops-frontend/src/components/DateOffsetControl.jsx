import React from "react";
import {cn} from "../lib/utils";
import {
  OFFSET_DIRECTIONS,
  buildOffsetSummary,
  isDateOutsideRange,
  resolveOffsetDate,
} from "../lib/dateOffset";

const UNIT_OPTIONS = [
  {value: "days", label: "Days"},
  {value: "weeks", label: "Weeks"},
  {value: "months", label: "Months"},
  {value: "years", label: "Years"},
];

function getOutOfRangeMessage(minDate, maxDate) {
  if (minDate && maxDate) return "Result is outside the allowed date range.";
  if (minDate) return "Result is before the minimum allowed date.";
  if (maxDate) return "Result is after the maximum allowed date.";
  return "";
}

function DateOffsetControl({
  selectedDate,
  minDate,
  maxDate,
  onApply,
  onNavigate,
  className,
  defaultAmount = 6,
  defaultUnit = "months",
  defaultDirection = OFFSET_DIRECTIONS.SELECTED,
  label = "Jump to",
  applyPrefix = "Apply",
}) {
  const [amountInput, setAmountInput] = React.useState(String(defaultAmount));
  const [unit, setUnit] = React.useState(defaultUnit);
  const [direction, setDirection] = React.useState(defaultDirection);

  const parsedAmount = React.useMemo(() => {
    const parsed = Number.parseInt(amountInput, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [amountInput]);

  const {baseDate, resultDate} = React.useMemo(
    () =>
      resolveOffsetDate({
        selectedDate,
        amount: parsedAmount,
        unit,
        direction,
      }),
    [selectedDate, parsedAmount, unit, direction],
  );

  const isOutOfRange = React.useMemo(
    () => isDateOutsideRange(resultDate, {minDate, maxDate}),
    [resultDate, minDate, maxDate],
  );

  const canApply = Boolean(resultDate && !isOutOfRange);
  const missingSelectedDate =
    direction === OFFSET_DIRECTIONS.SELECTED && !baseDate;
  const summary = buildOffsetSummary({
    amount: parsedAmount,
    unit,
    direction,
    resultDate,
  });

  return (
    <div className={cn("space-y-0.5", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {label}
        </span>
        <input
          type="number"
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
          className="form-input h-9 w-16 text-sm px-2 text-center"
          aria-label="Offset amount"
        />
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className="form-select h-9 text-sm pl-2 pr-7 min-w-[110px]"
          aria-label="Offset unit"
        >
          {UNIT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
          className="form-select h-9 text-sm pl-2 pr-7 min-w-[150px] flex-1 sm:flex-none"
          aria-label="Offset direction"
        >
          <option value={OFFSET_DIRECTIONS.SELECTED}>From selected</option>
          <option value={OFFSET_DIRECTIONS.TODAY}>From today</option>
        </select>
        <button
          type="button"
          onClick={() => {
            if (!canApply) return;
            onNavigate?.(resultDate);
            onApply?.(resultDate);
          }}
          disabled={!canApply}
          className={cn(
            "inline-flex h-9 items-center justify-center rounded border px-3 text-sm font-medium transition-colors",
            canApply
              ? "border-[#456564]/30 text-[#456564] hover:bg-[#456564]/5 dark:border-[#7aa3a2]/40 dark:text-[#7aa3a2] dark:hover:bg-[#7aa3a2]/10"
              : "border-gray-200 text-gray-400 dark:border-gray-700/60 dark:text-gray-500 cursor-not-allowed",
          )}
        >
          Go
        </button>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">
        {summary ? `${applyPrefix} ${summary}` : "Set an offset to preview"}
      </p>
      {missingSelectedDate && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Select a date first, or switch to &ldquo;From today&rdquo;.
        </p>
      )}
      {!missingSelectedDate && isOutOfRange && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {getOutOfRangeMessage(minDate, maxDate)}
        </p>
      )}
    </div>
  );
}

export default DateOffsetControl;
