import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { Employee } from "@/lib/query/hooks/useEmployees";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import { getVisibleEmployeeIds } from "@/lib/timeline-v2/visible-rows";

export type FilterPreviewDataset = {
  employees: Employee[];
  assignments: Assignment[];
  actualAssignments: ActualAssignment[];
  projectById: Map<string, ProjectOption>;
};

export type DraftScope = {
  brandIds: string[];
  projectIds: string[];
  departmentIds: string[];
};

export function countMatchingEmployees(dataset: FilterPreviewDataset, scope: DraftScope): number {
  // Derive selectedBrandProjectIds from the draft brand scope (empty brandIds = all brands pass).
  const selectedBrandProjectIds = new Set(
    [...dataset.projectById.values()]
      .filter(
        (project) =>
          scope.brandIds.length === 0 ||
          (project.brandId !== null && scope.brandIds.includes(project.brandId))
      )
      .map((project) => project.id)
  );

  return getVisibleEmployeeIds({
    employees: dataset.employees,
    assignments: dataset.assignments,
    actualAssignments: dataset.actualAssignments,
    projectById: dataset.projectById,
    selectedBrandProjectIds,
    // TimelineFilters uses `departments` (not `departmentIds`)
    filters: {
      brandIds: scope.brandIds,
      projectIds: scope.projectIds,
      departments: scope.departmentIds,
      searchQuery: "",
    },
  }).length;
}
