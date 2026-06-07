import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    session: {
      access: { can_view_all: true },
      employee: { uuid: "employee-1" },
    },
  }),
}));

vi.mock("@/lib/query/hooks", () => ({
  useBrands: () => ({ data: [], isLoading: false }),
  useEmployees: () => ({ data: [], isLoading: false }),
  useInfiniteEmployees: () => ({
    data: {
      pages: [
        {
          data: [],
          total: 0,
          hasMore: false,
        },
      ],
    },
    isLoading: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
  }),
  usePlannerTimeline: () => ({
    data: { assignments: [], actualAssignments: [] },
    isFetching: false,
    isRefetchError: false,
    isShowingPreviousData: false,
  }),
  usePlannerHomeBootstrap: () => ({
    data: {
      employees: [],
      employeeTotal: 0,
      employeeHasMore: false,
      departmentsById: {},
      brandsById: {},
      projectsById: {},
      plannerTimeline: { assignments: [], actualAssignments: [], request: { viewMode: "quarter", resolution: "month", startDate: "2026-04-01", endDate: "2026-06-30", filters: { category: null, status: null } } },
      metadataPartial: false,
      metadataFreshness: {
        state: "healthy",
        lastSuccessfulSyncAt: null,
        latestSyncAt: null,
        stale: false,
        issueCount: 0,
      },
      freshness: {
        directoryFetchedAt: "2026-06-05T00:00:00.000Z",
        plannerFetchedAt: "2026-06-05T00:00:00.000Z",
      },
      request: {
        viewMode: "quarter",
        resolution: "month",
        startDate: "2026-04-01",
        endDate: "2026-06-30",
        filters: { category: null, status: null },
        employeeLimit: 24,
        employeeOffset: 0,
        brandId: null,
        department: null,
        projectId: null,
        search: null,
      },
    },
    isLoading: false,
    isFetching: false,
    isRefetchError: false,
  }),
  useProjectsByBrand: () => ({ data: [], isLoading: false }),
  useProjectOptions: () => ({ data: [], isLoading: false }),
}));

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: () => ({
    getVirtualItems: () => [],
    scrollToOffset: vi.fn(),
  }),
}));

vi.mock("@/components/timeline-v2/useTimelineV2Controller", () => ({
  useTimelineV2Controller: () => ({
    plannedPopover: null,
    actualPopover: null,
    monthlyAllocationModal: null,
    monthlyAllocationConfirm: null,
    closePlannedPopover: vi.fn(),
    handleSavePlannedPopover: vi.fn(),
    closeActualPopover: vi.fn(),
    handleSaveActualPopover: vi.fn(),
    closeMonthlyAllocationModal: vi.fn(),
    handleSaveMonthlyAllocation: vi.fn(),
    handleDeleteMonthlyAllocation: vi.fn(),
    closeMonthlyAllocationConfirm: vi.fn(),
    handleConfirmMonthlyAllocation: vi.fn(),
    handleCreatePlannedAssignment: vi.fn(),
    handleCreateActualAssignment: vi.fn(),
    handleCreateTimeOff: vi.fn(),
    handleOpenMonthlyAllocation: vi.fn(),
    handleUpdatePlannedAssignment: vi.fn(),
    handleDeletePlannedAssignment: vi.fn(),
    handleUpdateActualAssignment: vi.fn(),
    handleDeleteActualAssignment: vi.fn(),
  }),
}));

vi.mock("@/components/timeline-v2/TimelineBodyV2", () => ({
  TimelineBodyV2: () => React.createElement("div", { "data-testid": "timeline-v2-body" }),
}));

vi.mock("@/components/timeline-v2/TimelineLoadingStatesV2", () => ({
  TimelineInitialSkeletonV2: () => React.createElement("div", { "data-testid": "timeline-v2-initial-skeleton" }),
  TimelineEmptyStateV2: () => React.createElement("div", { "data-testid": "timeline-v2-empty-state" }),
}));

describe("timeline-v2 render smoke test", () => {
  it("renders the planner shell without browser automation", async () => {
    const { TimelineV2 } = await import("@/components/timeline-v2");
    const html = renderToStaticMarkup(
      React.createElement(TimelineV2, {
        initialTimelineAnchor: "2026-06-04",
        brandId: null,
        department: null,
        searchQuery: "",
        projectId: null,
      })
    );

    expect(html).toContain("timeline-v2-root");
    expect(html).toContain("timeline-v2-header-controls");
    expect(html).toContain("timeline-v2-today-button");
    expect(html).toContain("timeline-v2-initial-skeleton");
  });
});
