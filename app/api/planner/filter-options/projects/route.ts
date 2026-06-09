import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { fetchPlannerFilterProjects } from "@/lib/query/server/planner-filter-projects";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const result = await fetchPlannerFilterProjects();

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
