import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { fetchPlannerTimeline } from "@/lib/query/server/planner-prefetch";
import {
  getTimelineResolution,
  type PlannerTimelineFilters,
  type TimelineViewMode,
} from "@/lib/timeline/planner-loading";

const VIEW_MODES = new Set<TimelineViewMode>([
  "week",
  "month",
  "quarter",
  "halfYear",
  "year",
]);

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const viewParam = request.nextUrl.searchParams.get("viewMode");
    const startDate = request.nextUrl.searchParams.get("startDate");
    const endDate = request.nextUrl.searchParams.get("endDate");

    if (!viewParam || !VIEW_MODES.has(viewParam as TimelineViewMode) || !startDate || !endDate) {
      return NextResponse.json(
        { error: "viewMode, startDate, and endDate are required" },
        { status: 400 }
      );
    }

    const viewMode = viewParam as TimelineViewMode;
    const filters: PlannerTimelineFilters = {
      brandId: request.nextUrl.searchParams.get("brandId"),
      department: request.nextUrl.searchParams.get("department"),
      projectId: request.nextUrl.searchParams.get("projectId"),
      category: request.nextUrl.searchParams.get("category"),
      status: request.nextUrl.searchParams.get("status"),
    };
    const data = await fetchPlannerTimeline(session, {
      viewMode,
      resolution: getTimelineResolution(viewMode),
      startDate,
      endDate,
      filters,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
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
