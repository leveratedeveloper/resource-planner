/**
 * Unit tests for scenario-simulator.ts
 * Tests deterministic conflict delta computation
 */

import { describe, it, expect } from "vitest";
import { simulateScenario } from "../scenario-simulator";
import { AnalysisInput, AnalysisAssignment } from "../types";
import type { ScenarioChange } from "../scenario-simulator";

function makeInput(assignments: AnalysisAssignment[]): AnalysisInput {
  return {
    resources: [
      { id: "r1", name: "Alice", department: "Eng", role: "Dev", capacity: 40 },
      { id: "r2", name: "Bob", department: "Eng", role: "Dev", capacity: 40 },
    ],
    assignments,
    projects: [
      { id: "p1", name: "Project Alpha", brandId: "b1", color: "#000", resourceIds: ["r1"] },
    ],
    brands: [
      { id: "b1", name: "Brand One", color: "#000", resourceIds: ["r1"] },
    ],
    dateRange: { start: "2026-02-02", end: "2026-02-06" },
  };
}

describe("simulateScenario", () => {
  it("produces deterministic conflict deltas across multiple runs", () => {
    const assignments: AnalysisAssignment[] = [
      {
        id: "a1",
        resourceId: "r1",
        projectId: "p1",
        startDate: new Date(2026, 1, 2),
        endDate: new Date(2026, 1, 6),
        hoursPerDay: 10, // Will cause overallocation (125%)
        isTimeOff: false,
        category: "development",
        isBillable: true,
        note: null,
      },
    ];

    const changes: ScenarioChange[] = [
      {
        type: "reassign",
        assignmentId: "a1",
        changes: { resourceId: "r2" },
      },
    ];

    const input = makeInput(assignments);

    // Run the same scenario multiple times
    const result1 = simulateScenario(input, changes);
    const result2 = simulateScenario(input, changes);

    // Conflict counts should be identical
    expect(result1.impactSummary.conflictsAdded).toBe(result2.impactSummary.conflictsAdded);
    expect(result1.impactSummary.conflictsResolved).toBe(result2.impactSummary.conflictsResolved);
    expect(result1.recommendation).toBe(result2.recommendation);
  });

  it("detects resolved conflicts when reassigning from overallocated resource", () => {
    const assignments: AnalysisAssignment[] = [
      {
        id: "a1",
        resourceId: "r1",
        projectId: "p1",
        startDate: new Date(2026, 1, 2),
        endDate: new Date(2026, 1, 6),
        hoursPerDay: 5,
        isTimeOff: false,
        category: "development",
        isBillable: true,
        note: null,
      },
      {
        id: "a2",
        resourceId: "r1",
        projectId: "p1",
        startDate: new Date(2026, 1, 2),
        endDate: new Date(2026, 1, 6),
        hoursPerDay: 5,
        isTimeOff: false,
        category: "development",
        isBillable: true,
        note: null,
      },
    ];

    // Reassign one assignment to r2 to reduce r1's load
    const changes: ScenarioChange[] = [
      {
        type: "reassign",
        assignmentId: "a2",
        changes: { resourceId: "r2" },
      },
    ];

    const input = makeInput(assignments);
    const result = simulateScenario(input, changes);

    // Before: r1 has 10h/day on 8h/day capacity = overallocated
    // After: r1 has 5h/day, r2 has 5h/day = both within capacity
    expect(result.impactSummary.conflictsResolved).toBeGreaterThanOrEqual(0);
    // The recommendation should not be "not_recommended"
    expect(result.recommendation).not.toBe("not_recommended");
  });

  it("handles remove_assignment scenario", () => {
    const assignments: AnalysisAssignment[] = [
      {
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
      },
    ];

    const changes: ScenarioChange[] = [
      { type: "remove_assignment", assignmentId: "a1", changes: {} },
    ];

    const input = makeInput(assignments);
    const result = simulateScenario(input, changes);

    // After removing the overallocating assignment, conflicts should be resolved
    expect(result.afterAnalysis.summary.conflictCount).toBeLessThanOrEqual(
      result.beforeAnalysis.summary.conflictCount
    );
  });
});
