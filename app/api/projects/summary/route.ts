import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { fetchProjectSummaries } from "@/lib/projects/project-summary-fetcher";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get("brandId") || undefined;
    const search = searchParams.get("search") || undefined;

    const result = await fetchProjectSummaries({
      brandId,
      search,
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      total: result.data.length,
      hasMore: result.hasMore,
      truncated: result.truncated,
    });
  } catch (error) {
    console.error("[Projects Summary API] Failed to fetch project summaries:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch project summaries",
        data: [],
        total: 0,
        hasMore: false,
        truncated: false,
      },
      { status: 500 }
    );
  }
}
