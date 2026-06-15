import type { SessionData } from "@/lib/auth/session";
import type { Employee } from "@/lib/query/hooks/useEmployees";
import type { PlannerDirectoryDepartmentRow, PlannerDirectoryEmployeeRow } from "@/lib/planner-directory/types";
import { plannerDirectoryRepository } from "@/lib/planner-directory/repository";
import type { EmployeeDirectorySlice } from "@/lib/employees/directory-cache";

const PAGE_SIZE_FALLBACK = 50;

type DepartmentById = Map<string, PlannerDirectoryDepartmentRow>;

export type OrderedEmployeeSlice = EmployeeDirectorySlice<Employee>;

function randomColor(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) & 0xffffff;
  }

  return `#${hash.toString(16).padStart(6, "0")}`;
}

function toEmployee(
  employee: PlannerDirectoryEmployeeRow,
  departmentsById: DepartmentById
): Employee {
  const department = employee.departmentId ? departmentsById.get(employee.departmentId) : undefined;
  const departmentColor = department?.color ?? randomColor(employee.departmentId ?? "department");

  return {
    id: employee.employeeUuid,
    employeeNumber: employee.employeeNumber,
    fullName: employee.fullName,
    nickname: employee.nickname,
    email: employee.email,
    photo: employee.photo,
    position: employee.position ?? "",
    departmentId: employee.departmentId,
    businessUnitId: null,
    directSupervisorId: null,
    weeklyCapacity: employee.weeklyCapacity,
    workStartDate: employee.workStartDate,
    dateOfBirth: null,
    employmentStatus: employee.employmentStatus === "active" ? "active" : "inactive",
    visibility: employee.visibility === "active" ? "active" : "archived",
    gender: null,
    createdAt: employee.sourceUpdatedAt ?? employee.syncedAt,
    updatedAt: employee.sourceUpdatedAt ?? employee.syncedAt,
    department: department
      ? {
          id: department.departmentId,
          name: department.name,
          color: departmentColor,
        }
      : undefined,
    businessUnit: undefined,
    supervisor: undefined,
  };
}

export async function fetchOrderedEmployeeSlice(
  session: SessionData,
  {
    offset,
    limit,
    search,
  }: {
    offset: number;
    limit: number;
    search?: string;
  }
): Promise<OrderedEmployeeSlice> {
  const pageSize = limit > 0 ? limit : PAGE_SIZE_FALLBACK;
  const requestedOffset = Math.max(offset, 0);

  const [employeeSlice, departments] = await Promise.all([
    plannerDirectoryRepository.listEmployeesForBootstrap({
      offset: session.access.can_view_all ? requestedOffset : 0,
      limit: session.access.can_view_all ? pageSize : 1,
      search: session.access.can_view_all ? search?.trim() || undefined : undefined,
      employeeUuid: session.access.can_view_all ? undefined : session.employee.uuid,
    }),
    plannerDirectoryRepository.listDepartments(),
  ]);
  const departmentsById = new Map(departments.map((department) => [department.departmentId, department]));

  return {
    data: employeeSlice.data.map((employee) => toEmployee(employee, departmentsById)),
    total: employeeSlice.total,
    hasMore: employeeSlice.hasMore,
    cacheStatus: "miss",
  };
}
