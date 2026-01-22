/**
 * Recommendation Generator
 * OpenAI integration for generating AI-powered recommendations
 */

import OpenAI from "openai";
import { SYSTEM_PROMPTS, formatCapacityContext } from "./prompts";
import {
  ResourceCapacityAnalysis,
  Conflict,
  CapacityRecommendation,
} from "@/lib/analysis/types";

// Types for AI responses
export type AIRecommendationsResponse = {
  recommendations: CapacityRecommendation[];
  summary: string;
  generatedAt: number;
};

export type AIConflictResolution = {
  conflictId: string;
  action: string;
  reasoning: string;
  estimatedImpact: string;
};

/**
 * Generate recommendations based on capacity analysis
 */
export async function generateCapacityRecommendations(
  capacityAnalysis: ResourceCapacityAnalysis[],
  conflicts: Conflict[],
  apiKey: string
): Promise<AIRecommendationsResponse> {
  const openai = new OpenAI({ apiKey });

  // Prepare context data
  const overallocated = capacityAnalysis
    .filter((r) => r.status === "overallocated")
    .map((r) => ({
      name: r.resourceName,
      utilization: r.averageUtilization,
      department: r.department,
    }));

  const underutilized = capacityAnalysis
    .filter((r) => r.status === "underutilized")
    .map((r) => ({
      name: r.resourceName,
      utilization: r.averageUtilization,
      department: r.department,
    }));

  const conflictData = conflicts.slice(0, 10).map((c) => ({
    type: c.type,
    description: c.description,
  }));

  const userMessage = formatCapacityContext({
    overallocated,
    underutilized,
    conflicts: conflictData,
  });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPTS.capacityRecommendations },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const parsed = JSON.parse(content);

    // Transform to our format
    const recommendations: CapacityRecommendation[] = (
      parsed.recommendations || []
    ).map((rec: { id: string; type: string; priority: string; title: string; description: string; reasoning: string }, index: number) => ({
      id: rec.id || `ai-rec-${Date.now()}-${index}`,
      type: rec.type || "reassignment",
      priority: rec.priority || "medium",
      title: rec.title || "Recommendation",
      description: rec.description || "",
      aiExplanation: rec.reasoning || "",
      estimatedImpact: "Improves team balance",
    }));

    return {
      recommendations,
      summary: parsed.summary || "Analysis complete.",
      generatedAt: Date.now(),
    };
  } catch (error) {
    console.error("[RecommendationGenerator] Error:", error);
    throw error;
  }
}

/**
 * Generate conflict resolution suggestions
 */
export async function generateConflictResolutions(
  conflicts: Conflict[],
  capacityAnalysis: ResourceCapacityAnalysis[],
  apiKey: string
): Promise<AIConflictResolution[]> {
  if (conflicts.length === 0) return [];

  const openai = new OpenAI({ apiKey });

  const conflictContext = conflicts.slice(0, 5).map((c) => ({
    id: c.id,
    type: c.type,
    severity: c.severity,
    resource: c.resourceName,
    description: c.description,
  }));

  const resourceContext = capacityAnalysis.slice(0, 10).map((r) => ({
    name: r.resourceName,
    department: r.department,
    utilization: Math.round(r.averageUtilization),
    status: r.status,
  }));

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPTS.conflictResolution },
        {
          role: "user",
          content: `Conflicts to resolve:\n${JSON.stringify(conflictContext, null, 2)}\n\nTeam capacity overview:\n${JSON.stringify(resourceContext, null, 2)}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 800,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const parsed = JSON.parse(content);
    return parsed.resolutions || [];
  } catch (error) {
    console.error("[RecommendationGenerator] Conflict resolution error:", error);
    throw error;
  }
}
