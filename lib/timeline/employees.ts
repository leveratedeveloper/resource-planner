import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { Brand } from "@/lib/query/hooks/useBrands";
import type { Employee } from "@/lib/query/hooks/useEmployees";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";

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
  brands: Brand[];
  allAssignments: Assignment[];
  dateFilteredAssignments: Assignment[];
  visibleActualAssignments: ActualAssignment[];
  projectById: Map<string, ProjectOption>;
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

function getBrandEmployeeIds({
  brandId,
  brands,
  allAssignments,
  projectById,
}: {
  brandId: string;
  brands: Brand[];
  allAssignments: Assignment[];
  projectById: Map<string, ProjectOption>;
}) {
  const brand = brands.find((item) => item.id === brandId);
  const memberIds = new Set(
    brand?.employeeBrandAssignments?.map((assignment) => assignment.employeeId) ?? []
  );
  const assignmentIds = new Set(
    allAssignments
      .filter((assignment) => {
        if (assignment.project?.brand?.id === brandId) return true;
        return assignment.projectId
          ? projectById.get(assignment.projectId)?.brandId === brandId
          : false;
      })
      .map((assignment) => assignment.employeeId)
  );

  return {
    memberIds,
    assignmentIds,
    hasEmployeeBrandData: memberIds.size > 0,
    hasAssignmentData: assignmentIds.size > 0,
  };
}

function getProjectEmployeeIds({
  projectId,
  dateFilteredAssignments,
  visibleActualAssignments,
}: {
  projectId: string;
  dateFilteredAssignments: Assignment[];
  visibleActualAssignments: ActualAssignment[];
}) {
  const employeeIds = new Set<string>();

  for (const assignment of dateFilteredAssignments) {
    if (assignment.projectId === projectId) {
      employeeIds.add(assignment.employeeId);
    }
  }

  for (const assignment of visibleActualAssignments) {
    if (assignment.projectUuid === projectId) {
      employeeIds.add(assignment.employeeUuid);
    }
  }

  return employeeIds;
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
  brands,
  allAssignments,
  dateFilteredAssignments,
  visibleActualAssignments,
  projectById,
  filters,
}: TimelineEmployeeFilterInput): Employee[] {
  let filtered = employees;

  if (filters.brandId) {
    const {
      memberIds,
      assignmentIds,
      hasEmployeeBrandData,
      hasAssignmentData,
    } = getBrandEmployeeIds({
      brandId: filters.brandId,
      brands,
      allAssignments,
      projectById,
    });

    filtered = filtered.filter((employee) => {
      if (hasEmployeeBrandData) {
        return memberIds.has(employee.id) || assignmentIds.has(employee.id);
      }

      if (hasAssignmentData) {
        return assignmentIds.has(employee.id);
      }

      return false;
    });
  }

  if (filters.department) {
    filtered = filtered.filter((employee) => employee.departmentId === filters.department);
  }

  if (filters.projectId) {
    const projectEmployeeIds = getProjectEmployeeIds({
      projectId: filters.projectId,
      dateFilteredAssignments,
      visibleActualAssignments,
    });

    filtered = filtered.filter((employee) => projectEmployeeIds.has(employee.id));
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
