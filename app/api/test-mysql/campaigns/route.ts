import { NextResponse } from "next/server";
import { getMySqlAuthManager } from "@/lib/mysql/auth";

export async function GET() {
  const baseUrl = process.env.MYSQL_API_BASE_URL || 'http://127.0.0.1:8000/api/v1';
  const authManager = getMySqlAuthManager();

  try {
    const token = await authManager.getToken();

    console.log('[Test Campaigns] Calling MySQL API at:', `${baseUrl}/campaigns`);
    console.log('[Test Campaigns] Token:', token ? token.substring(0, 20) + '...' : 'No token');

    const response = await fetch(`${baseUrl}/campaigns`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const text = await response.text();

    console.log('[Test Campaigns] Response status:', response.status);
    console.log('[Test Campaigns] Response text:', text.substring(0, 500));

    return NextResponse.json({
      url: `${baseUrl}/campaigns`,
      status: response.status,
      statusText: response.statusText,
      response: text.substring(0, 2000),
      headers: Object.fromEntries(response.headers.entries()),
    });
  } catch (error) {
    console.error('[Test Campaigns] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
