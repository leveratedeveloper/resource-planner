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
    const channelId = searchParams.get("channelId");

    // Get API client with session token
    const client = getMySqlApiClient(async () => session.access_token);

    // MySQL API uses page-based pagination, convert offset to page
    const perPage = limit ? parseInt(limit, 10) : 500;
    const page = offset ? Math.floor(parseInt(offset, 10) / perPage) + 1 : 1;

    // Use query params mapped to what Laravel expects
    const params: any = {
      page,
      per_page: perPage,
      search: search || undefined,
    };
    if (channelId) {
      params.channel_id = channelId;
    }

    const response = await client.getDeliverables(params);

    console.log('[Deliverables API] Raw MySQL response:', JSON.stringify(response, null, 2));

    // Check for API errors from the client
    if (response.error) {
      console.error('[Deliverables API] MySQL API returned an error:', response.error);
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
      success: response.success ?? true,
      data: actualData.map((del: any) => ({
        id: String(del.id),
        channelId: del.channel_id ? String(del.channel_id) : null,
        deliverableName: del.deliverable_name,
        deliverableNameNew: del.deliverable_name_new || null,
        flag: del.flag || 'active',
        createdAt: del.created_at,
        updatedAt: del.updated_at,
      })),
      total: mysqlTotal,
      hasMore: currentPage < lastPage,
    });
  } catch (error) {
    console.error("Failed to fetch deliverables:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch deliverables",
        data: [],
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return NextResponse.json(
    { success: false, error: "Creating deliverables via MySQL API not yet implemented" },
    { status: 501 }
  );
}
