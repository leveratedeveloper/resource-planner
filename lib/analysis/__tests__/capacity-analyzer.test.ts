/**
 * Unit tests for capacity-analyzer.ts
 * Tests getDateRange and analyzeCapacity
 */

import { describe, it, expect } from "vitest";
import { getDateRange, analyzeCapacity } from "../capacity-analyzer";
import { AnalysisInput } from "../types";

describe("getDateRange", () => {
  it("returns a single date when start equals end", () => {
    const range = getDateRange("2026-02-04", "2026-02-04");
    expect(range).toEqual(["2026-02-04"]);
  });

  it("returns correct range across multiple days", () => {
    const range = getDateRange("2026-02-01", "2026-02-05");
    expect(range).toEqual([
      "2026-02-01",
      "2026-02-02",
      "2026-02-03",
      "2026-02-04",
      "2026-02-05",
    ]);
  });

  it("handles month boundaries", () => {
    const range = getDateRange("2026-01-30", "2026-02-02");
    expect(range).toEqual([
      "2026-01-30",
      "2026-01-31",
      "2026-02-01",
      "2026-02-02",
    ]);
  });

  it("handles year boundaries", () => {
    const range = getDateRange("2025-12-30", "2026-01-02");
    expect(range).toEqual([
      "2025-12-30",
      "2025-12-31",
      "2026-01-01",
      "2026-01-02",
    ]);
  });

  it("returns empty array when end is before start", () => {
    const range = getDateRange("2026-02-05", "2026-02-01");
    expect(range).toEqual([]);
  });

  it("preserves local date keys (no UTC shift)", () => {
    // This is the key test: dates should not shift due to timezone
    const range = getDateRange("2026-02-04", "2026-02-06");
    expect(range[0]).toBe("2026-02-04");
    expect(range[range.length - 1]).toBe("2026-02-06");
    // Each date should be exactly YYYY-MM-DD with no time component artifacts
    for (const d of range) {
      expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("analyzeCapacity", () => {
  const makeInput = (overrides: Partial<AnalysisInput> = {}): AnalysisInput => ({
    resources: [
      { id: "r1", name: "Alice", department: "Engineering", role: "Developer", capacity: 40 },
    ],
    assignments: [],
    projects: [],
    brands: [],
    dateRange: { start: "2026-02-02", end: "2026-02-06" }, // Mon-Fri
    ...overrides,
  });

  it("returns one result per resource", () => {
    const result = analyzeCapacity(makeInput({
      resources: [
        { id: "r1", name: "Alice", department: "Eng", role: "Dev", capacity: 40 },
        { id: "r2", name: "Bob", department: "Eng", role: "Dev", capacity: 40 },
      ],
    }));
    expect(result).toHaveLength(2);
  });

  it("marks resource as optimal when no assignments", () => {
    const result = analyzeCapacity(makeInput());
    expect(result[0].status).toBe("optimal");
    expect(result[0].averageUtilization).toBe(0);
  });

  it("calculates correct utilization with an assignment", () => {
    const result = analyzeCapacity(makeInput({
      assignments: [{
        id: "a1",
        resourceId: "r1",
        projectId: "p1",
        startDate: new Date(2026, 1, 2), // Feb 2
        endDate: new Date(2026, 1, 6),   // Feb 6
        hoursPerDay: 4,
        isTimeOff: false,
        category: "development",
        isBillable: true,
        note: null,
      }],
    }));
    // Capacity is 40hrs/week = 8hrs/day. 4hrs/8hrs = 50%
    expect(result[0].averageUtilization).toBe(50);
  });

  it("detects overallocation", () => {
    const result = analyzeCapacity(makeInput({
      assignments: [{
        id: "a1",
        resourceId: "r1",
        projectId: "p1",
        startDate: new Date(2026, 1, 2),
        endDate: new Date(2026, 1, 6),
        hoursPerDay: 10,
        isTimeOff: false,
        category: "development",
        isBillable: true,
        note: null,
      }],
    }));
    // 10hrs/8hrs = 125%, all 5 days overallocated
    expect(result[0].overallocatedDays).toBe(5);
    expect(result[0].peakUtilization).toBe(125);
  });

  it("handles time-off correctly", () => {
    const result = analyzeCapacity(makeInput({
      assignments: [{
        id: "a1",
        resourceId: "r1",
        projectId: "",
        startDate: new Date(2026, 1, 3), // Tue
        endDate: new Date(2026, 1, 4),   // Wed
        hoursPerDay: 0,
        isTimeOff: true,
        category: "vacation",
        isBillable: false,
        note: null,
      }],
    }));
    // 2 days of time off out of 5 working days
    const timeOffDays = result[0].dailyUtilization.filter(d => d.hasTimeOff).length;
    expect(timeOffDays).toBe(2);
  });
});
