import { NextResponse } from "next/server";
import { getMySqlApiClient } from "@/lib/mysql/api-client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");
    const search = searchParams.get("search");

    const client = getMySqlApiClient();

    // MySQL API uses page-based pagination, convert offset to page
    const perPage = limit ? parseInt(limit, 10) : 50;
    const page = offset ? Math.floor(parseInt(offset, 10) / perPage) + 1 : 1;

    // Fetch brands from API
    const response = await client.getBrands({
      page,
      per_page: perPage,
      search: search || undefined,
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

    // Handle double-wrapped response: response.data.data instead of response.data
    const actualData = response?.data?.data || response?.data || [];

    // Transform MySQL response to match expected format
    return NextResponse.json({
      success: response.success,
      data: actualData.map((brand: any) => ({
        id: brand.uuid,
        name: brand.brand_name,
        businessUnitId: null,
        companyName: brand.company_name,
        brandAddress: brand.brand_address,
        clientCode: brand.client_code,
        color: '#' + Math.floor(Math.random()*16777215).toString(16),
        logo: brand.logo,
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
      })),
      total: (response?.data?.meta || response?.meta)?.total || actualData.length,
      hasMore: (response?.data?.meta || response?.meta) ? (response?.data?.meta || response?.meta).current_page < (response?.data?.meta || response?.meta).last_page : false,
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
