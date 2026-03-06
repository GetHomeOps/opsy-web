import * as React from "react";
import {format, isSameDay, startOfMonth} from "date-fns";
import {ChevronDown, ChevronsUpDown, X} from "lucide-react";
import {Popover, PopoverContent, PopoverTrigger} from "./ui/popover";
import {Calendar} from "./ui/calendar";
import {cn} from "../lib/utils";
import DateOffsetControl from "./DateOffsetControl";
import {
  isDateOutsideRange,
  parseDateInput,
} from "../lib/dateOffset";

/**
 * Date picker input that uses Popover + Calendar (react-day-picker).
 * Value format: YYYY-MM-DD (accepts ISO strings for display).
 * Select a date to set it; click the selected date again to clear.
 *
 * Wrapped in React.memo to prevent the Radix PopperAnchor useLayoutEffect
 * from creating an infinite update loop when the parent re-renders frequently.
 */
const DatePickerInput = React.memo(function DatePickerInput({
  name,
  value,
  onChange,
  className = "form-input w-full",
  placeholder = "",
  disabled = false,
  popoverClassName,
  required,
  style,
  showOffsetControl = false,
  minDate,
  maxDate,
  disabledDays,
}) {
  const [open, setOpen] = React.useState(false);
  const [offsetExpanded, setOffsetExpanded] = React.useState(false);

  // Keep onChange in a ref so the memoized component doesn't need it as a dep
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  const dateValue = React.useMemo(() => parseDateInput(value), [value]);
  const minDateValue = React.useMemo(() => parseDateInput(minDate), [minDate]);
  const maxDateValue = React.useMemo(() => parseDateInput(maxDate), [maxDate]);

  const initialMonth = React.useMemo(
    () => startOfMonth(dateValue ?? new Date()),
    [dateValue],
  );
  const [visibleMonth, setVisibleMonth] = React.useState(initialMonth);

  React.useEffect(() => {
    if (open) setVisibleMonth(startOfMonth(dateValue ?? new Date()));
  }, [open, dateValue]);

  const displayValue = React.useMemo(() => {
    if (!dateValue) return "";
    return format(dateValue, "dd/MM/yyyy");
  }, [dateValue]);

  const calendarDisabled = React.useMemo(() => {
    const rangeMatcher =
      minDateValue || maxDateValue
        ? {
            ...(minDateValue ? {before: minDateValue} : {}),
            ...(maxDateValue ? {after: maxDateValue} : {}),
          }
        : undefined;

    if (!rangeMatcher) return disabledDays;
    if (!disabledDays) return rangeMatcher;
    return [disabledDays, rangeMatcher];
  }, [disabledDays, minDateValue, maxDateValue]);

  const handleSelect = React.useCallback(
    (date) => {
      if (!date) return;
      if (isDateOutsideRange(date, {minDate: minDateValue, maxDate: maxDateValue})) {
        return;
      }
      if (dateValue && isSameDay(date, dateValue)) {
        onChangeRef.current?.({target: {name, value: ""}});
      } else {
        onChangeRef.current?.({
          target: {name, value: format(date, "yyyy-MM-dd")},
        });
      }
      setOpen(false);
    },
    [dateValue, name, minDateValue, maxDateValue],
  );

  const handleClear = React.useCallback(
    (e) => {
      e.stopPropagation();
      e.preventDefault();
      onChangeRef.current?.({target: {name, value: ""}});
    },
    [name],
  );

  const handleOpenChange = React.useCallback(
    (o) => {
      if (!disabled) {
        setOpen(o);
        if (!o) setOffsetExpanded(false);
      }
    },
    [disabled],
  );

  return (
    <Popover open={open && !disabled} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <div
          className={cn(
            "relative",
            disabled
              ? "cursor-not-allowed opacity-60 pointer-events-none"
              : "cursor-pointer",
          )}
        >
          <input
            type="text"
            readOnly
            name={name}
            value={displayValue}
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            className={cn(
              "form-input w-full pr-9",
              disabled ? "cursor-not-allowed" : "cursor-pointer",
              className,
            )}
            style={style}
            aria-expanded={open}
          />
          {dateValue && !disabled ? (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors"
              aria-label="Clear date"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <svg
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 fill-current text-gray-400 dark:text-gray-500"
              width="16"
              height="16"
              viewBox="0 0 16 16"
            >
              <path d="M5 4a1 1 0 0 0 0 2h6a1 1 0 1 0 0-2H5Z" />
              <path d="M4 0a4 4 0 0 0-4 4v8a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4V4a4 4 0 0 0-4-4H4ZM2 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4Z" />
            </svg>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent
        className={cn("w-[280px] p-0", popoverClassName)}
        align="start"
        side="bottom"
        sideOffset={4}
        collisionPadding={16}
      >
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={handleSelect}
          month={visibleMonth}
          onMonthChange={(month) => setVisibleMonth(startOfMonth(month))}
          initialFocus
          fixedWeeks
          disabled={calendarDisabled}
        />
        {showOffsetControl && (
          <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <button
              type="button"
              onClick={() => setOffsetExpanded((v) => !v)}
              className="group flex items-center justify-center gap-1.5 w-full py-2 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
            >
              Jump to
              <ChevronDown
                className={cn(
                  "w-3 h-3 transition-transform duration-150",
                  offsetExpanded && "rotate-180",
                )}
              />
            </button>
            <div
              className={cn(
                "grid transition-[grid-template-rows] duration-150 ease-out",
                offsetExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden">
                <div className="px-3 pb-3 pt-2 bg-gray-50 dark:bg-gray-900/40 border-t border-gray-200 dark:border-gray-700">
                  <DateOffsetControl
                    selectedDate={dateValue}
                    minDate={minDateValue}
                    maxDate={maxDateValue}
                    onNavigate={(nextDate) =>
                      setVisibleMonth(startOfMonth(nextDate))
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
});

export default DatePickerInput;
