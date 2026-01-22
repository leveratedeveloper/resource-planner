/**
 * Analysis Web Worker
 * Runs heavy capacity analysis and conflict detection in a separate thread
 * to keep the main UI thread responsive
 */

import { analyzeCapacity } from "../capacity-analyzer";
import { detectConflicts } from "../conflict-detector";
import {
  WorkerRequest,
  WorkerResponse,
  AnalysisResult,
  AnalysisInput,
} from "../types";

// Web Worker global scope
const ctx: Worker = self as unknown as Worker;

/**
 * Perform full analysis on the provided data
 */
function runAnalysis(input: AnalysisInput): AnalysisResult {
  console.log("[Analysis Worker] Starting analysis...", {
    resources: input.resources.length,
    assignments: input.assignments.length,
    dateRange: input.dateRange,
  });

  const startTime = performance.now();

  // Run capacity analysis
  const capacityAnalysis = analyzeCapacity(input);

  // Run conflict detection
  const conflicts = detectConflicts(input, capacityAnalysis);

  // Calculate summary
  const summary = {
    totalResources: input.resources.length,
    overallocatedCount: capacityAnalysis.filter(
      (r) => r.status === "overallocated"
    ).length,
    underutilizedCount: capacityAnalysis.filter(
      (r) => r.status === "underutilized"
    ).length,
    optimalCount: capacityAnalysis.filter((r) => r.status === "optimal").length,
    conflictCount: conflicts.length,
    criticalConflicts: conflicts.filter((c) => c.severity === "critical").length,
  };

  const endTime = performance.now();
  console.log(
    `[Analysis Worker] Analysis complete in ${(endTime - startTime).toFixed(2)}ms`,
    summary
  );

  return {
    timestamp: Date.now(),
    capacityAnalysis,
    conflicts,
    summary,
  };
}

/**
 * Message handler
 */
ctx.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { type, payload, requestId } = event.data;

  if (type === "ANALYZE") {
    try {
      const result = runAnalysis(payload);

      const response: WorkerResponse = {
        type: "ANALYSIS_COMPLETE",
        payload: result,
        requestId,
      };

      ctx.postMessage(response);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";

      console.error("[Analysis Worker] Error:", errorMessage);

      const response: WorkerResponse = {
        type: "ANALYSIS_ERROR",
        payload: { error: errorMessage },
        requestId,
      };

      ctx.postMessage(response);
    }
  }
};

// Signal that worker is ready
console.log("[Analysis Worker] Worker initialized and ready");
