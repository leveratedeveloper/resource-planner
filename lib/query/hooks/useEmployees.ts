import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { queryKeys } from "../queryKeys";

// Types
interface EmployeeBrandAssignment {
  id: string;
  employeeId: string;
  brandId: string;
  isPrimary: boolean;
  startDate: string | null;
  endDate: string | null;
  brand?: {
    id: string;
    name: string;
    color: string;
  };
}

export interface Employee {
  id: string;
  employeeNumber: string | null;
  fullName: string;
  nickname: string | null;
  email: string | null;
  photo: string | null;
  position: string;
  departmentId: string | null;
  businessUnitId: string | null;
  directSupervisorId: string | null;
  weeklyCapacity: number;
  workStartDate: string | null;
  dateOfBirth: string | null;
  employmentStatus: "active" | "inactive" | "contractor";
  visibility: "active" | "archived";
  gender: "MALE" | "FEMALE" | null;
  createdAt: string;
  updatedAt: string;
  department?: {
    id: string;
    name: string;
    color: string;
  };
  businessUnit?: {
    id: string;
    name: string;
    color: string;
  };
  supervisor?: {
    id: string;
    fullName: string;
    position: string;
  };
  employeeBrandAssignments?: EmployeeBrandAssignment[];
  assignments?: {
    id: string;
    projectId: string | null;
    startDate: string;
    endDate: string;
    hoursPerDay: string;
    isTimeOff: boolean;
    project?: {
      id: string;
      name: string;
      color: string;
    };
  }[];
}

// API Functions
async function fetchEmployees(): Promise<Employee[]> {
  const allEmployees: Employee[] = [];
  let offset = 0;
  const limit = 100; // Fetch 100 at a time for efficiency
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(`/api/employees?limit=${limit}&offset=${offset}`);
    if (!response.ok) {
      throw new Error("Failed to fetch employees");
    }
    const data = await response.json();
    allEmployees.push(...data.data);
    hasMore = data.hasMore;
    offset += limit;
  }

  return allEmployees;
}

// Hooks
export function useEmployees(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.employees,
    queryFn: fetchEmployees,
    enabled: options?.enabled ?? true,
  });
}

const PAGE_SIZE = 12;

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  hasMore: boolean;
}

async function fetchEmployeesPaginated({ pageParam = 0, search }: { pageParam?: number; search?: string }): Promise<PaginatedResponse<Employee>> {
  const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
  const response = await fetch(`/api/employees?limit=${PAGE_SIZE}&offset=${pageParam}${searchParam}`);
  if (!response.ok) {
    throw new Error("Failed to fetch employees");
  }
  const result = await response.json();
  return {
    data: result.data,
    total: result.total,
    hasMore: result.hasMore,
  };
}

export function useInfiniteEmployees(search?: string, options?: { enabled?: boolean }) {
  return useInfiniteQuery({
    queryKey: [...queryKeys.employeesInfinite, search],
    queryFn: ({ pageParam }) => fetchEmployeesPaginated({ pageParam, search }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      return allPages.reduce((acc, page) => acc + page.data.length, 0);
    },
    enabled: options?.enabled ?? true,
  });
}
