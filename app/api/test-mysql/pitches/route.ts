import { NextResponse } from "next/server";
import { getMySqlAuthManager } from "@/lib/mysql/auth";

export async function GET() {
  const baseUrl = process.env.MYSQL_API_BASE_URL || 'http://127.0.0.1:8000/api/v1';
  const authManager = getMySqlAuthManager();

  const endpoints = [
    '/pitches',
    '/brands',
    '/campaigns',
    '/employees',
  ];

  const results = await Promise.allSettled(
    endpoints.map(async (endpoint) => {
      try {
        const token = await authManager.getToken();

        console.log(`[Test MySQL] Testing ${endpoint}...`);

        const response = await fetch(`${baseUrl}${endpoint}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        const text = await response.text();
        const isHtml = text.trim().startsWith('<');

        let json;
        if (!isHtml) {
          try {
            json = JSON.parse(text);
          } catch {
            json = null;
          }
        }

        return {
          endpoint,
          url: `${baseUrl}${endpoint}`,
          status: response.status,
          statusText: response.statusText,
          contentType: response.headers.get('content-type'),
          isHtml,
          success: !isHtml && response.ok,
          responsePreview: text.substring(0, 500),
          json: json ? (typeof json === 'object' ? JSON.stringify(json, null, 2).substring(0, 500) : json) : null,
        };
      } catch (error) {
        return {
          endpoint,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    })
  );

  return NextResponse.json({
    baseUrl,
    results: results.map((r, i) => ({
      endpointUrl: endpoints[i],
      ...(r.status === 'fulfilled' ? r.value : { error: r.reason.message }),
    })),
  });
}
