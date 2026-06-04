import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  getCurrentPlannerTimelineData,
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
  const query = useQuery({
    queryKey: request ? getPlannerTimelineQueryKey(request) : ["planner-timeline", "disabled"],
    queryFn: () => fetchPlannerTimeline(request!),
    enabled: !!request && (options.enabled ?? true),
    placeholderData: keepPreviousData,
  });

  const currentData = getCurrentPlannerTimelineData(query.data, request);
  const hasMismatchedPlaceholderData = !!query.data && !currentData;

  return {
    ...query,
    data: currentData,
    previousData: hasMismatchedPlaceholderData ? query.data : undefined,
    isDataForCurrentRequest: !!currentData,
    isLoadingCurrentData: query.isLoading || (hasMismatchedPlaceholderData && query.isFetching),
    isShowingPreviousData: hasMismatchedPlaceholderData,
  };
}
