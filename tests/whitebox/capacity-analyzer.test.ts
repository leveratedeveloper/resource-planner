import { describe, it, expect } from "vitest";
import {
  getDailyCapacity,
  getDateRange,
  determineResourceStatus,
  analyzeCapacity,
} from "@/lib/analysis/capacity-analyzer";
import type { DailyUtilization, AnalysisInput } from "@/lib/analysis/types";

describe("getDailyCapacity", () => {
  it("converts 40 weekly hours to 8 daily hours", () => {
    expect(getDailyCapacity(40)).toBe(8);
  });

  it("converts 0 weekly hours to 0 daily hours", () => {
    expect(getDailyCapacity(0)).toBe(0);
  });

  it("converts 20 weekly hours to 4 daily hours", () => {
    expect(getDailyCapacity(20)).toBe(4);
  });
});

describe("getDateRange", () => {
  it("returns a single-day range", () => {
    const range = getDateRange("2026-02-18", "2026-02-18");
    expect(range).toHaveLength(1);
    expect(range).toContain("2026-02-18");
  });

  it("returns correct multi-day range", () => {
    const range = getDateRange("2026-02-16", "2026-02-18");
    expect(range).toHaveLength(3);
    expect(range[0]).toBe("2026-02-16");
    expect(range[2]).toBe("2026-02-18");
  });

  it("handles month boundary", () => {
    const range = getDateRange("2026-01-30", "2026-02-01");
    expect(range).toHaveLength(3);
    expect(range).toContain("2026-01-30");
    expect(range).toContain("2026-01-31");
    expect(range).toContain("2026-02-01");
  });
});

describe("determineResourceStatus", () => {
  function makeUtilization(percent: number): DailyUtilization {
    return {
      date: "2026-02-18",
      hoursAllocated: percent * 0.08,
      hoursAvailable: 8,
      utilizationPercent: percent,
      isOverallocated: percent > 100,
      isUnderutilized: percent < 60,
      hasTimeOff: false,
      assignments: [],
    };
  }

  it("returns 'overallocated' when enough days exceed 100%", () => {
    // Needs >=3 overallocated days or >50% of days to trigger
    const utils = [makeUtilization(110), makeUtilization(120), makeUtilization(105)];
    expect(determineResourceStatus(utils)).toBe("overallocated");
  });

  it("returns 'underutilized' when average is low and no overallocation", () => {
    const utils = [makeUtilization(30), makeUtilization(40), makeUtilization(20)];
    expect(determineResourceStatus(utils)).toBe("underutilized");
  });

  it("returns 'optimal' when utilization is balanced", () => {
    const utils = [makeUtilization(70), makeUtilization(80), makeUtilization(75)];
    expect(determineResourceStatus(utils)).toBe("optimal");
  });
});

describe("analyzeCapacity", () => {
  it("returns analysis for each resource in the input", () => {
    const input: AnalysisInput = {
      resources: [
        { id: "r-1", name: "Alice", department: "Eng", role: "Dev", capacity: 40 },
        { id: "r-2", name: "Bob", department: "Eng", role: "QA", capacity: 40 },
      ],
      assignments: [
        {
          id: "a-1",
          resourceId: "r-1",
          projectId: "p-1",
          startDate: new Date("2026-02-18"),
          endDate: new Date("2026-02-18"),
          hoursPerDay: 8,
          isTimeOff: false,
          category: "Development",
          isBillable: true,
          note: null,
        },
      ],
      projects: [],
      brands: [],
      dateRange: { start: "2026-02-18", end: "2026-02-18" },
    };

    const results = analyzeCapacity(input);
    expect(results).toHaveLength(2);
    expect(results[0].resourceId).toBe("r-1");
    expect(results[1].resourceId).toBe("r-2");
  });

  it("handles empty assignments", () => {
    const input: AnalysisInput = {
      resources: [
        { id: "r-1", name: "Alice", department: "Eng", role: "Dev", capacity: 40 },
      ],
      assignments: [],
      projects: [],
      brands: [],
      dateRange: { start: "2026-02-18", end: "2026-02-18" },
    };

    const results = analyzeCapacity(input);
    expect(results).toHaveLength(1);
    expect(results[0].averageUtilization).toBe(0);
  });
});
