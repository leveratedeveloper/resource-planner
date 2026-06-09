import { HomeClient, HomePlannerTimeline } from "@/app/HomeClient";
import { getInitialTimelineAnchor } from "@/lib/timeline/initial-load";

export default function Home() {
  const initialTimelineAnchor = getInitialTimelineAnchor();

  return (
    <HomeClient initialTimelineAnchor={initialTimelineAnchor}>
      <HomePlannerTimeline initialTimelineAnchor={initialTimelineAnchor} />
    </HomeClient>
  );
}
