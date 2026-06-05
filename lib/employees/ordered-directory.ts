import type { SessionData } from "@/lib/auth/session";
import type { Employee } from "@/lib/query/hooks/useEmployees";
import type { PlannerDirectoryDepartmentRow, PlannerDirectoryEmployeeRow } from "@/lib/planner-directory/types";
import { plannerDirectoryRepository } from "@/lib/planner-directory/repository";
import { sortEmployeeRecordsByName } from "@/lib/timeline/employees";
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

function matchesSearch(employee: Employee, query: string): boolean {
  const text = query.toLowerCase().trim();
  if (!text) return true;

  if (employee.fullName.toLowerCase().includes(text)) return true;
  if (employee.position?.toLowerCase().includes(text)) return true;
  if (employee.department?.name?.toLowerCase().includes(text)) return true;

  return false;
}

function paginate<T>(items: T[], offset: number, limit: number) {
  const data = items.slice(offset, offset + limit);
  return {
    data,
    total: items.length,
    hasMore: offset + limit < items.length,
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
  const [employees, departments] = await Promise.all([
    plannerDirectoryRepository.listEmployees(),
    plannerDirectoryRepository.listDepartments(),
  ]);
  const departmentsById = new Map(departments.map((department) => [department.departmentId, department]));

  if (!session.access.can_view_all) {
    const current = employees
      .filter((employee) => employee.employeeUuid === session.employee.uuid)
      .map((employee) => toEmployee(employee, departmentsById));

    return {
      data: current,
      total: current.length,
      hasMore: false,
      cacheStatus: "miss",
    };
  }

  const query = search?.trim().toLowerCase();
  const mapped = sortEmployeeRecordsByName(
    employees.map((employee) => toEmployee(employee, departmentsById)).filter((employee) => !query || matchesSearch(employee, query))
  );

  const pageSize = limit > 0 ? limit : PAGE_SIZE_FALLBACK;
  const sliced = paginate(mapped, Math.max(offset, 0), pageSize);

  return {
    data: sliced.data,
    total: sliced.total,
    hasMore: sliced.hasMore,
    cacheStatus: "miss",
  };
}
