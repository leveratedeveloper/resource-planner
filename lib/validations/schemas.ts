/**
 * Zod Validation Schemas
 * Request body validation for API routes
 */

import { z } from "zod";

// ============================================================================
// Assignment Schemas
// ============================================================================

export const AssignmentCreateSchema = z.object({
  employeeId: z.string().min(1, "employeeId is required"),
  projectId: z.string().nullable().optional(),
  taskId: z.string().nullable().optional(),
  startDate: z.string().min(1, "startDate is required"),
  endDate: z.string().min(1, "endDate is required"),
  hoursPerDay: z.union([z.string(), z.number()]).optional().default("8").transform(String),
  allocationPercentage: z.union([z.string(), z.number()]).nullable().optional().transform((v) => v != null ? String(v) : null),
  isTimeOff: z.boolean().optional().default(false),
  timeOffTypeId: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  isBillable: z.boolean().optional().default(true),
  status: z.enum(["draft", "confirmed", "completed"]).optional().default("confirmed"),
  note: z.string().nullable().optional(),
  createdById: z.string().nullable().optional(),
});

// Strict PUT schema: requires core fields but allows id/optional fields
export const AssignmentPutSchema = z.object({
  employeeId: z.string().min(1, "employeeId is required"),
  projectId: z.string().nullable().optional(),
  taskId: z.string().nullable().optional(),
  startDate: z.string().min(1, "startDate is required"),
  endDate: z.string().min(1, "endDate is required"),
  hoursPerDay: z.union([z.string(), z.number()]).optional().default("8").transform(String),
  allocationPercentage: z.union([z.string(), z.number()]).nullable().optional().transform((v) => v != null ? String(v) : null),
  isTimeOff: z.boolean().optional().default(false),
  timeOffTypeId: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  isBillable: z.boolean().optional().default(true),
  status: z.enum(["draft", "confirmed", "completed"]).optional().default("confirmed"),
  note: z.string().nullable().optional(),
  createdById: z.string().nullable().optional(),
});

export const AssignmentUpdateSchema = AssignmentCreateSchema.partial();

export type AssignmentCreateInput = z.infer<typeof AssignmentCreateSchema>;
export type AssignmentUpdateInput = z.infer<typeof AssignmentUpdateSchema>;
export type AssignmentPutInput = z.infer<typeof AssignmentPutSchema>;

// ============================================================================
// Insights Schemas
// ============================================================================

const AnalysisTypeEnum = z.enum(["recommendations", "conflicts", "scenario"]);

const CapacityAnalysisItemSchema = z.object({
  resourceId: z.string(),
  resourceName: z.string(),
  department: z.string(),
  role: z.string(),
  weeklyCapacity: z.number(),
  dailyUtilization: z.array(z.any()),
  averageUtilization: z.number(),
  peakUtilization: z.number(),
  overallocatedDays: z.number(),
  underutilizedDays: z.number(),
  billablePercent: z.number(),
  status: z.enum(["overallocated", "optimal", "underutilized"]),
});

const ConflictSchema = z.object({
  id: z.string(),
  type: z.enum(["time_off_deadline", "overallocation", "resource_unavailable", "billable_target"]),
  severity: z.enum(["critical", "warning", "info"]),
  resourceId: z.string(),
  resourceName: z.string(),
  date: z.string(),
  description: z.string(),
  affectedAssignments: z.array(z.string()),
  suggestedResolution: z.string().optional(),
});

const ScenarioChangeSchema = z.object({
  type: z.enum(["reassign", "reschedule", "add_assignment", "remove_assignment"]),
  assignmentId: z.string().optional(),
  changes: z.object({
    resourceId: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    hoursPerDay: z.number().optional(),
    projectId: z.string().optional(),
  }),
});

// ---------------------------------------------------------------------------
// Discriminated union: each analysisType enforces its own required fields
// ---------------------------------------------------------------------------

const RecommendationsRequestSchema = z.object({
  analysisType: z.literal("recommendations"),
  capacityAnalysis: z.array(CapacityAnalysisItemSchema),
  conflicts: z.array(ConflictSchema).optional().default([]),
});

const ConflictsRequestSchema = z.object({
  analysisType: z.literal("conflicts"),
  capacityAnalysis: z.array(CapacityAnalysisItemSchema),
  conflicts: z.array(ConflictSchema).optional().default([]),
});

const AnalysisAssignmentSchema = z.object({
  id: z.string(),
  resourceId: z.string(),
  projectId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  hoursPerDay: z.number(),
  isTimeOff: z.boolean(),
  category: z.string(),
  isBillable: z.boolean(),
  note: z.string().nullable(),
});

const AnalysisProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  brandId: z.string(),
  color: z.string(),
  resourceIds: z.array(z.string()),
});

const AnalysisBrandSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  resourceIds: z.array(z.string()),
});

const AnalysisInputSchema = z.object({
  resources: z.array(z.object({
    id: z.string(),
    name: z.string(),
    department: z.string(),
    role: z.string(),
    capacity: z.number(),
  })),
  assignments: z.array(AnalysisAssignmentSchema),
  projects: z.array(AnalysisProjectSchema),
  brands: z.array(AnalysisBrandSchema),
  dateRange: z.object({
    start: z.string(),
    end: z.string(),
  }),
});

const ScenarioRequestSchema = z.object({
  analysisType: z.literal("scenario"),
  analysisInput: AnalysisInputSchema,
  scenarioChanges: z
    .array(ScenarioChangeSchema)
    .min(1, "scenarioChanges must contain at least one change"),
  // These may be sent by the client but are ignored for scenario analysis
  capacityAnalysis: z.any().optional(),
  conflicts: z.any().optional(),
});

export const InsightsRequestSchema = z.discriminatedUnion("analysisType", [
  RecommendationsRequestSchema,
  ConflictsRequestSchema,
  ScenarioRequestSchema,
]);

export type InsightsRequestInput = z.infer<typeof InsightsRequestSchema>;

/**
 * Format Zod errors into a readable message
 */
export function formatZodErrors(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
}
