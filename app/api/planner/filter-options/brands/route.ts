import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { fetchPlannerFilterBrands } from "@/lib/query/server/planner-filter-brands";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const offset = Number.parseInt(searchParams.get("offset") || "0", 10);
    const limit = Number.parseInt(searchParams.get("limit") || "50", 10);
    const search = searchParams.get("search");
    const selectedBrandId = searchParams.get("selectedBrandId");

    const result = await fetchPlannerFilterBrands({
      offset,
      limit,
      search,
      selectedBrandId,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[Planner Filter Brands API] Failed to fetch brands:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch brands",
        data: null,
      },
      { status: 500 }
    );
  }
}
