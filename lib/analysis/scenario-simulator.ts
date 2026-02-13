/**
 * Scenario Simulator
 * Simulate changes and predict impact on capacity
 */

import { analyzeCapacity } from "./capacity-analyzer";
import { detectConflicts } from "./conflict-detector";
import { AnalysisResult, AnalysisInput, ResourceCapacityAnalysis, AnalysisAssignment } from "./types";

export type ScenarioChange = {
  type: "reassign" | "reschedule" | "add_assignment" | "remove_assignment";
  assignmentId?: string;
  changes: Partial<{
    resourceId: string;
    startDate: string;
    endDate: string;
    hoursPerDay: number;
    projectId: string;
  }>;
};

export type ScenarioResult = {
  beforeAnalysis: AnalysisResult;
  afterAnalysis: AnalysisResult;
  impactSummary: {
    utilizationChange: number; // Average change in team utilization
    conflictsAdded: number;
    conflictsResolved: number;
    resourcesImproved: string[]; // Resources that moved toward optimal
    resourcesWorsened: string[]; // Resources that moved away from optimal
  };
  recommendation: "proceed" | "caution" | "not_recommended";
  reasoning: string;
};

/**
 * Apply scenario changes to assignments
 */
function applyScenarioChanges(
  assignments: AnalysisAssignment[],
  changes: ScenarioChange[]
): AnalysisAssignment[] {
  let modifiedAssignments = [...assignments];

  for (const change of changes) {
    switch (change.type) {
      case "reassign":
        if (change.assignmentId && change.changes.resourceId) {
          modifiedAssignments = modifiedAssignments.map((a) =>
            a.id === change.assignmentId
              ? { ...a, resourceId: change.changes.resourceId! }
              : a
          );
        }
        break;

      case "reschedule":
        if (change.assignmentId && (change.changes.startDate || change.changes.endDate)) {
          modifiedAssignments = modifiedAssignments.map((a) =>
            a.id === change.assignmentId
              ? {
                  ...a,
                  startDate: change.changes.startDate
                    ? new Date(change.changes.startDate)
                    : a.startDate,
                  endDate: change.changes.endDate
                    ? new Date(change.changes.endDate)
                    : a.endDate,
                }
              : a
          );
        }
        break;

      case "remove_assignment":
        if (change.assignmentId) {
          modifiedAssignments = modifiedAssignments.filter(
            (a) => a.id !== change.assignmentId
          );
        }
        break;

      case "add_assignment":
        // For add, the changes should contain a full assignment
        // This is a simplified version
        break;
    }
  }

  return modifiedAssignments;
}

/**
 * Calculate average team utilization from capacity analysis
 */
function calculateAverageUtilization(analysis: ResourceCapacityAnalysis[]): number {
  if (analysis.length === 0) return 0;
  return analysis.reduce((sum, r) => sum + r.averageUtilization, 0) / analysis.length;
}

/**
 * Determine resource trend: improved if moving toward 70-85%, worsened if moving away
 */
function determineResourceTrend(
  before: ResourceCapacityAnalysis,
  after: ResourceCapacityAnalysis
): "improved" | "worsened" | "unchanged" {
  const OPTIMAL_MID = 77.5;
  
  const beforeDistance = Math.abs(before.averageUtilization - OPTIMAL_MID);
  const afterDistance = Math.abs(after.averageUtilization - OPTIMAL_MID);

  if (afterDistance < beforeDistance - 5) return "improved";
  if (afterDistance > beforeDistance + 5) return "worsened";
  return "unchanged";
}

/**
 * Run scenario simulation
 */
export function simulateScenario(
  currentInput: AnalysisInput,
  changes: ScenarioChange[]
): ScenarioResult {
  // Run analysis on current state
  const beforeCapacity = analyzeCapacity(currentInput);
  const beforeConflicts = detectConflicts(currentInput, beforeCapacity);
  const beforeAnalysis: AnalysisResult = {
    timestamp: Date.now(),
    capacityAnalysis: beforeCapacity,
    conflicts: beforeConflicts,
    summary: {
      totalResources: currentInput.resources.length,
      overallocatedCount: beforeCapacity.filter((r) => r.status === "overallocated").length,
      underutilizedCount: beforeCapacity.filter((r) => r.status === "underutilized").length,
      optimalCount: beforeCapacity.filter((r) => r.status === "optimal").length,
      conflictCount: beforeConflicts.length,
      criticalConflicts: beforeConflicts.filter((c) => c.severity === "critical").length,
    },
  };

  // Apply changes and run analysis on new state
  const modifiedAssignments = applyScenarioChanges(
    currentInput.assignments,
    changes
  );
  const afterInput: AnalysisInput = {
    ...currentInput,
    assignments: modifiedAssignments,
  };

  const afterCapacity = analyzeCapacity(afterInput);
  const afterConflicts = detectConflicts(afterInput, afterCapacity);
  const afterAnalysis: AnalysisResult = {
    timestamp: Date.now(),
    capacityAnalysis: afterCapacity,
    conflicts: afterConflicts,
    summary: {
      totalResources: afterInput.resources.length,
      overallocatedCount: afterCapacity.filter((r) => r.status === "overallocated").length,
      underutilizedCount: afterCapacity.filter((r) => r.status === "underutilized").length,
      optimalCount: afterCapacity.filter((r) => r.status === "optimal").length,
      conflictCount: afterConflicts.length,
      criticalConflicts: afterConflicts.filter((c) => c.severity === "critical").length,
    },
  };

  // Calculate impact
  const beforeAvgUtil = calculateAverageUtilization(beforeCapacity);
  const afterAvgUtil = calculateAverageUtilization(afterCapacity);
  const utilizationChange = afterAvgUtil - beforeAvgUtil;

  // Compare conflicts using stable keys (deterministic IDs ensure correct delta computation)
  const conflictKey = (c: { type: string; resourceId: string; date: string; affectedAssignments: string[] }) => {
    const sorted = [...c.affectedAssignments].sort().join(",");
    return `${c.type}-${c.resourceId}-${c.date}-${sorted}`;
  };
  const beforeConflictKeys = new Set(beforeConflicts.map(conflictKey));
  const afterConflictKeys = new Set(afterConflicts.map(conflictKey));
  const conflictsAdded = afterConflicts.filter((c) => !beforeConflictKeys.has(conflictKey(c))).length;
  const conflictsResolved = beforeConflicts.filter((c) => !afterConflictKeys.has(conflictKey(c))).length;

  const resourcesImproved: string[] = [];
  const resourcesWorsened: string[] = [];

  for (const after of afterCapacity) {
    const before = beforeCapacity.find((r) => r.resourceId === after.resourceId);
    if (!before) continue;

    const trend = determineResourceTrend(before, after);
    if (trend === "improved") {
      resourcesImproved.push(after.resourceName);
    } else if (trend === "worsened") {
      resourcesWorsened.push(after.resourceName);
    }
  }

  // Determine recommendation
  let recommendation: "proceed" | "caution" | "not_recommended";
  let reasoning: string;

  const criticalIncrease =
    afterAnalysis.summary.criticalConflicts - beforeAnalysis.summary.criticalConflicts;

  if (criticalIncrease > 0) {
    recommendation = "not_recommended";
    reasoning = `This change introduces ${criticalIncrease} critical conflict(s).`;
  } else if (resourcesWorsened.length > resourcesImproved.length) {
    recommendation = "caution";
    reasoning = `More resources are negatively impacted (${resourcesWorsened.length}) than improved (${resourcesImproved.length}).`;
  } else if (conflictsAdded > conflictsResolved) {
    recommendation = "caution";
    reasoning = `This change adds ${conflictsAdded} conflicts while only resolving ${conflictsResolved}.`;
  } else if (resourcesImproved.length > 0 || conflictsResolved > 0) {
    recommendation = "proceed";
    reasoning = `This change improves capacity for ${resourcesImproved.length} resource(s) and resolves ${conflictsResolved} conflict(s).`;
  } else {
    recommendation = "proceed";
    reasoning = "This change has minimal impact on overall capacity.";
  }

  return {
    beforeAnalysis,
    afterAnalysis,
    impactSummary: {
      utilizationChange,
      conflictsAdded,
      conflictsResolved,
      resourcesImproved,
      resourcesWorsened,
    },
    recommendation,
    reasoning,
  };
}
