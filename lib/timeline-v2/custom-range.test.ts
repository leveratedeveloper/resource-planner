import { describe, it, expect } from "vitest";
import {
  CUSTOM_RANGE_MAX_MONTHS,
  formatMonthValue,
  parseMonthValue,
  buildFromMonthOptions,
  buildToMonthOptions,
  clampRange,
  monthsInRange,
} from "./custom-range";

describe("formatMonthValue / parseMonthValue", () => {
  it("formats a date to yyyy-MM at the first of the month", () => {
    expect(formatMonthValue(new Date(2026, 6, 15))).toBe("2026-07");
  });

  it("parses yyyy-MM back to a first-of-month date", () => {
    expect(parseMonthValue("2026-07")).toEqual(new Date(2026, 6, 1));
  });
});

describe("buildFromMonthOptions", () => {
  it("spans from Jan of (year-1) to Dec of (year+2) = 48 months", () => {
    const options = buildFromMonthOptions(2026);
    expect(options).toHaveLength(48);
    expect(options[0]).toEqual({ value: "2025-01", label: "Jan 2025" });
    expect(options[47]).toEqual({ value: "2028-12", label: "Dec 2028" });
  });
});

describe("buildToMonthOptions", () => {
  it("returns exactly CUSTOM_RANGE_MAX_MONTHS options starting at 'from'", () => {
    const options = buildToMonthOptions("2026-07");
    expect(options).toHaveLength(CUSTOM_RANGE_MAX_MONTHS);
    expect(options[0]).toEqual({ value: "2026-07", label: "Jul 2026" });
    expect(options[11]).toEqual({ value: "2027-06", label: "Jun 2027" });
  });

  it("crosses the calendar year boundary", () => {
    const options = buildToMonthOptions("2026-11");
    expect(options[3]).toEqual({ value: "2027-02", label: "Feb 2027" });
  });
});

describe("clampRange", () => {
  it("keeps a valid in-range span unchanged (snapped to first of month)", () => {
    expect(clampRange(new Date(2026, 6, 10), new Date(2026, 11, 20))).toEqual({
      start: new Date(2026, 6, 1),
      end: new Date(2026, 11, 1),
    });
  });

  it("pulls end up to start when end is before start", () => {
    expect(clampRange(new Date(2026, 6, 1), new Date(2026, 3, 1))).toEqual({
      start: new Date(2026, 6, 1),
      end: new Date(2026, 6, 1),
    });
  });

  it("caps a too-long span at the max window", () => {
    expect(clampRange(new Date(2026, 6, 1), new Date(2027, 11, 1))).toEqual({
      start: new Date(2026, 6, 1),
      end: new Date(2027, 5, 1),
    });
  });
});

describe("monthsInRange", () => {
  it("counts inclusive months, cross-year aware", () => {
    expect(monthsInRange(new Date(2026, 6, 1), new Date(2026, 11, 1))).toBe(6);
    expect(monthsInRange(new Date(2026, 10, 1), new Date(2027, 1, 1))).toBe(4);
    expect(monthsInRange(new Date(2026, 6, 1), new Date(2026, 6, 1))).toBe(1);
  });
});
