import * as React from "react";
import {Popover, PopoverContent, PopoverTrigger} from "./ui/popover";
import {cn} from "../lib/utils";

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Month picker input that uses Popover + month/year grid.
 * Keeps the same input field appearance (form-input) but shows a styled month picker dropdown.
 * Value format: YYYY-MM
 */
export default function MonthPickerInput({
  name,
  value,
  onChange,
  className = "form-input w-full",
  placeholder = "",
  ...props
}) {
  const [open, setOpen] = React.useState(false);

  const [year, month] = React.useMemo(() => {
    if (!value || typeof value !== "string")
      return [new Date().getFullYear(), null];
    const parts = value.split("-");
    if (parts.length !== 2) return [new Date().getFullYear(), null];
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(y) || isNaN(m) || m < 1 || m > 12)
      return [new Date().getFullYear(), null];
    return [y, m];
  }, [value]);

  const [viewYear, setViewYear] = React.useState(year);
  React.useEffect(() => {
    setViewYear(year);
  }, [year, open]);

  const displayValue = value || "";

  const handleSelect = (selectedMonth) => {
    const formatted = `${viewYear}-${String(selectedMonth).padStart(2, "0")}`;
    onChange?.({target: {name, value: formatted}});
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative cursor-pointer">
          <input
            type="text"
            readOnly
            name={name}
            value={displayValue}
            placeholder={placeholder}
            className={cn("form-input w-full cursor-pointer pr-9", className)}
            style={props.style}
            aria-expanded={open}
          />
          <svg
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 fill-current text-gray-400 dark:text-gray-500"
            width="16"
            height="16"
            viewBox="0 0 16 16"
          >
            <path d="M5 4a1 1 0 0 0 0 2h6a1 1 0 1 0 0-2H5Z" />
            <path d="M4 0a4 4 0 0 0-4 4v8a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4V4a4 4 0 0 0-4-4H4ZM2 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4Z" />
          </svg>
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-[220px] p-0"
        align="start"
        side="bottom"
        sideOffset={4}
        avoidCollisions={false}
      >
        <div className="p-3">
          {/* Year navigation */}
          <div className="flex items-center justify-between gap-2 pb-3">
            <button
              type="button"
              onClick={() => setViewYear((y) => y - 1)}
              className="inline-flex size-7 items-center justify-center rounded-md p-0 opacity-50 hover:opacity-100"
              aria-label="Previous year"
            >
              <svg
                className="fill-current"
                width="7"
                height="11"
                viewBox="0 0 7 11"
              >
                <path d="M5.4 10.8l1.4-1.4-4-4 4-4L5.4 0 0 5.4z" />
              </svg>
            </button>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {viewYear}
            </span>
            <button
              type="button"
              onClick={() => setViewYear((y) => y + 1)}
              className="inline-flex size-7 items-center justify-center rounded-md p-0 opacity-50 hover:opacity-100"
              aria-label="Next year"
            >
              <svg
                className="fill-current"
                width="7"
                height="11"
                viewBox="0 0 7 11"
              >
                <path d="M1.4 10.8L0 9.4l4-4-4-4L1.4 0l5.4 5.4z" />
              </svg>
            </button>
          </div>
          {/* Month grid */}
          <div className="grid grid-cols-4 gap-1">
            {MONTH_NAMES.map((monthName, idx) => {
              const monthNum = idx + 1;
              const isSelected = year === viewYear && month === monthNum;
              return (
                <button
                  key={monthNum}
                  type="button"
                  onClick={() => handleSelect(monthNum)}
                  className={cn(
                    "inline-flex h-9 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-emerald-600 hover:text-white",
                    isSelected
                      ? "bg-emerald-600 text-white"
                      : "text-gray-700 dark:text-gray-200"
                  )}
                >
                  {monthName}
                </button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
