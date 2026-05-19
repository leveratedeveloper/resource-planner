import { NextResponse } from "next/server";
import { getMySqlApiClient } from "@/lib/mysql/api-client";
import { getSession } from "@/lib/auth/session";

export async function GET(request: Request) {
  try {
    // Get session and check authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");
    const search = searchParams.get("search");

    // Get API client with session token
    const client = getMySqlApiClient(async () => session.access_token);

    // MySQL API uses page-based pagination, convert offset to page
    const perPage = limit ? parseInt(limit, 10) : 50;
    const page = offset ? Math.floor(parseInt(offset, 10) / perPage) + 1 : 1;

    const response = await client.getDepartments({
      page,
      per_page: perPage,
      search: search || undefined,
    });

    // Check for API errors from the client
    if (response.error) {
      console.error('[Departments API] MySQL API returned an error:', response.error);
      return NextResponse.json(
        {
          success: false,
          error: response.error.message,
          errorType: response.error.type,
          data: [],
        },
        { status: response.status === 200 ? 500 : response.status }
      );
    }

    // Handle double-wrapped response: response.data.data instead of response.data
    let actualData = response?.data?.data || response?.data || [];

    // Get pagination metadata from MySQL response
    const meta = response?.data?.meta || response?.meta || {};
    const mysqlTotal = meta.total || actualData.length;
    const currentPage = meta.current_page || page;
    const lastPage = meta.last_page || 1;

    // Transform MySQL response to match expected format
    return NextResponse.json({
      success: response.success,
      data: actualData.map((dept: any) => ({
        id: String(dept.id),
        businessUnitId: dept.business_unit_id ? String(dept.business_unit_id) : null,
        name: dept.department_name,
        code: dept.code || '',
        color: dept.color || '#' + Math.floor(Math.random() * 16777215).toString(16),
        description: dept.description || null,
        isActive: dept.is_active !== false,
        createdAt: dept.created_at,
        updatedAt: dept.updated_at,
      })),
      total: mysqlTotal,
      hasMore: currentPage < lastPage,
    });
  } catch (error) {
    console.error("Failed to fetch departments:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch departments",
        data: [],
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return NextResponse.json(
    { success: false, error: "Creating departments via MySQL API not yet implemented" },
    { status: 501 }
  );
}
