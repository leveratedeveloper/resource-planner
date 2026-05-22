import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { HomeClient } from "@/app/HomeClient";
import { getSession } from "@/lib/auth/session";
import {
  DEFAULT_TIMELINE_VIEW,
  getInitialTimelineAnchor,
  getInitialTimelineDateRange,
} from "@/lib/timeline/initial-load";
import { queryKeys } from "@/lib/query/queryKeys";
import {
  fetchInitialEmployeePage,
  fetchPlannerBrands,
  fetchPlannerDepartments,
  fetchPlannerProjects,
  fetchPlannerTimeline,
  toPublicSession,
} from "@/lib/query/server/planner-prefetch";
import {
  getPlannerTimelineQueryKey,
  getTimelineResolution,
} from "@/lib/timeline/planner-loading";

type PrefetchResult<T> =
  | { ok: true; data: T }
  | { ok: false };

async function safePrefetch<T>(promise: Promise<T>): Promise<PrefetchResult<T>> {
  try {
    return { ok: true, data: await promise };
  } catch (error) {
    console.error("[Home Prefetch] Failed to prefetch initial data:", error);
    return { ok: false };
  }
}

async function prefetchHomeData(queryClient: QueryClient, initialTimelineAnchor: string) {
  const session = await getSession();
  const publicSession = toPublicSession(session);

  queryClient.setQueryData(["session"], publicSession);

  if (!session) {
    return;
  }

  const initialDateRange = getInitialTimelineDateRange(
    initialTimelineAnchor,
    DEFAULT_TIMELINE_VIEW
  );
  const initialPlannerRequest = {
    viewMode: DEFAULT_TIMELINE_VIEW,
    resolution: getTimelineResolution(DEFAULT_TIMELINE_VIEW),
    startDate: initialDateRange.startDate,
    endDate: initialDateRange.endDate,
    filters: {
      brandId: null,
      department: null,
      projectId: null,
      category: null,
      status: null,
    },
  };

  const results = await Promise.all([
    safePrefetch(fetchInitialEmployeePage(session)),
    safePrefetch(fetchPlannerBrands(session)),
    safePrefetch(fetchPlannerDepartments(session)),
    safePrefetch(fetchPlannerProjects(session)),
    safePrefetch(fetchPlannerTimeline(session, initialPlannerRequest)),
  ]);

  const [
    initialEmployeePage,
    brands,
    departments,
    projects,
    plannerTimeline,
  ] = results;

  if (initialEmployeePage.ok) {
    queryClient.setQueryData([...queryKeys.employeesInfinite, undefined], {
      pages: [initialEmployeePage.data],
      pageParams: [0],
    });
  }
  if (brands.ok) {
    queryClient.setQueryData(queryKeys.brands, brands.data);
  }
  if (departments.ok) {
    queryClient.setQueryData(queryKeys.departments, departments.data);
  }
  if (projects.ok) {
    queryClient.setQueryData(queryKeys.projects, projects.data);
  }
  if (plannerTimeline.ok) {
    queryClient.setQueryData(
      getPlannerTimelineQueryKey(initialPlannerRequest),
      plannerTimeline.data
    );
  }
}

export default async function Home() {
  const initialTimelineAnchor = getInitialTimelineAnchor();
  const queryClient = new QueryClient();

  await prefetchHomeData(queryClient, initialTimelineAnchor);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <HomeClient initialTimelineAnchor={initialTimelineAnchor} />
    </HydrationBoundary>
  );
}
