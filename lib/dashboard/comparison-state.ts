type UtilizationComparisonStateInput = {
  comparisonEnabled: boolean;
  resourceCount: number;
  assignmentsError: boolean;
  assignmentsLoading: boolean;
  assignmentsSuccess: boolean;
  currentAnalyzing: boolean;
  currentFresh: boolean;
  comparisonAnalyzing: boolean;
  comparisonFresh: boolean;
};

type UtilizationComparisonState = {
  shouldUsePrevious: boolean;
  loading: boolean;
  unavailable: boolean;
};

export function getUtilizationComparisonState({
  comparisonEnabled,
  resourceCount,
  assignmentsError,
  assignmentsLoading,
  assignmentsSuccess,
  currentAnalyzing,
  currentFresh,
  comparisonAnalyzing,
  comparisonFresh,
}: UtilizationComparisonStateInput): UtilizationComparisonState {
  const unavailable = comparisonEnabled && assignmentsError;
  const analysisReady = resourceCount === 0 || (currentFresh && comparisonFresh);
  const shouldUsePrevious =
    comparisonEnabled &&
    !unavailable &&
    assignmentsSuccess &&
    analysisReady;
  const loading =
    comparisonEnabled &&
    resourceCount > 0 &&
    !unavailable &&
    (!assignmentsSuccess ||
      assignmentsLoading ||
      currentAnalyzing ||
      !currentFresh ||
      comparisonAnalyzing ||
      !comparisonFresh);

  return {
    shouldUsePrevious,
    loading,
    unavailable,
  };
}

type RefreshDashboardInsightsInput = {
  comparisonEnabled: boolean;
  refreshAnalysis: () => void;
  refreshComparisonAnalysis: () => void;
  refetchComparisonAssignments: () => unknown;
};

export function refreshDashboardInsights({
  comparisonEnabled,
  refreshAnalysis,
  refreshComparisonAnalysis,
  refetchComparisonAssignments,
}: RefreshDashboardInsightsInput) {
  if (comparisonEnabled) {
    refetchComparisonAssignments();
  }

  refreshAnalysis();

  if (comparisonEnabled) {
    refreshComparisonAnalysis();
  }
}
