import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/queryKeys";
import type { PlannerFilterBrandsResponse } from "@/lib/query/server/planner-filter-brands";

async function fetchPlannerFilterBrands(): Promise<PlannerFilterBrandsResponse> {
  const url = new URL("/api/planner/filter-options/brands", window.location.origin);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error("Failed to fetch planner filter brands");
  }

  const result = await response.json();
  return result.data;
}

export function usePlannerFilterBrands(
  options: { enabled?: boolean } = {}
) {
  return useQuery({
    queryKey: queryKeys.plannerFilterBrands,
    queryFn: fetchPlannerFilterBrands,
    enabled: options.enabled ?? true,
    staleTime: 5 * 60 * 1000,
  });
}
