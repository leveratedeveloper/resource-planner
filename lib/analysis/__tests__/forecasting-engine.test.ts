/**
 * Unit tests for forecasting-engine.ts
 * Tests empty resource guard and normal forecast generation
 */

import { describe, it, expect } from "vitest";
import { generateForecast } from "../forecasting-engine";
import { Resource } from "@/types";
import { AnalysisAssignment } from "../types";

describe("generateForecast", () => {
  it("returns safe defaults when resources is empty", () => {
    const result = generateForecast([], [], 4);

    expect(result.weeks).toHaveLength(4);
    for (const week of result.weeks) {
      expect(week.averageUtilization).toBe(0);
      expect(week.peakUtilization).toBe(0);
      expect(week.riskLevel).toBe("low");
      expect(week.resourcesAtRisk).toEqual([]);
    }
    expect(result.overallTrend).toBe("stable");
  });

  it("returns safe defaults when assignments is empty", () => {
    const resources: Resource[] = [
      { id: "r1", name: "Alice", department: "Eng", role: "Dev", capacity: 40 },
    ];
    const result = generateForecast(resources, [], 2);

    expect(result.weeks).toHaveLength(2);
    for (const week of result.weeks) {
      expect(week.averageUtilization).toBe(0);
      expect(week.riskLevel).toBe("low");
    }
  });

  it("generates correct number of forecast weeks", () => {
    const resources: Resource[] = [
      { id: "r1", name: "Alice", department: "Eng", role: "Dev", capacity: 40 },
    ];
    const result = generateForecast(resources, [], 6);
    expect(result.weeks).toHaveLength(6);
  });

  it("produces valid date format for week start/end", () => {
    const resources: Resource[] = [
      { id: "r1", name: "Alice", department: "Eng", role: "Dev", capacity: 40 },
    ];
    const result = generateForecast(resources, [], 2);

    for (const week of result.weeks) {
      expect(week.weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(week.weekEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("detects high utilization risk", () => {
    const resources: Resource[] = [
      { id: "r1", name: "Alice", department: "Eng", role: "Dev", capacity: 40 },
    ];

    // Create an assignment that covers the next few weeks at very high hours
    const now = new Date();
    const futureEnd = new Date(now);
    futureEnd.setDate(futureEnd.getDate() + 28);

    const assignments: AnalysisAssignment[] = [{
      id: "a1",
      resourceId: "r1",
      projectId: "p1",
      startDate: now,
      endDate: futureEnd,
      hoursPerDay: 12, // 150% utilization
      isTimeOff: false,
      category: "development",
      isBillable: true,
      note: null,
    }];

    const result = generateForecast(resources, assignments, 4);
    // At least some weeks should be high risk with 150% utilization
    const highRiskWeeks = result.weeks.filter(w => w.riskLevel === "high");
    expect(highRiskWeeks.length).toBeGreaterThan(0);
  });
});
