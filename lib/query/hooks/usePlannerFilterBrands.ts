import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/queryKeys";
import type { PlannerFilterBrandsRequest, PlannerFilterBrandsResponse } from "@/lib/query/server/planner-filter-brands";

export type PlannerFilterBrandsHookRequest = PlannerFilterBrandsRequest;

async function fetchPlannerFilterBrands(
  request: PlannerFilterBrandsHookRequest
): Promise<PlannerFilterBrandsResponse> {
  const url = new URL("/api/planner/filter-options/brands", window.location.origin);
  if (request.selectedBrandId) url.searchParams.set("selectedBrandId", request.selectedBrandId);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error("Failed to fetch planner filter brands");
  }

  const result = await response.json();
  return result.data;
}

export function usePlannerFilterBrands(
  request: PlannerFilterBrandsHookRequest,
  options: { enabled?: boolean } = {}
) {
  return useQuery({
    queryKey: queryKeys.plannerFilterBrands(request),
    queryFn: () => fetchPlannerFilterBrands(request),
    enabled: options.enabled ?? true,
    staleTime: 5 * 60 * 1000,
  });
}
