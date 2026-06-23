import { describe, it, expect } from "vitest";
import { splitTotalAcrossMonths } from "./split";

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
});
