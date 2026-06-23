import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  fetchPlannerFilterProjects,
  type PlannerFilterProjectsRequest,
} from "@/lib/query/server/planner-filter-projects";

function boundedInteger(value: string | null, fallback: number, min: number, max: number) {
  const parsed = value ? Number.parseInt(value, 10) : fallback;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const brandIdsParam = request.nextUrl.searchParams.get("brandIds");
    const brandIds = brandIdsParam ? brandIdsParam.split(",").map((id) => id.trim()).filter(Boolean) : null;
    const status = request.nextUrl.searchParams.get("status") as PlannerFilterProjectsRequest["status"];
    const sourceType = request.nextUrl.searchParams.get("sourceType") as PlannerFilterProjectsRequest["sourceType"];
    const limit = boundedInteger(request.nextUrl.searchParams.get("limit"), 50, 1, 100);
    const offset = boundedInteger(request.nextUrl.searchParams.get("offset"), 0, 0, 1_000_000);
    const search = request.nextUrl.searchParams.get("search");

    const result = await fetchPlannerFilterProjects({ brandIds, status, sourceType, search, limit, offset });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[Planner Filter Projects API] Failed to fetch projects:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch projects",
        data: null,
      },
      { status: 500 }
    );
  }
}
