import { NextResponse } from "next/server";
import { getMySqlApiClient } from "@/lib/mysql/api-client";
import { getSession } from "@/lib/auth/session";

export async function GET(request: Request) {
  try {
    // Get session for token
    const session = await getSession();
    if (!session?.access_token) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Get search params for pagination/filtering
    const { searchParams } = new URL(request.url);
    const params: any = {
      page: searchParams.get("page") || "1",
      per_page: searchParams.get("per_page") || "1000",
      search: searchParams.get("search") || "",
      include: searchParams.get("include") || "",
    };

    // Use MySQL API client
    const client = getMySqlApiClient(async () => session.access_token as string);
    const response = await client.getChannelClassifications(params);

    if (!response.success) {
      return NextResponse.json(
        { success: false, error: response.message || "Failed to fetch channel classifications from Timetrack" },
        { status: 500 }
      );
    }

    // Map Timetrack data to our application format
    const actualData = response.data || [];
    
    return NextResponse.json({
      success: true,
      data: actualData.map((channel: any) => ({
        id: String(channel.id),
        pillarsId: channel.pillars_id || null,
        channelName: channel.channel_name || "",
        channelNameNew: channel.channel_name_new || null,
        flag: String(channel.flag || "1"), // Ensure string flag for frontend consistency
        createdAt: channel.created_at || "",
        updatedAt: channel.updated_at || "",
        deliverables: channel.deliverables || [],
      })),
      total: response.meta?.total || actualData.length,
      hasMore: response.meta ? (response.meta.current_page < response.meta.last_page) : false,
    });
  } catch (error) {
    console.error("Failed to fetch channel classifications:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch channel classifications" },
      { status: 500 }
    );
  }
}
