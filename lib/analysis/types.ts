/**
 * Analysis Engine Types
 * Shared interfaces for capacity analysis, conflict detection, and forecasting
 */

import { Resource } from "@/types";

// ============================================================================
// Assignment type used internally by the analysis engine
// ============================================================================

/**
 * Assignment type used internally by the analysis engine.
 * This matches the transformed data from AppContext where employeeId becomes resourceId.
 */
export interface AnalysisAssignment {
  id: string;
  resourceId: string;
  projectId: string;
  startDate: Date;
  endDate: Date;
  hoursPerDay: number;
  isTimeOff: boolean;
  category: string;
  isBillable: boolean;
  note: string | null;
}

/**
 * Assignment with pre-parsed date timestamps for fast comparison
 */
export interface ParsedAssignment extends AnalysisAssignment {
  _startTime: number;
  _endTime: number;
}

/**
 * Project shape used internally by the analysis engine.
 */
export interface AnalysisProject {
  id: string;
  name: string;
  brandId: string;
  color: string;
  resourceIds: string[];
}

/**
 * Brand shape used internally by the analysis engine.
 */
export interface AnalysisBrand {
  id: string;
  name: string;
  color: string;
  resourceIds: string[];
}

// ============================================================================
// Core Analysis Types
// ============================================================================

/**
 * Daily utilization data for a single resource
 */
export type DailyUtilization = {
  date: string; // ISO date string (YYYY-MM-DD)
  hoursAllocated: number;
  hoursAvailable: number; // Based on resource capacity (e.g., 8 hours/day)
  utilizationPercent: number; // (hoursAllocated / hoursAvailable) * 100
  isOverallocated: boolean; // > 100%
  isUnderutilized: boolean; // < 60%
  hasTimeOff: boolean;
  assignments: string[]; // Assignment IDs contributing to this day
};

/**
 * Aggregated capacity data for a resource over a time period
 */
export type ResourceCapacityAnalysis = {
  resourceId: string;
  resourceName: string;
  department: string;
  role: string;
  weeklyCapacity: number;
  dailyUtilization: DailyUtilization[];
  averageUtilization: number;
  peakUtilization: number;
  overallocatedDays: number;
  underutilizedDays: number;
  billablePercent: number;
  status: "overallocated" | "optimal" | "underutilized";
};

// ============================================================================
// Conflict Types
// ============================================================================

export type ConflictType =
  | "time_off_deadline" // Time-off overlaps with project deadline
  | "overallocation" // > 100% on same day
  | "resource_unavailable" // Assigned during time-off
  | "billable_target"; // < 80% billable but fully allocated

export type ConflictSeverity = "critical" | "warning" | "info";

export type Conflict = {
  id: string;
  type: ConflictType;
  severity: ConflictSeverity;
  resourceId: string;
  resourceName: string;
  date: string; // ISO date string
  description: string;
  affectedAssignments: string[]; // Assignment IDs
  suggestedResolution?: string;
};

// ============================================================================
// Forecasting Types
// ============================================================================

export type WeeklyForecast = {
  weekStart: string; // ISO date string (Monday)
  weekEnd: string; // ISO date string (Sunday)
  averageUtilization: number;
  peakUtilization: number;
  resourcesAtRisk: string[]; // Resource IDs predicted to be overallocated
  riskLevel: "low" | "medium" | "high";
  trend: "improving" | "stable" | "declining";
};

export type ForecastResult = {
  weeks: WeeklyForecast[];
  overallTrend: "improving" | "stable" | "declining";
  bottleneckDates: string[]; // Dates with highest risk
  recommendations: string[];
};

// ============================================================================
// Recommendation Types
// ============================================================================

export type ReassignmentSuggestion = {
  id: string;
  assignmentId: string;
  fromResourceId: string;
  fromResourceName: string;
  toResourceId: string;
  toResourceName: string;
  projectName: string;
  hoursPerDay: number;
  dateRange: { start: string; end: string };
  score: number; // 0-100, higher = better match
  reasoning: string;
  impact: {
    fromUtilizationBefore: number;
    fromUtilizationAfter: number;
    toUtilizationBefore: number;
    toUtilizationAfter: number;
  };
};

export type CapacityRecommendation = {
  id: string;
  type: "reassignment" | "reschedule" | "reduce_scope" | "add_resource";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  aiExplanation?: string; // Natural language explanation from AI
  suggestion?: ReassignmentSuggestion;
  estimatedImpact: string;
};

// ============================================================================
// Worker Message Types
// ============================================================================

export type AnalysisInput = {
  resources: Resource[];
  assignments: AnalysisAssignment[];
  projects: AnalysisProject[];
  brands: AnalysisBrand[];
  dateRange: {
    start: string; // ISO date string
    end: string;   // ISO date string
  };
};

export type AnalysisResult = {
  timestamp: number;
  capacityAnalysis: ResourceCapacityAnalysis[];
  conflicts: Conflict[];
  summary: {
    totalResources: number;
    overallocatedCount: number;
    underutilizedCount: number;
    optimalCount: number;
    conflictCount: number;
    criticalConflicts: number;
  };
};

// Worker message types for type-safe communication
export type WorkerRequest = {
  type: "ANALYZE";
  payload: AnalysisInput;
  requestId: string;
};

export type WorkerResponse = {
  type: "ANALYSIS_COMPLETE" | "ANALYSIS_ERROR";
  payload: AnalysisResult | { error: string };
  requestId: string;
};
