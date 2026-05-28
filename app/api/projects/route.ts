import { NextResponse } from "next/server";
import { getMySqlApiClient } from "@/lib/mysql/api-client";
import { getSession } from "@/lib/auth/session";
import {
  mapCampaignToProject,
  mapCampaignToProjectSummary,
  mapPitchToProject,
  mapPitchToProjectSummary,
  type CampaignApiRecord,
  type PitchApiRecord,
} from "@/lib/projects/project-mappers";

export async function GET(request: Request) {
  try {
    // Get session for authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get("brandId");
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");
    const search = searchParams.get("search");
    const fields = searchParams.get("fields");
    const isSummary = fields === "summary";

    // Get API client with session token
    const client = getMySqlApiClient(async () => session.access_token);

    // MySQL API uses page-based pagination, convert offset to page
    const perPage = limit ? parseInt(limit, 10) : 50;
    const page = offset ? Math.floor(parseInt(offset, 10) / perPage) + 1 : 1;

    // Fetch both campaigns and pitches in parallel
    const [campaignsResponse, pitchesResponse] = await Promise.all([
      client.getCampaigns({
        page,
        per_page: perPage,
        search: search || undefined,
        brand_id: brandId || undefined,
        include: isSummary ? undefined : "channels",
      }),
      client.getPitches({
        page,
        per_page: perPage,
        search: search || undefined,
        brand_id: brandId || undefined,
        include: isSummary ? undefined : "channels",
      }),
    ]);

    // Check for error responses - return early if both failed
    if (campaignsResponse?.error && pitchesResponse?.error) {
      console.error('[Projects API] Both campaigns and pitches failed');
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch campaigns and pitches',
          campaignsError: campaignsResponse.error.message,
          pitchesError: pitchesResponse.error.message,
          data: [],
        },
        { status: 500 }
      );
    }

    // Get actual data from responses - handle various possible response structures
    // MySQL API might return: { success: true, data: [...] } or { success: true, data: { data: [...], meta: {...} } }
    const campaignsData = campaignsResponse?.data?.data || campaignsResponse?.data || [];
    const pitchesData = pitchesResponse?.data?.data || pitchesResponse?.data || [];

    // Transform campaigns to projects
    const campaignProjects = (campaignsData as CampaignApiRecord[]).map((campaign) =>
      isSummary ? mapCampaignToProjectSummary(campaign) : mapCampaignToProject(campaign)
    );

    // Transform pitches to projects
    const pitchProjects = (pitchesData as PitchApiRecord[]).map((pitch) =>
      isSummary ? mapPitchToProjectSummary(pitch) : mapPitchToProject(pitch)
    );

    // Combine both project types
    const data = [...campaignProjects, ...pitchProjects];

    // No client-side filtering needed - MySQL API handles it
    const filteredData = data;

    // Combine totals from both responses
    const campaignsMeta = campaignsResponse?.data?.meta || campaignsResponse?.meta;
    const pitchesMeta = pitchesResponse?.data?.meta || pitchesResponse?.meta;
    const total = (campaignsMeta?.total || 0) + (pitchesMeta?.total || 0);

    // Calculate hasMore based on combined pagination
    const lastPage = Math.max(campaignsMeta?.last_page || 1, pitchesMeta?.last_page || 1);
    const hasMore = page < lastPage;

    return NextResponse.json({
      success: campaignsResponse.success && pitchesResponse.success,
      data: filteredData,
      total: total,
      hasMore: hasMore,
    });
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}
