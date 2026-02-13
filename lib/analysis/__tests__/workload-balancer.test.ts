/**
 * Unit tests for workload-balancer.ts
 * Tests reassignment scoring with differing resource capacities
 */

import { describe, it, expect } from "vitest";
import { generateReassignmentSuggestions } from "../workload-balancer";
import { ResourceCapacityAnalysis, AnalysisAssignment, AnalysisProject } from "../types";
import { Resource } from "@/types";

function makeCapacity(
  id: string,
  name: string,
  status: "overallocated" | "optimal" | "underutilized",
  avgUtil: number,
  capacity: number = 40
): ResourceCapacityAnalysis {
  return {
    resourceId: id,
    resourceName: name,
    department: "Eng",
    role: "Dev",
    weeklyCapacity: capacity,
    dailyUtilization: [],
    averageUtilization: avgUtil,
    peakUtilization: avgUtil,
    overallocatedDays: status === "overallocated" ? 5 : 0,
    underutilizedDays: status === "underutilized" ? 5 : 0,
    billablePercent: 80,
    status,
  };
}

describe("generateReassignmentSuggestions", () => {
  it("uses destination resource capacity for utilization calculation", () => {
    // Resource A: 40h/week capacity, overallocated at 120%
    // Resource B: 20h/week capacity, underutilized at 30%
    const capacityAnalysis: ResourceCapacityAnalysis[] = [
      makeCapacity("rA", "Alice", "overallocated", 120, 40),
      makeCapacity("rB", "Bob", "underutilized", 30, 20),
    ];

    const resources: Resource[] = [
      { id: "rA", name: "Alice", department: "Eng", role: "Dev", capacity: 40 },
      { id: "rB", name: "Bob", department: "Eng", role: "Dev", capacity: 20 },
    ];

    const assignments: AnalysisAssignment[] = [{
      id: "a1",
      resourceId: "rA",
      projectId: "p1",
      startDate: new Date(2026, 1, 2),
      endDate: new Date(2026, 1, 6),
      hoursPerDay: 2,
      isTimeOff: false,
      category: "development",
      isBillable: true,
      note: null,
    }];

    const projects: AnalysisProject[] = [
      { id: "p1", name: "Project Alpha", brandId: "b1", color: "#000", resourceIds: ["rA"] },
    ];

    const suggestions = generateReassignmentSuggestions(
      capacityAnalysis, assignments, resources, projects, [], 5
    );

    // Should have at least one suggestion
    expect(suggestions.length).toBeGreaterThan(0);

    const suggestion = suggestions[0];
    // The destination utilization should use Bob's capacity (20h/week = 4h/day)
    // 2h / 4h = 50% additional, so Bob goes from 30% to 80%
    expect(suggestion.impact.toUtilizationAfter).toBeCloseTo(80, 0);

    // Alice: 2h / 8h = 25% less, so 120% to 95%
    expect(suggestion.impact.fromUtilizationAfter).toBeCloseTo(95, 0);
  });

  it("skips suggestions that would overload the candidate", () => {
    const capacityAnalysis: ResourceCapacityAnalysis[] = [
      makeCapacity("rA", "Alice", "overallocated", 120, 40),
      makeCapacity("rB", "Bob", "underutilized", 50, 20), // Only 20h/week
    ];

    const resources: Resource[] = [
      { id: "rA", name: "Alice", department: "Eng", role: "Dev", capacity: 40 },
      { id: "rB", name: "Bob", department: "Eng", role: "Dev", capacity: 20 },
    ];

    // 4h/day for Bob's 4h/day capacity = 100% additional → would exceed 100%
    const assignments: AnalysisAssignment[] = [{
      id: "a1",
      resourceId: "rA",
      projectId: "p1",
      startDate: new Date(2026, 1, 2),
      endDate: new Date(2026, 1, 6),
      hoursPerDay: 4,
      isTimeOff: false,
      category: "development",
      isBillable: true,
      note: null,
    }];

    const projects: AnalysisProject[] = [
      { id: "p1", name: "Project Alpha", brandId: "b1", color: "#000", resourceIds: ["rA"] },
    ];

    const suggestions = generateReassignmentSuggestions(
      capacityAnalysis, assignments, resources, projects, [], 5
    );

    // Should skip Bob since 50% + 100% = 150% > 100%
    expect(suggestions.length).toBe(0);
  });

  it("returns empty array when no overallocated resources", () => {
    const capacityAnalysis: ResourceCapacityAnalysis[] = [
      makeCapacity("rA", "Alice", "optimal", 75),
    ];
    const resources: Resource[] = [
      { id: "rA", name: "Alice", department: "Eng", role: "Dev", capacity: 40 },
    ];

    const suggestions = generateReassignmentSuggestions(
      capacityAnalysis, [], resources, [], [], 5
    );
    expect(suggestions).toEqual([]);
  });
});
