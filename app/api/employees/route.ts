import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { fetchOrderedEmployeeSlice } from "@/lib/employees/ordered-directory";
import { createRequestTiming } from "@/lib/observability/request-timing";

export async function GET(request: Request) {
  const timing = createRequestTiming("employees_api");

  try {
    // Get session and check authentication
    const session = await getSession();
    if (!session) {
      timing.total({ result: "unauthenticated" });
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");
    const search = searchParams.get("search");

    const perPage = limit ? parseInt(limit, 10) : 50;
    const requestedOffset = offset ? parseInt(offset, 10) : 0;
    const employeeSlice = await fetchOrderedEmployeeSlice(session, {
      offset: requestedOffset,
      limit: perPage,
      search: search || undefined,
    });
    timing.phase(session.access.can_view_all ? "directory_page" : "restricted_lookup", {
      cacheStatus: employeeSlice.cacheStatus,
      total: employeeSlice.total,
    });
    timing.total({
      result: "success",
      access: session.access.can_view_all ? "full" : "restricted",
    });

    return NextResponse.json({
      success: true,
      data: employeeSlice.data,
      total: employeeSlice.total,
      hasMore: employeeSlice.hasMore,
    });
  } catch (error) {
    timing.total({ result: "error" });
    console.error("Failed to fetch employees:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch employees",
        data: [],
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  // Check authentication
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  // Check authorization - only full access users can create employees
  if (!session.access.can_view_all) {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    );
  }

  return NextResponse.json(
    { success: false, error: "Creating employees via MySQL API not yet implemented" },
    { status: 501 }
  );
}
