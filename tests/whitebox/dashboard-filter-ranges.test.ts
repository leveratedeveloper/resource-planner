import { describe, expect, it } from "vitest";
import {
  getDashboardDateRange,
  getDashboardScopeLabel,
  isValidCustomDateRange,
} from "@/lib/dashboard/filter-ranges";

describe("dashboard filter ranges", () => {
  const today = new Date(2026, 4, 12);

  it("calculates weekly as the last 7 days through today", () => {
    expect(getDashboardDateRange("weekly", { today })).toEqual({
      startDate: "2026-05-05",
      endDate: "2026-05-12",
    });
  });

  it("calculates monthly as the last 1 month through today", () => {
    expect(getDashboardDateRange("monthly", { today })).toEqual({
      startDate: "2026-04-12",
      endDate: "2026-05-12",
    });
  });

  it("calculates annual as the last 1 year through today", () => {
    expect(getDashboardDateRange("annual", { today })).toEqual({
      startDate: "2025-05-12",
      endDate: "2026-05-12",
    });
  });

  it("uses the custom range when both dates are valid", () => {
    expect(
      getDashboardDateRange("custom", {
        today,
        customStartDate: new Date(2026, 0, 10),
        customEndDate: new Date(2026, 1, 20),
      })
    ).toEqual({
      startDate: "2026-01-10",
      endDate: "2026-02-20",
    });
  });

  it("marks a custom end date before start date as invalid", () => {
    expect(
      isValidCustomDateRange({
        startDate: new Date(2026, 1, 20),
        endDate: new Date(2026, 0, 10),
      })
    ).toBe(false);
  });

  it("marks a custom end date after today as invalid", () => {
    expect(
      isValidCustomDateRange({
        startDate: new Date(2026, 4, 1),
        endDate: new Date(2026, 4, 13),
        today,
      })
    ).toBe(false);
  });

  it("allows a custom end date equal to today", () => {
    expect(
      isValidCustomDateRange({
        startDate: new Date(2026, 4, 1),
        endDate: today,
        today,
      })
    ).toBe(true);
  });

  it("allows a custom end date before today when start is before end", () => {
    expect(
      isValidCustomDateRange({
        startDate: new Date(2026, 3, 1),
        endDate: new Date(2026, 3, 30),
        today,
      })
    ).toBe(true);
  });

  it("formats the active scope label", () => {
    expect(
      getDashboardScopeLabel({
        preset: "monthly",
        range: { startDate: "2026-04-12", endDate: "2026-05-12" },
        departmentName: "Creative",
      })
    ).toBe("Last 1 month · Creative");
  });
});
