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
async function fetchAssignments(params?: { startDate?: string; endDate?: string; projectIds?: string[] }): Promise<Assignment[]> {
  const url = new URL("/api/assignments", window.location.origin);
  if (params?.startDate) url.searchParams.set("startDate", params.startDate);
  if (params?.endDate) url.searchParams.set("endDate", params.endDate);
  if (params?.projectIds) {
    params.projectIds.forEach(id => url.searchParams.append("projectIds", id));
  }

  const response = await fetch(url.toString());
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
    let errorMessage = "Failed to create assignment";
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch {
      // If parsing fails, use the default message
    }
    throw new Error(errorMessage);
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
export function useAssignments(params?: { startDate?: string; endDate?: string; projectIds?: string[] }) {
  return useQuery({
    queryKey: [...queryKeys.assignments, params],
    queryFn: () => fetchAssignments(params),
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

    // Optimistic update - add to cache immediately with temp ID
    onMutate: async (newAssignment) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.assignments });
      await queryClient.cancelQueries({ queryKey: queryKeys.employees });

      // Snapshot for rollback
      const previousAssignments = queryClient.getQueryData(queryKeys.assignments);
      const previousEmployees = queryClient.getQueryData(queryKeys.employees);

      // Create optimistic assignment with temp ID
      const optimisticAssignment: Assignment = {
        id: `temp-${Date.now()}`,
        employeeId: newAssignment.employeeId,
        projectId: newAssignment.projectId,
        taskId: newAssignment.taskId,
        startDate: newAssignment.startDate,
        endDate: newAssignment.endDate,
        hoursPerDay: newAssignment.hoursPerDay,
        allocationPercentage: newAssignment.allocationPercentage,
        isTimeOff: newAssignment.isTimeOff,
        timeOffTypeId: newAssignment.timeOffTypeId,
        category: newAssignment.category,
        isBillable: newAssignment.isBillable,
        status: newAssignment.status,
        note: newAssignment.note,
        createdById: newAssignment.createdById,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Add to assignments cache
      queryClient.setQueryData<Assignment[]>(queryKeys.assignments, (old) => {
        if (!old) return [optimisticAssignment];
        return [...old, optimisticAssignment];
      });

      return { previousAssignments, previousEmployees, optimisticId: optimisticAssignment.id };
    },

    // Rollback on error
    onError: (err, newAssignment, context) => {
      if (context?.previousAssignments) {
        queryClient.setQueryData(queryKeys.assignments, context.previousAssignments);
      }
      if (context?.previousEmployees) {
        queryClient.setQueryData(queryKeys.employees, context.previousEmployees);
      }
    },

    // Replace temp ID with real data (no refetch needed)
    onSuccess: (data, variables, context) => {
      // Replace the optimistic assignment with real server data
      queryClient.setQueryData<Assignment[]>(queryKeys.assignments, (old) => {
        if (!old) return [data];
        return old.map((a) => (a.id === context?.optimisticId ? data : a));
      });
    },

    // Invalidate related queries so brand-filtered views stay in sync
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.brands });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
    },
  });
}

export function useUpdateAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateAssignment,

    // Optimistic update before API call
    onMutate: async (variables) => {
      const { id, hoursPerDay, ...updates } = variables;

      console.log('[useUpdateAssignment] onMutate:', { id, updates });

      // Defensive check: skip optimistic update for invalid hours
      if (hoursPerDay !== undefined) {
        // Normalize comma to dot for parseFloat (supports both "0.5" and "0,5" formats)
        const normalized = String(hoursPerDay).replace(',', '.');
        const parsed = parseFloat(normalized);
        if (isNaN(parsed) || parsed < 0.5 || parsed > 24) {
          // Return safe context for rollback handlers (don't return null!)
          // Skip optimistic update - let API handle validation error
          return {
            previousAssignments: queryClient.getQueryData(queryKeys.assignments),
            previousEmployees: queryClient.getQueryData(queryKeys.employees),
            skipOptimistic: true,
          };
        }
      }

      // Cancel outgoing refetches to prevent overwriting
      await queryClient.cancelQueries({ queryKey: queryKeys.assignments });
      await queryClient.cancelQueries({ queryKey: queryKeys.employees });

      // Snapshot for rollback
      const previousAssignments = queryClient.getQueryData(queryKeys.assignments);
      const previousEmployees = queryClient.getQueryData(queryKeys.employees);

      // Immediately update cache
      queryClient.setQueryData<Assignment[]>(queryKeys.assignments, (old) => {
        if (!old) return old;
        return old.map((assignment) =>
          assignment.id === id ? { ...assignment, ...updates } : assignment
        );
      });

      // Update employees cache (assignments nested within)
      queryClient.setQueryData<any[]>(queryKeys.employees, (old) => {
        if (!old) return old;
        return old.map((employee) => ({
          ...employee,
          assignments: employee.assignments?.map((assignment: Assignment) =>
            assignment.id === id ? { ...assignment, ...updates } : assignment
          ),
        }));
      });

      // Also update ALL date-filtered query caches
      const queriesData = queryClient.getQueriesData({ queryKey: queryKeys.assignments });
      console.log('[useUpdateAssignment] Updating all query caches:', queriesData.length);
      queriesData.forEach(([queryKey, data]) => {
        if (Array.isArray(data)) {
          queryClient.setQueryData<Assignment[]>(queryKey, (old) => {
            if (!old) return old;
            return old.map((assignment) =>
              assignment.id === id ? { ...assignment, ...updates } : assignment
            );
          });
        }
      });

      return { previousAssignments, previousEmployees };
    },

    // Rollback on error
    onError: (err, variables, context) => {
      console.error('[useUpdateAssignment] onError:', err);
      // Only rollback if we actually did an optimistic update
      if (context?.previousAssignments && !context?.skipOptimistic) {
        queryClient.setQueryData(queryKeys.assignments, context.previousAssignments);
      }
      if (context?.previousEmployees && !context?.skipOptimistic) {
        queryClient.setQueryData(queryKeys.employees, context.previousEmployees);
      }
    },

    // Server sync - update cache with actual server data (no refetch needed)
    onSuccess: (data) => {
      console.log('[useUpdateAssignment] onSuccess:', data);
      // Update assignments cache with server response
      queryClient.setQueryData<Assignment[]>(queryKeys.assignments, (old) => {
        if (!old) return [data];
        return old.map((a) => (a.id === data.id ? data : a));
      });

      // Update employees cache with server response
      queryClient.setQueryData<any[]>(queryKeys.employees, (old) => {
        if (!old) return old;
        return old.map((employee) => ({
          ...employee,
          assignments: employee.assignments?.map((a: Assignment) =>
            a.id === data.id ? data : a
          ),
        }));
      });
    },
  });
}

export function useDeleteAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAssignment,

    // Optimistic delete - remove from cache immediately
    onMutate: async (id: string) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.assignments });
      await queryClient.cancelQueries({ queryKey: queryKeys.employees });

      // Snapshot for rollback
      const previousAssignments = queryClient.getQueryData(queryKeys.assignments);
      const previousEmployees = queryClient.getQueryData(queryKeys.employees);

      // Remove from assignments cache immediately
      queryClient.setQueryData<Assignment[]>(queryKeys.assignments, (old) => {
        if (!old) return old;
        return old.filter((a) => a.id !== id);
      });

      // Remove from employees cache (nested assignments)
      queryClient.setQueryData<any[]>(queryKeys.employees, (old) => {
        if (!old) return old;
        return old.map((employee) => ({
          ...employee,
          assignments: employee.assignments?.filter((a: Assignment) => a.id !== id),
        }));
      });

      return { previousAssignments, previousEmployees };
    },

    // Rollback on error
    onError: (err, id, context) => {
      if (context?.previousAssignments) {
        queryClient.setQueryData(queryKeys.assignments, context.previousAssignments);
      }
      if (context?.previousEmployees) {
        queryClient.setQueryData(queryKeys.employees, context.previousEmployees);
      }
    },

    // Invalidate related queries so brand-filtered views stay in sync
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.brands });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
    },
  });
}
