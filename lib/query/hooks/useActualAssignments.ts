import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Types - Struktur sama dengan Assignment
export interface ActualAssignment {
  uuid: string;
  employeeUuid: string;
  projectUuid: string | null;
  taskUuid: string | null;
  startDate: string;
  endDate: string;
  hoursPerDay: number;
  allocationPercentage: number | null;
  isTimeOff: boolean;
  timeOffTypeUuid: string | null;
  category: string | null;
  isBillable: boolean;
  status: string;
  note: string | null;
  createdByUuid: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NewActualAssignment = Omit<
  ActualAssignment,
  "uuid" | "createdAt" | "updatedAt"
>;

// API Functions
async function fetchActualAssignments(params?: {
  employee_uuid?: string;
  project_uuid?: string;
  start_date?: string;
  end_date?: string;
}): Promise<ActualAssignment[]> {
  const url = new URL("/api/actual", window.location.origin);
  if (params?.employee_uuid) url.searchParams.set("employee_uuid", params.employee_uuid);
  if (params?.project_uuid) url.searchParams.set("project_uuid", params.project_uuid);
  if (params?.start_date) url.searchParams.set("start_date", params.start_date);
  if (params?.end_date) url.searchParams.set("end_date", params.end_date);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error("Failed to fetch actual assignments");
  }
  const data = await response.json();
  return data.data;
}

async function fetchActual(uuid: string): Promise<ActualAssignment> {
  const response = await fetch(`/api/actual/${uuid}`);
  if (!response.ok) {
    throw new Error("Failed to fetch actual assignment");
  }
  const data = await response.json();
  return data.data;
}

async function createActualAssignment(
  assignment: NewActualAssignment
): Promise<ActualAssignment> {
  const response = await fetch("/api/actual", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(assignment),
  });
  if (!response.ok) {
    let errorMessage = "Failed to create actual assignment";
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

async function updateActualAssignment({
  uuid,
  ...data
}: Partial<ActualAssignment> & { uuid: string }): Promise<ActualAssignment> {
  const response = await fetch(`/api/actual/${uuid}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error("Failed to update actual assignment");
  }
  const result = await response.json();
  return result.data;
}

async function deleteActualAssignment(uuid: string): Promise<void> {
  const response = await fetch(`/api/actual/${uuid}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to delete actual assignment");
  }
}

// Hooks
export function useActualAssignments(params?: {
  employee_uuid?: string;
  project_uuid?: string;
  start_date?: string;
  end_date?: string;
}) {
  return useQuery({
    queryKey: ["actual", params],
    queryFn: () => fetchActualAssignments(params),
  });
}

export function useActual(uuid: string) {
  return useQuery({
    queryKey: ["actual", uuid],
    queryFn: () => fetchActual(uuid),
    enabled: !!uuid,
  });
}

export function useCreateActualAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createActualAssignment,

    // Optimistic update - add to cache immediately with temp ID
    onMutate: async (newActual) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["actual"] });

      // Create optimistic actual with temp ID
      const optimisticActual: ActualAssignment = {
        uuid: `temp-${Date.now()}-${Math.random()}`,
        employeeUuid: newActual.employeeUuid,
        projectUuid: newActual.projectUuid,
        taskUuid: newActual.taskUuid,
        startDate: newActual.startDate,
        endDate: newActual.endDate,
        hoursPerDay: newActual.hoursPerDay,
        allocationPercentage: newActual.allocationPercentage,
        isTimeOff: newActual.isTimeOff,
        timeOffTypeUuid: newActual.timeOffTypeUuid,
        category: newActual.category || null,
        isBillable: newActual.isBillable,
        status: newActual.status,
        note: newActual.note,
        createdByUuid: newActual.createdByUuid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Update ALL query caches
      queryClient.setQueriesData<ActualAssignment[]>(
        { queryKey: ["actual"] },
        (old) => {
          if (!old) {
            return [optimisticActual];
          }
          return [...old, optimisticActual];
        }
      );

      return { optimisticId: optimisticActual.uuid };
    },

    // Replace temp ID with real data
    onSuccess: (data, variables, context) => {
      // Update ALL query caches to replace temp ID with real data
      queryClient.setQueriesData<ActualAssignment[]>(
        { queryKey: ["actual"] },
        (old) => {
          if (!old) return [data];
          return old.map((a) =>
            a.uuid === context?.optimisticId ? data : a
          );
        }
      );
    },
  });
}

export function useUpdateActualAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateActualAssignment,

    // Optimistic update before API call
    onMutate: async (variables) => {
      const { uuid } = variables;

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["actual"] });

      // Snapshot for rollback
      const previousActuals = queryClient.getQueryData(["actual"]);

      // Immediately update cache
      queryClient.setQueryData<ActualAssignment[]>(["actual"], (old) => {
        if (!old) return old;
        return old.map((actual) =>
          actual.uuid === uuid
            ? { ...actual, ...variables }
            : actual
        );
      });

      return { previousActuals };
    },

    // Rollback on error
    onError: (err, variables, context) => {
      if (context?.previousActuals) {
        queryClient.setQueryData(["actual"], context.previousActuals);
      }
    },

    // Server sync - update cache with actual server data
    onSuccess: (data) => {
      queryClient.setQueryData<ActualAssignment[]>(["actual"], (old) => {
        if (!old) return [data];
        return old.map((a) => (a.uuid === data.uuid ? data : a));
      });
    },
  });
}

export function useDeleteActualAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteActualAssignment,

    // Optimistic delete - remove from cache immediately
    onMutate: async (uuid: string) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["actual"] });

      // Snapshot for rollback
      const previousActuals = queryClient.getQueryData(["actual"]);

      // Remove from cache immediately
      queryClient.setQueryData<ActualAssignment[]>(["actual"], (old) => {
        if (!old) return old;
        return old.filter((a) => a.uuid !== uuid);
      });

      return { previousActuals };
    },

    // Rollback on error
    onError: (err, uuid, context) => {
      if (context?.previousActuals) {
        queryClient.setQueryData(["actual"], context.previousActuals);
      }
    },

    // Invalidate related queries
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["actual"] });
    },
  });
}
