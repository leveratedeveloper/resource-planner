import { useInfiniteQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/queryKeys";
import { hasProjectCriteria } from "@/lib/query/filterCriteria";
import type { PlannerFilterProjectsResponse } from "@/lib/query/server/planner-filter-projects";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";

const PAGE_SIZE = 50;

type ProjectScope = {
  brandIds: string[];
  status: ProjectOption["status"] | null;
  sourceType: ProjectOption["projectType"] | null;
  search: string;
};

async function fetchPage(
  pageParam: number,
  scope: ProjectScope,
  signal?: AbortSignal
): Promise<PlannerFilterProjectsResponse> {
  const url = new URL("/api/planner/filter-options/projects", window.location.origin);
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("offset", String(pageParam));
  if (scope.brandIds.length > 0) url.searchParams.set("brandIds", scope.brandIds.join(","));
  if (scope.status) url.searchParams.set("status", scope.status);
  if (scope.sourceType) url.searchParams.set("sourceType", scope.sourceType);
  if (scope.search) url.searchParams.set("search", scope.search);

  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    throw new Error("Failed to fetch planner filter projects");
  }

  const result = await response.json();
  return result.data;
}

export function usePlannerFilterProjects(
  params: {
    brandIds?: string[];
    status?: ProjectOption["status"] | null;
    sourceType?: ProjectOption["projectType"] | null;
    search?: string;
  } = {},
  options: { enabled?: boolean } = {}
) {
  const scope: ProjectScope = {
    brandIds: params.brandIds ?? [],
    status: params.status ?? null,
    sourceType: params.sourceType ?? null,
    search: params.search ?? "",
  };
  return useInfiniteQuery({
    queryKey: [...queryKeys.plannerFilterProjectsInfinite, scope] as const,
    queryFn: ({ pageParam, signal }) => fetchPage(pageParam, scope, signal),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.reduce((count, page) => count + page.projects.length, 0) : undefined,
    enabled:
      (options.enabled ?? true) &&
      hasProjectCriteria({ search: scope.search, brandIds: scope.brandIds, status: scope.status, sourceType: scope.sourceType }),
    staleTime: 5 * 60 * 1000,
  });
}
