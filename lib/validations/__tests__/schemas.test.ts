/**
 * Unit tests for Zod validation schemas
 * Tests valid and invalid payloads for assignments and insights
 */

import { describe, it, expect } from "vitest";
import {
  AssignmentCreateSchema,
  AssignmentUpdateSchema,
  InsightsRequestSchema,
  formatZodErrors,
} from "../schemas";

describe("AssignmentCreateSchema", () => {
  it("accepts a valid minimal payload", () => {
    const result = AssignmentCreateSchema.safeParse({
      employeeId: "emp-1",
      startDate: "2026-02-04",
      endDate: "2026-02-06",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.employeeId).toBe("emp-1");
      expect(result.data.hoursPerDay).toBe("8"); // default
      expect(result.data.isTimeOff).toBe(false); // default
      expect(result.data.isBillable).toBe(true); // default
      expect(result.data.status).toBe("confirmed"); // default
    }
  });

  it("rejects when employeeId is missing", () => {
    const result = AssignmentCreateSchema.safeParse({
      startDate: "2026-02-04",
      endDate: "2026-02-06",
    });
    expect(result.success).toBe(false);
  });

  it("rejects when startDate is empty", () => {
    const result = AssignmentCreateSchema.safeParse({
      employeeId: "emp-1",
      startDate: "",
      endDate: "2026-02-06",
    });
    expect(result.success).toBe(false);
  });

  it("rejects when endDate is missing", () => {
    const result = AssignmentCreateSchema.safeParse({
      employeeId: "emp-1",
      startDate: "2026-02-04",
    });
    expect(result.success).toBe(false);
  });

  it("coerces hoursPerDay number to string", () => {
    const result = AssignmentCreateSchema.safeParse({
      employeeId: "emp-1",
      startDate: "2026-02-04",
      endDate: "2026-02-06",
      hoursPerDay: 6,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hoursPerDay).toBe("6");
    }
  });

  it("accepts valid status values", () => {
    for (const status of ["draft", "confirmed", "completed"]) {
      const result = AssignmentCreateSchema.safeParse({
        employeeId: "emp-1",
        startDate: "2026-02-04",
        endDate: "2026-02-06",
        status,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid status values", () => {
    const result = AssignmentCreateSchema.safeParse({
      employeeId: "emp-1",
      startDate: "2026-02-04",
      endDate: "2026-02-06",
      status: "invalid_status",
    });
    expect(result.success).toBe(false);
  });
});

describe("InsightsRequestSchema", () => {
  const validCapacityItem = {
    resourceId: "r1",
    resourceName: "Alice",
    department: "Eng",
    role: "Dev",
    weeklyCapacity: 40,
    dailyUtilization: [],
    averageUtilization: 75,
    peakUtilization: 90,
    overallocatedDays: 0,
    underutilizedDays: 2,
    billablePercent: 80,
    status: "optimal",
  };

  it("accepts valid recommendations request", () => {
    const result = InsightsRequestSchema.safeParse({
      analysisType: "recommendations",
      capacityAnalysis: [validCapacityItem],
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid conflicts request", () => {
    const result = InsightsRequestSchema.safeParse({
      analysisType: "conflicts",
      capacityAnalysis: [validCapacityItem],
      conflicts: [{
        id: "c1",
        type: "overallocation",
        severity: "warning",
        resourceId: "r1",
        resourceName: "Alice",
        date: "2026-02-04",
        description: "Test conflict",
        affectedAssignments: ["a1"],
      }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects when analysisType is missing", () => {
    const result = InsightsRequestSchema.safeParse({
      capacityAnalysis: [validCapacityItem],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid analysisType", () => {
    const result = InsightsRequestSchema.safeParse({
      analysisType: "invalid",
      capacityAnalysis: [validCapacityItem],
    });
    expect(result.success).toBe(false);
  });

  it("rejects scenario request without scenarioChanges", () => {
    const result = InsightsRequestSchema.safeParse({
      analysisType: "scenario",
      analysisInput: { resources: [], assignments: [], projects: [], brands: [], dateRange: { start: "2026-02-01", end: "2026-02-28" } },
    });
    expect(result.success).toBe(false);
  });

  it("rejects scenario request with empty scenarioChanges array", () => {
    const result = InsightsRequestSchema.safeParse({
      analysisType: "scenario",
      analysisInput: { resources: [], assignments: [], projects: [], brands: [], dateRange: { start: "2026-02-01", end: "2026-02-28" } },
      scenarioChanges: [],
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid scenario request with capacityAnalysis", () => {
    const result = InsightsRequestSchema.safeParse({
      analysisType: "scenario",
      capacityAnalysis: [validCapacityItem],
      scenarioChanges: [{ type: "reassign", assignmentId: "a1", changes: { resourceId: "r2" } }],
      analysisInput: { resources: [], assignments: [], projects: [], brands: [], dateRange: { start: "2026-02-01", end: "2026-02-28" } },
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid scenario request WITHOUT capacityAnalysis", () => {
    const result = InsightsRequestSchema.safeParse({
      analysisType: "scenario",
      scenarioChanges: [{ type: "reassign", assignmentId: "a1", changes: { resourceId: "r2" } }],
      analysisInput: { resources: [], assignments: [], projects: [], brands: [], dateRange: { start: "2026-02-01", end: "2026-02-28" } },
    });
    expect(result.success).toBe(true);
  });

  it("rejects scenario with malformed assignments (not objects)", () => {
    const result = InsightsRequestSchema.safeParse({
      analysisType: "scenario",
      scenarioChanges: [{ type: "reassign", assignmentId: "a1", changes: { resourceId: "r2" } }],
      analysisInput: {
        resources: [],
        assignments: ["not-an-object"],
        projects: [],
        brands: [],
        dateRange: { start: "2026-02-01", end: "2026-02-28" },
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects scenario with malformed projects (missing required fields)", () => {
    const result = InsightsRequestSchema.safeParse({
      analysisType: "scenario",
      scenarioChanges: [{ type: "reassign", assignmentId: "a1", changes: { resourceId: "r2" } }],
      analysisInput: {
        resources: [],
        assignments: [],
        projects: [{ wrong: true }],
        brands: [],
        dateRange: { start: "2026-02-01", end: "2026-02-28" },
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects scenario with malformed brands (not objects)", () => {
    const result = InsightsRequestSchema.safeParse({
      analysisType: "scenario",
      scenarioChanges: [{ type: "reassign", assignmentId: "a1", changes: { resourceId: "r2" } }],
      analysisInput: {
        resources: [],
        assignments: [],
        projects: [],
        brands: [123],
        dateRange: { start: "2026-02-01", end: "2026-02-28" },
      },
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid fully-typed scenario payload", () => {
    const result = InsightsRequestSchema.safeParse({
      analysisType: "scenario",
      scenarioChanges: [{ type: "add_assignment", changes: { resourceId: "r1", startDate: "2026-03-01", endDate: "2026-03-15", hoursPerDay: 6, projectId: "p1" } }],
      analysisInput: {
        resources: [{ id: "r1", name: "Alice", department: "Eng", role: "Dev", capacity: 40 }],
        assignments: [{
          id: "a1", resourceId: "r1", projectId: "p1",
          startDate: "2026-02-01", endDate: "2026-02-28",
          hoursPerDay: 8, isTimeOff: false, category: "Development",
          isBillable: true, note: null,
        }],
        projects: [{ id: "p1", name: "Project X", brandId: "b1", color: "#ff0000", resourceIds: ["r1"] }],
        brands: [{ id: "b1", name: "Brand A", color: "#00ff00", resourceIds: ["r1"] }],
        dateRange: { start: "2026-02-01", end: "2026-03-31" },
      },
    });
    expect(result.success).toBe(true);
  });
});

describe("formatZodErrors", () => {
  it("formats errors into readable string", () => {
    const result = AssignmentCreateSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const formatted = formatZodErrors(result.error);
      expect(formatted).toContain("employeeId");
      expect(formatted).toContain("startDate");
      expect(formatted).toContain("endDate");
    }
  });
});
