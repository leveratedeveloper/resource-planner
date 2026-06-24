import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";

export type TimelineScopeFilters = {
  brandIds: string[];
  projectIds: string[];
};

type TimelineScopeFilterInput = {
  dateFilteredAssignments: Assignment[];
  projectByKey: Map<string, ProjectOption>;
  selectedBrandProjectKeys?: Set<string>;
  filters: TimelineScopeFilters;
};

export function hasActiveTimelineScopeFilter(filters: TimelineScopeFilters): boolean {
  return filters.brandIds.length > 0 || filters.projectIds.length > 0;
}

function addEmployeesForProjectKeys({
  employeeIds,
  projectKeys,
  dateFilteredAssignments,
}: {
  employeeIds: Set<string>;
  projectKeys: Set<string>;
  dateFilteredAssignments: Assignment[];
}) {
  for (const assignment of dateFilteredAssignments) {
    if (!assignment.projectKey) continue;
    if (projectKeys.has(assignment.projectKey)) employeeIds.add(assignment.employeeId);
  }
}

function getProjectEmployeeIds({
  projectIds,
  dateFilteredAssignments,
  projectByKey,
}: {
  projectIds: string[];
  dateFilteredAssignments: Assignment[];
  projectByKey: Map<string, ProjectOption>;
}): Set<string> {
  // projectIds here are project.id (UUID). Build a set of projectKeys for those ids.
  const projectKeySet = new Set<string>();
  for (const project of projectByKey.values()) {
    if (projectIds.includes(project.id)) projectKeySet.add(project.projectKey);
  }

  const employeeIds = new Set<string>();
  addEmployeesForProjectKeys({
    employeeIds,
    projectKeys: projectKeySet,
    dateFilteredAssignments,
  });

  return employeeIds;
}

function assignmentMatchesBrand({
  projectKey,
  brandIds,
  projectByKey,
  selectedBrandProjectKeys,
}: {
  projectKey: string;
  brandIds: string[];
  projectByKey: Map<string, ProjectOption>;
  selectedBrandProjectKeys?: Set<string>;
}): boolean {
  const projectBrandId = projectByKey.get(projectKey)?.brandId;
  return (
    (projectBrandId != null && brandIds.includes(projectBrandId)) ||
    !!selectedBrandProjectKeys?.has(projectKey)
  );
}

function getBrandEmployeeIds({
  brandIds,
  dateFilteredAssignments,
  projectByKey,
  selectedBrandProjectKeys,
}: {
  brandIds: string[];
  dateFilteredAssignments: Assignment[];
  projectByKey: Map<string, ProjectOption>;
  selectedBrandProjectKeys?: Set<string>;
}): Set<string> {
  const employeeIds = new Set<string>();

  for (const assignment of dateFilteredAssignments) {
    if (!assignment.projectKey) continue;

    if (
      assignmentMatchesBrand({
        projectKey: assignment.projectKey,
        brandIds,
        projectByKey,
        selectedBrandProjectKeys,
      })
    ) {
      employeeIds.add(assignment.employeeId);
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
  projectByKey,
  selectedBrandProjectKeys,
  filters,
}: TimelineScopeFilterInput): Set<string> | null {
  const activeMatches: Set<string>[] = [];

  if (filters.brandIds.length > 0) {
    activeMatches.push(
      getBrandEmployeeIds({
        brandIds: filters.brandIds,
        dateFilteredAssignments,
        projectByKey,
        selectedBrandProjectKeys,
      })
    );
  }

  if (filters.projectIds.length > 0) {
    activeMatches.push(
      getProjectEmployeeIds({
        projectIds: filters.projectIds,
        dateFilteredAssignments,
        projectByKey,
      })
    );
  }

  if (activeMatches.length === 0) {
    return null;
  }

  return activeMatches.slice(1).reduce(intersectEmployeeIds, activeMatches[0]);
}
