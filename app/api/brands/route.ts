import { NextResponse } from "next/server";
import { getMySqlApiClient } from "@/lib/mysql/api-client";
import { getSession } from "@/lib/auth/session";

// Simple in-memory cache for brands data
let brandsCache: {
  data: any[];
  timestamp: number;
} | null = null;

const CACHE_TTL = 1 * 60 * 1000; // 1 minute (faster refresh, minimal performance impact)

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

    // Only use cache for first page without search
    const useCache = !search && (searchParams.get("offset") || "0") === "0";

    // Check cache
    if (useCache && brandsCache && (Date.now() - brandsCache.timestamp) < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        data: brandsCache.data,
        total: brandsCache.data.length,
        hasMore: false,
      });
    }

    // Get API client with session token
    const client = getMySqlApiClient(async () => session.access_token);

    // MySQL API uses page-based pagination, convert offset to page
    // Use a large default per_page to ensure we get all brands in one request
    const perPage = limit ? parseInt(limit, 10) : 1000;
    const page = offset ? Math.floor(parseInt(offset, 10) / perPage) + 1 : 1;

    // Fetch brands from API with include=all to get all brands regardless of status
    const response = await client.getBrands({
      page,
      per_page: perPage,
      search: search || undefined,
      include: 'all', // Add this to bypass filtering and ensure all brands appear
    });

    // Check for API errors from the client
    if (response.error) {
      console.error('[Brands API] MySQL API returned an error:', response.error);
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

    // Handle nested response structure: response.data.data contains the actual brands array
    // The MySQL API returns: { data: { data: [...brands...], meta: {...} }, meta: {...}, links: {...} }
    let actualData = response?.data?.data || response?.data || [];

    // Use the actual data from the API
    let mergedBrands = actualData;

    // Extract meta data from either response.data.meta or response.meta
    const dataMeta = response?.data?.meta;
    const responseMeta = response?.meta;

    // Use dataMeta if available, otherwise fall back to responseMeta
    const meta = dataMeta || responseMeta;
    const total = mergedBrands.length;
    const currentPage = meta?.current_page ?? 1;
    const lastPage = meta?.last_page ?? 1;

    // Calculate hasMore based on whether we have data and there are more pages
    const hasMore = mergedBrands.length > 0 && currentPage < lastPage;

    // Transform MySQL response to match expected format
    // Note: Use brand_id (numeric) to match with campaigns/pitches
    const transformedBrands = mergedBrands.map((brand: any) => {
      // IMPORTANT: Prioritize brand_id over id to match with campaigns/pitches
      // campaigns API uses campaign.brand_id, pitches API uses pitch.brand_id
      const brandId = String(brand.brand_id || brand.id || brand.uuid);

      // Check if this is partial data (from campaigns/pitches without nested brand object)
      const isPartialData = brand.brand_name?.startsWith('Brand ') || !brand.company_name;

      return {
        id: brandId, // Convert to string for consistency
        name: brand.brand_name,
        businessUnitId: null,
        companyName: brand.company_name,
        brandAddress: brand.brand_address,
        clientCode: String(brand.client_code || ''),
        color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'),
        logo: brand.logo || null,
        website: brand.brand_website,
        contactName: brand.pic_brand_name,
        contactTitle: brand.pic_title,
        contactEmail: brand.pic_email,
        contactPhone: brand.pic_brand_phone,
        picFinanceName: brand.pic_finance_name,
        picFinancePhone: brand.pic_finance_phone,
        industryCategory: brand.industry_category,
        description: brand.description,
        status: brand.flag === 'active' ? 'active' : brand.flag === 'inactive' ? 'inactive' : 'prospect',
        createdAt: brand.created_at,
        updatedAt: brand.updated_at,
        // Metadata for fetching complete data
        _partialData: isPartialData,
        _originalBrandId: brand.brand_id || brandId,
      };
    });

    // Store in cache (only first page, no search)
    if (useCache) {
      brandsCache = {
        data: transformedBrands,
        timestamp: Date.now(),
      };
    }

    return NextResponse.json({
      success: response.success ?? true,
      data: transformedBrands,
      total,
      hasMore,
    });
  } catch (error) {
    console.error("Failed to fetch brands:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch brands",
        data: [],
      },
      { status: 500 }
    );
  }
}
