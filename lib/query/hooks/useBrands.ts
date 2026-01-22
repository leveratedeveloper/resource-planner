import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../queryKeys";

// Types
export interface EmployeeBrandAssignment {
  id: string;
  employeeId: string;
  brandId: string;
  isPrimary: boolean;
  startDate: string | null;
  endDate: string | null;
  employee?: {
    id: string;
    fullName: string;
    position: string;
  };
  brand?: {
    id: string;
    name: string;
    color: string;
  };
}

export interface Brand {
  id: string;
  businessUnitId: string | null;
  name: string;
  clientCode: string | null;
  color: string;
  logo: string | null;
  website: string | null;
  contactName: string | null;
  contactTitle: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  industryCategory: string | null;
  description: string | null;
  status: "active" | "inactive" | "prospect";
  createdAt: string;
  updatedAt: string;
  businessUnit?: {
    id: string;
    name: string;
    color: string;
  };
  employeeBrandAssignments?: EmployeeBrandAssignment[];
  projects?: {
    id: string;
    name: string;
    color: string;
    status: string;
  }[];
}

export type NewBrand = {
  name: string;
  color?: string;
  status?: "active" | "inactive" | "prospect";
  businessUnitId?: string | null;
  clientCode?: string | null;
  logo?: string | null;
  website?: string | null;
  contactName?: string | null;
  contactTitle?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  industryCategory?: string | null;
  description?: string | null;
};

// API Functions
async function fetchBrands(): Promise<Brand[]> {
  const response = await fetch("/api/brands");
  if (!response.ok) {
    throw new Error("Failed to fetch brands");
  }
  const data = await response.json();
  return data.data;
}

async function fetchBrand(id: string): Promise<Brand> {
  const response = await fetch(`/api/brands/${id}`);
  if (!response.ok) {
    throw new Error("Failed to fetch brand");
  }
  const data = await response.json();
  return data.data;
}

async function createBrand(brand: NewBrand): Promise<Brand> {
  const response = await fetch("/api/brands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(brand),
  });
  if (!response.ok) {
    throw new Error("Failed to create brand");
  }
  const data = await response.json();
  return data.data;
}

async function updateBrand({ id, ...data }: Partial<Brand> & { id: string }): Promise<Brand> {
  const response = await fetch(`/api/brands/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error("Failed to update brand");
  }
  const result = await response.json();
  return result.data;
}

async function deleteBrand(id: string): Promise<void> {
  const response = await fetch(`/api/brands/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to delete brand");
  }
}

async function assignEmployeeToBrand(data: {
  employeeId: string;
  brandId: string;
  isPrimary?: boolean;
  startDate?: string;
}): Promise<EmployeeBrandAssignment> {
  const response = await fetch(`/api/employees/${data.employeeId}/brands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      brandId: data.brandId,
      isPrimary: data.isPrimary ?? false,
      startDate: data.startDate,
    }),
  });
  if (!response.ok) {
    throw new Error("Failed to assign employee to brand");
  }
  const result = await response.json();
  return result.data;
}

async function unassignEmployeeFromBrand(data: { employeeId: string; brandId: string }): Promise<void> {
  const response = await fetch(`/api/employees/${data.employeeId}/brands?brandId=${data.brandId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to unassign employee from brand");
  }
}

// Hooks
export function useBrands() {
  return useQuery({
    queryKey: queryKeys.brands,
    queryFn: fetchBrands,
  });
}

export function useBrand(id: string) {
  return useQuery({
    queryKey: queryKeys.brand(id),
    queryFn: () => fetchBrand(id),
    enabled: !!id,
  });
}

export function useCreateBrand() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createBrand,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.brands });
    },
  });
}

export function useUpdateBrand() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateBrand,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.brands });
      queryClient.invalidateQueries({ queryKey: queryKeys.brand(data.id) });
    },
  });
}

export function useDeleteBrand() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteBrand,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.brands });
    },
  });
}

export function useAssignEmployeeToBrand() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: assignEmployeeToBrand,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.brands });
      queryClient.invalidateQueries({ queryKey: queryKeys.brand(variables.brandId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.employees });
      queryClient.invalidateQueries({ queryKey: queryKeys.employee(variables.employeeId) });
    },
  });
}

export function useUnassignEmployeeFromBrand() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: unassignEmployeeFromBrand,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.brands });
      queryClient.invalidateQueries({ queryKey: queryKeys.brand(variables.brandId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.employees });
      queryClient.invalidateQueries({ queryKey: queryKeys.employee(variables.employeeId) });
    },
  });
}
