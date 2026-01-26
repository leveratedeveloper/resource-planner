import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../queryKeys";

// Types
export interface BusinessUnit {
  id: string;
  name: string;
  code: string;
  color: string;
  logo: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type NewBusinessUnit = Omit<BusinessUnit, "id" | "createdAt" | "updatedAt">;

// API Functions
async function fetchBusinessUnits(): Promise<BusinessUnit[]> {
  const response = await fetch("/api/business-units");
  if (!response.ok) {
    throw new Error("Failed to fetch business units");
  }
  const data = await response.json();
  return data.data;
}

async function fetchBusinessUnit(id: string): Promise<BusinessUnit> {
  const response = await fetch(`/api/business-units/${id}`);
  if (!response.ok) {
    throw new Error("Failed to fetch business unit");
  }
  const data = await response.json();
  return data.data;
}

async function createBusinessUnit(businessUnit: NewBusinessUnit): Promise<BusinessUnit> {
  const response = await fetch("/api/business-units", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(businessUnit),
  });
  if (!response.ok) {
    throw new Error("Failed to create business unit");
  }
  const data = await response.json();
  return data.data;
}

async function updateBusinessUnit({ id, ...data }: Partial<BusinessUnit> & { id: string }): Promise<BusinessUnit> {
  const response = await fetch(`/api/business-units/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error("Failed to update business unit");
  }
  const result = await response.json();
  return result.data;
}

async function deleteBusinessUnit(id: string): Promise<void> {
  const response = await fetch(`/api/business-units/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to delete business unit");
  }
}

// Hooks
export function useBusinessUnits() {
  return useQuery({
    queryKey: queryKeys.businessUnits,
    queryFn: fetchBusinessUnits,
  });
}

export function useBusinessUnit(id: string) {
  return useQuery({
    queryKey: queryKeys.businessUnit(id),
    queryFn: () => fetchBusinessUnit(id),
    enabled: !!id,
  });
}

export function useCreateBusinessUnit() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createBusinessUnit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.businessUnits });
    },
  });
}

export function useUpdateBusinessUnit() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateBusinessUnit,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.businessUnits });
      queryClient.invalidateQueries({ queryKey: queryKeys.businessUnit(data.id) });
    },
  });
}

export function useDeleteBusinessUnit() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteBusinessUnit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.businessUnits });
    },
  });
}
