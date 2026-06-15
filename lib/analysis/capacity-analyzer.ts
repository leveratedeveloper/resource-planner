/**
 * Capacity Analyzer
 * Pure functions for calculating resource utilization and capacity metrics
 * Designed to run in Web Worker for performance
 */

import { Resource } from "@/types";
import {
  DailyUtilization,
  ResourceCapacityAnalysis,
  AnalysisInput,
  AnalysisAssignment,
  ParsedAssignment,
} from "./types";
import { toLocalDateKey, parseLocalDateKey } from "./date-utils";

// ============================================================================
// Pre-indexing and Date Parsing (Performance Optimization)
// ============================================================================

/**
 * Pre-index assignments by employeeId for O(1) lookup
 */
export function indexAssignmentsByResource(
  assignments: ParsedAssignment[]
): Map<string, ParsedAssignment[]> {
  const index = new Map<string, ParsedAssignment[]>();
  for (const a of assignments) {
    const existing = index.get(a.resourceId) || [];
    existing.push(a);
    index.set(a.resourceId, existing);
  }
  return index;
}

/**
 * Pre-parse assignment dates to avoid repeated Date object creation
 */
export function parseAssignmentDates(assignments: AnalysisAssignment[]): ParsedAssignment[] {
  return assignments.map((a) => {
    const start = new Date(a.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(a.endDate);
    end.setHours(0, 0, 0, 0);
    return {
      ...a,
      _startTime: start.getTime(),
      _endTime: end.getTime(),
    };
  });
}

/**
 * Parse date strings to timestamps for fast comparison
 */
export function parseDateRangeToTimestamps(dates: string[]): number[] {
  return dates.map((d) => {
    const parsed = parseLocalDateKey(d);
    return parsed.getTime();
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate array of date strings between start and end (inclusive)
 */
export function getDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = parseLocalDateKey(start);
  const endDate = parseLocalDateKey(end);

  while (current <= endDate) {
    dates.push(toLocalDateKey(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Check if a timestamp falls within an assignment's date range (optimized)
 */
export function isDateInAssignment(
  dateTime: number,
  assignment: ParsedAssignment
): boolean {
  return dateTime >= assignment._startTime && dateTime <= assignment._endTime;
}

/**
 * Legacy: Check if a date string falls within an assignment's date range
 * @deprecated Use isDateInAssignment with pre-parsed timestamps instead
 */
export function isDateStrInAssignment(
  dateStr: string,
  assignment: { startDate: Date; endDate: Date }
): boolean {
  const date = parseLocalDateKey(dateStr);
  const start = new Date(assignment.startDate);
  const end = new Date(assignment.endDate);

  // Normalize to start of day for comparison
  date.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  return date >= start && date <= end;
}

/**
 * Convert weekly capacity to daily capacity (assuming 5 working days)
 */
export function getDailyCapacity(weeklyCapacity: number): number {
  return weeklyCapacity / 5;
}

// ============================================================================
// Core Analysis Functions
// ============================================================================

/**
 * Calculate daily utilization for a single resource (optimized)
 * Uses pre-parsed assignments and timestamps for fast comparison
 */
export function calculateDailyUtilization(
  resource: Resource,
  resourceAssignments: ParsedAssignment[],
  dateRange: string[],
  dateTimestamps: number[]
): DailyUtilization[] {
  const dailyCapacity = getDailyCapacity(resource.capacity);

  return dateRange.map((dateStr, idx) => {
    const dateTime = dateTimestamps[idx];
    const dayAssignments = resourceAssignments.filter((a) =>
      isDateInAssignment(dateTime, a)
    );

    const workAssignments = dayAssignments.filter((a) => !a.isTimeOff);
    const hoursAvailable = dailyCapacity;
    const hoursAllocated = workAssignments.reduce((sum, a) => sum + a.hoursPerDay, 0);

    // Calculate utilization (handle division by zero)
    const utilizationPercent =
      hoursAvailable > 0 ? (hoursAllocated / hoursAvailable) * 100 : 0;

    return {
      date: dateStr,
      hoursAllocated,
      hoursAvailable,
      utilizationPercent,
      isOverallocated: utilizationPercent > 100,
      isUnderutilized: utilizationPercent < 60 && utilizationPercent > 0,
      hasTimeOff: false,
      assignments: workAssignments.map((a) => a.id),
    };
  });
}

/**
 * Calculate billable percentage for a resource's assignments (optimized)
 * Uses pre-parsed assignments with cached timestamps
 */
export function calculateBillablePercent(
  resourceAssignments: ParsedAssignment[]
): number {
  const workAssignments = resourceAssignments.filter((a) => !a.isTimeOff);

  if (workAssignments.length === 0) return 0;

  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  const totalHours = workAssignments.reduce((sum, a) => {
    const days = Math.ceil((a._endTime - a._startTime) / MS_PER_DAY) + 1;
    return sum + a.hoursPerDay * days;
  }, 0);

  const billableHours = workAssignments
    .filter((a) => a.isBillable)
    .reduce((sum, a) => {
      const days = Math.ceil((a._endTime - a._startTime) / MS_PER_DAY) + 1;
      return sum + a.hoursPerDay * days;
    }, 0);

  return totalHours > 0 ? (billableHours / totalHours) * 100 : 0;
}

/**
 * Determine resource status based on utilization patterns
 */
export function determineResourceStatus(
  dailyUtilization: DailyUtilization[]
): "overallocated" | "optimal" | "underutilized" {
  const workingDays = dailyUtilization;
  
  if (workingDays.length === 0) return "optimal";

  const overallocatedDays = workingDays.filter((d) => d.isOverallocated).length;
  const underutilizedDays = workingDays.filter((d) => d.isUnderutilized).length;

  // Overallocated if >100% for 3+ consecutive days or >50% of days
  if (overallocatedDays >= 3 || overallocatedDays / workingDays.length > 0.5) {
    return "overallocated";
  }

  // Underutilized if <60% for 5+ consecutive days or >60% of days
  if (underutilizedDays >= 5 || underutilizedDays / workingDays.length > 0.6) {
    return "underutilized";
  }

  return "optimal";
}

/**
 * Analyze capacity for a single resource (optimized)
 */
export function analyzeResourceCapacity(
  resource: Resource,
  resourceAssignments: ParsedAssignment[],
  dateRange: string[],
  dateTimestamps: number[]
): ResourceCapacityAnalysis {
  const dailyUtilization = calculateDailyUtilization(
    resource,
    resourceAssignments,
    dateRange,
    dateTimestamps
  );

  const workingDays = dailyUtilization;
  const utilizationValues = workingDays.map((d) => d.utilizationPercent);

  const averageUtilization =
    utilizationValues.length > 0
      ? utilizationValues.reduce((a, b) => a + b, 0) / utilizationValues.length
      : 0;

  const peakUtilization =
    utilizationValues.length > 0 ? Math.max(...utilizationValues) : 0;

  return {
    resourceId: resource.id,
    resourceName: resource.name,
    department: resource.department,
    role: resource.role,
    weeklyCapacity: resource.capacity,
    dailyUtilization,
    averageUtilization,
    peakUtilization,
    overallocatedDays: workingDays.filter((d) => d.isOverallocated).length,
    underutilizedDays: workingDays.filter((d) => d.isUnderutilized).length,
    billablePercent: calculateBillablePercent(resourceAssignments),
    status: determineResourceStatus(dailyUtilization),
  };
}

/**
 * Main analysis function - analyzes all resources (optimized)
 * Pre-indexes assignments by resource and pre-parses dates for performance
 */
export function analyzeCapacity(
  input: AnalysisInput
): ResourceCapacityAnalysis[] {
  // Pre-compute date range and timestamps once
  const dateRange = getDateRange(input.dateRange.start, input.dateRange.end);
  const dateTimestamps = parseDateRangeToTimestamps(dateRange);
  
  // Pre-parse all assignment dates once
  const parsedAssignments = parseAssignmentDates(input.assignments);
  
  // Pre-index assignments by resourceId for O(1) lookup
  const assignmentIndex = indexAssignmentsByResource(parsedAssignments);

  return input.resources.map((resource) =>
    analyzeResourceCapacity(
      resource,
      assignmentIndex.get(resource.id) || [],
      dateRange,
      dateTimestamps
    )
  );
}
