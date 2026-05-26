import { describe, expect, it, vi } from "vitest";
import {
  getUtilizationComparisonState,
  refreshDashboardInsights,
} from "@/lib/dashboard/comparison-state";

describe("dashboard comparison state", () => {
  it("uses previous-period data only when current and comparison analyses are fresh", () => {
    expect(
      getUtilizationComparisonState({
        comparisonEnabled: true,
        resourceCount: 4,
        assignmentsError: false,
        assignmentsLoading: false,
        assignmentsSuccess: true,
        currentAnalyzing: false,
        currentFresh: true,
        comparisonAnalyzing: false,
        comparisonFresh: true,
      })
    ).toEqual({
      shouldUsePrevious: true,
      loading: false,
      unavailable: false,
    });
  });

  it("keeps comparison loading when the current analysis is stale", () => {
    expect(
      getUtilizationComparisonState({
        comparisonEnabled: true,
        resourceCount: 4,
        assignmentsError: false,
        assignmentsLoading: false,
        assignmentsSuccess: true,
        currentAnalyzing: false,
        currentFresh: false,
        comparisonAnalyzing: false,
        comparisonFresh: true,
      })
    ).toEqual({
      shouldUsePrevious: false,
      loading: true,
      unavailable: false,
    });
  });

  it("keeps comparison loading when the comparison analysis is stale", () => {
    expect(
      getUtilizationComparisonState({
        comparisonEnabled: true,
        resourceCount: 4,
        assignmentsError: false,
        assignmentsLoading: false,
        assignmentsSuccess: true,
        currentAnalyzing: false,
        currentFresh: true,
        comparisonAnalyzing: false,
        comparisonFresh: false,
      })
    ).toEqual({
      shouldUsePrevious: false,
      loading: true,
      unavailable: false,
    });
  });

  it("keeps comparison loading while current analysis is recomputing", () => {
    expect(
      getUtilizationComparisonState({
        comparisonEnabled: true,
        resourceCount: 4,
        assignmentsError: false,
        assignmentsLoading: false,
        assignmentsSuccess: true,
        currentAnalyzing: true,
        currentFresh: false,
        comparisonAnalyzing: false,
        comparisonFresh: true,
      })
    ).toEqual({
      shouldUsePrevious: false,
      loading: true,
      unavailable: false,
    });
  });

  it("marks comparison unavailable when previous-period assignments fail", () => {
    expect(
      getUtilizationComparisonState({
        comparisonEnabled: true,
        resourceCount: 4,
        assignmentsError: true,
        assignmentsLoading: false,
        assignmentsSuccess: false,
        currentAnalyzing: false,
        currentFresh: true,
        comparisonAnalyzing: false,
        comparisonFresh: false,
      })
    ).toEqual({
      shouldUsePrevious: false,
      loading: false,
      unavailable: true,
    });
  });

  it("uses successful empty comparison data when no employees are in scope", () => {
    expect(
      getUtilizationComparisonState({
        comparisonEnabled: true,
        resourceCount: 0,
        assignmentsError: false,
        assignmentsLoading: false,
        assignmentsSuccess: true,
        currentAnalyzing: false,
        currentFresh: false,
        comparisonAnalyzing: false,
        comparisonFresh: false,
      })
    ).toEqual({
      shouldUsePrevious: true,
      loading: false,
      unavailable: false,
    });
  });

  it("awaits previous-period assignments before refreshing the workers", async () => {
    const refreshAnalysis = vi.fn();
    const refreshComparisonAnalysis = vi.fn();
    let resolveRefetch: (() => void) | undefined;
    const refetchComparisonAssignments = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRefetch = resolve;
        })
    );

    const promise = refreshDashboardInsights({
      comparisonEnabled: true,
      refreshAnalysis,
      refreshComparisonAnalysis,
      refetchComparisonAssignments,
    });

    expect(refetchComparisonAssignments).toHaveBeenCalledTimes(1);
    expect(refreshAnalysis).not.toHaveBeenCalled();
    expect(refreshComparisonAnalysis).not.toHaveBeenCalled();

    resolveRefetch?.();
    await promise;

    expect(refreshAnalysis).toHaveBeenCalledTimes(1);
    expect(refreshComparisonAnalysis).toHaveBeenCalledTimes(1);
  });

  it("does not retry previous-period assignments when comparison is disabled", async () => {
    const refreshAnalysis = vi.fn();
    const refreshComparisonAnalysis = vi.fn();
    const refetchComparisonAssignments = vi.fn();

    await refreshDashboardInsights({
      comparisonEnabled: false,
      refreshAnalysis,
      refreshComparisonAnalysis,
      refetchComparisonAssignments,
    });

    expect(refetchComparisonAssignments).not.toHaveBeenCalled();
    expect(refreshAnalysis).toHaveBeenCalledTimes(1);
    expect(refreshComparisonAnalysis).not.toHaveBeenCalled();
  });
});
