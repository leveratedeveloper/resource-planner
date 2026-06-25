import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { Employee } from "@/lib/query/hooks/useEmployees";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import { filterTimelineEmployees } from "@/lib/timeline-v2/employees";
import type { TimelineFilters } from "@/lib/timeline-v2/types";

export type VisibleEmployeeIdsInput = {
  employees: Employee[];
  assignments: Assignment[];
  projectByKey: Map<string, ProjectOption>;
  selectedBrandProjectKeys: Set<string>;
  filters: TimelineFilters;
};

export function getVisibleEmployeeIds({
  employees,
  assignments,
  projectByKey,
  selectedBrandProjectKeys,
  filters,
}: VisibleEmployeeIdsInput): string[] {
  return filterTimelineEmployees({
    employees,
    dateFilteredAssignments: assignments,
    projectByKey,
    selectedBrandProjectKeys,
    filters,
  }).map((employee) => employee.id);
}
