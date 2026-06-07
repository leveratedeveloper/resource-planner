import { HomeClient, HomePlannerTimeline } from "@/app/HomeClient";
import { getSession } from "@/lib/auth/session";
import { fetchPlannerHomeBootstrap } from "@/lib/query/server/planner-home-bootstrap";
import { getInitialPlannerRequest } from "@/lib/query/server/planner-startup";
import { getInitialTimelineAnchor } from "@/lib/timeline/initial-load";

export default async function Home() {
  const initialTimelineAnchor = getInitialTimelineAnchor();
  const session = await getSession();
  const initialPlannerRequest = getInitialPlannerRequest(initialTimelineAnchor);
  const initialBootstrap = session
    ? await fetchPlannerHomeBootstrap(session, {
        ...initialPlannerRequest,
        employeeLimit: 24,
        employeeOffset: 0,
        brandId: null,
        department: null,
        projectId: null,
        search: null,
      }).catch((error) => {
        console.error("[Home] Failed to prefetch planner bootstrap:", error);
        return null;
      })
    : null;

  return (
    <HomeClient initialTimelineAnchor={initialTimelineAnchor} initialBootstrap={initialBootstrap}>
      <HomePlannerTimeline
        initialTimelineAnchor={initialTimelineAnchor}
        initialBootstrap={initialBootstrap}
      />
    </HomeClient>
  );
}
