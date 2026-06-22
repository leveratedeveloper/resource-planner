import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import {
  arePlannerTimelineRequestsEqual,
  getCurrentPlannerTimelineData,
  getPlannerTimelineQueryKey,
  getTimelineResolution,
  shouldLoadPlannerAssignmentDetail,
  summarizeMonthlyAssignments,
} from "@/lib/planner/planner-loading";

const makeAssignment = (overrides: Partial<Assignment>): Assignment => ({
  id: "assignment-1",
  employeeId: "employee-1",
  projectId: "project-1",
  taskId: null,
  startDate: "2026-01-30",
  endDate: "2026-02-02",
  hoursPerDay: "8",
  totalHours: 32,
  allocationPercentage: null,
  isTimeOff: false,
  isAdjustment: false,
  timeOffTypeId: null,
  category: "Development",
  isBillable: true,
  status: "confirmed",
  note: "Homepage",
  createdById: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("planner timeline loading contract", () => {
  it("selects day detail for short views and month summaries for long views", () => {
    expect(getTimelineResolution("week")).toBe("day");
    expect(getTimelineResolution("month")).toBe("day");
    expect(getTimelineResolution("quarter")).toBe("month");
    expect(getTimelineResolution("halfYear")).toBe("month");
    expect(getTimelineResolution("year")).toBe("month");
  });

  it("scopes planner cache keys by view, range, resolution, and filters", () => {
    expect(
      getPlannerTimelineQueryKey({
        viewMode: "year",
        resolution: "month",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        filters: {
          category: "Development",
          status: "confirmed",
        },
      })
    ).toEqual([
      "planner-timeline",
      {
        viewMode: "year",
        resolution: "month",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        filters: {
          category: "Development",
          status: "confirmed",
        },
      },
    ]);
  });

  it("scopes planner cache keys and request equality without presentation-only project filters", () => {
    const baseRequest = {
      viewMode: "month" as const,
      resolution: "day" as const,
      startDate: "2026-06-01",
      endDate: "2026-06-30",
      filters: {
        category: null,
        status: null,
      },
    };
    const requestWithProject = {
      ...baseRequest,
      filters: {
        ...baseRequest.filters,
        projectId: "project-1",
      },
    };

    expect(getPlannerTimelineQueryKey(requestWithProject)).toEqual(
      getPlannerTimelineQueryKey(baseRequest)
    );
    expect(arePlannerTimelineRequestsEqual(requestWithProject, baseRequest)).toBe(true);
  });

  it("does not use projectId as a destructive planner assignment payload filter", () => {
    const plannerPrefetchSource = readFileSync("lib/query/server/planner-prefetch.ts", "utf8");
    const plannerQueriesSource = readFileSync("lib/mysql-assignments/queries.ts", "utf8");

    expect(plannerPrefetchSource).not.toContain("assignment.projectId !== request.filters.projectId");
    expect(plannerPrefetchSource).not.toContain("assignment.projectUuid !== request.filters.projectId");
    expect(plannerPrefetchSource).toContain("category: filters?.category");
    expect(plannerPrefetchSource).toContain("status: filters?.status");
    expect(plannerQueriesSource).toContain("AND category = ?");
    expect(plannerQueriesSource).toContain("AND status = ?");
  });

  it("keeps brand and project ids out of the planner request because they are resource filters", () => {
    const timelineSource = readFileSync("components/timeline-v2/Timeline.tsx", "utf8");
    const routeSource = readFileSync("app/api/planner/timeline/route.ts", "utf8");

    expect(timelineSource).not.toContain("filters: {\n        projectId,");
    expect(timelineSource).not.toContain("filters: {\n        brandId,");
    expect(timelineSource).toContain("filters: {");
    expect(timelineSource).toContain("projectId,");
    expect(timelineSource).toContain("brandId,");
    expect(timelineSource).toContain("getVisibleEmployeeIds");
    expect(routeSource).not.toContain('request.nextUrl.searchParams.get("projectId")');
    expect(routeSource).not.toContain('request.nextUrl.searchParams.get("brandId")');
  });

  it("does not use brandId as a destructive planner assignment payload filter", () => {
    const timelineSource = readFileSync("components/timeline-v2/Timeline.tsx", "utf8");

    expect(timelineSource).not.toContain("filters: {\n        brandId:");
    expect(timelineSource).not.toContain("request.filters.brandId");
    expect(timelineSource).toContain("brandId,");
    expect(timelineSource).toContain("getVisibleEmployeeIds");
  });

  it("loads selected brand projects before calculating brand-filtered resources", () => {
    const timelineSource = readFileSync("components/timeline-v2/Timeline.tsx", "utf8");
    const employeesHookSource = readFileSync("lib/timeline-v2/use-timeline-employees.ts", "utf8");

    expect(timelineSource).toContain("Object.values(projectsById).map(toProjectOption)");
    expect(timelineSource).toContain("request: bootstrapRequest");
    expect(employeesHookSource).toContain("usePlannerHomeBootstrapWindow");
    expect(timelineSource).toContain("selectedBrandProjectIds");
    expect(timelineSource).not.toContain("useProjectsByBrand(brandId ?? \"\")");
    expect(timelineSource).not.toContain("isLoadingSelectedBrandProjects");
    expect(timelineSource).not.toContain("isLoadingBrandProjectLookup");
  });

  it("returns one monthly render block per month for assignments crossing a boundary", () => {
    const blocks = summarizeMonthlyAssignments([makeAssignment({})], {
      startDate: "2026-01-01",
      endDate: "2026-02-28",
    });

    expect(blocks.map((block) => ({
      month: block.startDate,
      totalHours: block.totalHours,
      detailCount: block.detailCount,
    }))).toEqual([
      {
        month: "2026-01-01",
        totalHours: 16,
        detailCount: 1,
      },
      {
        month: "2026-02-01",
        totalHours: 16,
        detailCount: 1,
      },
    ]);
  });

  it("splits planned monthly summaries by weekday overlap instead of calendar days", () => {
    const blocks = summarizeMonthlyAssignments([
      makeAssignment({
        startDate: "2026-01-26",
        endDate: "2026-02-04",
        hoursPerDay: "8",
        totalHours: null,
      }),
    ], {
      startDate: "2026-01-01",
      endDate: "2026-02-28",
    });

    expect(blocks.map((block) => ({
      month: block.startDate,
      totalHours: block.totalHours,
    }))).toEqual([
      {
        month: "2026-01-01",
        totalHours: 40,
      },
      {
        month: "2026-02-01",
        totalHours: 24,
      },
    ]);
  });

  it("only asks for edit detail when a monthly planner summary is opened", () => {
    const [monthlyBlock] = summarizeMonthlyAssignments([makeAssignment({})], {
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });

    expect(shouldLoadPlannerAssignmentDetail(monthlyBlock)).toBe(true);
    expect(shouldLoadPlannerAssignmentDetail(makeAssignment({ id: "raw-assignment" }))).toBe(false);
  });

  it("matches planner responses only when request identity is identical", () => {
    const request = {
      viewMode: "quarter" as const,
      resolution: "month" as const,
      startDate: "2026-04-01",
      endDate: "2026-06-30",
      filters: {
        category: null,
        status: null,
      },
    };

    expect(arePlannerTimelineRequestsEqual(request, { ...request })).toBe(true);
    expect(
      arePlannerTimelineRequestsEqual(request, {
        ...request,
        filters: {
          category: "Design",
          status: null,
        },
      })
    ).toBe(false);
    expect(
      arePlannerTimelineRequestsEqual(request, {
        ...request,
        startDate: "2026-07-01",
        endDate: "2026-09-30",
      })
    ).toBe(false);
  });

  it("rejects stale planner responses for a new active request", () => {
    const activeRequest = {
      viewMode: "quarter" as const,
      resolution: "month" as const,
      startDate: "2026-04-01",
      endDate: "2026-06-30",
      filters: {
        category: null,
        status: null,
      },
    };
    const staleResponse = {
      request: {
        ...activeRequest,
        filters: {
          category: "Design",
          status: null,
        },
      },
      assignments: [],
      actualAssignments: [],
    };

    expect(getCurrentPlannerTimelineData(staleResponse, activeRequest)).toBeUndefined();
    expect(
      getCurrentPlannerTimelineData({ ...staleResponse, request: activeRequest }, activeRequest)
    ).toEqual({
      ...staleResponse,
      request: activeRequest,
    });
  });

  it("keeps previous query data out of active timeline calculations", () => {
    const hookSource = readFileSync("lib/query/hooks/usePlannerTimeline.ts", "utf8");

    expect(hookSource).toContain("getCurrentPlannerTimelineData(query.data, request)");
    expect(hookSource).toContain("data: currentData");
    expect(hookSource).toContain("isLoadingCurrentData");
    expect(hookSource).toContain("isShowingPreviousData");
  });

  it("shows filter application state instead of calculating from stale planner data", () => {
    const timelineSource = readFileSync("components/timeline-v2/Timeline.tsx", "utf8");
    const loadingStateSource = readFileSync("lib/timeline-v2/resource-row-loading.ts", "utf8");

    expect(timelineSource).toContain("isShowingPreviousBootstrap && isFetchingBootstrap");
    expect(timelineSource).toContain("isPlannerApplyingFilters: isApplyingNewRequest");
    expect(timelineSource).toContain("isPlannerRefreshing: hasBootstrapData && isApplyingNewRequest");
    expect(loadingStateSource).toContain("showInitialSkeleton");
    expect(loadingStateSource).toContain("showTimelineLoading: isRefreshInProgress");
    expect(timelineSource).toContain("<DataStatus");
    expect(timelineSource).toContain("Refreshing planner directory...");
    expect(timelineSource).not.toContain("Updating planner directory...");
  });

  it("does not render row-level project selector UI in resource rows", () => {
    const resourceRowSource = readFileSync("components/timeline-v2/ResourceRow.tsx", "utf8");
    const timelineSource = readFileSync("components/timeline-v2/Timeline.tsx", "utf8");

    expect(resourceRowSource).not.toContain("Select Project");
    expect(resourceRowSource).not.toContain("Select Projects");
    expect(resourceRowSource).not.toContain("selectedProjectIds.has");
    expect(resourceRowSource).not.toContain("PROJECT_DISPLAY_LIMIT");
    expect(timelineSource).not.toContain("selectedProjectIdsByEmployee");
    expect(timelineSource).not.toContain("initializedProjectFiltersByEmployee");
    expect(timelineSource).not.toContain("openProjectFilterEmployeeIds");
  });

  it("keeps resources visible while planner rows and expanded campaigns show loading state", () => {
    const timelineSource = readFileSync("components/timeline-v2/Timeline.tsx", "utf8");
    const resourceRowSource = readFileSync("components/timeline-v2/ResourceRow.tsx", "utf8");

    expect(timelineSource).toContain("getResourceRowLoadingState");
    expect(timelineSource).toContain("showTimelineLoading={rowLoadingState.showTimelineLoading}");
    expect(timelineSource).toContain("showExpandedLoading={rowLoadingState.showExpandedLoading}");
    expect(resourceRowSource).toContain("showTimelineLoading");
    expect(resourceRowSource).toContain("showExpandedLoading");
    expect(resourceRowSource).toContain("TimelineExpandedSkeleton");
    expect(resourceRowSource).toContain("TimelineRowLoadingCells");
  });

  it("seeds the single windowed bootstrap query and drops employee pagination", () => {
    const timelineSource = readFileSync("components/timeline-v2/Timeline.tsx", "utf8");
    const employeesHookSource = readFileSync("lib/timeline-v2/use-timeline-employees.ts", "utf8");

    expect(employeesHookSource).toContain("initialData: initialBootstrap ?? undefined");
    expect(employeesHookSource).toContain("usePlannerHomeBootstrapWindow");
    // Pagination is gone: no next-page handles or viewport prefetch effect.
    expect(timelineSource).not.toContain("hasNextEmployeePage");
    expect(timelineSource).not.toContain("fetchNextEmployeePage");
    expect(employeesHookSource).not.toContain("fetchNextPage");
    expect(timelineSource).not.toContain("if (shouldUseHomeBootstrap || !!plannerHomeBootstrap");
  });
});
