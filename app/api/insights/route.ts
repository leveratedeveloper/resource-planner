/**
 * AI Insights API Route
 * POST /api/insights
 * Generates AI-powered recommendations using OpenAI
 */

import { NextRequest, NextResponse } from "next/server";
import {
  generateCapacityRecommendations,
  generateConflictResolutions,
} from "@/lib/ai/recommendation-generator";
import {
  ResourceCapacityAnalysis,
  Conflict,
} from "@/lib/analysis/types";

export type InsightsRequestBody = {
  analysisType: "recommendations" | "conflicts" | "scenario";
  capacityAnalysis: ResourceCapacityAnalysis[];
  conflicts: Conflict[];
};

export async function POST(request: NextRequest) {
  try {
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

    const body: InsightsRequestBody = await request.json();
    const { analysisType, capacityAnalysis, conflicts } = body;

    if (!analysisType || !capacityAnalysis) {
      return NextResponse.json(
        { error: "Missing required fields: analysisType, capacityAnalysis" },
        { status: 400 }
      );
    }

    switch (analysisType) {
      case "recommendations": {
        const result = await generateCapacityRecommendations(
          capacityAnalysis,
          conflicts || [],
          apiKey
        );
        return NextResponse.json(result);
      }

      case "conflicts": {
        const resolutions = await generateConflictResolutions(
          conflicts || [],
          capacityAnalysis,
          apiKey
        );
        return NextResponse.json({ resolutions });
      }

      case "scenario": {
        // TODO: Implement scenario analysis
        return NextResponse.json(
          { error: "Scenario analysis not yet implemented" },
          { status: 501 }
        );
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
