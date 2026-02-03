import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { queryKeys } from "../queryKeys";

// Types
export interface EmployeeBrandAssignment {
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

export type NewEmployee = {
  fullName: string;
  position: string;
  weeklyCapacity?: number;
  employmentStatus?: "active" | "inactive" | "contractor";
  visibility?: "active" | "archived";
  employeeNumber?: string | null;
  nickname?: string | null;
  email?: string | null;
  photo?: string | null;
  departmentId?: string | null;
  businessUnitId?: string | null;
  directSupervisorId?: string | null;
  workStartDate?: string | null;
  dateOfBirth?: string | null;
};

// API Functions
async function fetchEmployees(): Promise<Employee[]> {
  const response = await fetch("/api/employees");
  if (!response.ok) {
    throw new Error("Failed to fetch employees");
  }
  const data = await response.json();
  return data.data;
}

async function fetchEmployee(id: string): Promise<Employee> {
  const response = await fetch(`/api/employees/${id}`);
  if (!response.ok) {
    throw new Error("Failed to fetch employee");
  }
  const data = await response.json();
  return data.data;
}

async function createEmployee(employee: NewEmployee): Promise<Employee> {
  const response = await fetch("/api/employees", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(employee),
  });
  if (!response.ok) {
    throw new Error("Failed to create employee");
  }
  const data = await response.json();
  return data.data;
}

async function updateEmployee({ id, ...data }: Partial<Employee> & { id: string }): Promise<Employee> {
  const response = await fetch(`/api/employees/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error("Failed to update employee");
  }
  const result = await response.json();
  return result.data;
}

async function deleteEmployee(id: string): Promise<void> {
  const response = await fetch(`/api/employees/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to delete employee");
  }
}

// Hooks
export function useEmployees() {
  return useQuery({
    queryKey: queryKeys.employees,
    queryFn: fetchEmployees,
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

export function useInfiniteEmployees(search?: string) {
  return useInfiniteQuery({
    queryKey: [...queryKeys.employeesInfinite, search],
    queryFn: ({ pageParam }) => fetchEmployeesPaginated({ pageParam, search }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      return allPages.reduce((acc, page) => acc + page.data.length, 0);
    },
  });
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: queryKeys.employee(id),
    queryFn: () => fetchEmployee(id),
    enabled: !!id,
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees });
    },
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateEmployee,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees });
      queryClient.invalidateQueries({ queryKey: queryKeys.employee(data.id) });
    },
  });
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees });
    },
  });
}
