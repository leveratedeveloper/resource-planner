import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { fetchPlannerFilterProjects } from "@/lib/query/server/planner-filter-projects";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const offset = Number.parseInt(searchParams.get("offset") || "0", 10);
    const limit = Number.parseInt(searchParams.get("limit") || "100", 10);
    const brandId = searchParams.get("brandId");
    const status = searchParams.get("status");
    const sourceType = searchParams.get("sourceType");
    const search = searchParams.get("search");
    const selectedProjectId = searchParams.get("selectedProjectId");

    const result = await fetchPlannerFilterProjects({
      offset,
      limit,
      brandId,
      status,
      sourceType,
      search,
      selectedProjectId,
    });

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
