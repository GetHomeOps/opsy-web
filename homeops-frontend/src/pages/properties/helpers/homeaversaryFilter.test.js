import {describe, expect, it} from "vitest";
import {
  formatSaleDate,
  homeaversaryDateValue,
  homeaversaryMonthValue,
  matchesHomeaversaryFilter,
  parseSaleDateParts,
  saleDateSortValue,
} from "./homeaversaryFilter";

describe("parseSaleDateParts", () => {
  it("parses a YYYY-MM-DD string without timezone shift", () => {
    expect(parseSaleDateParts("2019-03-01")).toEqual({
      year: 2019,
      month: 3,
      day: 1,
    });
  });

  it("parses an ISO datetime by taking the date prefix", () => {
    expect(parseSaleDateParts("2019-03-01T00:00:00.000Z")).toEqual({
      year: 2019,
      month: 3,
      day: 1,
    });
  });

  it("returns null for missing values", () => {
    expect(parseSaleDateParts(null)).toBeNull();
    expect(parseSaleDateParts("")).toBeNull();
    expect(parseSaleDateParts("not-a-date")).toBeNull();
  });
});

describe("saleDateSortValue", () => {
  it("normalizes to YYYY-MM-DD", () => {
    expect(saleDateSortValue("2019-03-01T12:00:00Z")).toBe("2019-03-01");
  });

  it("is empty when missing", () => {
    expect(saleDateSortValue(null)).toBe("");
  });
});

describe("formatSaleDate", () => {
  it("formats a UTC date-only value", () => {
    expect(formatSaleDate("2019-03-01")).toMatch(/Mar/);
    expect(formatSaleDate("2019-03-01")).toMatch(/1/);
    expect(formatSaleDate("2019-03-01")).toMatch(/2019/);
  });

  it("is empty when missing", () => {
    expect(formatSaleDate(null)).toBe("");
  });
});

describe("matchesHomeaversaryFilter", () => {
  it("matches month+day ignoring year", () => {
    const value = homeaversaryDateValue(3, 1);
    expect(matchesHomeaversaryFilter("2019-03-01", [value])).toBe(true);
    expect(matchesHomeaversaryFilter("2026-03-01", [value])).toBe(true);
    expect(matchesHomeaversaryFilter("2019-03-02", [value])).toBe(false);
    expect(matchesHomeaversaryFilter("2019-04-01", [value])).toBe(false);
  });

  it("matches an entire month ignoring year and day", () => {
    const value = homeaversaryMonthValue(3);
    expect(matchesHomeaversaryFilter("2019-03-01", [value])).toBe(true);
    expect(matchesHomeaversaryFilter("2020-03-31", [value])).toBe(true);
    expect(matchesHomeaversaryFilter("2019-04-01", [value])).toBe(false);
  });

  it("does not match a missing sale date", () => {
    expect(
      matchesHomeaversaryFilter(null, [homeaversaryDateValue(3, 1)]),
    ).toBe(false);
    expect(matchesHomeaversaryFilter("", [homeaversaryMonthValue(3)])).toBe(
      false,
    );
  });

  it("matches Feb 29 on a date pick and in February", () => {
    expect(
      matchesHomeaversaryFilter("2020-02-29", [homeaversaryDateValue(2, 29)]),
    ).toBe(true);
    expect(
      matchesHomeaversaryFilter("2020-02-29", [homeaversaryDateValue(2, 28)]),
    ).toBe(false);
    expect(
      matchesHomeaversaryFilter("2020-02-29", [homeaversaryMonthValue(2)]),
    ).toBe(true);
  });

  it("passes through when no filter values are set", () => {
    expect(matchesHomeaversaryFilter(null, [])).toBe(true);
    expect(matchesHomeaversaryFilter("2019-03-01", [])).toBe(true);
  });
});
