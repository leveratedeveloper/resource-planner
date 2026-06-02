import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";

export type TimelineScopeFilters = {
  brandId: string | null;
  projectId: string | null;
};

type TimelineScopeFilterInput = {
  dateFilteredAssignments: Assignment[];
  visibleActualAssignments: ActualAssignment[];
  projectById: Map<string, ProjectOption>;
  selectedBrandProjectIds?: Set<string>;
  filters: TimelineScopeFilters;
};

export function hasActiveTimelineScopeFilter(filters: TimelineScopeFilters): boolean {
  return !!filters.brandId || !!filters.projectId;
}

function addEmployeesForProjectIds({
  employeeIds,
  projectIds,
  dateFilteredAssignments,
  visibleActualAssignments,
}: {
  employeeIds: Set<string>;
  projectIds: Set<string>;
  dateFilteredAssignments: Assignment[];
  visibleActualAssignments: ActualAssignment[];
}) {
  for (const assignment of dateFilteredAssignments) {
    if (assignment.isTimeOff || !assignment.projectId) continue;
    if (projectIds.has(assignment.projectId)) employeeIds.add(assignment.employeeId);
  }

  for (const assignment of visibleActualAssignments) {
    if (assignment.isTimeOff || !assignment.projectUuid) continue;
    if (projectIds.has(assignment.projectUuid)) employeeIds.add(assignment.employeeUuid);
  }
}

function getProjectEmployeeIds({
  projectId,
  dateFilteredAssignments,
  visibleActualAssignments,
}: {
  projectId: string;
  dateFilteredAssignments: Assignment[];
  visibleActualAssignments: ActualAssignment[];
}): Set<string> {
  const employeeIds = new Set<string>();

  addEmployeesForProjectIds({
    employeeIds,
    projectIds: new Set([projectId]),
    dateFilteredAssignments,
    visibleActualAssignments,
  });

  return employeeIds;
}

function assignmentMatchesBrand({
  projectId,
  brandId,
  projectById,
  selectedBrandProjectIds,
  assignmentProjectBrandId,
}: {
  projectId: string;
  brandId: string;
  projectById: Map<string, ProjectOption>;
  selectedBrandProjectIds?: Set<string>;
  assignmentProjectBrandId?: string | null;
}): boolean {
  return (
    assignmentProjectBrandId === brandId ||
    projectById.get(projectId)?.brandId === brandId ||
    !!selectedBrandProjectIds?.has(projectId)
  );
}

function getBrandEmployeeIds({
  brandId,
  dateFilteredAssignments,
  visibleActualAssignments,
  projectById,
  selectedBrandProjectIds,
}: {
  brandId: string;
  dateFilteredAssignments: Assignment[];
  visibleActualAssignments: ActualAssignment[];
  projectById: Map<string, ProjectOption>;
  selectedBrandProjectIds?: Set<string>;
}): Set<string> {
  const employeeIds = new Set<string>();

  for (const assignment of dateFilteredAssignments) {
    if (assignment.isTimeOff || !assignment.projectId) continue;

    if (
      assignmentMatchesBrand({
        projectId: assignment.projectId,
        brandId,
        projectById,
        selectedBrandProjectIds,
        assignmentProjectBrandId: assignment.project?.brand?.id,
      })
    ) {
      employeeIds.add(assignment.employeeId);
    }
  }

  for (const assignment of visibleActualAssignments) {
    if (assignment.isTimeOff || !assignment.projectUuid) continue;

    if (
      assignmentMatchesBrand({
        projectId: assignment.projectUuid,
        brandId,
        projectById,
        selectedBrandProjectIds,
      })
    ) {
      employeeIds.add(assignment.employeeUuid);
    }
  }

  return employeeIds;
}

function intersectEmployeeIds(left: Set<string>, right: Set<string>): Set<string> {
  const result = new Set<string>();

  for (const employeeId of left) {
    if (right.has(employeeId)) result.add(employeeId);
  }

  return result;
}

export function getMatchingTimelineEmployeeIds({
  dateFilteredAssignments,
  visibleActualAssignments,
  projectById,
  selectedBrandProjectIds,
  filters,
}: TimelineScopeFilterInput): Set<string> | null {
  const activeMatches: Set<string>[] = [];

  if (filters.brandId) {
    activeMatches.push(
      getBrandEmployeeIds({
        brandId: filters.brandId,
        dateFilteredAssignments,
        visibleActualAssignments,
        projectById,
        selectedBrandProjectIds,
      })
    );
  }

  if (filters.projectId) {
    activeMatches.push(
      getProjectEmployeeIds({
        projectId: filters.projectId,
        dateFilteredAssignments,
        visibleActualAssignments,
      })
    );
  }

  if (activeMatches.length === 0) {
    return null;
  }

  return activeMatches.slice(1).reduce(intersectEmployeeIds, activeMatches[0]);
}
