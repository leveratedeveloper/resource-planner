import { useInfiniteQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/queryKeys";
import { hasBrandCriteria } from "@/lib/query/filterCriteria";
import type { PlannerFilterBrandsResponse } from "@/lib/query/server/planner-filter-brands";

const PAGE_SIZE = 50;

async function fetchPage(
  pageParam: number,
  search: string,
  signal?: AbortSignal
): Promise<PlannerFilterBrandsResponse> {
  const url = new URL("/api/planner/filter-options/brands", window.location.origin);
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("offset", String(pageParam));
  if (search) url.searchParams.set("search", search);

  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    throw new Error("Failed to fetch planner filter brands");
  }

  const result = await response.json();
  return result.data;
}

export function usePlannerFilterBrands(
  params: { search?: string } = {},
  options: { enabled?: boolean } = {}
) {
  const search = params.search ?? "";
  return useInfiniteQuery({
    queryKey: [...queryKeys.plannerFilterBrandsInfinite, search] as const,
    queryFn: ({ pageParam, signal }) => fetchPage(pageParam, search, signal),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.reduce((count, page) => count + page.brands.length, 0) : undefined,
    enabled: (options.enabled ?? true) && hasBrandCriteria(search),
    staleTime: 5 * 60 * 1000,
  });
}
