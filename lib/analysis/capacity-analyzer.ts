/**
 * Capacity Analyzer
 * Pure functions for calculating resource utilization and capacity metrics
 * Designed to run in Web Worker for performance
 */

import { Assignment, Resource, Project } from "@/types";
import {
  DailyUtilization,
  ResourceCapacityAnalysis,
  AnalysisInput,
} from "./types";

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate array of date strings between start and end (inclusive)
 */
export function getDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start);
  const endDate = new Date(end);

  while (current <= endDate) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Check if a date falls within an assignment's date range
 */
export function isDateInAssignment(
  dateStr: string,
  assignment: Assignment
): boolean {
  const date = new Date(dateStr);
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
 * Calculate daily utilization for a single resource
 */
export function calculateDailyUtilization(
  resource: Resource,
  assignments: Assignment[],
  dateRange: string[]
): DailyUtilization[] {
  const dailyCapacity = getDailyCapacity(resource.capacity);
  const resourceAssignments = assignments.filter(
    (a) => a.resourceId === resource.id
  );

  return dateRange.map((dateStr) => {
    const dayAssignments = resourceAssignments.filter((a) =>
      isDateInAssignment(dateStr, a)
    );

    const hasTimeOff = dayAssignments.some((a) => a.isTimeOff);
    
    // If there's time off, available hours = 0
    const hoursAvailable = hasTimeOff ? 0 : dailyCapacity;
    
    // Calculate allocated hours (excluding time-off blocks from allocation count)
    const hoursAllocated = dayAssignments
      .filter((a) => !a.isTimeOff)
      .reduce((sum, a) => sum + a.hoursPerDay, 0);

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
      hasTimeOff,
      assignments: dayAssignments.map((a) => a.id),
    };
  });
}

/**
 * Calculate billable percentage for a resource's assignments
 */
export function calculateBillablePercent(
  resourceId: string,
  assignments: Assignment[]
): number {
  const resourceAssignments = assignments.filter(
    (a) => a.resourceId === resourceId && !a.isTimeOff
  );

  if (resourceAssignments.length === 0) return 0;

  const totalHours = resourceAssignments.reduce((sum, a) => {
    const days = Math.ceil(
      (new Date(a.endDate).getTime() - new Date(a.startDate).getTime()) /
        (1000 * 60 * 60 * 24)
    ) + 1;
    return sum + a.hoursPerDay * days;
  }, 0);

  const billableHours = resourceAssignments
    .filter((a) => a.isBillable)
    .reduce((sum, a) => {
      const days = Math.ceil(
        (new Date(a.endDate).getTime() - new Date(a.startDate).getTime()) /
          (1000 * 60 * 60 * 24)
      ) + 1;
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
  const workingDays = dailyUtilization.filter((d) => !d.hasTimeOff);
  
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
 * Analyze capacity for a single resource
 */
export function analyzeResourceCapacity(
  resource: Resource,
  assignments: Assignment[],
  dateRange: string[]
): ResourceCapacityAnalysis {
  const dailyUtilization = calculateDailyUtilization(
    resource,
    assignments,
    dateRange
  );

  const workingDays = dailyUtilization.filter((d) => !d.hasTimeOff);
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
    billablePercent: calculateBillablePercent(resource.id, assignments),
    status: determineResourceStatus(dailyUtilization),
  };
}

/**
 * Main analysis function - analyzes all resources
 */
export function analyzeCapacity(
  input: AnalysisInput
): ResourceCapacityAnalysis[] {
  const dateRange = getDateRange(input.dateRange.start, input.dateRange.end);

  return input.resources.map((resource) =>
    analyzeResourceCapacity(resource, input.assignments, dateRange)
  );
}
