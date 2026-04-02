import { NextResponse } from "next/server";

export async function GET() {
  const baseUrl = process.env.TIMETRACK_API_URL || 'http://127.0.0.1:8000/api/v1';

  try {
    // Test if base URL is accessible
    const response = await fetch(baseUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const text = await response.text();

    return NextResponse.json({
      baseUrl,
      status: response.status,
      statusText: response.statusText,
      responsePreview: text.substring(0, 500),
    });
  } catch (error) {
    return NextResponse.json({
      baseUrl,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
