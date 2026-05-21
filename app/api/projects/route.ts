import { NextResponse } from "next/server";
import { getMySqlApiClient } from "@/lib/mysql/api-client";
import { getSession } from "@/lib/auth/session";

type RawProjectChannel = Record<string, unknown>;

type RawCampaign = {
  uuid?: string;
  io_number?: string | null;
  campaign_name?: string;
  brand_id?: string | number | null;
  company_id?: string | number | null;
  currency?: string;
  budget?: string | number | null;
  asf?: string | number | null;
  grand_total?: string | number | null;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
  io_file?: string | null;
  state?: string | null;
  flag?: string | null;
  quotation_reference?: string | null;
  created_at?: string;
  updated_at?: string;
  brand?: {
    brand_name?: string;
  };
  company?: unknown;
  channels?: RawProjectChannel[];
};

type RawPitch = {
  uuid?: string;
  pitch_number?: string | null;
  pitch_name?: string;
  brand_id?: string | number | null;
  currency?: string;
  budget?: string | number | null;
  value_total?: string | number | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  author?: {
    uuid?: string;
  };
  region?: string | null;
  date_submit?: string | null;
  status?: string | null;
  brand?: {
    brand_name?: string;
  };
  channels?: RawProjectChannel[];
};

function transformCampaignLikeToProject(campaign: RawCampaign, type: 'campaign' | 'operational' | 'rnd') {
  if (campaign.channels && campaign.channels.length > 0) {
    console.log(`[Projects API] ${type} ${campaign.campaign_name} channels:`, campaign.channels.length);
  }
  return {
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
    projectType: type,
    entity: null,
    description: null,
    color: '#' + Math.floor(Math.random()*16777215).toString(16),
    createdById: null,
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
  };
}

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

    // Fetch campaigns, pitches, operationals, and rnds in parallel
    const [campaignsResponse, pitchesResponse, operationalsResponse, rndsResponse] = await Promise.all([
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
      client.getOperationals({
        page,
        per_page: perPage,
        search: search || undefined,
        brand_id: brandId || undefined,
        include: 'channels',
      }),
      client.getRnds({
        page,
        per_page: perPage,
        search: search || undefined,
        brand_id: brandId || undefined,
        include: 'channels',
      }),
    ]);

    // Check for error responses - return early if all failed
    if (campaignsResponse?.error && pitchesResponse?.error && operationalsResponse?.error && rndsResponse?.error) {
      console.error('[Projects API] All project types failed');
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch all project types',
          data: [],
        },
        { status: 500 }
      );
    }

    // Get actual data from responses
    const campaignsData = ((campaignsResponse?.data?.data || campaignsResponse?.data || []) as RawCampaign[]);
    const pitchesData = ((pitchesResponse?.data?.data || pitchesResponse?.data || []) as RawPitch[]);
    const operationalsData = ((operationalsResponse?.data?.data || operationalsResponse?.data || []) as RawCampaign[]);
    const rndsData = ((rndsResponse?.data?.data || rndsResponse?.data || []) as RawCampaign[]);

    console.log('[Projects API] Fetched projects:', {
      campaigns: campaignsData.length,
      pitches: pitchesData.length,
      operationals: operationalsData.length,
      rnds: rndsData.length,
      page,
      perPage,
      search: Boolean(search),
      brandId: brandId || null,
    });

    // Transform campaigns, operationals, and rnds using shared helper
    const campaignProjects = campaignsData.map((c) => transformCampaignLikeToProject(c, 'campaign'));
    const operationalProjects = operationalsData.map((o) => transformCampaignLikeToProject(o, 'operational'));
    const rndProjects = rndsData.map((r) => transformCampaignLikeToProject(r, 'rnd'));

    // Transform pitches to projects (different data model)
    const pitchProjects = pitchesData.map((pitch) => ({
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

    // Combine all project types
    const data = [...campaignProjects, ...pitchProjects, ...operationalProjects, ...rndProjects];

    // No client-side filtering needed - MySQL API handles it
    const filteredData = data;

    // Combine totals from all responses
    const campaignsMeta = campaignsResponse?.data?.meta || campaignsResponse?.meta;
    const pitchesMeta = pitchesResponse?.data?.meta || pitchesResponse?.meta;
    const operationalsMeta = operationalsResponse?.data?.meta || operationalsResponse?.meta;
    const rndsMeta = rndsResponse?.data?.meta || rndsResponse?.meta;
    const total = (campaignsMeta?.total || 0) + (pitchesMeta?.total || 0) + (operationalsMeta?.total || 0) + (rndsMeta?.total || 0);

    // Calculate hasMore based on combined pagination
    const lastPage = Math.max(
      campaignsMeta?.last_page || 1,
      pitchesMeta?.last_page || 1,
      operationalsMeta?.last_page || 1,
      rndsMeta?.last_page || 1
    );
    const hasMore = page < lastPage;

    return NextResponse.json({
      success: campaignsResponse.success && pitchesResponse.success && operationalsResponse.success && rndsResponse.success,
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
