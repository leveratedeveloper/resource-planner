import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import type {
  PlannerHomeBootstrapRequest,
  PlannerHomeBootstrapResponse,
} from "@/lib/query/server/planner-home-bootstrap";
import { queryKeys } from "@/lib/query/queryKeys";

// Employee pages are the unit of loading: each bootstrap page carries its own
// employees AND their timeline assignments (payload-diet spec 2026-06-12), so
// the page param is the employee offset and scrolling fetches the next slice.
export type PlannerHomeBootstrapPageRequest = Omit<PlannerHomeBootstrapRequest, "employeeOffset">;

function getPlannerHomeBootstrapPagesQueryKey(request: PlannerHomeBootstrapPageRequest) {
  return [...queryKeys.plannerHomeBootstrap, "pages", request] as const;
}

async function fetchPlannerHomeBootstrap(
  request: PlannerHomeBootstrapRequest,
  signal?: AbortSignal
): Promise<PlannerHomeBootstrapResponse> {
  const url = new URL("/api/planner/home-bootstrap", window.location.origin);
  url.searchParams.set("viewMode", request.viewMode);
  url.searchParams.set("startDate", request.startDate);
  url.searchParams.set("endDate", request.endDate);
  url.searchParams.set("employeeLimit", String(request.employeeLimit));
  url.searchParams.set("employeeOffset", String(request.employeeOffset));

  if (request.brandId) url.searchParams.set("brandId", request.brandId);
  if (request.department) url.searchParams.set("department", request.department);
  if (request.projectId) url.searchParams.set("projectId", request.projectId);
  if (request.search) url.searchParams.set("search", request.search);

  for (const [key, value] of Object.entries(request.filters ?? {})) {
    if (value) url.searchParams.set(key, value);
  }

  // Forward the abort signal so a cancelled query actually aborts on the wire
  // — without it, every cancellation still costs the server the full query.
  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    throw new Error("Failed to fetch planner home bootstrap");
  }

  const result = await response.json();
  return result.data;
}

export function usePlannerHomeBootstrapPages(
  request?: PlannerHomeBootstrapPageRequest,
  options: {
    enabled?: boolean;
    initialData?: PlannerHomeBootstrapResponse | null;
    initialDataUpdatedAt?: number;
  } = {}
) {
  return useInfiniteQuery({
    queryKey: request
      ? getPlannerHomeBootstrapPagesQueryKey(request)
      : [...queryKeys.plannerHomeBootstrap, "pages", "disabled"],
    queryFn: ({ pageParam, signal }) =>
      fetchPlannerHomeBootstrap({ ...request!, employeeOffset: pageParam }, signal),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.employeeHasMore
        ? allPages.reduce((count, page) => count + page.employees.length, 0)
        : undefined,
    enabled: !!request && (options.enabled ?? true),
    placeholderData: keepPreviousData,
    // The SSR bootstrap seeds page 0 exactly like the old single-shot query.
    initialData: options.initialData
      ? { pages: [options.initialData], pageParams: [0] }
      : undefined,
    initialDataUpdatedAt: options.initialDataUpdatedAt,
  });
}
