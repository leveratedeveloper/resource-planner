/**
 * useCapacityAnalysis Hook
 * React hook for managing Web Worker-based capacity analysis
 */

"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Resource, Assignment, Project, Brand } from "@/types";
import { AnalysisResult, AnalysisInput } from "@/lib/analysis/types";
import { createAnalysisWorker, AnalysisWorkerClient } from "@/lib/analysis/worker/client";

type UseCapacityAnalysisOptions = {
  /** Delay in ms before running analysis after data changes (debounce) */
  debounceMs?: number;
  /** Enable analysis */
  enabled?: boolean;
};

type UseCapacityAnalysisReturn = {
  /** Latest analysis result */
  result: AnalysisResult | null;
  /** Whether analysis is currently running */
  isAnalyzing: boolean;
  /** Error if analysis failed */
  error: Error | null;
  /** Manually trigger analysis */
  refresh: () => void;
  /** Time of last successful analysis */
  lastAnalyzedAt: Date | null;
};

/**
 * Hook for performing capacity analysis in a Web Worker
 */
export function useCapacityAnalysis(
  resources: Resource[],
  assignments: Assignment[],
  projects: Project[],
  brands: Brand[],
  dateRange: { start: Date; end: Date },
  options: UseCapacityAnalysisOptions = {}
): UseCapacityAnalysisReturn {
  const { debounceMs = 300, enabled = true } = options;

  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<Date | null>(null);

  // Worker instance ref
  const workerRef = useRef<AnalysisWorkerClient | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Memoize input to detect changes
  const analysisInput = useMemo<AnalysisInput>(
    () => ({
      resources,
      assignments,
      projects,
      brands,
      dateRange: {
        start: dateRange.start.toISOString().split("T")[0],
        end: dateRange.end.toISOString().split("T")[0],
      },
    }),
    [resources, assignments, projects, brands, dateRange.start, dateRange.end]
  );

  // Create fingerprint for change detection
  const inputFingerprint = useMemo(() => {
    return JSON.stringify({
      resourceCount: resources.length,
      assignmentCount: assignments.length,
      projectCount: projects.length,
      dateRange: analysisInput.dateRange,
      // Include assignment IDs and dates for change detection
      assignmentIds: assignments.map((a) => `${a.id}-${a.startDate}-${a.endDate}`).sort(),
    });
  }, [resources.length, assignments, projects.length, analysisInput.dateRange]);

  // Initialize worker on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    workerRef.current = createAnalysisWorker();

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Run analysis function
  const runAnalysis = useCallback(async () => {
    if (!workerRef.current || !enabled) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      console.log("[useCapacityAnalysis] Triggering analysis...");
      const analysisResult = await workerRef.current.analyze(analysisInput);
      setResult(analysisResult);
      setLastAnalyzedAt(new Date());
      console.log("[useCapacityAnalysis] Analysis complete", analysisResult.summary);
    } catch (err) {
      console.error("[useCapacityAnalysis] Analysis failed:", err);
      setError(err instanceof Error ? err : new Error("Analysis failed"));
    } finally {
      setIsAnalyzing(false);
    }
  }, [analysisInput, enabled]);

  // Auto-run analysis when input changes (debounced)
  useEffect(() => {
    if (!enabled || assignments.length === 0) return;

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce the analysis
    debounceTimerRef.current = setTimeout(() => {
      runAnalysis();
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [inputFingerprint, enabled, debounceMs, runAnalysis]);

  // Manual refresh function
  const refresh = useCallback(() => {
    runAnalysis();
  }, [runAnalysis]);

  return {
    result,
    isAnalyzing,
    error,
    refresh,
    lastAnalyzedAt,
  };
}

export default useCapacityAnalysis;
