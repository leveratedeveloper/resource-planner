import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../queryKeys";

// Types
export interface Department {
  id: string;
  businessUnitId: string | null;
  name: string;
  code: string;
  color: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  businessUnit?: {
    id: string;
    name: string;
    color: string;
  };
}

export type NewDepartment = Omit<Department, "id" | "createdAt" | "updatedAt" | "businessUnit">;

// API Functions
async function fetchDepartments(): Promise<Department[]> {
  const allDepartments: Department[] = [];
  let offset = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(`/api/departments?limit=${limit}&offset=${offset}`);
    if (!response.ok) {
      throw new Error("Failed to fetch departments");
    }
    const data = await response.json();
    allDepartments.push(...(data.data || []));
    hasMore = data.hasMore;
    offset += limit;
  }

  return allDepartments;
}

async function fetchDepartment(id: string): Promise<Department> {
  const response = await fetch(`/api/departments/${id}`);
  if (!response.ok) {
    throw new Error("Failed to fetch department");
  }
  const data = await response.json();
  return data.data;
}

async function createDepartment(department: NewDepartment): Promise<Department> {
  const response = await fetch("/api/departments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(department),
  });
  if (!response.ok) {
    throw new Error("Failed to create department");
  }
  const data = await response.json();
  return data.data;
}

async function updateDepartment({ id, ...data }: Partial<Department> & { id: string }): Promise<Department> {
  const response = await fetch(`/api/departments/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error("Failed to update department");
  }
  const result = await response.json();
  return result.data;
}

async function deleteDepartment(id: string): Promise<void> {
  const response = await fetch(`/api/departments/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to delete department");
  }
}

// Hooks
export function useDepartments() {
  return useQuery({
    queryKey: queryKeys.departments,
    queryFn: fetchDepartments,
  });
}

export function useDepartment(id: string) {
  return useQuery({
    queryKey: queryKeys.department(id),
    queryFn: () => fetchDepartment(id),
    enabled: !!id,
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.departments });
    },
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateDepartment,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.departments });
      queryClient.invalidateQueries({ queryKey: queryKeys.department(data.id) });
    },
  });
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.departments });
    },
  });
}
