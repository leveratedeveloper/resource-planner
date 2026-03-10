import { NextResponse } from 'next/server';
import { getMySqlApiClient } from '@/lib/mysql/api-client';

/**
 * GET /api/mysql-bridge/campaigns
 * Proxy endpoint for fetching campaigns from MySQL API
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') || '1';
    const perPage = searchParams.get('per_page') || '50';
    const search = searchParams.get('search') || undefined;

    const client = getMySqlApiClient();
    const response = await client.getCampaigns({
      page: parseInt(page, 10),
      per_page: parseInt(perPage, 10),
      search,
    });

    // Check for API errors from the client
    if (response.error) {
      console.error('[MySQL Bridge] Campaigns API error:', response.error);
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

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to fetch MySQL campaigns:', error);

    const statusCode = error instanceof Error && 'statusCode' in error
      ? (error as { statusCode: number }).statusCode
      : 500;

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: [],
      },
      { status: statusCode }
    );
  }
}
