import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  getPlannerTimelineQueryKey,
  type PlannerTimelineRequest,
  type PlannerTimelineResponse,
} from "@/lib/timeline/planner-loading";

async function fetchPlannerTimeline(request: PlannerTimelineRequest): Promise<PlannerTimelineResponse> {
  const url = new URL("/api/planner/timeline", window.location.origin);
  url.searchParams.set("viewMode", request.viewMode);
  url.searchParams.set("startDate", request.startDate);
  url.searchParams.set("endDate", request.endDate);

  for (const [key, value] of Object.entries(request.filters ?? {})) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error("Failed to fetch planner timeline");
  }

  const data = await response.json();
  return data.data;
}

export function usePlannerTimeline(
  request?: PlannerTimelineRequest,
  options: { enabled?: boolean } = {}
) {
  return useQuery({
    queryKey: request ? getPlannerTimelineQueryKey(request) : ["planner-timeline", "disabled"],
    queryFn: () => fetchPlannerTimeline(request!),
    enabled: !!request && (options.enabled ?? true),
    placeholderData: keepPreviousData,
  });
}
