import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/queryKeys";
import type { PlannerFilterBrandsRequest, PlannerFilterBrandsResponse } from "@/lib/query/server/planner-filter-brands";

export type PlannerFilterBrandsHookRequest = PlannerFilterBrandsRequest;

async function fetchPlannerFilterBrands(
  request: PlannerFilterBrandsHookRequest
): Promise<PlannerFilterBrandsResponse> {
  const url = new URL("/api/planner/filter-options/brands", window.location.origin);
  url.searchParams.set("offset", String(request.offset));
  url.searchParams.set("limit", String(request.limit));

  if (request.search) url.searchParams.set("search", request.search);
  if (request.selectedBrandId) url.searchParams.set("selectedBrandId", request.selectedBrandId);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error("Failed to fetch planner filter brands");
  }

  const result = await response.json();
  return result.data;
}

export function useInfinitePlannerFilterBrands(
  request: Omit<PlannerFilterBrandsHookRequest, "offset">,
  options: { enabled?: boolean } = {}
) {
  return useInfiniteQuery({
    queryKey: queryKeys.plannerFilterBrands(request),
    queryFn: ({ pageParam }) =>
      fetchPlannerFilterBrands({
        ...request,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      return allPages.reduce((total, page) => total + page.brands.length, 0);
    },
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  });
}
