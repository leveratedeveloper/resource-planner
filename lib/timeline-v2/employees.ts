import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { Employee } from "@/lib/query/hooks/useEmployees";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import {
  getMatchingTimelineEmployeeIds,
  hasActiveTimelineScopeFilter,
} from "@/lib/timeline-v2/timeline-filters";

type EmployeePage = {
  data: Employee[];
};

type EmployeeNameRecord = {
  fullName?: string | null;
  full_name?: string | null;
};

type TimelineEmployeeFilters = {
  brandId: string | null;
  department: string | null;
  projectId: string | null;
  searchQuery?: string;
};

export type TimelineEmployeeFilterInput = {
  employees: Employee[];
  dateFilteredAssignments: Assignment[];
  visibleActualAssignments: ActualAssignment[];
  projectById: Map<string, ProjectOption>;
  selectedBrandProjectIds?: Set<string>;
  filters: TimelineEmployeeFilters;
};

export function getLoadedTimelineEmployees(pages?: EmployeePage[]): Employee[] {
  if (!pages?.length) {
    return [];
  }

  return pages.flatMap((page) => page.data);
}

export function sortTimelineEmployees(employees: Employee[]): Employee[] {
  return sortEmployeeRecordsByName(employees);
}

export function sortEmployeeRecordsByName<T extends EmployeeNameRecord>(employees: T[]): T[] {
  return [...employees].sort((a, b) => {
    const aName = a.fullName ?? a.full_name ?? "";
    const bName = b.fullName ?? b.full_name ?? "";
    return aName.localeCompare(bName, undefined, { sensitivity: "base" });
  });
}

function matchesSearch(employee: Employee, query: string): boolean {
  if (employee.fullName.toLowerCase().includes(query)) return true;
  if (employee.position?.toLowerCase().includes(query)) return true;
  if (employee.department?.name?.toLowerCase().includes(query)) return true;

  for (const assignment of employee.assignments ?? []) {
    if (assignment.project?.name?.toLowerCase().includes(query)) return true;
  }

  for (const brandAssignment of employee.employeeBrandAssignments ?? []) {
    if (brandAssignment.brand?.name?.toLowerCase().includes(query)) return true;
  }

  return false;
}

export function filterTimelineEmployees({
  employees,
  dateFilteredAssignments,
  visibleActualAssignments,
  projectById,
  selectedBrandProjectIds,
  filters,
}: TimelineEmployeeFilterInput): Employee[] {
  let filtered = employees;

  if (hasActiveTimelineScopeFilter(filters)) {
    const matchingEmployeeIds = getMatchingTimelineEmployeeIds({
      dateFilteredAssignments,
      visibleActualAssignments,
      projectById,
      selectedBrandProjectIds,
      filters: {
        brandId: filters.brandId,
        projectId: filters.projectId,
      },
    });

    filtered = filtered.filter((employee) => matchingEmployeeIds?.has(employee.id));
  }

  if (filters.department) {
    filtered = filtered.filter((employee) => employee.departmentId === filters.department);
  }

  const query = filters.searchQuery?.toLowerCase().trim();
  if (query) {
    filtered = filtered.filter((employee) => matchesSearch(employee, query));
  }

  return sortTimelineEmployees(filtered);
}

export function shouldUseCompleteEmployeeList({
  brandId,
  department,
  projectId,
  searchQuery,
}: {
  brandId: string | null;
  department: string | null;
  projectId?: string | null;
  searchQuery?: string;
}): boolean {
  return !!brandId || !!department || !!projectId || !!searchQuery?.trim();
}
