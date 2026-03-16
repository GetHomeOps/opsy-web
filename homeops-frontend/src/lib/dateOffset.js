import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  format,
  isAfter,
  isBefore,
  isValid,
  parse,
  startOfDay,
} from "date-fns";

export const OFFSET_UNITS = ["days", "weeks", "months", "years"];
export const OFFSET_DIRECTIONS = {
  SELECTED: "selected",
  TODAY: "today",
};

/**
 * Parse YYYY-MM-DD (or ISO date string) as local date.
 * Avoids new Date("2025-03-16") and new Date("2025-03-20T00:00:00.000Z")
 * which parse as UTC midnight and can show the previous calendar day in
 * timezones west of UTC.
 */
export function parseDateInput(value) {
  if (!value) return undefined;
  if (value instanceof Date) return isValid(value) ? startOfDay(value) : undefined;
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const parsed = parse(trimmed, "yyyy-MM-dd", new Date());
  if (isValid(parsed)) return startOfDay(parsed);

  // ISO strings like "2025-03-20T00:00:00.000Z" - extract date part and parse as local
  const datePart = trimmed.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const localParsed = parse(datePart, "yyyy-MM-dd", new Date());
    if (isValid(localParsed)) return startOfDay(localParsed);
  }

  const iso = new Date(trimmed);
  return isValid(iso) ? startOfDay(iso) : undefined;
}

export function addDateOffset(baseDate, amount, unit) {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  if (!baseDate || !isValid(baseDate)) return undefined;
  if (!OFFSET_UNITS.includes(unit)) return undefined;

  switch (unit) {
    case "days":
      return startOfDay(addDays(baseDate, safeAmount));
    case "weeks":
      return startOfDay(addWeeks(baseDate, safeAmount));
    case "months":
      return startOfDay(addMonths(baseDate, safeAmount));
    case "years":
      return startOfDay(addYears(baseDate, safeAmount));
    default:
      return undefined;
  }
}

export function resolveOffsetDate({
  selectedDate,
  amount,
  unit,
  direction = OFFSET_DIRECTIONS.SELECTED,
  today = new Date(),
}) {
  const normalizedSelected = parseDateInput(selectedDate);
  const normalizedToday = parseDateInput(today);
  const baseDate =
    direction === OFFSET_DIRECTIONS.TODAY ? normalizedToday : normalizedSelected;

  if (!baseDate) {
    return {baseDate: undefined, resultDate: undefined};
  }

  return {
    baseDate,
    resultDate: addDateOffset(baseDate, amount, unit),
  };
}

/**
 * Parse a YYYY-MM-DD string as local date (avoids new Date(str) UTC-midnight bug
 * which shifts the calendar day in timezones west of UTC).
 * @param {string} value - Date string (YYYY-MM-DD)
 * @returns {Date|undefined} Local midnight for that date, or undefined
 */
export function parseDateOnly(value) {
  return parseDateInput(value);
}

export function isDateOutsideRange(date, {minDate, maxDate} = {}) {
  if (!date || !isValid(date)) return false;
  const min = parseDateInput(minDate);
  const max = parseDateInput(maxDate);
  if (min && isBefore(date, min)) return true;
  if (max && isAfter(date, max)) return true;
  return false;
}

function getUnitLabel(unit, amount) {
  const abs = Math.abs(amount);
  if (abs === 1) return unit.replace(/s$/, "");
  return unit;
}

export function buildOffsetSummary({amount, unit, direction, resultDate}) {
  if (!resultDate || !isValid(resultDate)) return "";

  const abs = Math.abs(amount);
  const unitLabel = getUnitLabel(unit, amount);
  const baseLabel =
    direction === OFFSET_DIRECTIONS.TODAY ? "today" : "selected date";

  const phrase =
    amount < 0
      ? `${abs} ${unitLabel} before ${baseLabel}`
      : `${abs} ${unitLabel} from ${baseLabel}`;

  return `${phrase} -> ${format(resultDate, "MMM d, yyyy")}`;
}
