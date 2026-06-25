import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type {
  PlannerHomeBootstrapRequest,
  PlannerHomeBootstrapResponse,
} from "@/lib/query/server/planner-home-bootstrap";
import { queryKeys } from "@/lib/query/queryKeys";

export type PlannerHomeBootstrapRequestInput = PlannerHomeBootstrapRequest;

function getPlannerHomeBootstrapQueryKey(request: PlannerHomeBootstrapRequest) {
  // Filters are client-side now: only the date window + view affect the fetch.
  return [
    ...queryKeys.plannerHomeBootstrap,
    "window",
    request.viewMode,
    request.resolution,
    request.startDate,
    request.endDate,
    request.filters?.category ?? null,
    request.filters?.status ?? null,
  ] as const;
}

async function fetchPlannerHomeBootstrap(
  request: PlannerHomeBootstrapRequest,
  signal?: AbortSignal
): Promise<PlannerHomeBootstrapResponse> {
  const url = new URL("/api/planner/home-bootstrap", window.location.origin);
  url.searchParams.set("viewMode", request.viewMode);
  url.searchParams.set("startDate", request.startDate);
  url.searchParams.set("endDate", request.endDate);
  for (const [key, value] of Object.entries(request.filters ?? {})) {
    if (value) url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    throw new Error("Failed to fetch planner home bootstrap");
  }
  const result = await response.json();
  return result.data;
}

export function usePlannerHomeBootstrapWindow(
  request?: PlannerHomeBootstrapRequest,
  options: {
    enabled?: boolean;
    initialData?: PlannerHomeBootstrapResponse | null;
    initialDataUpdatedAt?: number;
  } = {}
) {
  return useQuery({
    queryKey: request
      ? getPlannerHomeBootstrapQueryKey(request)
      : [...queryKeys.plannerHomeBootstrap, "window", "disabled"],
    queryFn: ({ signal }) => fetchPlannerHomeBootstrap(request!, signal),
    enabled: !!request && (options.enabled ?? true),
    placeholderData: keepPreviousData,
    initialData: options.initialData ?? undefined,
    initialDataUpdatedAt: options.initialDataUpdatedAt,
  });
}
