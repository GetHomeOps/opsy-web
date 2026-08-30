/** Filter type stored in the properties list `activeFilters` array. */
export const HOMEAVERSARY_FILTER_TYPE = "homeaversary";

export const MONTH_LABEL_KEYS = [
  "monthJanuary",
  "monthFebruary",
  "monthMarch",
  "monthApril",
  "monthMay",
  "monthJune",
  "monthJuly",
  "monthAugust",
  "monthSeptember",
  "monthOctober",
  "monthNovember",
  "monthDecember",
];

export function pad2(n) {
  return String(n).padStart(2, "0");
}

/**
 * Parse last_sale_date from API (YYYY-MM-DD, ISO, or Date) into calendar parts.
 * Uses the date-only string when present so timezones cannot shift the day.
 * @returns {{year: number, month: number, day: number}|null}
 */
export function parseSaleDateParts(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return {
      year: value.getUTCFullYear(),
      month: value.getUTCMonth() + 1,
      day: value.getUTCDate(),
    };
  }
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return {year, month, day};
}

/** Normalize to YYYY-MM-DD for sorting, or "" when missing. */
export function saleDateSortValue(value) {
  const parts = parseSaleDateParts(value);
  if (!parts) return "";
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

/** UTC short date, e.g. "Mar 1, 2019". Empty string when missing. */
export function formatSaleDate(value) {
  const parts = parseSaleDateParts(value);
  if (!parts) return "";
  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function homeaversaryDateValue(month, day) {
  return `md:${pad2(month)}-${pad2(day)}`;
}

export function homeaversaryMonthValue(month) {
  return `month:${pad2(month)}`;
}

/** Chip label like "Mar 1". */
export function homeaversaryDateLabel(month, day) {
  const d = new Date(Date.UTC(2000, month - 1, day));
  if (Number.isNaN(d.getTime())) return `${pad2(month)}-${pad2(day)}`;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * True when last_sale_date matches any Homeaversary filter value
 * (`month:03` or `md:03-01`). Year is ignored. Missing sale date never matches.
 * @param {unknown} lastSaleDate
 * @param {string[]} filterValues
 */
export function matchesHomeaversaryFilter(lastSaleDate, filterValues) {
  if (!Array.isArray(filterValues) || filterValues.length === 0) return true;
  const parts = parseSaleDateParts(lastSaleDate);
  if (!parts) return false;
  return filterValues.some((value) => {
    if (typeof value !== "string") return false;
    if (value.startsWith("month:")) {
      const month = parseInt(value.slice(6), 10);
      return Number.isFinite(month) && parts.month === month;
    }
    if (value.startsWith("md:")) {
      const [mm, dd] = value.slice(3).split("-");
      const month = parseInt(mm, 10);
      const day = parseInt(dd, 10);
      return (
        Number.isFinite(month) &&
        Number.isFinite(day) &&
        parts.month === month &&
        parts.day === day
      );
    }
    return false;
  });
}

export function propertyLastSaleDate(property) {
  return property?.last_sale_date ?? property?.lastSaleDate ?? "";
}
