import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { Employee } from "@/lib/query/hooks/useEmployees";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import { filterTimelineEmployees } from "@/lib/timeline-v2/employees";
import type { TimelineFilters } from "@/lib/timeline-v2/types";

export type VisibleEmployeeIdsInput = {
  employees: Employee[];
  assignments: Assignment[];
  actualAssignments: ActualAssignment[];
  projectById: Map<string, ProjectOption>;
  selectedBrandProjectIds: Set<string>;
  filters: TimelineFilters;
};

export function getVisibleEmployeeIds({
  employees,
  assignments,
  actualAssignments,
  projectById,
  selectedBrandProjectIds,
  filters,
}: VisibleEmployeeIdsInput): string[] {
  return filterTimelineEmployees({
    employees,
    dateFilteredAssignments: assignments,
    visibleActualAssignments: actualAssignments,
    projectById,
    selectedBrandProjectIds,
    filters,
  }).map((employee) => employee.id);
}
