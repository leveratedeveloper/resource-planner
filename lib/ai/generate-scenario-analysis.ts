/**
 * Scenario Analysis Generator
 * OpenAI integration for AI-enhanced scenario assessment
 */

import OpenAI from "openai";
import { SYSTEM_PROMPTS } from "./prompts";
import { ScenarioResult } from "@/lib/analysis/scenario-simulator";

export type AIScenarioAssessment = {
  overallImpact: "positive" | "neutral" | "negative";
  utilizationChange: string;
  newConflicts: string[];
  resolvedConflicts: string[];
  recommendation: string;
  reasoning: string;
};

export type ScenarioAnalysisResponse = {
  simulation: ScenarioResult;
  aiAssessment: AIScenarioAssessment;
  generatedAt: number;
};

/**
 * Format scenario result into a context string for the AI prompt
 */
function formatScenarioContext(result: ScenarioResult): string {
  const { beforeAnalysis, afterAnalysis, impactSummary } = result;

  return `Scenario Impact Analysis:

Before changes:
- Total resources: ${beforeAnalysis.summary.totalResources}
- Overallocated: ${beforeAnalysis.summary.overallocatedCount}
- Underutilized: ${beforeAnalysis.summary.underutilizedCount}
- Optimal: ${beforeAnalysis.summary.optimalCount}
- Conflicts: ${beforeAnalysis.summary.conflictCount} (${beforeAnalysis.summary.criticalConflicts} critical)

After changes:
- Total resources: ${afterAnalysis.summary.totalResources}
- Overallocated: ${afterAnalysis.summary.overallocatedCount}
- Underutilized: ${afterAnalysis.summary.underutilizedCount}
- Optimal: ${afterAnalysis.summary.optimalCount}
- Conflicts: ${afterAnalysis.summary.conflictCount} (${afterAnalysis.summary.criticalConflicts} critical)

Impact:
- Average utilization change: ${impactSummary.utilizationChange > 0 ? "+" : ""}${impactSummary.utilizationChange.toFixed(1)}%
- Conflicts added: ${impactSummary.conflictsAdded}
- Conflicts resolved: ${impactSummary.conflictsResolved}
- Resources improved: ${impactSummary.resourcesImproved.length > 0 ? impactSummary.resourcesImproved.join(", ") : "None"}
- Resources worsened: ${impactSummary.resourcesWorsened.length > 0 ? impactSummary.resourcesWorsened.join(", ") : "None"}

System recommendation: ${result.recommendation}
System reasoning: ${result.reasoning}

Please provide your AI assessment of this scenario.`;
}

/**
 * Generate an AI-enhanced scenario assessment using OpenAI
 */
export async function generateScenarioAnalysis(
  scenarioResult: ScenarioResult,
  apiKey: string
): Promise<ScenarioAnalysisResponse> {
  const openai = new OpenAI({ apiKey });

  const userMessage = formatScenarioContext(scenarioResult);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPTS.scenarioAnalysis },
        { role: "user", content: userMessage },
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
    const assessment = parsed.scenarioAssessment || parsed;

    const aiAssessment: AIScenarioAssessment = {
      overallImpact: assessment.overallImpact || "neutral",
      utilizationChange: assessment.utilizationChange || "No significant change",
      newConflicts: assessment.newConflicts || [],
      resolvedConflicts: assessment.resolvedConflicts || [],
      recommendation: assessment.recommendation || scenarioResult.recommendation,
      reasoning: assessment.reasoning || scenarioResult.reasoning,
    };

    return {
      simulation: scenarioResult,
      aiAssessment,
      generatedAt: Date.now(),
    };
  } catch (error) {
    console.error("[ScenarioAnalysis] Error:", error);
    throw error;
  }
}
