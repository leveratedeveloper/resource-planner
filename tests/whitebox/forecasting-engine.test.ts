import { describe, it, expect } from "vitest";
import {
  generateForecast,
  calculateMovingAverage,
} from "@/lib/analysis/forecasting-engine";
import type { ResourceCapacityAnalysis } from "@/lib/analysis/types";

describe("generateForecast", () => {
  it("returns the requested number of weeks", () => {
    const result = generateForecast(
      [{ id: "r-1", name: "Alice", department: "Eng", role: "Dev", capacity: 40 }],
      [],
      4
    );
    expect(result.weeks).toHaveLength(4);
  });

  it("returns 4 weeks by default", () => {
    const result = generateForecast(
      [{ id: "r-1", name: "Alice", department: "Eng", role: "Dev", capacity: 40 }],
      []
    );
    expect(result.weeks).toHaveLength(4);
  });

  it("returns healthy recommendations when no data", () => {
    const result = generateForecast(
      [{ id: "r-1", name: "Alice", department: "Eng", role: "Dev", capacity: 40 }],
      [],
      2
    );
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations[0]).toContain("healthy");
  });

  it("handles empty resources array", () => {
    const result = generateForecast([], [], 2);
    expect(result.weeks).toHaveLength(2);
    expect(result.weeks.every((w) => w.averageUtilization === 0)).toBe(true);
  });

  it("includes overallTrend and bottleneckDates", () => {
    const result = generateForecast(
      [{ id: "r-1", name: "Alice", department: "Eng", role: "Dev", capacity: 40 }],
      [],
      2
    );
    expect(result).toHaveProperty("overallTrend");
    expect(result).toHaveProperty("bottleneckDates");
    expect(Array.isArray(result.bottleneckDates)).toBe(true);
  });

  it("counts Monday assignments when forecast generation starts mid-week", () => {
    const result = generateForecast(
      [{ id: "r-1", name: "Alice", department: "Eng", role: "Dev", capacity: 40 }],
      [
        {
          id: "assignment-1",
          resourceId: "r-1",
          projectId: "project-1",
          projectName: "Launch",
          startDate: new Date(2026, 4, 11),
          endDate: new Date(2026, 4, 11),
          hoursPerDay: 8,
          isTimeOff: false,
          isBillable: true,
        },
      ],
      1,
      new Date(2026, 4, 13)
    );

    expect(result.weeks[0]).toMatchObject({
      weekStart: "2026-05-11",
      weekEnd: "2026-05-17",
      averageUtilization: 20,
      peakUtilization: 100,
    });
  });
});

describe("calculateMovingAverage", () => {
  it("returns empty array for empty input", () => {
    expect(calculateMovingAverage([])).toEqual([]);
  });

  it("calculates moving averages from capacity analysis data", () => {
    const analysis: ResourceCapacityAnalysis[] = [
      {
        resourceId: "r-1",
        resourceName: "Alice",
        department: "Eng",
        role: "Dev",
        weeklyCapacity: 40,
        dailyUtilization: [
          {
            date: "2026-02-16",
            hoursAllocated: 8,
            hoursAvailable: 8,
            utilizationPercent: 100,
            isOverallocated: false,
            isUnderutilized: false,
            hasTimeOff: false,
            assignments: [],
          },
          {
            date: "2026-02-17",
            hoursAllocated: 4,
            hoursAvailable: 8,
            utilizationPercent: 50,
            isOverallocated: false,
            isUnderutilized: true,
            hasTimeOff: false,
            assignments: [],
          },
        ],
        averageUtilization: 75,
        peakUtilization: 100,
        overallocatedDays: 0,
        underutilizedDays: 1,
        billablePercent: 80,
        status: "optimal",
      },
    ];

    const averages = calculateMovingAverage(analysis, 2);
    expect(averages).toHaveLength(2);
    // First day: window=[100] → avg=100
    expect(averages[0]).toBe(100);
    // Second day: window=[100, 50] → avg=75
    expect(averages[1]).toBe(75);
  });
});
