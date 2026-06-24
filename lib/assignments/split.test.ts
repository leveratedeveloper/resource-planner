import { describe, it, expect } from "vitest";
import { splitTotalAcrossMonths, splitTotalAcrossMonthsMap, toWholeHoursInput } from "./split";

describe("splitTotalAcrossMonths", () => {
  it("splits a total equally across the months the span covers", () => {
    expect(splitTotalAcrossMonths(60, "2026-04-10", "2026-06-20")).toEqual([
      { month: "2026-04-01", plannedHours: 20 },
      { month: "2026-05-01", plannedHours: 20 },
      { month: "2026-06-01", plannedHours: 20 },
    ]);
  });
  it("puts the whole total in one month when the span is within a month", () => {
    expect(splitTotalAcrossMonths(8, "2026-07-15", "2026-07-15")).toEqual([
      { month: "2026-07-01", plannedHours: 8 },
    ]);
  });
  it("rounds to 2 decimals", () => {
    expect(splitTotalAcrossMonths(10, "2026-04-01", "2026-06-30")[0].plannedHours).toBeCloseTo(3.33, 2);
  });
  it("returns an empty array when the span is invalid (end before start)", () => {
    expect(splitTotalAcrossMonths(10, "2026-06-01", "2026-04-01")).toEqual([]);
  });
  it("conserves the total — parts sum to the input (remainder on last month)", () => {
    const parts = splitTotalAcrossMonths(100, "2026-01-01", "2026-03-31");
    expect(parts.map((p) => p.plannedHours)).toEqual([33.33, 33.33, 33.34]);
    expect(parts.reduce((s, p) => s + p.plannedHours, 0)).toBeCloseTo(100, 10);
  });
});

describe("splitTotalAcrossMonthsMap", () => {
  it("returns the even split as a {month: hours} map", () => {
    expect(splitTotalAcrossMonthsMap(60, "2026-04-10", "2026-06-20")).toEqual({
      "2026-04-01": 20,
      "2026-05-01": 20,
      "2026-06-01": 20,
    });
  });
  it("returns an empty map for an invalid span", () => {
    expect(splitTotalAcrossMonthsMap(10, "2026-06-01", "2026-04-01")).toEqual({});
  });
  it("returns a single entry when the span is within one month", () => {
    expect(splitTotalAcrossMonthsMap(8, "2026-07-15", "2026-07-15")).toEqual({ "2026-07-01": 8 });
  });
});

describe("toWholeHoursInput", () => {
  it("keeps a whole number unchanged", () => {
    expect(toWholeHoursInput("12")).toBe("12");
  });
  it("strips a decimal point so fractional hours can't be entered", () => {
    expect(toWholeHoursInput("7.5")).toBe("75");
  });
  it("strips letters and symbols", () => {
    expect(toWholeHoursInput("8h")).toBe("8");
  });
  it("returns empty string for empty input", () => {
    expect(toWholeHoursInput("")).toBe("");
  });
});
