import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { Brand } from "@/lib/query/hooks/useBrands";
import type { Employee } from "@/lib/query/hooks/useEmployees";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import { filterTimelineEmployees } from "@/lib/timeline/employees";
import {
  getResourceProjects,
  isProjectHighlighted,
  sortResourceProjects,
} from "@/lib/timeline/resource-project-model";
import type {
  TimelineV2CampaignGroup,
  TimelineV2Filters,
  TimelineV2ResourceRow,
} from "@/lib/timeline-v2/types";

export function groupTimelineV2AssignmentsByEmployee(assignments: Assignment[]) {
  const grouped = new Map<string, Assignment[]>();

  assignments.forEach((assignment) => {
    if (!grouped.has(assignment.employeeId)) grouped.set(assignment.employeeId, []);
    grouped.get(assignment.employeeId)!.push(assignment);
  });

  return grouped;
}

export function groupTimelineV2ActualAssignmentsByEmployee(actualAssignments: ActualAssignment[]) {
  const grouped = new Map<string, ActualAssignment[]>();

  actualAssignments.forEach((assignment) => {
    if (!assignment.employeeUuid) return;
    if (!grouped.has(assignment.employeeUuid)) grouped.set(assignment.employeeUuid, []);
    grouped.get(assignment.employeeUuid)!.push(assignment);
  });

  return grouped;
}

export function buildTimelineV2Rows({
  employees,
  assignments,
  actualAssignments,
  projects,
  brandById,
  expandedEmployeeIds,
  filters,
  days,
  selectedBrandProjectIds,
}: {
  employees: Employee[];
  assignments: Assignment[];
  actualAssignments: ActualAssignment[];
  projects: ProjectOption[];
  brandById: Map<string, Brand>;
  expandedEmployeeIds: Set<string>;
  filters: TimelineV2Filters;
  days: Date[];
  selectedBrandProjectIds?: Set<string>;
}): TimelineV2ResourceRow[] {
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const filteredEmployees = filterTimelineEmployees({
    employees,
    dateFilteredAssignments: assignments,
    visibleActualAssignments: actualAssignments,
    projectById,
    selectedBrandProjectIds,
    filters,
  });
  const assignmentsByEmployee = groupTimelineV2AssignmentsByEmployee(assignments);
  const actualsByEmployee = groupTimelineV2ActualAssignmentsByEmployee(actualAssignments);

  return filteredEmployees.map((employee) => {
    const resourceAssignments = assignmentsByEmployee.get(employee.id) ?? [];
    const employeeActuals = actualsByEmployee.get(employee.id) ?? [];
    const resourceProjects = getResourceProjects(resourceAssignments, employeeActuals, projects);
    const sortedProjects = sortResourceProjects({
      projects: resourceProjects,
      resourceAssignments,
      brandId: filters.brandId,
      selectedProjectId: filters.projectId,
      days,
    });
    const highlightFilters = {
      selectedBrandId: filters.brandId,
      selectedProjectId: filters.projectId,
    };

    const campaignGroups: TimelineV2CampaignGroup[] = sortedProjects.map((project) => {
      const brand = project.brandId ? brandById.get(project.brandId) : undefined;
      const planAssignments = resourceAssignments.filter(
        (assignment) => assignment.projectId === project.id && !assignment.isTimeOff
      );
      const matchingActualAssignments = employeeActuals.filter(
        (assignment) => assignment.projectUuid === project.id && !assignment.isTimeOff
      );
      const isHighlighted = isProjectHighlighted(project, highlightFilters);

      return {
        id: project.id,
        name: project.name,
        brandName: brand?.name,
        isHighlighted,
        row: {
          id: project.id,
          project,
          brand,
          planAssignments,
          actualAssignments: matchingActualAssignments,
          isHighlighted,
        },
      };
    });

    return {
      id: employee.id,
      resource: {
        id: employee.id,
        name: employee.fullName,
        role: employee.position,
        department: employee.department?.name || "",
        capacity: employee.weeklyCapacity,
        employee,
      },
      assignments: resourceAssignments,
      actualAssignments: employeeActuals,
      timeOffAssignments: resourceAssignments.filter((assignment) => assignment.isTimeOff),
      campaignGroups,
      isExpanded: expandedEmployeeIds.has(employee.id),
    };
  });
}
