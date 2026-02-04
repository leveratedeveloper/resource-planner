/**
 * useCapacityAnalysis Hook
 * React hook for managing Web Worker-based capacity analysis
 * 
 * Performance optimizations:
 * - Uses AnalysisCache for result caching
 * - Content-hash fingerprinting for smarter change detection
 * - Request cancellation to prevent stale results
 */

"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Resource } from "@/types";
import { AnalysisResult, AnalysisInput, AnalysisAssignment, AnalysisProject, AnalysisBrand } from "@/lib/analysis/types";
import { createAnalysisWorker, AnalysisWorkerClient } from "@/lib/analysis/worker/client";
import { AnalysisCache, analysisResultCache } from "@/lib/analysis/analysis-cache";

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
  assignments: AnalysisAssignment[],
  projects: AnalysisProject[],
  brands: AnalysisBrand[],
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
  
  // Track current request for cancellation support
  const currentRequestIdRef = useRef<string | null>(null);

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

  // Create content-hash fingerprint for smarter change detection (Fix 2)
  const inputFingerprint = useMemo(() => {
    return AnalysisCache.generateFingerprint({
      resources: resources.map(r => ({ id: r.id, capacity: r.capacity })),
      assignments: assignments.map(a => ({
        id: a.id,
        resourceId: a.resourceId,
        startDate: a.startDate,
        endDate: a.endDate,
        hoursPerDay: a.hoursPerDay,
        isTimeOff: a.isTimeOff,
        isBillable: a.isBillable,
      })),
      dateRange: analysisInput.dateRange,
    });
  }, [resources, assignments, analysisInput.dateRange]);

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

  // Run analysis function with caching and cancellation support
  const runAnalysis = useCallback(async (forceRefresh = false) => {
    if (!workerRef.current || !enabled) return;

    // Check cache first (Fix 1)
    if (!forceRefresh) {
      const cachedResult = analysisResultCache.get('main', inputFingerprint);
      if (cachedResult) {
        console.log("[useCapacityAnalysis] Cache hit - using cached result");
        setResult(cachedResult as AnalysisResult);
        return;
      }
    }

    // Generate unique request ID for cancellation support (Fix 5)
    const requestId = `analysis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    currentRequestIdRef.current = requestId;

    setIsAnalyzing(true);
    setError(null);

    try {
      console.log("[useCapacityAnalysis] Triggering analysis...");
      const analysisResult = await workerRef.current.analyze(analysisInput);
      
      // Only update state if this is still the current request (Fix 5)
      if (currentRequestIdRef.current === requestId) {
        setResult(analysisResult);
        setLastAnalyzedAt(new Date());
        // Cache the result (Fix 1)
        analysisResultCache.set('main', analysisResult, inputFingerprint);
        console.log("[useCapacityAnalysis] Analysis complete", analysisResult.summary);
      } else {
        console.log("[useCapacityAnalysis] Stale result ignored");
      }
    } catch (err) {
      // Only update error state if this is still the current request
      if (currentRequestIdRef.current === requestId) {
        console.error("[useCapacityAnalysis] Analysis failed:", err);
        setError(err instanceof Error ? err : new Error("Analysis failed"));
      }
    } finally {
      // Only update loading state if this is still the current request
      if (currentRequestIdRef.current === requestId) {
        setIsAnalyzing(false);
      }
    }
  }, [analysisInput, enabled, inputFingerprint]);

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

  // Manual refresh function (bypasses cache)
  const refresh = useCallback(() => {
    runAnalysis(true);
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

