/**
 * Workload Balancer
 * Scoring algorithm for reassignment candidates
 * Pure function - can run in Web Worker
 */

import { Assignment, Resource, Project, Brand } from "@/types";
import { ResourceCapacityAnalysis, ReassignmentSuggestion } from "./types";

type ScoringFactors = {
  utilizationBalance: number; // Weight: 40%
  skillMatch: number; // Weight: 25%
  billableOptimization: number; // Weight: 20%
  projectContinuity: number; // Weight: 15%
};

const WEIGHTS: ScoringFactors = {
  utilizationBalance: 0.4,
  skillMatch: 0.25,
  billableOptimization: 0.2,
  projectContinuity: 0.15,
};

const OPTIMAL_UTILIZATION_MIN = 70;
const OPTIMAL_UTILIZATION_MAX = 85;

/**
 * Calculate how much a reassignment improves utilization balance
 */
function calculateUtilizationScore(
  fromUtilBefore: number,
  fromUtilAfter: number,
  toUtilBefore: number,
  toUtilAfter: number
): number {
  // Score improvement: moving both closer to optimal range
  const fromImprovement = Math.abs(fromUtilBefore - 77.5) - Math.abs(fromUtilAfter - 77.5);
  const toChange = Math.abs(toUtilAfter - 77.5) - Math.abs(toUtilBefore - 77.5);
  
  // Penalize if destination becomes overallocated
  if (toUtilAfter > 100) {
    return Math.max(0, (fromImprovement - toChange * 2) / 100);
  }
  
  // Reward if both move toward optimal
  if (fromUtilAfter >= OPTIMAL_UTILIZATION_MIN && fromUtilAfter <= OPTIMAL_UTILIZATION_MAX) {
    return Math.min(1, (fromImprovement + (100 - toUtilAfter) / 100) / 100);
  }
  
  return Math.max(0, Math.min(1, (fromImprovement - toChange) / 100 + 0.5));
}

/**
 * Calculate skill match score based on role and department
 */
function calculateSkillMatchScore(
  fromResource: Resource,
  toResource: Resource
): number {
  let score = 0;
  
  // Same role = best match
  if (fromResource.role === toResource.role) {
    score += 0.6;
  }
  
  // Same department = good match
  if (fromResource.department === toResource.department) {
    score += 0.4;
  }
  
  return score;
}

/**
 * Calculate billable optimization score
 */
function calculateBillableScore(
  assignment: Assignment,
  toResourceBillablePercent: number
): number {
  // Billable assignment to resource with low billable = good
  if (assignment.isBillable && toResourceBillablePercent < 80) {
    return 0.8;
  }
  
  // Non-billable assignment = neutral
  if (!assignment.isBillable) {
    return 0.5;
  }
  
  return 0.3;
}

/**
 * Calculate project continuity score
 */
function calculateContinuityScore(
  assignment: Assignment,
  toResource: Resource,
  toResourceAssignments: Assignment[],
  projects: Project[]
): number {
  const project = projects.find((p) => p.id === assignment.projectId);
  if (!project) return 0;
  
  // Check if toResource already works on this project
  const alreadyOnProject = toResourceAssignments.some(
    (a) => a.projectId === assignment.projectId
  );
  if (alreadyOnProject) return 1;
  
  // Check if toResource works on same brand
  const sameProjectBrandAssignments = toResourceAssignments.filter((a) => {
    const p = projects.find((proj) => proj.id === a.projectId);
    return p?.brandId === project.brandId;
  });
  if (sameProjectBrandAssignments.length > 0) return 0.7;
  
  return 0.3;
}

/**
 * Generate reassignment suggestions for overallocated resources
 */
export function generateReassignmentSuggestions(
  capacityAnalysis: ResourceCapacityAnalysis[],
  assignments: Assignment[],
  resources: Resource[],
  projects: Project[],
  brands: Brand[],
  maxSuggestions: number = 5
): ReassignmentSuggestion[] {
  const suggestions: ReassignmentSuggestion[] = [];
  
  // Get overallocated and underutilized resources
  const overallocated = capacityAnalysis.filter((r) => r.status === "overallocated");
  const candidates = capacityAnalysis.filter(
    (r) => r.status === "underutilized" || r.averageUtilization < 90
  );
  
  if (overallocated.length === 0 || candidates.length === 0) {
    return [];
  }
  
  for (const overResource of overallocated) {
    // Get assignments for this resource
    const resourceAssignments = assignments.filter(
      (a) => a.resourceId === overResource.resourceId && !a.isTimeOff
    );
    
    const fromResourceData = resources.find((r) => r.id === overResource.resourceId);
    if (!fromResourceData) continue;
    
    for (const assignment of resourceAssignments) {
      // Calculate assignment's daily impact
      const assignmentDays = Math.ceil(
        (new Date(assignment.endDate).getTime() - new Date(assignment.startDate).getTime()) /
          (1000 * 60 * 60 * 24)
      ) + 1;
      
      for (const candidate of candidates) {
        if (candidate.resourceId === overResource.resourceId) continue;
        
        const toResourceData = resources.find((r) => r.id === candidate.resourceId);
        if (!toResourceData) continue;
        
        const toResourceAssignments = assignments.filter(
          (a) => a.resourceId === candidate.resourceId
        );
        
        // Calculate utilization changes
        const dailyHoursImpact = assignment.hoursPerDay;
        const dailyCapacity = fromResourceData.capacity / 5;
        
        const fromUtilAfter =
          overResource.averageUtilization -
          (dailyHoursImpact / dailyCapacity) * 100;
        const toUtilAfter =
          candidate.averageUtilization +
          (dailyHoursImpact / dailyCapacity) * 100;
        
        // Skip if this would overload the candidate
        if (toUtilAfter > 100) continue;
        
        // Calculate scores
        const utilizationScore = calculateUtilizationScore(
          overResource.averageUtilization,
          fromUtilAfter,
          candidate.averageUtilization,
          toUtilAfter
        );
        
        const skillScore = calculateSkillMatchScore(fromResourceData, toResourceData);
        
        const billableScore = calculateBillableScore(
          assignment,
          candidate.billablePercent
        );
        
        const continuityScore = calculateContinuityScore(
          assignment,
          toResourceData,
          toResourceAssignments,
          projects
        );
        
        // Calculate weighted score
        const totalScore = Math.round(
          (utilizationScore * WEIGHTS.utilizationBalance +
            skillScore * WEIGHTS.skillMatch +
            billableScore * WEIGHTS.billableOptimization +
            continuityScore * WEIGHTS.projectContinuity) *
            100
        );
        
        const project = projects.find((p) => p.id === assignment.projectId);
        
        suggestions.push({
          id: `suggestion-${assignment.id}-${candidate.resourceId}`,
          assignmentId: assignment.id,
          fromResourceId: overResource.resourceId,
          fromResourceName: overResource.resourceName,
          toResourceId: candidate.resourceId,
          toResourceName: candidate.resourceName,
          projectName: project?.name || "Unknown Project",
          hoursPerDay: assignment.hoursPerDay,
          dateRange: {
            start: new Date(assignment.startDate).toISOString().split("T")[0],
            end: new Date(assignment.endDate).toISOString().split("T")[0],
          },
          score: totalScore,
          reasoning: generateReasoning(
            fromResourceData,
            toResourceData,
            overResource.averageUtilization,
            fromUtilAfter,
            candidate.averageUtilization,
            toUtilAfter,
            skillScore,
            project?.name || "the project"
          ),
          impact: {
            fromUtilizationBefore: overResource.averageUtilization,
            fromUtilizationAfter: fromUtilAfter,
            toUtilizationBefore: candidate.averageUtilization,
            toUtilizationAfter: toUtilAfter,
          },
        });
      }
    }
  }
  
  // Sort by score and return top suggestions
  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSuggestions);
}

function generateReasoning(
  from: Resource,
  to: Resource,
  fromUtilBefore: number,
  fromUtilAfter: number,
  toUtilBefore: number,
  toUtilAfter: number,
  skillScore: number,
  projectName: string
): string {
  const parts: string[] = [];
  
  parts.push(
    `Moving this work from ${from.name} (${Math.round(fromUtilBefore)}% → ${Math.round(fromUtilAfter)}%) to ${to.name} (${Math.round(toUtilBefore)}% → ${Math.round(toUtilAfter)}%)`
  );
  
  if (from.role === to.role) {
    parts.push(`Both are ${from.role}s, ensuring skill compatibility`);
  } else if (from.department === to.department) {
    parts.push(`Both work in ${from.department}, enabling easy handoff`);
  }
  
  if (toUtilAfter >= OPTIMAL_UTILIZATION_MIN && toUtilAfter <= OPTIMAL_UTILIZATION_MAX) {
    parts.push(`This brings ${to.name} into optimal capacity range`);
  }
  
  return parts.join(". ") + ".";
}
