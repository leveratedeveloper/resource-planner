import { getMySqlApiClient } from "@/lib/mysql/api-client";
import type { SessionData } from "@/lib/auth/session";
import { sortEmployeeRecordsByName } from "@/lib/timeline/employees";
import type { MySqlApiResponse } from "@/lib/types/mysql";
import type { Employee } from "@/lib/query/hooks/useEmployees";
import {
  createEmployeeDirectoryCache,
  type EmployeeDirectoryPage,
  type EmployeeDirectorySlice,
} from "@/lib/employees/directory-cache";

const UPSTREAM_EMPLOYEE_PAGE_SIZE = 100;
const EMPLOYEE_DIRECTORY_CACHE_TTL = 60 * 1000;

type TimetrackEmployeeRecord = {
  uuid?: string;
  nik?: string;
  full_name?: string;
  nickname?: string | null;
  photo?: string | null;
  position?: string;
  dept_id?: string | number;
  direct_supervisor?: string | number | null;
  work_start_date?: string | null;
  dob?: string | null;
  gender?: "MALE" | "FEMALE" | null;
  flag?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  department?: {
    id?: string | number;
    department_name?: string;
    color?: string;
  };
  supervisor?: {
    uuid?: string;
    full_name?: string;
    position?: string;
  };
};

export type OrderedEmployeeSlice = EmployeeDirectorySlice<Employee>;

const employeeDirectoryCache = createEmployeeDirectoryCache<TimetrackEmployeeRecord>({
  sortRecords: sortEmployeeRecordsByName,
  ttlMs: EMPLOYEE_DIRECTORY_CACHE_TTL,
});

function recordsFromResponse(response: MySqlApiResponse<unknown>): TimetrackEmployeeRecord[] {
  const data = response?.data as
    | TimetrackEmployeeRecord[]
    | { data?: TimetrackEmployeeRecord[] }
    | undefined;

  if (Array.isArray(data)) {
    return data;
  }

  return Array.isArray(data?.data) ? data.data : [];
}

function recordFromResponse(response: MySqlApiResponse<unknown>): TimetrackEmployeeRecord | undefined {
  const data = response.data as TimetrackEmployeeRecord | { data?: TimetrackEmployeeRecord } | undefined;

  if (!data) {
    return undefined;
  }

  if ("data" in data) {
    return data.data;
  }

  return data as TimetrackEmployeeRecord;
}

function pageFromResponse(
  response: MySqlApiResponse<unknown>,
  page: number
): EmployeeDirectoryPage<TimetrackEmployeeRecord> {
  const nestedData = response.data as {
    meta?: { current_page?: number; last_page?: number; total?: number };
  };
  const meta = nestedData?.meta || response.meta || {};
  const data = recordsFromResponse(response);

  return {
    data,
    meta: {
      currentPage: meta.current_page || page,
      lastPage: meta.last_page || 1,
      total: meta.total || data.length,
    },
  };
}

function randomColor(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index++) {
    hash = (hash * 31 + seed.charCodeAt(index)) & 0xffffff;
  }

  return `#${hash.toString(16).padStart(6, "0")}`;
}

function text(value: string | undefined, fallback = ""): string {
  return value ?? fallback;
}

function nullableText(value: string | null | undefined): string | null {
  return value ?? null;
}

function transformEmployee(employee: TimetrackEmployeeRecord): Employee {
  const departmentId = employee.department?.id ?? employee.dept_id;

  return {
    id: text(employee.uuid),
    employeeNumber: nullableText(employee.nik),
    fullName: text(employee.full_name),
    nickname: nullableText(employee.nickname),
    email: null,
    photo: nullableText(employee.photo),
    position: text(employee.position),
    departmentId: departmentId !== undefined ? String(departmentId) : null,
    businessUnitId: null,
    directSupervisorId: employee.direct_supervisor ? String(employee.direct_supervisor) : null,
    weeklyCapacity: 40,
    workStartDate: nullableText(employee.work_start_date),
    dateOfBirth: nullableText(employee.dob),
    employmentStatus: employee.flag === "active" ? "active" : "inactive",
    visibility: employee.status === "visible" ? "active" : "archived",
    gender: employee.gender ?? null,
    createdAt: text(employee.created_at),
    updatedAt: text(employee.updated_at),
    department: employee.department
      ? {
          id: String(employee.department.id ?? employee.dept_id ?? ""),
          name: text(employee.department.department_name),
          color: text(
            employee.department.color,
            randomColor(String(employee.department.id ?? employee.dept_id ?? "department"))
          ),
        }
      : undefined,
    businessUnit: undefined,
    supervisor: employee.supervisor
      ? {
          id: text(employee.supervisor.uuid),
          fullName: text(employee.supervisor.full_name),
          position: text(employee.supervisor.position),
        }
      : undefined,
  };
}

function employeeMatchesSession(employee: TimetrackEmployeeRecord, session: SessionData) {
  return (
    employee.uuid === session.employee.uuid ||
    employee.nik === session.employee.nik ||
    employee.full_name === session.employee.full_name
  );
}

async function fetchRestrictedEmployees(session: SessionData): Promise<TimetrackEmployeeRecord[]> {
  const client = getMySqlApiClient(async () => session.access_token);

  if (session.employee.uuid) {
    const employeeResponse = await client.getEmployee(session.employee.uuid);
    const employee = recordFromResponse(employeeResponse);

    if (!employeeResponse.error && employee && employeeMatchesSession(employee, session)) {
      return [employee];
    }
  }

  const search = session.employee.nik || session.employee.full_name;
  if (!search) {
    return [];
  }

  const searchResponse = await client.getEmployees({
    page: 1,
    per_page: UPSTREAM_EMPLOYEE_PAGE_SIZE,
    search,
  });

  if (searchResponse.error) {
    return [];
  }

  const match = recordsFromResponse(searchResponse).find((employee) =>
    employeeMatchesSession(employee, session)
  );

  return match ? [match] : [];
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
  if (!session.access.can_view_all) {
    const restrictedEmployees = await fetchRestrictedEmployees(session);
    const data = restrictedEmployees.map(transformEmployee);

    return {
      data,
      total: data.length,
      hasMore: false,
      cacheStatus: "miss",
    };
  }

  const client = getMySqlApiClient(async () => session.access_token);
  const loadEmployeePage = async (page: number) => {
    const response = await client.getEmployees({
      page,
      per_page: UPSTREAM_EMPLOYEE_PAGE_SIZE,
      search,
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    return pageFromResponse(response, page);
  };
  const directorySlice = await (search?.trim()
    ? employeeDirectoryCache.getUncachedSlice
    : employeeDirectoryCache.getSlice)(
    search?.trim() ? "search" : "all",
    { offset, limit },
    loadEmployeePage
  );

  return {
    ...directorySlice,
    data: directorySlice.data.map(transformEmployee),
  };
}
