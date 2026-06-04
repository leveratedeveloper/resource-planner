import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { fetchPlannerHomeBootstrap } from "@/lib/query/server/planner-home-bootstrap";
import {
  getTimelineResolution,
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

function boundedInteger(value: string | null, fallback: number, min: number, max: number) {
  const parsed = value ? Number.parseInt(value, 10) : fallback;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

export async function GET(request: NextRequest) {
  const timing = createRequestTiming("planner_home_bootstrap_api");

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
    const employeeLimit = boundedInteger(request.nextUrl.searchParams.get("employeeLimit"), 24, 1, 100);
    const employeeOffset = boundedInteger(request.nextUrl.searchParams.get("employeeOffset"), 0, 0, 100_000);

    const data = await fetchPlannerHomeBootstrap(session, {
      viewMode,
      resolution: getTimelineResolution(viewMode),
      startDate,
      endDate,
      filters: {
        category: request.nextUrl.searchParams.get("category"),
        status: request.nextUrl.searchParams.get("status"),
      },
      employeeLimit,
      employeeOffset,
      brandId: request.nextUrl.searchParams.get("brandId"),
      department: request.nextUrl.searchParams.get("department"),
      projectId: request.nextUrl.searchParams.get("projectId"),
      search: request.nextUrl.searchParams.get("search"),
    });

    const body = { success: true, data };
    timing.phase("response_payload", {
      bytes: Buffer.byteLength(JSON.stringify(body), "utf8"),
      employees: data.employees.length,
      assignments: data.plannerTimeline.assignments.length,
      actualAssignments: data.plannerTimeline.actualAssignments.length,
      metadataPartial: data.metadataPartial,
    });
    timing.total({ result: "success" });

    return NextResponse.json(body);
  } catch (error) {
    timing.total({ result: "error" });
    console.error("[API /planner/home-bootstrap] Failed to load planner home bootstrap:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load planner home bootstrap",
      },
      { status: 500 }
    );
  }
}
