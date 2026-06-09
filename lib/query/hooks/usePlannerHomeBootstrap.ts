import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type {
  PlannerHomeBootstrapRequest,
  PlannerHomeBootstrapResponse,
} from "@/lib/query/server/planner-home-bootstrap";
import { queryKeys } from "@/lib/query/queryKeys";

function getPlannerHomeBootstrapQueryKey(request: PlannerHomeBootstrapRequest) {
  return [...queryKeys.plannerHomeBootstrap, request] as const;
}

async function fetchPlannerHomeBootstrap(
  request: PlannerHomeBootstrapRequest
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

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error("Failed to fetch planner home bootstrap");
  }

  const result = await response.json();
  return result.data;
}

export function usePlannerHomeBootstrap(
  request?: PlannerHomeBootstrapRequest,
  options: {
    enabled?: boolean;
    initialData?: PlannerHomeBootstrapResponse | null;
    initialDataUpdatedAt?: number;
  } = {}
) {
  return useQuery({
    queryKey: request ? getPlannerHomeBootstrapQueryKey(request) : [...queryKeys.plannerHomeBootstrap, "disabled"],
    queryFn: () => fetchPlannerHomeBootstrap(request!),
    enabled: !!request && (options.enabled ?? true),
    placeholderData: keepPreviousData,
    initialData: options.initialData ?? undefined,
    initialDataUpdatedAt: options.initialDataUpdatedAt,
  });
}
