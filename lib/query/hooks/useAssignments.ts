import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../queryKeys";

// Types
export interface Assignment {
  id: string;
  employeeId: string;
  projectId: string | null;
  taskId: string | null;
  startDate: string;
  endDate: string;
  hoursPerDay: string;
  allocationPercentage: string | null;
  isTimeOff: boolean;
  timeOffTypeId: string | null;
  category: string | null;
  isBillable: boolean;
  status: "draft" | "confirmed" | "completed";
  note: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: {
    id: string;
    fullName: string;
    position: string;
    department?: {
      id: string;
      name: string;
      color: string;
    };
  };
  project?: {
    id: string;
    name: string;
    color: string;
    brand?: {
      id: string;
      name: string;
      color: string;
    };
  };
  createdBy?: {
    id: string;
    fullName: string;
  };
}

export type NewAssignment = Omit<
  Assignment,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "employee"
  | "project"
  | "createdBy"
>;

// API Functions
async function fetchAssignments(): Promise<Assignment[]> {
  const response = await fetch("/api/assignments");
  if (!response.ok) {
    throw new Error("Failed to fetch assignments");
  }
  const data = await response.json();
  return data.data;
}

async function fetchAssignment(id: string): Promise<Assignment> {
  const response = await fetch(`/api/assignments/${id}`);
  if (!response.ok) {
    throw new Error("Failed to fetch assignment");
  }
  const data = await response.json();
  return data.data;
}

async function fetchAssignmentsByEmployee(employeeId: string): Promise<Assignment[]> {
  const response = await fetch(`/api/assignments?employeeId=${employeeId}`);
  if (!response.ok) {
    throw new Error("Failed to fetch assignments by employee");
  }
  const data = await response.json();
  return data.data;
}

async function fetchAssignmentsByProject(projectId: string): Promise<Assignment[]> {
  const response = await fetch(`/api/assignments?projectId=${projectId}`);
  if (!response.ok) {
    throw new Error("Failed to fetch assignments by project");
  }
  const data = await response.json();
  return data.data;
}

async function createAssignment(assignment: NewAssignment): Promise<Assignment> {
  const response = await fetch("/api/assignments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(assignment),
  });
  if (!response.ok) {
    throw new Error("Failed to create assignment");
  }
  const data = await response.json();
  return data.data;
}

async function updateAssignment({ id, ...data }: Partial<Assignment> & { id: string }): Promise<Assignment> {
  const response = await fetch(`/api/assignments/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error("Failed to update assignment");
  }
  const result = await response.json();
  return result.data;
}

async function deleteAssignment(id: string): Promise<void> {
  const response = await fetch(`/api/assignments/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to delete assignment");
  }
}

// Hooks
export function useAssignments() {
  return useQuery({
    queryKey: queryKeys.assignments,
    queryFn: fetchAssignments,
  });
}

export function useAssignment(id: string) {
  return useQuery({
    queryKey: queryKeys.assignment(id),
    queryFn: () => fetchAssignment(id),
    enabled: !!id,
  });
}

export function useAssignmentsByEmployee(employeeId: string) {
  return useQuery({
    queryKey: queryKeys.assignmentsByEmployee(employeeId),
    queryFn: () => fetchAssignmentsByEmployee(employeeId),
    enabled: !!employeeId,
  });
}

export function useAssignmentsByProject(projectId: string) {
  return useQuery({
    queryKey: queryKeys.assignmentsByProject(projectId),
    queryFn: () => fetchAssignmentsByProject(projectId),
    enabled: !!projectId,
  });
}

export function useCreateAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAssignment,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assignments });
      queryClient.invalidateQueries({ queryKey: queryKeys.assignmentsByEmployee(data.employeeId) });
      if (data.projectId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.assignmentsByProject(data.projectId) });
      }
      // Also invalidate employees as their assignments change
      queryClient.invalidateQueries({ queryKey: queryKeys.employees });
    },
  });
}

export function useUpdateAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateAssignment,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assignments });
      queryClient.invalidateQueries({ queryKey: queryKeys.assignment(data.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.assignmentsByEmployee(data.employeeId) });
      if (data.projectId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.assignmentsByProject(data.projectId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.employees });
    },
  });
}

export function useDeleteAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAssignment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assignments });
      queryClient.invalidateQueries({ queryKey: queryKeys.employees });
    },
  });
}
