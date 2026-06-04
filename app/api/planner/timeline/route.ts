import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { fetchPlannerTimeline } from "@/lib/query/server/planner-prefetch";
import {
  getTimelineResolution,
  type PlannerTimelineFilters,
  type TimelineViewMode,
} from "@/lib/timeline/planner-loading";
import { createRequestTiming } from "@/lib/observability/request-timing";

const VIEW_MODES = new Set<TimelineViewMode>([
  "week",
  "month",
  "quarter",
  "halfYear",
  "year",
]);

export async function GET(request: NextRequest) {
  const timing = createRequestTiming("planner_timeline_api");

  try {
    const session = await getSession();
    if (!session) {
      timing.total({ result: "unauthenticated" });
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const viewParam = request.nextUrl.searchParams.get("viewMode");
    const startDate = request.nextUrl.searchParams.get("startDate");
    const endDate = request.nextUrl.searchParams.get("endDate");

    if (!viewParam || !VIEW_MODES.has(viewParam as TimelineViewMode) || !startDate || !endDate) {
      timing.total({ result: "invalid_request" });
      return NextResponse.json(
        { error: "viewMode, startDate, and endDate are required" },
        { status: 400 }
      );
    }

    const viewMode = viewParam as TimelineViewMode;
    const filters: PlannerTimelineFilters = {
      category: request.nextUrl.searchParams.get("category"),
      status: request.nextUrl.searchParams.get("status"),
    };
    const data = await fetchPlannerTimeline(session, {
      viewMode,
      resolution: getTimelineResolution(viewMode),
      startDate,
      endDate,
      filters,
    }, { timing });

    const body = { success: true, data };
    const responseBytes = Buffer.byteLength(JSON.stringify(body), "utf8");

    timing.phase("response_payload", {
      bytes: responseBytes,
      assignmentCount: data.assignments.length,
      actualAssignmentCount: data.actualAssignments.length,
    });
    timing.total({ result: "success" });

    return NextResponse.json(body);
  } catch (error) {
    timing.total({ result: "error" });
    console.error("[API /planner/timeline] Failed to load planner timeline:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load planner timeline",
      },
      { status: 500 }
    );
  }
}
