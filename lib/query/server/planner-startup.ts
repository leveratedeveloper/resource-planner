import { QueryClient } from "@tanstack/react-query";
import { getSession } from "@/lib/auth/session";
import { fetchPlannerTimeline } from "@/lib/query/server/planner-prefetch";
import {
  DEFAULT_TIMELINE_VIEW,
  getInitialTimelineDateRange,
} from "@/lib/timeline/initial-load";
import {
  getPlannerTimelineQueryKey,
  getTimelineResolution,
  type PlannerTimelineRequest,
  type PlannerTimelineResponse,
} from "@/lib/timeline/planner-loading";
import { createRequestTiming } from "@/lib/observability/request-timing";

type PrefetchResult<T> =
  | { ok: true; data: T }
  | { ok: false };

async function safePrefetch<T>(label: string, promise: Promise<T>): Promise<PrefetchResult<T>> {
  try {
    return { ok: true, data: await promise };
  } catch (error) {
    console.error(`[Planner Startup] Failed to prefetch ${label}:`, error);
    return { ok: false };
  }
}

export function getInitialPlannerRequest(initialTimelineAnchor: string): PlannerTimelineRequest {
  const initialDateRange = getInitialTimelineDateRange(
    initialTimelineAnchor,
    DEFAULT_TIMELINE_VIEW
  );

  return {
    viewMode: DEFAULT_TIMELINE_VIEW,
    resolution: getTimelineResolution(DEFAULT_TIMELINE_VIEW),
    startDate: initialDateRange.startDate,
    endDate: initialDateRange.endDate,
    filters: {
      category: null,
      status: null,
    },
  };
}

export function seedCriticalPlannerStartup(
  queryClient: QueryClient,
  {
    plannerTimeline,
  }: {
    plannerTimeline?: PlannerTimelineResponse;
  }
) {
  if (plannerTimeline) {
    queryClient.setQueryData(
      getPlannerTimelineQueryKey(plannerTimeline.request),
      plannerTimeline
    );
  }
}

export async function prefetchCriticalPlannerStartup(
  queryClient: QueryClient,
  initialTimelineAnchor: string
) {
  const timing = createRequestTiming("planner_startup_prefetch");
  const session = await getSession();

  if (!session) {
    timing.total({ result: "unauthenticated" });
    return;
  }

  const initialPlannerRequest = getInitialPlannerRequest(initialTimelineAnchor);
  const plannerTimeline = await safePrefetch(
    "initial timeline",
    fetchPlannerTimeline(session, initialPlannerRequest)
  );

  seedCriticalPlannerStartup(queryClient, {
    plannerTimeline: plannerTimeline.ok ? plannerTimeline.data : undefined,
  });
  timing.total({
    result: "settled",
    timeline: plannerTimeline.ok ? "hydrated" : "client_fetch",
  });
}
