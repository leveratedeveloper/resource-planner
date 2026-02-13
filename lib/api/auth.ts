/**
 * API Auth Helper
 * Lightweight bearer-token validation for protected API routes.
 * If API_SECRET_KEY is not set in environment, auth is bypassed (development mode).
 */

import { NextRequest, NextResponse } from "next/server";

/**
 * Validate API authentication via Bearer token.
 * Returns null on success, or a NextResponse 401 on failure.
 * If API_SECRET_KEY is not configured, auth is bypassed.
 */
export function validateApiAuth(request: NextRequest): NextResponse | null {
  const secretKey = process.env.API_SECRET_KEY;

  // If no secret key is configured, skip auth (development mode)
  if (!secretKey) {
    return null;
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Missing or invalid Authorization header. Use: Bearer <token>" },
      { status: 401 }
    );
  }

  const token = authHeader.slice(7);
  if (token !== secretKey) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Invalid API token" },
      { status: 401 }
    );
  }

  return null;
}
