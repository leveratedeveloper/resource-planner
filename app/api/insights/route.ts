/**
 * AI Insights API Route
 * POST /api/insights
 *
 * Flow: auth → validate → rate limit → OpenAI key check → handler
 *
 * Environment variables:
 *   INSIGHTS_API_TOKEN  – bearer token for authentication (optional in dev)
 *   OPENAI_API_KEY      – OpenAI API key for AI generation
 */

import { NextRequest, NextResponse } from "next/server";
import {
  generateCapacityRecommendations,
  generateConflictResolutions,
} from "@/lib/ai/recommendation-generator";
import { generateScenarioAnalysis } from "@/lib/ai/generate-scenario-analysis";
import { simulateScenario } from "@/lib/analysis/scenario-simulator";
import { validateInsightsAuth } from "@/lib/security/insights-auth";
import { checkInsightsRateLimit } from "@/lib/security/insights-rate-limit";
import { InsightsRequestSchema, formatZodErrors } from "@/lib/validations/schemas";
import type {
  ResourceCapacityAnalysis,
  Conflict,
} from "@/lib/analysis/types";

/**
 * Extract a client identifier from the request for rate-limiting.
 */
function getClientKey(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  try {
    // ── 1. Auth check ──────────────────────────────────────────────────
    const authError = validateInsightsAuth(request);
    if (authError) return authError;

    // ── 2. Parse & validate body ───────────────────────────────────────
    const rawBody = await request.json();

    const parsed = InsightsRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: formatZodErrors(parsed.error) },
        { status: 400 }
      );
    }

    const { analysisType } = parsed.data;

    // ── 3. Rate limit check ────────────────────────────────────────────
    const clientKey = getClientKey(request);
    const rateLimit = checkInsightsRateLimit(clientKey, analysisType);

    if (rateLimit.limited) {
      const retryAfterSec = Math.ceil(rateLimit.retryAfterMs / 1000);
      return NextResponse.json(
        {
          error: "Too many requests",
          retryAfter: retryAfterSec,
          message: `Rate limit exceeded for ${analysisType}. Try again in ${retryAfterSec}s.`,
        },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSec) },
        }
      );
    }

    // ── 4. OpenAI key check ────────────────────────────────────────────
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "OpenAI API key not configured",
          message: "Please add OPENAI_API_KEY to your .env.local file",
        },
        { status: 500 }
      );
    }

    // ── 5. Route to handler ────────────────────────────────────────────
    switch (analysisType) {
      case "recommendations": {
        const capacityAnalysis = parsed.data.capacityAnalysis as unknown as ResourceCapacityAnalysis[];
        const conflicts = (parsed.data.conflicts || []) as unknown as Conflict[];
        const result = await generateCapacityRecommendations(
          capacityAnalysis,
          conflicts,
          apiKey
        );
        return NextResponse.json(result);
      }

      case "conflicts": {
        const capacityAnalysis = parsed.data.capacityAnalysis as unknown as ResourceCapacityAnalysis[];
        const conflicts = (parsed.data.conflicts || []) as unknown as Conflict[];
        const resolutions = await generateConflictResolutions(
          conflicts,
          capacityAnalysis,
          apiKey
        );
        return NextResponse.json({ resolutions });
      }

      case "scenario": {
        const scenarioResult = simulateScenario(
          parsed.data.analysisInput as unknown as Parameters<typeof simulateScenario>[0],
          parsed.data.scenarioChanges
        );

        const scenarioResponse = await generateScenarioAnalysis(
          scenarioResult,
          apiKey
        );

        return NextResponse.json(scenarioResponse);
      }

      default:
        return NextResponse.json(
          { error: `Unknown analysis type: ${analysisType}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[API /insights] Error:", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate insights", details: message },
      { status: 500 }
    );
  }
}
