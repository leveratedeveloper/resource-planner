import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { Employee } from "@/lib/query/hooks/useEmployees";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import { filterTimelineEmployees } from "@/lib/timeline/employees";
import type { TimelineV2Filters } from "@/lib/timeline-v2/types";

export type VisibleEmployeeIdsInput = {
  employees: Employee[];
  assignments: Assignment[];
  actualAssignments: ActualAssignment[];
  projectById: Map<string, ProjectOption>;
  selectedBrandProjectIds: Set<string>;
  filters: TimelineV2Filters;
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
