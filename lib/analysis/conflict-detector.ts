/**
 * Conflict Detector
 * Pure functions for detecting scheduling conflicts and issues
 * Designed to run in Web Worker for performance
 */

import {
  Conflict,
  ConflictType,
  ResourceCapacityAnalysis,
  AnalysisInput,
} from "./types";
import { toLocalDateKey } from "./date-utils";

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a deterministic conflict ID from its key properties.
 * This ensures stable before/after comparison in scenario simulation.
 */
function generateConflictId(
  type: ConflictType,
  resourceId: string,
  date: string,
  affectedAssignments: string[]
): string {
  const sortedAssignments = [...affectedAssignments].sort().join(",");
  return `conflict-${type}-${resourceId}-${date}-${sortedAssignments}`;
}

// ============================================================================
// Conflict Detection Functions
// ============================================================================

/**
 * Detect overallocation conflicts (>100% on same day)
 */
export function detectOverallocationConflicts(
  capacityAnalysis: ResourceCapacityAnalysis[]
): Conflict[] {
  const conflicts: Conflict[] = [];

  for (const analysis of capacityAnalysis) {
    const overallocatedDays = analysis.dailyUtilization.filter(
      (d) => d.isOverallocated
    );

    for (const day of overallocatedDays) {
      const affectedAssignments = day.assignments;
      conflicts.push({
        id: generateConflictId("overallocation", analysis.resourceId, day.date, affectedAssignments),
        type: "overallocation",
        severity: day.utilizationPercent > 150 ? "critical" : "warning",
        resourceId: analysis.resourceId,
        resourceName: analysis.resourceName,
        date: day.date,
        description: `${analysis.resourceName} is at ${Math.round(day.utilizationPercent)}% capacity (${day.hoursAllocated}h allocated, ${day.hoursAvailable}h available)`,
        affectedAssignments,
        suggestedResolution: `Consider reassigning ${Math.round(day.hoursAllocated - day.hoursAvailable)}h to another team member`,
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
        id: generateConflictId("billable_target", analysis.resourceId, toLocalDateKey(new Date()), []),
        type: "billable_target",
        severity: "info",
        resourceId: analysis.resourceId,
        resourceName: analysis.resourceName,
        date: toLocalDateKey(new Date()),
        description: `${analysis.resourceName} is at ${Math.round(analysis.averageUtilization)}% utilization but only ${Math.round(analysis.billablePercent)}% billable`,
        affectedAssignments: [],
        suggestedResolution: `Review non-billable assignments and consider reallocating to billable projects`,
      });
    }
  }

  return conflicts;
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
    ...detectOverallocationConflicts(capacityAnalysis)
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
