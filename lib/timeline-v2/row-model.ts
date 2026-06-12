import { endOfMonth, format, startOfMonth } from "date-fns";
import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { Brand } from "@/lib/query/hooks/useBrands";
import type { Employee } from "@/lib/query/hooks/useEmployees";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import {
  isProjectHighlighted,
  sortResourceProjects,
} from "@/lib/timeline/resource-project-model";
import { buildAllocationDayMaps } from "@/lib/timeline-v2/allocation-day-map";
import {
  getAllocationCellModel,
  getTimelineV2AllocationModel,
} from "@/lib/timeline-v2/allocation-model";
import { buildTimelineV2PlanDisplaySegments } from "@/lib/timeline-v2/plan-display-segments";
import type {
  TimelineV2AllocationCell,
  TimelineV2CampaignGroup,
  TimelineV2Filters,
  TimelineV2Resource,
  TimelineV2ResourceRow,
  TimelineV2ViewMode,
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

function getPlanCampaignProjects(
  assignments: Assignment[],
  projectById: Map<string, ProjectOption>
): ProjectOption[] {
  const seenProjectIds = new Set<string>();
  const campaignProjects: ProjectOption[] = [];

  for (const assignment of assignments) {
    if (assignment.isTimeOff || !assignment.projectId) continue;
    if (seenProjectIds.has(assignment.projectId)) continue;

    const project = projectById.get(assignment.projectId);
    if (!project) continue;

    seenProjectIds.add(project.id);
    campaignProjects.push(project);
  }

  return campaignProjects;
}

function isTimelineV2MonthRangeView(viewMode: TimelineV2ViewMode) {
  return viewMode === "quarter" || viewMode === "halfYear" || viewMode === "year";
}

function isTimelineV2WeekView(viewMode: TimelineV2ViewMode) {
  return viewMode === "week";
}

export function buildTimelineV2AllocationCells({
  resource,
  assignments,
  actualAssignments,
  days,
  viewMode,
}: {
  resource: TimelineV2Resource;
  assignments: Assignment[];
  actualAssignments: ActualAssignment[];
  days: Date[];
  viewMode: TimelineV2ViewMode;
}): TimelineV2AllocationCell[] {
  const isWeekView = isTimelineV2WeekView(viewMode);
  const isMonthRangeView = isTimelineV2MonthRangeView(viewMode);

  return days.map((day) => {
    const date = format(day, "yyyy-MM-dd");

    return {
      id: `${resource.id}-${date}`,
      employeeId: resource.id,
      date,
      model: getTimelineV2AllocationModel({
        day,
        resource,
        assignments,
        actualAssignments,
        isWeekView,
        isMonthRangeView,
      }),
    };
  });
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
  viewMode,
}: {
  employees: Employee[];
  assignments: Assignment[];
  actualAssignments: ActualAssignment[];
  projects: ProjectOption[];
  brandById: Map<string, Brand>;
  expandedEmployeeIds: Set<string>;
  filters: TimelineV2Filters;
  days: Date[];
  viewMode: TimelineV2ViewMode;
}): TimelineV2ResourceRow[] {
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const assignmentsByEmployee = groupTimelineV2AssignmentsByEmployee(assignments);
  const actualsByEmployee = groupTimelineV2ActualAssignmentsByEmployee(actualAssignments);

  return employees.map((employee) => {
    const resourceAssignments = (assignmentsByEmployee.get(employee.id) ?? []).filter(
      (assignment) => !assignment.isTimeOff
    );
    const employeeActuals = actualsByEmployee.get(employee.id) ?? [];
    const resourceProjects = getPlanCampaignProjects(resourceAssignments, projectById);
    const resource: TimelineV2Resource = {
      id: employee.id,
      name: employee.fullName,
      role: employee.position,
      department: employee.department?.name || "",
      capacity: employee.weeklyCapacity,
      employee,
    };
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

    const campaignGroups: TimelineV2CampaignGroup[] = sortedProjects.flatMap((project) => {
      const brand = project.brandId ? brandById.get(project.brandId) : undefined;
      const planAssignments = resourceAssignments.filter(
        (assignment) => assignment.projectId === project.id && !assignment.isTimeOff
      );
      const planDisplaySegments = buildTimelineV2PlanDisplaySegments({
        assignments: planAssignments,
        visibleDates: days,
        resolution: isTimelineV2MonthRangeView(viewMode) ? "month" : "day",
        projectStartDate: project.startDate,
        projectEndDate: project.endDate,
      });

      if (planDisplaySegments.length === 0) return [];

      const isHighlighted = isProjectHighlighted(project, highlightFilters);

      return [
        {
          id: project.id,
          name: project.name,
          brandName: brand?.name,
          isHighlighted,
          row: {
            id: project.id,
            project,
            brand,
            planAssignments,
            planDisplaySegments,
            isHighlighted,
          },
        },
      ];
    });

    return {
      id: employee.id,
      resource,
      assignments: resourceAssignments,
      actualAssignments: employeeActuals,
      allocationCells: buildTimelineV2AllocationCells({
        resource,
        assignments: resourceAssignments,
        actualAssignments: employeeActuals,
        days,
        viewMode,
      }),
      campaignGroups,
      isExpanded: expandedEmployeeIds.has(employee.id),
    };
  });
}

// ---------------------------------------------------------------------------
// Rework row model: depends ONLY on data + days + viewMode. Filters, lane
// ordering, highlights, and expansion are derived elsewhere (visible-rows,
// lane-order, expansion-store) so changing them never rebuilds these models.
// ---------------------------------------------------------------------------

export type ProjectLaneModel = {
  projectId: string;
  project: ProjectOption;
  brand?: Brand;
  planAssignments: Assignment[];
  planDisplaySegments: ReturnType<typeof buildTimelineV2PlanDisplaySegments>;
};

export type EmployeeRowModel = {
  id: string;
  resource: TimelineV2Resource;
  assignments: Assignment[];
  allocationCells: TimelineV2AllocationCell[];
  projectLanes: ProjectLaneModel[];
};

export function buildEmployeeRowModels({
  employees,
  assignments,
  actualAssignments,
  projects,
  brandById,
  days,
  viewMode,
}: {
  employees: Employee[];
  assignments: Assignment[];
  actualAssignments: ActualAssignment[];
  projects: ProjectOption[];
  brandById: Map<string, Brand>;
  days: Date[];
  viewMode: TimelineV2ViewMode;
}): Map<string, EmployeeRowModel> {
  const models = new Map<string, EmployeeRowModel>();
  if (days.length === 0) return models;

  const isMonthRangeView = isTimelineV2MonthRangeView(viewMode);
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const assignmentsByEmployee = groupTimelineV2AssignmentsByEmployee(assignments);
  // Month-resolution cells aggregate full calendar months, so the day map must
  // cover the month bounds, not just the visible column dates.
  const dayMaps = buildAllocationDayMaps({
    assignments,
    actualAssignments,
    rangeStart: isMonthRangeView ? startOfMonth(days[0]) : days[0],
    rangeEnd: isMonthRangeView ? endOfMonth(days[days.length - 1]) : days[days.length - 1],
  });

  for (const employee of employees) {
    const resourceAssignments = (assignmentsByEmployee.get(employee.id) ?? []).filter(
      (assignment) => !assignment.isTimeOff
    );
    const resource: TimelineV2Resource = {
      id: employee.id,
      name: employee.fullName,
      role: employee.position,
      department: employee.department?.name || "",
      capacity: employee.weeklyCapacity,
      employee,
    };
    const dayMap = dayMaps.get(employee.id);

    const projectLanes: ProjectLaneModel[] = [];
    for (const project of getPlanCampaignProjects(resourceAssignments, projectById)) {
      const planAssignments = resourceAssignments.filter(
        (assignment) => assignment.projectId === project.id && !assignment.isTimeOff
      );
      const planDisplaySegments = buildTimelineV2PlanDisplaySegments({
        assignments: planAssignments,
        visibleDates: days,
        resolution: isMonthRangeView ? "month" : "day",
        projectStartDate: project.startDate,
        projectEndDate: project.endDate,
      });

      if (planDisplaySegments.length === 0) continue;

      projectLanes.push({
        projectId: project.id,
        project,
        brand: project.brandId ? brandById.get(project.brandId) : undefined,
        planAssignments,
        planDisplaySegments,
      });
    }

    models.set(employee.id, {
      id: employee.id,
      resource,
      assignments: resourceAssignments,
      allocationCells: days.map((day) => {
        const date = format(day, "yyyy-MM-dd");
        return {
          id: `${employee.id}-${date}`,
          employeeId: employee.id,
          date,
          model: getAllocationCellModel({
            dayMap,
            day,
            viewMode,
            capacity: resource.capacity,
          }),
        };
      }),
      projectLanes,
    });
  }

  return models;
}
