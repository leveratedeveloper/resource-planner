import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../queryKeys";

// Types
export interface ProjectChannel {
  id: string;
  projectId: string;
  channelId: string;
  deliverableId: string | null;
  quantity: string | null;
  channelBudget: string | null;
  manHours: string | null;
  createdAt: string;
  updatedAt: string;
  channel?: {
    id: string;
    channelName: string;
  };
  deliverable?: {
    id: string;
    deliverableName: string;
  };
}

export interface Project {
  id: string;
  brandId: string;
  businessUnitId: string | null;
  projectCategoryId: string | null;
  projectTypeId: string | null;
  projectType: 'pitch' | 'campaign';
  entity: string | null;
  name: string;
  projectNumber: string | null;
  description: string | null;
  color: string;
  budget: string | null;
  asf: string | null;
  grandTotal: string | null;
  currency: string;
  ioFile: string | null;
  flag: string | null;
  quotationReference: string | null;
  startDate: string | null;
  endDate: string | null;
  status: "planning" | "active" | "on_hold" | "completed" | "cancelled";
  createdById: string | null;
  notes: string | null;
  // Pitch-specific fields (nullable)
  region: string | null;
  submitDate: string | null;
  pitchStatus: 'introduction' | 'waiting_for_brief' | 'proposal_development' | 'submit_or_presentation' | 'waiting_for_feedback' | 'negotiation' | 'won' | 'lost' | 'cancelled' | 'missing' | 'withdraw' | null;
  valueTotalEstimate: string | null;
  hsDealId: string | null;
  createdAt: string;
  updatedAt: string;
  brand?: {
    id: string;
    name: string;
    color: string;
  };
  businessUnit?: {
    id: string;
    name: string;
    color: string;
  };
  projectCategory?: {
    id: string;
    name: string;
  };
  createdBy?: {
    id: string;
    fullName: string;
  };
  assignments?: {
    id: string;
    employeeId: string;
    startDate: string;
    endDate: string;
    hoursPerDay: string;
    employee?: {
      id: string;
      fullName: string;
      position: string;
    };
  }[];
  projectChannels?: ProjectChannel[];
}

export type NewProject = {
  name: string;
  brandId: string;
  projectType?: 'pitch' | 'campaign';
  entity?: string | null;
  color?: string;
  status?: "planning" | "active" | "on_hold" | "completed" | "cancelled";
  businessUnitId?: string | null;
  projectCategoryId?: string | null;
  projectTypeId?: string | null;
  projectNumber?: string | null;
  description?: string | null;
  budget?: string | null;
  asf?: string | null;
  grandTotal?: string | null;
  currency?: string;
  ioFile?: string | null;
  flag?: string | null;
  quotationReference?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  createdById?: string | null;
  notes?: string | null;
  // Pitch-specific fields
  region?: string | null;
  submitDate?: string | null;
  pitchStatus?: 'introduction' | 'waiting_for_brief' | 'proposal_development' | 'submit_or_presentation' | 'waiting_for_feedback' | 'negotiation' | 'won' | 'lost' | 'cancelled' | 'missing' | 'withdraw' | null;
  valueTotalEstimate?: string | null;
  hsDealId?: string | null;
  // Project channels (for pitches and campaigns)
  projectChannels?: Array<{
    channelId: string;
    deliverableId: string | null;
    quantity?: string | null;
    channelBudget?: string | null;
    manHours?: string | null;
  }>;
};

// API Functions
async function fetchProjects(): Promise<Project[]> {
  const response = await fetch("/api/projects");
  if (!response.ok) {
    throw new Error("Failed to fetch projects");
  }
  const data = await response.json();
  return data.data;
}

async function fetchProject(id: string): Promise<Project> {
  const response = await fetch(`/api/projects/${id}`);
  if (!response.ok) {
    throw new Error("Failed to fetch project");
  }
  const data = await response.json();
  return data.data;
}

async function fetchProjectsByBrand(brandId: string): Promise<Project[]> {
  const response = await fetch(`/api/projects?brandId=${brandId}`);
  if (!response.ok) {
    throw new Error("Failed to fetch projects by brand");
  }
  const data = await response.json();
  return data.data;
}

async function createProject(project: NewProject): Promise<Project> {
  const response = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(project),
  });
  if (!response.ok) {
    throw new Error("Failed to create project");
  }
  const data = await response.json();
  return data.data;
}

async function updateProject({ id, ...data }: Partial<Project> & { id: string }): Promise<Project> {
  const response = await fetch(`/api/projects/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error("Failed to update project");
  }
  const result = await response.json();
  return result.data;
}

async function deleteProject(id: string): Promise<void> {
  const response = await fetch(`/api/projects/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to delete project");
  }
}

// Hooks
export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: fetchProjects,
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: queryKeys.project(id),
    queryFn: () => fetchProject(id),
    enabled: !!id,
  });
}

export function useProjectsByBrand(brandId: string) {
  return useQuery({
    queryKey: queryKeys.projectsByBrand(brandId),
    queryFn: () => fetchProjectsByBrand(brandId),
    enabled: !!brandId,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createProject,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      if (data.brandId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.projectsByBrand(data.brandId) });
      }
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateProject,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      queryClient.invalidateQueries({ queryKey: queryKeys.project(data.id) });
      if (data.brandId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.projectsByBrand(data.brandId) });
      }
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}
