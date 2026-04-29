import { NextResponse } from "next/server";
import { getMySqlApiClient } from "@/lib/mysql/api-client";
import { getSession } from "@/lib/auth/session";

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

    // Get API client with session token
    const client = getMySqlApiClient(async () => session.access_token);

    // MySQL API uses page-based pagination, convert offset to page
    const perPage = limit ? parseInt(limit, 10) : 50;
    const page = offset ? Math.floor(parseInt(offset, 10) / perPage) + 1 : 1;

    // Fetch both campaigns and pitches in parallel (include channels for deliverables)
    const [campaignsResponse, pitchesResponse] = await Promise.all([
      client.getCampaigns({
        page,
        per_page: perPage,
        search: search || undefined,
        brand_id: brandId || undefined,
        include: 'channels',
      }),
      client.getPitches({
        page,
        per_page: perPage,
        search: search || undefined,
        brand_id: brandId || undefined,
        include: 'channels',
      }),
    ]);

    // Debug logging - show full response to diagnose issues
    console.log('[Projects API] Campaigns FULL response:', JSON.stringify(campaignsResponse, null, 2));
    console.log('[Projects API] Pitches FULL response:', JSON.stringify(pitchesResponse, null, 2));

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

    console.log('[Projects API] Campaigns count:', campaignsData.length);
    console.log('[Projects API] Pitches count:', pitchesData.length);

    // Transform campaigns to projects
    const campaignProjects = campaignsData.map((campaign: any) => ({
      id: campaign.uuid,
      projectNumber: campaign.io_number,
      name: campaign.campaign_name,
      brandId: campaign.brand_id !== null && campaign.brand_id !== undefined ? String(campaign.brand_id) : null,
      companyId: String(campaign.company_id),
      currency: campaign.currency,
      budget: campaign.budget,
      asf: campaign.asf,
      grandTotal: campaign.grand_total,
      startDate: campaign.start_date,
      endDate: campaign.end_date,
      notes: campaign.notes,
      ioFile: campaign.io_file,
      state: campaign.state,
      status: campaign.flag === 'active' ? 'active' : campaign.flag === 'inactive' ? 'completed' : 'planning',
      quotationReference: campaign.quotation_reference,
      createdAt: campaign.created_at,
      updatedAt: campaign.updated_at,
      businessUnitId: null,
      projectCategoryId: null,
      projectTypeId: null,
      projectType: 'campaign' as const,
      entity: null,
      description: null,
      color: '#' + Math.floor(Math.random()*16777215).toString(16),
      createdById: null,
      // Pitch-specific fields (null for campaigns)
      region: null,
      submitDate: null,
      pitchStatus: null,
      valueTotalEstimate: null,
      hsDealId: null,
      brand: campaign.brand ? {
        id: String(campaign.brand_id),
        name: campaign.brand.brand_name,
        color: '#' + Math.floor(Math.random()*16777215).toString(16),
      } : undefined,
      company: campaign.company,
      channels: campaign.channels,
    }));

    // Transform pitches to projects
    const pitchProjects = pitchesData.map((pitch: any) => ({
      id: pitch.uuid,
      projectNumber: pitch.pitch_number,
      name: pitch.pitch_name,
      brandId: pitch.brand_id !== null && pitch.brand_id !== undefined ? String(pitch.brand_id) : null,
      companyId: null,
      currency: pitch.currency,
      budget: pitch.budget,
      asf: null,
      grandTotal: pitch.value_total,
      startDate: null,
      endDate: null,
      notes: pitch.notes,
      ioFile: null,
      state: null,
      status: pitch.status === 'win' ? 'completed' : pitch.status === 'loss' ? 'cancelled' : 'planning',
      quotationReference: null,
      createdAt: pitch.created_at,
      updatedAt: pitch.updated_at,
      businessUnitId: null,
      projectCategoryId: null,
      projectTypeId: null,
      projectType: 'pitch' as const,
      entity: null,
      description: null,
      color: '#' + Math.floor(Math.random()*16777215).toString(16),
      createdById: pitch.author?.uuid || null,
      // Pitch-specific fields
      region: pitch.region || null,
      submitDate: pitch.date_submit || null,
      pitchStatus: pitch.status === 'on_going' ? 'proposal_development' : pitch.status === 'win' ? 'won' : pitch.status === 'loss' ? 'lost' : null,
      valueTotalEstimate: pitch.value_total ? String(pitch.value_total) : null,
      hsDealId: null,
      brand: pitch.brand ? {
        id: String(pitch.brand_id),
        name: pitch.brand.brand_name,
        color: '#' + Math.floor(Math.random()*16777215).toString(16),
      } : undefined,
      company: null,
      channels: pitch.channels,
    }));

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
