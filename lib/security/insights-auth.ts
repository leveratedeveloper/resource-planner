/**
 * Insights API Authentication Guard
 * Bearer-token validation using constant-time comparison for POST /api/insights.
 *
 * Environment variable: INSIGHTS_API_TOKEN
 * If not set, auth is bypassed (development mode).
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

/**
 * Perform constant-time string comparison to prevent timing attacks.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Compare against self so timing is consistent regardless of length mismatch
    const buf = Buffer.from(a, "utf8");
    timingSafeEqual(buf, buf);
    return false;
  }
  return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

/**
 * Validate insights-specific API authentication via Bearer token.
 * Returns null on success, or a 401 NextResponse on failure.
 */
export function validateInsightsAuth(
  request: NextRequest,
  analysisType?: string
): NextResponse | null {
  const expectedToken = process.env.INSIGHTS_API_TOKEN;

  // If no token configured, fail-closed in production, warn in development
  if (!expectedToken) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[insights-auth] INSIGHTS_API_TOKEN is not set in production. Rejecting request."
      );
      return NextResponse.json(
        {
          error: "Service unavailable",
          message:
            "INSIGHTS_API_TOKEN is not configured. Authentication cannot proceed.",
        },
        { status: 403 }
      );
    }
    // Development: bypass with a one-time warning
    console.warn(
      `[insights-auth] INSIGHTS_API_TOKEN not set – auth bypassed (dev). ` +
      `analysisType=${analysisType ?? "unknown"}`
    );
    return null;
  }

  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    const suffix = "(none)";
    console.warn(
      `[insights-auth] Blocked: missing/malformed header | analysisType=${analysisType ?? "unknown"} | tokenSuffix=${suffix}`
    );
    return NextResponse.json(
      {
        error: "Unauthorized",
        message:
          "Missing or invalid Authorization header. Use: Bearer <token>",
      },
      { status: 401 }
    );
  }

  const token = authHeader.slice(7);

  if (!constantTimeEqual(token, expectedToken)) {
    const suffix = token.length >= 4 ? token.slice(-4) : "****";
    console.warn(
      `[insights-auth] Blocked: invalid token | analysisType=${analysisType ?? "unknown"} | tokenSuffix=...${suffix}`
    );
    return NextResponse.json(
      { error: "Unauthorized", message: "Invalid API token" },
      { status: 401 }
    );
  }

  return null;
}
