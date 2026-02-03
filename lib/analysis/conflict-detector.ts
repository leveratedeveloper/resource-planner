/**
 * Conflict Detector
 * Pure functions for detecting scheduling conflicts and issues
 * Designed to run in Web Worker for performance
 */

import { Assignment, Resource, Project } from "@/types";
import {
  Conflict,
  ConflictType,
  ConflictSeverity,
  ResourceCapacityAnalysis,
  AnalysisInput,
} from "./types";
import { getDateRange, isDateStrInAssignment } from "./capacity-analyzer";

// ============================================================================
// Utility Functions
// ============================================================================

let conflictIdCounter = 0;

function generateConflictId(): string {
  return `conflict-${Date.now()}-${++conflictIdCounter}`;
}

function getSeverity(type: ConflictType): ConflictSeverity {
  switch (type) {
    case "time_off_deadline":
      return "critical";
    case "overallocation":
      return "warning";
    case "resource_unavailable":
      return "critical";
    case "billable_target":
      return "info";
    default:
      return "warning";
  }
}

// ============================================================================
// Conflict Detection Functions
// ============================================================================

/**
 * Detect overallocation conflicts (>100% on same day)
 */
export function detectOverallocationConflicts(
  capacityAnalysis: ResourceCapacityAnalysis[],
  resources: Resource[]
): Conflict[] {
  const conflicts: Conflict[] = [];

  for (const analysis of capacityAnalysis) {
    const overallocatedDays = analysis.dailyUtilization.filter(
      (d) => d.isOverallocated
    );

    for (const day of overallocatedDays) {
      conflicts.push({
        id: generateConflictId(),
        type: "overallocation",
        severity: day.utilizationPercent > 150 ? "critical" : "warning",
        resourceId: analysis.resourceId,
        resourceName: analysis.resourceName,
        date: day.date,
        description: `${analysis.resourceName} is at ${Math.round(day.utilizationPercent)}% capacity (${day.hoursAllocated}h allocated, ${day.hoursAvailable}h available)`,
        affectedAssignments: day.assignments,
        suggestedResolution: `Consider reassigning ${Math.round(day.hoursAllocated - day.hoursAvailable)}h to another team member`,
      });
    }
  }

  return conflicts;
}

/**
 * Detect resource unavailability conflicts (assigned during time-off)
 */
export function detectTimeOffConflicts(
  assignments: Assignment[],
  resources: Resource[],
  projects: Project[]
): Conflict[] {
  const conflicts: Conflict[] = [];
  const resourceMap = new Map(resources.map((r) => [r.id, r]));
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  // Get all time-off assignments
  const timeOffAssignments = assignments.filter((a) => a.isTimeOff);
  const workAssignments = assignments.filter((a) => !a.isTimeOff);

  for (const timeOff of timeOffAssignments) {
    const resource = resourceMap.get(timeOff.resourceId);
    if (!resource) continue;

    // Find work assignments that overlap with this time-off
    const overlappingWork = workAssignments.filter(
      (work) =>
        work.resourceId === timeOff.resourceId &&
        datesOverlap(timeOff, work)
    );

    for (const work of overlappingWork) {
      const project = projectMap.get(work.projectId);
      const overlapDates = getOverlapDates(timeOff, work);

      conflicts.push({
        id: generateConflictId(),
        type: "resource_unavailable",
        severity: "critical",
        resourceId: resource.id,
        resourceName: resource.name,
        date: overlapDates[0], // First overlap date
        description: `${resource.name} has time-off from ${formatDate(timeOff.startDate)} to ${formatDate(timeOff.endDate)}, but is assigned to "${project?.name || 'Unknown Project'}" during this period`,
        affectedAssignments: [timeOff.id, work.id],
        suggestedResolution: `Reassign "${project?.name}" work to another team member or adjust the assignment dates`,
      });
    }
  }

  return conflicts;
}

/**
 * Detect billable target conflicts (<80% billable but fully allocated)
 */
export function detectBillableTargetConflicts(
  capacityAnalysis: ResourceCapacityAnalysis[]
): Conflict[] {
  const conflicts: Conflict[] = [];

  for (const analysis of capacityAnalysis) {
    // Only flag if resource is at high utilization but low billable
    if (
      analysis.averageUtilization >= 80 &&
      analysis.billablePercent < 80
    ) {
      conflicts.push({
        id: generateConflictId(),
        type: "billable_target",
        severity: "info",
        resourceId: analysis.resourceId,
        resourceName: analysis.resourceName,
        date: new Date().toISOString().split("T")[0],
        description: `${analysis.resourceName} is at ${Math.round(analysis.averageUtilization)}% utilization but only ${Math.round(analysis.billablePercent)}% billable`,
        affectedAssignments: [],
        suggestedResolution: `Review non-billable assignments and consider reallocating to billable projects`,
      });
    }
  }

  return conflicts;
}

/**
 * Detect time-off vs deadline conflicts (within 3 days)
 */
export function detectDeadlineConflicts(
  assignments: Assignment[],
  resources: Resource[],
  projects: Project[]
): Conflict[] {
  const conflicts: Conflict[] = [];
  const resourceMap = new Map(resources.map((r) => [r.id, r]));
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  const timeOffAssignments = assignments.filter((a) => a.isTimeOff);
  const workAssignments = assignments.filter((a) => !a.isTimeOff);

  for (const timeOff of timeOffAssignments) {
    const resource = resourceMap.get(timeOff.resourceId);
    if (!resource) continue;

    const timeOffStart = new Date(timeOff.startDate);

    // Find work assignments ending within 3 days before time-off starts
    const nearbyDeadlines = workAssignments.filter((work) => {
      if (work.resourceId !== timeOff.resourceId) return false;
      
      const workEnd = new Date(work.endDate);
      const daysBeforeTimeOff = Math.ceil(
        (timeOffStart.getTime() - workEnd.getTime()) / (1000 * 60 * 60 * 24)
      );

      return daysBeforeTimeOff >= 0 && daysBeforeTimeOff <= 3;
    });

    for (const work of nearbyDeadlines) {
      const project = projectMap.get(work.projectId);
      const workEnd = new Date(work.endDate);
      const daysBeforeTimeOff = Math.ceil(
        (timeOffStart.getTime() - workEnd.getTime()) / (1000 * 60 * 60 * 24)
      );

      conflicts.push({
        id: generateConflictId(),
        type: "time_off_deadline",
        severity: daysBeforeTimeOff <= 1 ? "critical" : "warning",
        resourceId: resource.id,
        resourceName: resource.name,
        date: formatDate(work.endDate),
        description: `${resource.name}'s "${project?.name}" ends on ${formatDate(work.endDate)}, just ${daysBeforeTimeOff} day(s) before time-off starts on ${formatDate(timeOff.startDate)}`,
        affectedAssignments: [work.id, timeOff.id],
        suggestedResolution: daysBeforeTimeOff === 0 
          ? `Move deadline to ${formatDate(addDays(new Date(timeOff.endDate), 1))} (after time-off ends)`
          : `Consider completing work earlier or adjusting timeline`,
      });
    }
  }

  return conflicts;
}

// ============================================================================
// Helper Functions
// ============================================================================

function datesOverlap(a1: Assignment, a2: Assignment): boolean {
  const a1Start = new Date(a1.startDate);
  const a1End = new Date(a1.endDate);
  const a2Start = new Date(a2.startDate);
  const a2End = new Date(a2.endDate);

  return a1Start <= a2End && a2Start <= a1End;
}

function getOverlapDates(a1: Assignment, a2: Assignment): string[] {
  const start = new Date(Math.max(
    new Date(a1.startDate).getTime(),
    new Date(a2.startDate).getTime()
  ));
  const end = new Date(Math.min(
    new Date(a1.endDate).getTime(),
    new Date(a2.endDate).getTime()
  ));

  return getDateRange(
    start.toISOString().split("T")[0],
    end.toISOString().split("T")[0]
  );
}

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// ============================================================================
// Main Detection Function
// ============================================================================

/**
 * Detect all conflicts in the given data
 */
export function detectConflicts(
  input: AnalysisInput,
  capacityAnalysis: ResourceCapacityAnalysis[]
): Conflict[] {
  const allConflicts: Conflict[] = [];

  // Detect overallocation conflicts
  allConflicts.push(
    ...detectOverallocationConflicts(capacityAnalysis, input.resources)
  );

  // Detect time-off conflicts (resource unavailable)
  allConflicts.push(
    ...detectTimeOffConflicts(input.assignments, input.resources, input.projects)
  );

  // Detect deadline conflicts (near time-off)
  allConflicts.push(
    ...detectDeadlineConflicts(input.assignments, input.resources, input.projects)
  );

  // Detect billable target issues
  allConflicts.push(
    ...detectBillableTargetConflicts(capacityAnalysis)
  );

  // Sort by severity (critical first) then by date
  return allConflicts.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });
}
