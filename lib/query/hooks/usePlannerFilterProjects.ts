import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/queryKeys";
import type {
  PlannerFilterProjectsRequest,
  PlannerFilterProjectsResponse,
} from "@/lib/query/server/planner-filter-projects";

export type PlannerFilterProjectsHookRequest = PlannerFilterProjectsRequest;

async function fetchPlannerFilterProjects(
  request: PlannerFilterProjectsHookRequest
): Promise<PlannerFilterProjectsResponse> {
  const url = new URL("/api/planner/filter-options/projects", window.location.origin);
  url.searchParams.set("offset", String(request.offset));
  url.searchParams.set("limit", String(request.limit));

  if (request.brandId) url.searchParams.set("brandId", request.brandId);
  if (request.status) url.searchParams.set("status", request.status);
  if (request.sourceType) url.searchParams.set("sourceType", request.sourceType);
  if (request.search) url.searchParams.set("search", request.search);
  if (request.selectedProjectId) url.searchParams.set("selectedProjectId", request.selectedProjectId);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error("Failed to fetch planner filter projects");
  }

  const result = await response.json();
  return result.data;
}

export function useInfinitePlannerFilterProjects(
  request: Omit<PlannerFilterProjectsHookRequest, "offset">,
  options: { enabled?: boolean } = {}
) {
  return useInfiniteQuery({
    queryKey: queryKeys.plannerFilterProjects(request),
    queryFn: ({ pageParam }) =>
      fetchPlannerFilterProjects({
        ...request,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      return allPages.reduce((total, page) => total + page.projects.length, 0);
    },
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  });
}
