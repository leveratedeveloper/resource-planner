import { describe, it, expect } from "vitest";
import { MONTH_CAPACITY_HOURS, WEEK_CAPACITY_HOURS, DAY_CAPACITY_HOURS, monthPct, sumByMonth, criticalMonths } from "./allocation";

describe("allocation (flat 160h/month)", () => {
  it("exposes flat capacity constants", () => {
    expect(MONTH_CAPACITY_HOURS).toBe(160);
    expect(WEEK_CAPACITY_HOURS).toBe(40);
    expect(DAY_CAPACITY_HOURS).toBe(8);
  });
  it("monthPct divides by 160", () => {
    expect(monthPct(80)).toBeCloseTo(0.5);
    expect(monthPct(176)).toBeCloseTo(1.1);
  });
  it("sumByMonth aggregates hours per month across entries", () => {
    const m = sumByMonth([
      { month: "2026-04-01", hours: 10 },
      { month: "2026-04-01", hours: 30 },
      { month: "2026-05-01", hours: 20 },
    ]);
    expect(m.get("2026-04-01")).toBe(40);
    expect(m.get("2026-05-01")).toBe(20);
  });
  it("criticalMonths returns months over 90% with rounded % and a label, sorted", () => {
    expect(criticalMonths([
      { month: "2026-05-01", hours: 80 },   // 50% -> excluded
      { month: "2026-04-01", hours: 176 },  // 110% -> included
    ])).toEqual([
      { month: "2026-04-01", monthLabel: "Apr 2026", percentage: 110 },
    ]);
  });
});
