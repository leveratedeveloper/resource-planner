import { NextResponse } from "next/server";
import { getMySqlApiClient } from "@/lib/mysql/api-client";
import { getSession } from "@/lib/auth/session";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  try {
    // Get session and check authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Await params (Next.js 15 requirement)
    const { type, id } = await params;

    // Validate project type
    const validTypes = ['campaign', 'pitch', 'operational', 'rnd'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: `Invalid project type: ${type}` },
        { status: 400 }
      );
    }

    // Get API client with session token
    const client = getMySqlApiClient(async () => session.access_token);

    // Map singular project type to plural API endpoint
    const typeToEndpoint: Record<string, string> = {
      campaign: 'campaigns',
      pitch: 'pitches',
      operational: 'operationals',
      rnd: 'rnds',
    };
    const endpoint = typeToEndpoint[type] || type;

    // Call MySQL API endpoint for project deliverables
    const response = await client.request<any>(`/${endpoint}/${id}/deliverables`);

    console.log('[Project Deliverables API] Raw MySQL response:', JSON.stringify(response, null, 2));

    // Check for API errors from the client
    if (response.error) {
      console.error('[Project Deliverables API] MySQL API returned an error:', response.error);
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

    // Transform MySQL response to match expected format
    return NextResponse.json({
      success: response.success ?? true,
      data: actualData.map((del: any) => ({
        id: String(del.id),
        channelId: del.channel_id ? String(del.channel_id) : null,
        deliverableName: del.deliverable_name,
        deliverableNameNew: del.deliverable_name_new || null,
        flag: del.flag || 'active',
        channel: del.channel ? {
          id: String(del.channel.id),
          channelName: del.channel.channel_name_new || del.channel.channel_name,
        } : null,
      })),
    });
  } catch (error) {
    console.error("Failed to fetch project deliverables:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch project deliverables",
        data: [],
      },
      { status: 500 }
    );
  }
}
