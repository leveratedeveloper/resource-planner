import { Suspense } from "react";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { HomeClient, HomePlannerTimeline } from "@/app/HomeClient";
import { TimelineStartupFallback } from "@/components/timeline/TimelineStartupFallback";
import { prefetchCriticalPlannerStartup } from "@/lib/query/server/planner-startup";
import { getInitialTimelineAnchor } from "@/lib/timeline/initial-load";

async function CriticalPlannerTimeline({
  initialTimelineAnchor,
}: {
  initialTimelineAnchor: string;
}) {
  const queryClient = new QueryClient();

  await prefetchCriticalPlannerStartup(queryClient, initialTimelineAnchor);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <HomePlannerTimeline initialTimelineAnchor={initialTimelineAnchor} />
    </HydrationBoundary>
  );
}

export default async function Home() {
  const initialTimelineAnchor = getInitialTimelineAnchor();

  return (
    <HomeClient initialTimelineAnchor={initialTimelineAnchor}>
      <Suspense fallback={<TimelineStartupFallback initialTimelineAnchor={initialTimelineAnchor} />}>
        <CriticalPlannerTimeline initialTimelineAnchor={initialTimelineAnchor} />
      </Suspense>
    </HomeClient>
  );
}
