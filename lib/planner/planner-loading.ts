import { queryKeys } from "@/lib/query/queryKeys";
import { toLocalDateString } from "@/lib/utils";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { TimelineViewMode } from "@/lib/timeline-v2/types";

export type { TimelineViewMode };
export type PlannerTimelineResolution = "day" | "month";

export type PlannerTimelineFilters = {
  category?: string | null;
  status?: string | null;
};

export type PlannerTimelineRequest = {
  viewMode: TimelineViewMode;
  resolution: PlannerTimelineResolution;
  startDate: string;
  endDate: string;
  filters?: PlannerTimelineFilters;
};

export type PlannerTimelineResponse = {
  request: PlannerTimelineRequest;
  assignments: Assignment[];
  // actualAssignments removed — actuals track dropped in timeline-read migration
};

export function getTimelineResolution(viewMode: TimelineViewMode): PlannerTimelineResolution {
  return viewMode === "week" || viewMode === "month" ? "day" : "month";
}

function normalizePlannerFilters(filters?: PlannerTimelineFilters): Required<PlannerTimelineFilters> {
  return {
    category: filters?.category ?? null,
    status: filters?.status ?? null,
  };
}

function getPlannerTimelineRequestIdentity(request: PlannerTimelineRequest) {
  return {
    viewMode: request.viewMode,
    resolution: request.resolution,
    startDate: request.startDate,
    endDate: request.endDate,
    filters: normalizePlannerFilters(request.filters),
  };
}

export function getPlannerTimelineQueryKey(request: PlannerTimelineRequest) {
  return [...queryKeys.plannerTimeline, getPlannerTimelineRequestIdentity(request)] as const;
}

export function arePlannerTimelineRequestsEqual(
  left?: PlannerTimelineRequest,
  right?: PlannerTimelineRequest
): boolean {
  if (!left || !right) {
    return false;
  }

  const leftFilters = normalizePlannerFilters(left.filters);
  const rightFilters = normalizePlannerFilters(right.filters);

  return (
    left.viewMode === right.viewMode &&
    left.resolution === right.resolution &&
    left.startDate === right.startDate &&
    left.endDate === right.endDate &&
    leftFilters.category === rightFilters.category &&
    leftFilters.status === rightFilters.status
  );
}

export function getCurrentPlannerTimelineData(
  response: PlannerTimelineResponse | undefined,
  activeRequest: PlannerTimelineRequest | undefined
): PlannerTimelineResponse | undefined {
  if (!response || !activeRequest) {
    return undefined;
  }

  return arePlannerTimelineRequestsEqual(response.request, activeRequest)
    ? response
    : undefined;
}

export type MonthlyTimelineAssignment = Assignment & {
  // Number of underlying engagement rows collapsed into this month block.
  // The IDs themselves never ship — the month editor fetches detail on demand.
  detailCount: number;
  resolution: "month";
};

export function isMonthlyPlannerAssignment(
  assignment: Assignment
): assignment is MonthlyTimelineAssignment {
  return assignment.id.startsWith("planner-month:");
}

export function shouldLoadPlannerAssignmentDetail(assignment?: Assignment): boolean {
  return !!assignment && isMonthlyPlannerAssignment(assignment);
}
