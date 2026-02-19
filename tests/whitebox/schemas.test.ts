import { describe, it, expect } from "vitest";
import {
  AssignmentCreateSchema,
  AssignmentPutSchema,
  InsightsRequestSchema,
  formatZodErrors,
} from "@/lib/validations/schemas";
import { z } from "zod";

// ============================================================================
// AssignmentCreateSchema
// ============================================================================

describe("AssignmentCreateSchema", () => {
  const validPayload = {
    employeeId: "emp-1",
    startDate: "2026-02-18",
    endDate: "2026-02-20",
  };

  it("accepts a valid minimal input", () => {
    const result = AssignmentCreateSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("defaults hoursPerDay to '8'", () => {
    const result = AssignmentCreateSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hoursPerDay).toBe("8");
    }
  });

  it("defaults status to 'confirmed'", () => {
    const result = AssignmentCreateSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("confirmed");
    }
  });

  it("rejects missing employeeId", () => {
    const result = AssignmentCreateSchema.safeParse({
      startDate: "2026-02-18",
      endDate: "2026-02-20",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing startDate", () => {
    const result = AssignmentCreateSchema.safeParse({
      employeeId: "emp-1",
      endDate: "2026-02-20",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing endDate", () => {
    const result = AssignmentCreateSchema.safeParse({
      employeeId: "emp-1",
      startDate: "2026-02-18",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty employeeId string", () => {
    const result = AssignmentCreateSchema.safeParse({
      ...validPayload,
      employeeId: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid status enum value", () => {
    const result = AssignmentCreateSchema.safeParse({
      ...validPayload,
      status: "invalid_status",
    });
    expect(result.success).toBe(false);
  });

  it("accepts hoursPerDay as number and transforms to string", () => {
    const result = AssignmentCreateSchema.safeParse({
      ...validPayload,
      hoursPerDay: 4,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hoursPerDay).toBe("4");
    }
  });
});

// ============================================================================
// AssignmentPutSchema
// ============================================================================

describe("AssignmentPutSchema", () => {
  it("requires employeeId", () => {
    const result = AssignmentPutSchema.safeParse({
      startDate: "2026-02-18",
      endDate: "2026-02-20",
    });
    expect(result.success).toBe(false);
  });

  it("requires startDate", () => {
    const result = AssignmentPutSchema.safeParse({
      employeeId: "emp-1",
      endDate: "2026-02-20",
    });
    expect(result.success).toBe(false);
  });

  it("requires endDate", () => {
    const result = AssignmentPutSchema.safeParse({
      employeeId: "emp-1",
      startDate: "2026-02-18",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid full payload", () => {
    const result = AssignmentPutSchema.safeParse({
      employeeId: "emp-1",
      startDate: "2026-02-18",
      endDate: "2026-02-20",
    });
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// InsightsRequestSchema
// ============================================================================

describe("InsightsRequestSchema", () => {
  const validCapacityItem = {
    resourceId: "r-1",
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
    status: "optimal" as const,
  };

  it("accepts a valid 'recommendations' request", () => {
    const result = InsightsRequestSchema.safeParse({
      analysisType: "recommendations",
      capacityAnalysis: [validCapacityItem],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid 'conflicts' request", () => {
    const result = InsightsRequestSchema.safeParse({
      analysisType: "conflicts",
      capacityAnalysis: [validCapacityItem],
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown analysisType", () => {
    const result = InsightsRequestSchema.safeParse({
      analysisType: "unknown_type",
      capacityAnalysis: [validCapacityItem],
    });
    expect(result.success).toBe(false);
  });

  it("rejects recommendations without capacityAnalysis", () => {
    const result = InsightsRequestSchema.safeParse({
      analysisType: "recommendations",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid 'scenario' request", () => {
    const result = InsightsRequestSchema.safeParse({
      analysisType: "scenario",
      analysisInput: {
        resources: [{ id: "r-1", name: "Alice", department: "Eng", role: "Dev", capacity: 40 }],
        assignments: [],
        projects: [],
        brands: [],
        dateRange: { start: "2026-02-01", end: "2026-02-28" },
      },
      scenarioChanges: [
        { type: "reassign", changes: { resourceId: "r-2" } },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects scenario with empty scenarioChanges", () => {
    const result = InsightsRequestSchema.safeParse({
      analysisType: "scenario",
      analysisInput: {
        resources: [],
        assignments: [],
        projects: [],
        brands: [],
        dateRange: { start: "2026-02-01", end: "2026-02-28" },
      },
      scenarioChanges: [],
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// formatZodErrors
// ============================================================================

describe("formatZodErrors", () => {
  it("formats multiple issues separated by semicolons", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });
    const result = schema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const formatted = formatZodErrors(result.error);
      expect(formatted).toContain("name:");
      expect(formatted).toContain("age:");
      expect(formatted).toContain(";");
    }
  });
});
