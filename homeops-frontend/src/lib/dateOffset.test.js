import {describe, expect, it} from "vitest";
import {format} from "date-fns";
import {
  OFFSET_DIRECTIONS,
  isDateOutsideRange,
  resolveOffsetDate,
} from "./dateOffset";

describe("resolveOffsetDate", () => {
  it("jumps by months and years from selected date", () => {
    const byMonth = resolveOffsetDate({
      selectedDate: "2026-01-15",
      amount: 2,
      unit: "months",
      direction: OFFSET_DIRECTIONS.SELECTED,
    });
    const byYear = resolveOffsetDate({
      selectedDate: "2026-03-01",
      amount: -1,
      unit: "years",
      direction: OFFSET_DIRECTIONS.SELECTED,
    });

    expect(format(byMonth.resultDate, "yyyy-MM-dd")).toBe("2026-03-15");
    expect(format(byYear.resultDate, "yyyy-MM-dd")).toBe("2025-03-01");
  });

  it("handles end-of-month offset math correctly", () => {
    const janEnd = resolveOffsetDate({
      selectedDate: "2026-01-31",
      amount: 1,
      unit: "months",
      direction: OFFSET_DIRECTIONS.SELECTED,
    });
    const leapYear = resolveOffsetDate({
      selectedDate: "2024-02-29",
      amount: 1,
      unit: "years",
      direction: OFFSET_DIRECTIONS.SELECTED,
    });

    expect(format(janEnd.resultDate, "yyyy-MM-dd")).toBe("2026-02-28");
    expect(format(leapYear.resultDate, "yyyy-MM-dd")).toBe("2025-02-28");
  });

  it("supports offset direction from today", () => {
    const res = resolveOffsetDate({
      selectedDate: "2020-01-01",
      amount: 6,
      unit: "months",
      direction: OFFSET_DIRECTIONS.TODAY,
      today: "2026-03-04",
    });

    expect(format(res.resultDate, "yyyy-MM-dd")).toBe("2026-09-04");
  });
});

describe("isDateOutsideRange", () => {
  it("returns true for dates outside min/max boundaries", () => {
    expect(
      isDateOutsideRange(new Date("2026-09-04"), {
        maxDate: "2026-09-01",
      }),
    ).toBe(true);
    expect(
      isDateOutsideRange(new Date("2026-02-28"), {
        minDate: "2026-03-01",
      }),
    ).toBe(true);
  });

  it("returns false when date is inside boundaries", () => {
    expect(
      isDateOutsideRange(new Date("2026-06-01"), {
        minDate: "2026-03-01",
        maxDate: "2026-09-01",
      }),
    ).toBe(false);
  });
});
