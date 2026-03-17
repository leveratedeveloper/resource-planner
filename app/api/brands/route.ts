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

    console.log('[Brands API] MySQL response:', JSON.stringify(response, null, 2));

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

    // PERFORMANCE: Only fetch campaigns/pitches on first page without search
    // This ensures we get all brands that are referenced by campaigns/pitches
    let mergedBrands = actualData;

    if (!search && page === 1) {
      // Fetch campaigns and pitches to get all referenced brand_ids
      // Then match them with brands from the brands endpoint (which now includes brand_id)
      console.log('[Brands API] Fetching campaigns and pitches to get referenced brand_ids...');

      try {
        const [campaignsResponse, pitchesResponse] = await Promise.all([
          client.getCampaigns({ page: 1, per_page: 100 }).catch(err => {
            console.error('[Brands API] Failed to fetch campaigns:', err);
            return { data: [] };
          }),
          client.getPitches({ page: 1, per_page: 100 }).catch(err => {
            console.error('[Brands API] Failed to fetch pitches:', err);
            return { data: [] };
          }),
        ]);

        const campaignsData = campaignsResponse?.data?.data || campaignsResponse?.data || [];
        const pitchesData = pitchesResponse?.data?.data || pitchesResponse?.data || [];

        console.log('[Brands API] Campaigns:', campaignsData.length, 'Pitches:', pitchesData.length);

        // Get unique brand_ids from campaigns and pitches
        const referencedBrandIds = new Set<number>();
        campaignsData.forEach((c: any) => c.brand_id && referencedBrandIds.add(c.brand_id));
        pitchesData.forEach((p: any) => p.brand_id && referencedBrandIds.add(p.brand_id));

        console.log('[Brands API] Referenced brand_ids:', Array.from(referencedBrandIds).slice(0, 10), '...');

        // Fetch ALL brands from the brands endpoint (all pages) to get complete data
        // The brands endpoint is paginated, so we need to fetch all pages
        console.log('[Brands API] Fetching all brands from brands endpoint...');
        const allBrandsFromEndpoint: any[] = [];
        let brandsPage = 1;
        let brandsHasMore = true;

        while (brandsHasMore) {
          const brandsResponse = await client.getBrands({ page: brandsPage, per_page: 100 });

          if (brandsResponse.error) {
            console.error('[Brands API] Error fetching brands page:', brandsPage, brandsResponse.error);
            break;
          }

          const brandsPageData = brandsResponse?.data?.data || brandsResponse?.data || [];
          allBrandsFromEndpoint.push(...brandsPageData);

          const brandsMeta = brandsResponse?.data?.meta || brandsResponse?.meta;
          brandsHasMore = brandsMeta?.current_page < brandsMeta?.last_page;
          brandsPage++;

          console.log('[Brands API] Fetched brands page:', brandsPage - 1, 'total so far:', allBrandsFromEndpoint.length);
        }

        console.log('[Brands API] Total brands from endpoint:', allBrandsFromEndpoint.length);

        // Create a map of brands from the brands endpoint, keyed by brand_id
        const brandsByNumericId = new Map<number, any>();
        allBrandsFromEndpoint.forEach((brand: any) => {
          if (brand.brand_id) {
            brandsByNumericId.set(brand.brand_id, brand);
          }
        });

        console.log('[Brands API] Brands from brands endpoint with brand_id:', brandsByNumericId.size);

        // Create the final brands list
        // Use brands from brands endpoint for referenced brand_ids
        // For unreferenced brand_ids, create minimal entries
        const brandsMap = new Map<string, any>();

        Array.from(referencedBrandIds).forEach((brandId) => {
          const stringId = String(brandId);
          const brandFromEndpoint = brandsByNumericId.get(brandId);

          if (brandFromEndpoint) {
            // Use complete data from brands endpoint
            console.log('[Brands API] Found brand for brand_id:', brandId, brandFromEndpoint.brand_name);
            brandsMap.set(stringId, {
              id: stringId,
              brand_id: brandId,
              uuid: brandFromEndpoint.uuid,
              brand_name: brandFromEndpoint.brand_name,
              company_name: brandFromEndpoint.company_name,
              brand_address: brandFromEndpoint.brand_address,
              client_code: brandFromEndpoint.client_code,
              logo: brandFromEndpoint.logo,
              brand_website: brandFromEndpoint.brand_website,
              pic_brand_name: brandFromEndpoint.pic_brand_name,
              pic_title: brandFromEndpoint.pic_title,
              pic_email: brandFromEndpoint.pic_email,
              pic_brand_phone: brandFromEndpoint.pic_brand_phone,
              pic_finance_name: brandFromEndpoint.pic_finance_name,
              pic_finance_phone: brandFromEndpoint.pic_finance_phone,
              industry_category: brandFromEndpoint.industry_category,
              description: brandFromEndpoint.description,
              flag: brandFromEndpoint.flag,
              created_at: brandFromEndpoint.created_at,
              updated_at: brandFromEndpoint.updated_at,
              source: 'brands-endpoint',
            });
          } else {
            // Brand not found in brands endpoint, create minimal entry
            brandsMap.set(stringId, {
              id: stringId,
              brand_id: brandId,
              uuid: null,
              brand_name: `Brand ${brandId}`,
              company_name: null,
              brand_address: null,
              client_code: null,
              logo: null,
              brand_website: null,
              pic_brand_name: null,
              pic_title: null,
              pic_email: null,
              pic_brand_phone: null,
              pic_finance_name: null,
              pic_finance_phone: null,
              industry_category: null,
              description: null,
              flag: 'prospect',
              created_at: null,
              updated_at: null,
              source: 'fallback',
            });
          }
        });

        mergedBrands = Array.from(brandsMap.values());

        console.log('[Brands API] Final brands count:', {
          total: mergedBrands.length,
          fromBrandsEndpoint: mergedBrands.filter((b: any) => b.source === 'brands-endpoint').length,
          fallback: mergedBrands.filter((b: any) => b.source === 'fallback').length,
          withActualNames: mergedBrands.filter((b: any) => !b.brand_name?.startsWith('Brand ')).length,
        });
      } catch (error) {
        // If campaigns/pitches fetch fails, just use the brands from the brands endpoint
        console.error('[Brands API] Failed to fetch campaigns/pitches, using brands endpoint only:', error);
        mergedBrands = actualData;
      }
    }

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

    console.log('[Brands API] Processed response:', {
      dataLength: mergedBrands.length,
      total,
      currentPage,
      lastPage,
      hasMore,
      hasMeta: !!meta,
      sampleBrand: mergedBrands[0] ? Object.keys(mergedBrands[0]) : [],
    });

    // Transform MySQL response to match expected format
    // Note: Use brand_id (numeric) to match with campaigns/pitches
    const transformedBrands = mergedBrands.map((brand: any) => {
      // Use brand_id first (for campaigns/pitches compatibility), then fall back to uuid/id
      const brandId = String(brand.id || brand.brand_id || brand.uuid);

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

    console.log('[Brands API] Final transformed brands sample:', transformedBrands.slice(0, 3).map(b => ({ id: b.id, name: b.name, original: mergedBrands.find((mb: any) => mb.brand_name === b.name)?.id || mergedBrands.find((mb: any) => mb.brand_name === b.name)?.brand_id })));

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
