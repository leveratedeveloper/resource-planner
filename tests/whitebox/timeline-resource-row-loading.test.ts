import { describe, expect, it } from "vitest";
import { getResourceRowLoadingState } from "@/lib/timeline-v2/resource-row-loading";

describe("resource row loading state", () => {
  it("uses a full row skeleton only during the initial planner load", () => {
    expect(
      getResourceRowLoadingState({
        hasPlannerData: false,
        isPlannerApplyingFilters: false,
        isPlannerRefreshing: false,
        hasPlannerRefreshError: false,
      })
    ).toEqual({
      showInitialSkeleton: true,
      showTimelineLoading: false,
      showExpandedLoading: false,
      canEditAssignments: false,
    });
  });

  it("keeps resource rows visible and loads timeline content while filters apply", () => {
    expect(
      getResourceRowLoadingState({
        hasPlannerData: true,
        isPlannerApplyingFilters: true,
        isPlannerRefreshing: false,
        hasPlannerRefreshError: false,
      })
    ).toEqual({
      showInitialSkeleton: false,
      showTimelineLoading: true,
      showExpandedLoading: true,
      canEditAssignments: false,
    });
  });

  it("keeps stale planner data visible but disables edits after refresh failure", () => {
    expect(
      getResourceRowLoadingState({
        hasPlannerData: true,
        isPlannerApplyingFilters: false,
        isPlannerRefreshing: false,
        hasPlannerRefreshError: true,
      })
    ).toEqual({
      showInitialSkeleton: false,
      showTimelineLoading: false,
      showExpandedLoading: false,
      canEditAssignments: false,
    });
  });

  it("allows edits only when planner data is present and not refreshing or failed", () => {
    expect(
      getResourceRowLoadingState({
        hasPlannerData: true,
        isPlannerApplyingFilters: false,
        isPlannerRefreshing: false,
        hasPlannerRefreshError: false,
      }).canEditAssignments
    ).toBe(true);
  });
});
