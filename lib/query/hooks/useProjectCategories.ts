import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../queryKeys";

// Types
export interface ProjectCategory {
  id: string;
  name: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type NewProjectCategory = {
  name: string;
  description?: string | null;
  displayOrder?: number;
  isActive?: boolean;
};

// API Functions
async function fetchProjectCategories(): Promise<ProjectCategory[]> {
  const response = await fetch("/api/project-categories");
  if (!response.ok) {
    throw new Error("Failed to fetch project categories");
  }
  const data = await response.json();
  return data.data;
}

async function fetchProjectCategory(id: string): Promise<ProjectCategory> {
  const response = await fetch(`/api/project-categories/${id}`);
  if (!response.ok) {
    throw new Error("Failed to fetch project category");
  }
  const data = await response.json();
  return data.data;
}

async function createProjectCategory(category: NewProjectCategory): Promise<ProjectCategory> {
  const response = await fetch("/api/project-categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(category),
  });
  if (!response.ok) {
    throw new Error("Failed to create project category");
  }
  const data = await response.json();
  return data.data;
}

async function updateProjectCategory({ id, ...data }: Partial<ProjectCategory> & { id: string }): Promise<ProjectCategory> {
  const response = await fetch(`/api/project-categories/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error("Failed to update project category");
  }
  const result = await response.json();
  return result.data;
}

async function deleteProjectCategory(id: string): Promise<void> {
  const response = await fetch(`/api/project-categories/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to delete project category");
  }
}

// Hooks
export function useProjectCategories() {
  return useQuery({
    queryKey: queryKeys.projectCategories,
    queryFn: fetchProjectCategories,
  });
}

export function useProjectCategory(id: string) {
  return useQuery({
    queryKey: queryKeys.projectCategory(id),
    queryFn: () => fetchProjectCategory(id),
    enabled: !!id,
  });
}

export function useCreateProjectCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createProjectCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectCategories });
    },
  });
}

export function useUpdateProjectCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateProjectCategory,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectCategories });
      queryClient.invalidateQueries({ queryKey: queryKeys.projectCategory(data.id) });
    },
  });
}

export function useDeleteProjectCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteProjectCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectCategories });
    },
  });
}
