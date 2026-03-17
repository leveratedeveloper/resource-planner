import { NextResponse } from "next/server";
import { getMySqlApiClient } from "@/lib/mysql/api-client";
import { getSession } from "@/lib/auth/session";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get("brandId");
    const brandName = searchParams.get("brandName");

    if (!brandId && !brandName) {
      return NextResponse.json(
        { error: 'brandId or brandName is required' },
        { status: 400 }
      );
    }

    const client = getMySqlApiClient(async () => session.access_token);

    // Fetch all brands and search for the matching one
    // The brands endpoint uses pagination, so we need to fetch all pages
    let allBrands: any[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await client.getBrands({ page, per_page: 100 });

      if (response.error) {
        console.error('[Brands Lookup API] Error fetching brands:', response.error);
        return NextResponse.json(
          { error: 'Failed to fetch brands' },
          { status: 500 }
        );
      }

      const brands = response?.data?.data || response?.data || [];
      allBrands = [...allBrands, ...brands];

      const meta = response?.data?.meta || response?.meta;
      hasMore = meta?.current_page < meta?.last_page;
      page++;
    }

    console.log('[Brands Lookup API] Searching for brand:', { brandId, brandName, totalBrands: allBrands.length });

    // Try to match by brand_id first (if available), then by name
    let matchedBrand = null;

    if (brandId) {
      // Some brands might have brand_id field
      matchedBrand = allBrands.find((b: any) =>
        String(b.id) === brandId || String(b.brand_id) === brandId
      );
    }

    if (!matchedBrand && brandName) {
      // Try exact match first
      matchedBrand = allBrands.find((b: any) => b.brand_name === brandName);

      // If no exact match, try case-insensitive match
      if (!matchedBrand) {
        matchedBrand = allBrands.find((b: any) =>
          b.brand_name?.toLowerCase() === brandName.toLowerCase()
        );
      }

      // If still no match, try partial match
      if (!matchedBrand) {
        matchedBrand = allBrands.find((b: any) =>
          b.brand_name?.toLowerCase().includes(brandName.toLowerCase()) ||
          brandName.toLowerCase().includes(b.brand_name?.toLowerCase())
        );
      }
    }

    if (!matchedBrand) {
      console.log('[Brands Lookup API] No matching brand found');
      return NextResponse.json(
        { success: false, error: 'Brand not found' },
        { status: 404 }
      );
    }

    console.log('[Brands Lookup API] Found brand:', {
      uuid: matchedBrand.uuid,
      brand_name: matchedBrand.brand_name,
      company_name: matchedBrand.company_name
    });

    // Transform to match expected format
    const transformedBrand = {
      id: matchedBrand.uuid, // Use UUID as ID for brands endpoint brands
      name: matchedBrand.brand_name,
      businessUnitId: null,
      companyName: matchedBrand.company_name,
      brandAddress: matchedBrand.brand_address,
      clientCode: String(matchedBrand.client_code || ''),
      color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'),
      logo: matchedBrand.logo || null,
      website: matchedBrand.brand_website,
      contactName: matchedBrand.pic_brand_name,
      contactTitle: matchedBrand.pic_title,
      contactEmail: matchedBrand.pic_email,
      contactPhone: matchedBrand.pic_brand_phone,
      picFinanceName: matchedBrand.pic_finance_name,
      picFinancePhone: matchedBrand.pic_finance_phone,
      industryCategory: matchedBrand.industry_category,
      description: matchedBrand.description,
      status: matchedBrand.flag === 'active' ? 'active' : matchedBrand.flag === 'inactive' ? 'inactive' : 'prospect',
      createdAt: matchedBrand.created_at,
      updatedAt: matchedBrand.updated_at,
    };

    return NextResponse.json({
      success: true,
      data: transformedBrand
    });
  } catch (error) {
    console.error('[Brands Lookup API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to lookup brand' },
      { status: 500 }
    );
  }
}
