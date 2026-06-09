import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/queryKeys";
import type { PlannerFilterProjectsResponse } from "@/lib/query/server/planner-filter-projects";

async function fetchPlannerFilterProjects(): Promise<PlannerFilterProjectsResponse> {
  const url = new URL("/api/planner/filter-options/projects", window.location.origin);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error("Failed to fetch planner filter projects");
  }

  const result = await response.json();
  return result.data;
}

export function usePlannerFilterProjects(
  options: { enabled?: boolean } = {}
) {
  return useQuery({
    queryKey: queryKeys.plannerFilterProjects,
    queryFn: fetchPlannerFilterProjects,
    enabled: options.enabled ?? true,
    staleTime: 5 * 60 * 1000,
  });
}
