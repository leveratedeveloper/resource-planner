import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";

export type TimelineScopeFilters = {
  brandIds: string[];
  projectIds: string[];
};

type TimelineScopeFilterInput = {
  dateFilteredAssignments: Assignment[];
  visibleActualAssignments: ActualAssignment[];
  projectById: Map<string, ProjectOption>;
  selectedBrandProjectIds?: Set<string>;
  filters: TimelineScopeFilters;
};

export function hasActiveTimelineScopeFilter(filters: TimelineScopeFilters): boolean {
  return filters.brandIds.length > 0 || filters.projectIds.length > 0;
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
  projectIds,
  dateFilteredAssignments,
  visibleActualAssignments,
}: {
  projectIds: string[];
  dateFilteredAssignments: Assignment[];
  visibleActualAssignments: ActualAssignment[];
}): Set<string> {
  const employeeIds = new Set<string>();

  addEmployeesForProjectIds({
    employeeIds,
    projectIds: new Set(projectIds),
    dateFilteredAssignments,
    visibleActualAssignments,
  });

  return employeeIds;
}

function assignmentMatchesBrand({
  projectId,
  brandIds,
  projectById,
  selectedBrandProjectIds,
  assignmentProjectBrandId,
}: {
  projectId: string;
  brandIds: string[];
  projectById: Map<string, ProjectOption>;
  selectedBrandProjectIds?: Set<string>;
  assignmentProjectBrandId?: string | null;
}): boolean {
  const projectBrandId = projectById.get(projectId)?.brandId;
  return (
    (assignmentProjectBrandId !== null &&
      assignmentProjectBrandId !== undefined &&
      brandIds.includes(assignmentProjectBrandId)) ||
    (projectBrandId != null && brandIds.includes(projectBrandId)) ||
    !!selectedBrandProjectIds?.has(projectId)
  );
}

function getBrandEmployeeIds({
  brandIds,
  dateFilteredAssignments,
  visibleActualAssignments,
  projectById,
  selectedBrandProjectIds,
}: {
  brandIds: string[];
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
        brandIds,
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
        brandIds,
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

  if (filters.brandIds.length > 0) {
    activeMatches.push(
      getBrandEmployeeIds({
        brandIds: filters.brandIds,
        dateFilteredAssignments,
        visibleActualAssignments,
        projectById,
        selectedBrandProjectIds,
      })
    );
  }

  if (filters.projectIds.length > 0) {
    activeMatches.push(
      getProjectEmployeeIds({
        projectIds: filters.projectIds,
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
