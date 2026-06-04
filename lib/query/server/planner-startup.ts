import {
  DEFAULT_TIMELINE_VIEW,
  getInitialTimelineDateRange,
} from "@/lib/timeline/initial-load";
import {
  getTimelineResolution,
  type PlannerTimelineRequest,
} from "@/lib/timeline/planner-loading";

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
