export type ResourceRowLoadingInput = {
  hasPlannerData: boolean;
  isPlannerApplyingFilters: boolean;
  isPlannerRefreshing: boolean;
  hasPlannerRefreshError: boolean;
};

export type ResourceRowLoadingState = {
  showInitialSkeleton: boolean;
  showTimelineLoading: boolean;
  showExpandedLoading: boolean;
  canEditAssignments: boolean;
};

export function getResourceRowLoadingState({
  hasPlannerData,
  isPlannerApplyingFilters,
  isPlannerRefreshing,
  hasPlannerRefreshError,
}: ResourceRowLoadingInput): ResourceRowLoadingState {
  const isRefreshInProgress = hasPlannerData && (isPlannerApplyingFilters || isPlannerRefreshing);
  const showInitialSkeleton = !hasPlannerData;

  return {
    showInitialSkeleton,
    showTimelineLoading: isRefreshInProgress,
    showExpandedLoading: isRefreshInProgress,
    canEditAssignments: hasPlannerData && !isRefreshInProgress && !hasPlannerRefreshError,
  };
}
