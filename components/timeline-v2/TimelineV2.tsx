"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useAuth } from "@/context/AuthContext";
import { usePlannerHomeBootstrap } from "@/lib/query/hooks";
import type { Brand } from "@/lib/query/hooks/useBrands";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import { getResourceRowLoadingState } from "@/lib/timeline/resource-row-loading";
import { getTimelineRowStateResetKey } from "@/lib/timeline/row-state";
import { shouldEnableTimelineAssignments, type TimelineAssignmentDateRange } from "@/lib/timeline/initial-load";
import { getTimelineV2Columns, getTimelineV2Resolution } from "@/lib/timeline-v2/date-range";
import { buildEmployeeRowModels } from "@/lib/timeline-v2/row-model";
import { getVisibleEmployeeIds } from "@/lib/timeline-v2/visible-rows";
import { useTimelineEmployees } from "@/lib/timeline-v2/use-timeline-employees";
import { useTimelineExpansionStore } from "@/lib/timeline-v2/expansion-store";
import { useTimelineViewStore } from "@/lib/timeline-v2/view-store";
import {
  TIMELINE_V2_CAMPAIGN_ROW_HEIGHT,
  TIMELINE_V2_COLLAPSED_ROW_HEIGHT,
  TIMELINE_V2_ROW_ESTIMATE,
  getTimelineV2CellWidth,
  getTimelineV2TodayScrollLeft,
  getTimelineV2VisibleWidth,
} from "@/lib/timeline-v2/layout";
import { TimelineToolbarV2 } from "@/components/timeline-v2/TimelineToolbarV2";
import { TimelineDataStatusV2 } from "@/components/timeline-v2/TimelineDataStatusV2";
import { TimelineHeaderV2 } from "@/components/timeline-v2/TimelineHeaderV2";
import { TimelineBodyV2 } from "@/components/timeline-v2/TimelineBodyV2";
import { TimelineInitialSkeletonV2, TimelineEmptyStateV2 } from "@/components/timeline-v2/TimelineLoadingStatesV2";
import { useTimelineV2Controller } from "@/components/timeline-v2/useTimelineV2Controller";
import dynamic from "next/dynamic";
import { startOfDay } from "date-fns";
import type { PlannerHomeBootstrapResponse } from "@/lib/query/server/planner-home-bootstrap";

// Editing surfaces are conditionally rendered and never needed for first paint —
// load them on demand so they stay out of the initial bundle.
const AssignmentPopover = dynamic(
  () => import("@/components/timeline/AssignmentPopover").then((mod) => mod.AssignmentPopover),
  { ssr: false }
);
const MonthlyAllocationModal = dynamic(
  () => import("@/components/timeline/MonthlyAllocationModal").then((mod) => mod.MonthlyAllocationModal),
  { ssr: false }
);
const MonthlyAllocationConfirmation = dynamic(
  () => import("@/components/timeline/MonthlyAllocationConfirmation").then((mod) => mod.MonthlyAllocationConfirmation),
  { ssr: false }
);

type TimelineV2Props = {
  initialTimelineAnchor: string;
  initialBootstrap?: PlannerHomeBootstrapResponse | null;
  brandId: string | null;
  department: string | null;
  searchQuery?: string;
  projectId: string | null;
};

function getInitialDate(anchor: string) {
  return new Date(`${anchor}T00:00:00`);
}

function toBrandOption(brand: PlannerHomeBootstrapResponse["brandsById"][string]): Brand {
  return {
    id: brand.brandId,
    businessUnitId: null,
    name: brand.name,
    companyName: brand.companyName,
    brandAddress: null,
    clientCode: null,
    color: brand.color ?? "#64748b",
    logo: null,
    website: null,
    contactName: null,
    contactTitle: null,
    contactEmail: null,
    contactPhone: null,
    picFinanceName: null,
    picFinancePhone: null,
    industryCategory: null,
    description: null,
    status:
      brand.status === "active"
        ? "active"
        : brand.status === "inactive"
          ? "inactive"
          : "prospect",
    createdAt: brand.sourceUpdatedAt ?? brand.syncedAt,
    updatedAt: brand.sourceUpdatedAt ?? brand.syncedAt,
  };
}

function toProjectOption(project: PlannerHomeBootstrapResponse["projectsById"][string]): ProjectOption {
  return {
    id: project.sourceProjectId,
    name: project.name,
    color: project.color ?? "#64748b",
    status:
      project.status === "completed" ||
      project.status === "cancelled" ||
      project.status === "active" ||
      project.status === "planning" ||
      project.status === "on_hold"
        ? project.status
        : "planning",
    projectType: project.sourceType,
    brandId: project.brandId,
    startDate: project.startDate,
    endDate: project.endDate,
  };
}

export function TimelineV2({
  initialTimelineAnchor,
  initialBootstrap,
  brandId,
  department,
  searchQuery,
  projectId,
}: TimelineV2Props) {
  const { session } = useAuth();
  const timelineRootRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const scrollSyncSourceRef = useRef<"header" | "body" | null>(null);
  const todayScrollTargetRef = useRef<Date | null>(null);
  const todayScrollRafRef = useRef<number | null>(null);
  const hasLoggedTimelineFirstVisibleRef = useRef(false);

  // View state (mode, anchor, weekends, column width) lives in the view store;
  // toggling any of it never rebuilds the row models below.
  const viewMode = useTimelineViewStore((state) => state.viewMode);
  const anchorDate = useTimelineViewStore((state) => state.anchorDate);
  const showWeekends = useTimelineViewStore((state) => state.showWeekends);
  const hasHydratedWeekendPreference = useTimelineViewStore((state) => state.hasHydratedWeekendPreference);
  const resourceColumnWidth = useTimelineViewStore((state) => state.resourceColumnWidth);
  const setViewMode = useTimelineViewStore((state) => state.setViewMode);
  const setAnchorDate = useTimelineViewStore((state) => state.setAnchorDate);
  const toggleWeekends = useTimelineViewStore((state) => state.toggleWeekends);
  const hydrateWeekendPreference = useTimelineViewStore((state) => state.hydrateWeekendPreference);
  const setResourceColumnWidth = useTimelineViewStore((state) => state.setResourceColumnWidth);

  const currentDate = anchorDate ?? getInitialDate(initialTimelineAnchor);

  useEffect(() => {
    hydrateWeekendPreference();
  }, [hydrateWeekendPreference]);

  // Preload the lazy editor chunks once the browser is idle. Keeps them out of
  // the initial bundle but ensures the first click opens its dialog instantly —
  // without this, clicks during the chunk-load gap fall through to the lane
  // underneath and stack a second modal.
  useEffect(() => {
    const preloadEditors = () => {
      void import("@/components/timeline/AssignmentPopover");
      void import("@/components/timeline/MonthlyAllocationModal");
      void import("@/components/timeline/MonthlyAllocationConfirmation");
      void import("@/components/timeline/EditAssignmentDialog");
    };

    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(preloadEditors);
      return () => window.cancelIdleCallback(idleId);
    }

    preloadEditors();
  }, []);

  useEffect(() => {
    const rootContainer = timelineRootRef.current;
    if (!rootContainer) return;

    let frame = 0;
    const updateWidth = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!rootContainer) return;
        const rootWidth = rootContainer.clientWidth;
        setContainerWidth(getTimelineV2VisibleWidth(rootWidth, resourceColumnWidth));
      });
    };

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(rootContainer);
    updateWidth();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [resourceColumnWidth]);

  const columns = useMemo(
    () => getTimelineV2Columns({
      anchorDate: currentDate,
      viewMode,
      showWeekends,
    }),
    [currentDate, showWeekends, viewMode]
  );

  const cellWidth = useMemo(() => {
    if (!containerWidth) return 100;
    return getTimelineV2CellWidth(containerWidth, columns.columns.length);
  }, [columns.columns.length, containerWidth]);
  const isLayoutReady = hasHydratedWeekendPreference && containerWidth !== null;
  const assignmentDateRange = useMemo<TimelineAssignmentDateRange | undefined>(() => {
    if (!columns.startDate || !columns.endDate) return undefined;
    return {
      startDate: columns.startDate,
      endDate: columns.endDate,
    };
  }, [columns.endDate, columns.startDate]);

  const bootstrapRequest = useMemo(() => {
    if (!assignmentDateRange || !shouldEnableTimelineAssignments(assignmentDateRange)) {
      return undefined;
    }

    return {
      viewMode,
      resolution: getTimelineV2Resolution(viewMode),
      startDate: assignmentDateRange.startDate,
      endDate: assignmentDateRange.endDate,
      filters: {
        category: null,
        status: null,
      },
      employeeLimit: 24,
      employeeOffset: 0,
      brandId,
      department,
      projectId,
      search: searchQuery?.trim() || null,
    };
  }, [assignmentDateRange, brandId, department, projectId, searchQuery, viewMode]);

  const {
    data: plannerHomeBootstrap,
    isLoading: isLoadingPlannerHomeBootstrap,
    isFetching: isFetchingPlannerHomeBootstrap,
    isRefetchError: isPlannerHomeBootstrapRefetchError,
  } = usePlannerHomeBootstrap(bootstrapRequest, {
    enabled: !!bootstrapRequest,
    initialData: initialBootstrap ?? undefined,
    initialDataUpdatedAt: initialBootstrap
      ? Date.parse(initialBootstrap.freshness.directoryFetchedAt)
      : undefined,
  });

  const bootstrapPlannerTimeline = plannerHomeBootstrap?.plannerTimeline;
  const timelineFilters = useMemo(
    () => ({ brandId, department, projectId, searchQuery }),
    [brandId, department, projectId, searchQuery]
  );
  const {
    employees,
    isLoadingEmployees,
    useCompleteEmployeeList,
    hasNextEmployeePage,
    isFetchingNextEmployeePage,
    fetchNextEmployeePage,
  } = useTimelineEmployees({
    filters: timelineFilters,
    bootstrap: plannerHomeBootstrap,
  });
  const timelineBrands = useMemo(
    () => Object.values(plannerHomeBootstrap?.brandsById ?? {}).map(toBrandOption),
    [plannerHomeBootstrap]
  );
  const timelineProjects = useMemo(
    () => Object.values(plannerHomeBootstrap?.projectsById ?? {}).map(toProjectOption),
    [plannerHomeBootstrap]
  );
  const selectedBrandProjectIds = useMemo(
    () =>
      new Set(
        timelineProjects
          .filter((project) => !brandId || project.brandId === brandId)
          .map((project) => project.id)
      ),
    [brandId, timelineProjects]
  );
  const projectById = useMemo(() => new Map(timelineProjects.map((project) => [project.id, project])), [timelineProjects]);
  const brandById = useMemo(() => new Map(timelineBrands.map((brand) => [brand.id, brand])), [timelineBrands]);
  const plannerTimeline = bootstrapPlannerTimeline;
  const dateFilteredAssignments = useMemo(() => plannerTimeline?.assignments ?? [], [plannerTimeline]);
  const visibleActualAssignments = useMemo(() => plannerTimeline?.actualAssignments ?? [], [plannerTimeline]);

  const days = useMemo(() => columns.columns.map((column) => column.date), [columns.columns]);

  // Row models depend on data + days + viewMode ONLY. Expanding rows, typing in
  // search, or switching filters never rebuilds them — that was the structural
  // cause of the old timeline's sluggishness.
  const rowModels = useMemo(
    () =>
      buildEmployeeRowModels({
        employees,
        assignments: dateFilteredAssignments,
        actualAssignments: visibleActualAssignments,
        projects: timelineProjects,
        brandById,
        days,
        viewMode,
      }),
    [brandById, dateFilteredAssignments, days, employees, timelineProjects, viewMode, visibleActualAssignments]
  );

  // Filters only decide WHICH rows are visible — an ordered id list, not a rebuild.
  const visibleIds = useMemo(
    () =>
      getVisibleEmployeeIds({
        employees,
        assignments: dateFilteredAssignments,
        actualAssignments: visibleActualAssignments,
        projectById,
        selectedBrandProjectIds,
        filters: timelineFilters,
      }),
    [dateFilteredAssignments, employees, projectById, selectedBrandProjectIds, timelineFilters, visibleActualAssignments]
  );

  const rowStateResetKey = useMemo(
    () =>
      getTimelineRowStateResetKey({
        brandId,
        department,
        projectId,
        searchQuery,
      }),
    [brandId, department, projectId, searchQuery]
  );
  const previousRowStateResetKeyRef = useRef(rowStateResetKey);

  const rowVirtualizer = useVirtualizer({
    count: visibleIds.length,
    getScrollElement: () => bodyScrollRef.current,
    estimateSize: (index) => {
      const id = visibleIds[index];
      const model = id ? rowModels.get(id) : undefined;
      if (!model) return TIMELINE_V2_ROW_ESTIMATE;
      // Expansion is read non-reactively; measureElement corrects real heights
      // and the expansion subscription below re-measures on toggle.
      if (!useTimelineExpansionStore.getState().expandedIds.has(id)) {
        return TIMELINE_V2_COLLAPSED_ROW_HEIGHT;
      }
      return TIMELINE_V2_COLLAPSED_ROW_HEIGHT + Math.max(model.projectLanes.length, 1) * TIMELINE_V2_CAMPAIGN_ROW_HEIGHT;
    },
    overscan: 10,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

  // Safety valve for virtualizer height estimates when a row expands/collapses.
  useEffect(
    () =>
      useTimelineExpansionStore.subscribe(() => {
        rowVirtualizer.measure();
      }),
    [rowVirtualizer]
  );

  useEffect(() => {
    if (previousRowStateResetKeyRef.current === rowStateResetKey) return;
    previousRowStateResetKeyRef.current = rowStateResetKey;
    useTimelineExpansionStore.getState().collapseAll();
    rowVirtualizer.scrollToOffset(0);
  }, [rowStateResetKey, rowVirtualizer]);

  useEffect(() => {
    return () => {
      if (todayScrollRafRef.current !== null) {
        cancelAnimationFrame(todayScrollRafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isLayoutReady || !todayScrollTargetRef.current) return;

    const today = todayScrollTargetRef.current;
    todayScrollTargetRef.current = null;

    if (todayScrollRafRef.current !== null) {
      cancelAnimationFrame(todayScrollRafRef.current);
    }

    todayScrollRafRef.current = requestAnimationFrame(() => {
      const container = bodyScrollRef.current;
      if (!container) {
        todayScrollRafRef.current = null;
        return;
      }

      const todayIndex = columns.columns.findIndex((column) => startOfDay(column.date).getTime() === startOfDay(today).getTime());
      if (todayIndex < 0) {
        todayScrollRafRef.current = null;
        return;
      }

      const scrollLeft = getTimelineV2TodayScrollLeft({
        todayIndex,
        cellWidth,
        viewportWidth: container.offsetWidth,
      });

      container.scrollTo({ left: scrollLeft, behavior: "smooth" });
      todayScrollRafRef.current = null;
    });
  }, [cellWidth, columns.columns, isLayoutReady]);

  useEffect(() => {
    if (useCompleteEmployeeList || !hasNextEmployeePage || isFetchingNextEmployeePage) return;
    const lastVirtualRow = virtualRows[virtualRows.length - 1];
    const shouldPrefetchInitialRows = !isLoadingEmployees && visibleIds.length < 20;
    const shouldPrefetchNearEnd = !!lastVirtualRow && lastVirtualRow.index >= visibleIds.length - 10;

    if (shouldPrefetchInitialRows || shouldPrefetchNearEnd) {
      fetchNextEmployeePage();
    }
  }, [
    fetchNextEmployeePage,
    hasNextEmployeePage,
    isFetchingNextEmployeePage,
    isLoadingEmployees,
    useCompleteEmployeeList,
    virtualRows,
    visibleIds.length,
  ]);

  const rowLoadingState = getResourceRowLoadingState({
    hasPlannerData: !!plannerTimeline,
    isPlannerApplyingFilters: isFetchingPlannerHomeBootstrap,
    isPlannerRefreshing: !!plannerTimeline && isFetchingPlannerHomeBootstrap,
    hasPlannerRefreshError: !!plannerTimeline && isPlannerHomeBootstrapRefetchError,
  });
  const isInitialTimelineLoading =
    !isLayoutReady ||
    isLoadingPlannerHomeBootstrap ||
    (!plannerHomeBootstrap && (isLoadingEmployees || rowLoadingState.showInitialSkeleton));

  useEffect(() => {
    if (isInitialTimelineLoading || hasLoggedTimelineFirstVisibleRef.current) return;

    hasLoggedTimelineFirstVisibleRef.current = true;
    console.info("[Timing]", {
      flow: "planner_startup",
      phase: "timeline_first_visible",
      durationMs: Math.round(performance.now()),
      rowCount: visibleIds.length,
      columnCount: columns.columns.length,
    });
  }, [columns.columns.length, isInitialTimelineLoading, visibleIds.length]);

  const plannerFreshnessState = useMemo(() => {
    if (plannerHomeBootstrap?.metadataFreshness) {
      const freshness = plannerHomeBootstrap.metadataFreshness;
      if (freshness.state === "syncing") {
        return { tone: "syncing" as const, message: "Refreshing planner directory..." };
      }
      if (freshness.state === "stale") {
        return { tone: "warning" as const, message: "Showing saved planner data. Directory sync is stale." };
      }
      if (freshness.state === "unavailable") {
        return { tone: "warning" as const, message: "Showing saved planner data. Directory sync is unavailable." };
      }
    }

    if (isPlannerHomeBootstrapRefetchError) {
      return { tone: "warning" as const, message: "Showing saved planner data. Refresh failed." };
    }

    if (!!plannerTimeline && isFetchingPlannerHomeBootstrap) {
      return { tone: "syncing" as const, message: "Updating planner..." };
    }

    return null;
  }, [
    isFetchingPlannerHomeBootstrap,
    isPlannerHomeBootstrapRefetchError,
    plannerHomeBootstrap?.metadataFreshness,
    plannerTimeline,
  ]);

  const controller = useTimelineV2Controller({
    canEditAssignments: rowLoadingState.canEditAssignments && !!session?.access?.can_view_all,
    createdByUuid: session?.employee?.uuid ?? null,
  });

  const handleBodyScroll = useCallback(() => {
    if (!bodyScrollRef.current || !headerScrollRef.current) return;
    if (scrollSyncSourceRef.current === "header") {
      scrollSyncSourceRef.current = null;
      return;
    }

    scrollSyncSourceRef.current = "body";
    headerScrollRef.current.scrollLeft = bodyScrollRef.current.scrollLeft;
  }, []);

  const handleHeaderScroll = useCallback(() => {
    if (!headerScrollRef.current || !bodyScrollRef.current) return;
    if (scrollSyncSourceRef.current === "body") {
      scrollSyncSourceRef.current = null;
      return;
    }

    scrollSyncSourceRef.current = "header";
    bodyScrollRef.current.scrollLeft = headerScrollRef.current.scrollLeft;
  }, []);

  const handleToday = useCallback(() => {
    todayScrollTargetRef.current = new Date();
    setAnchorDate(todayScrollTargetRef.current);
  }, [setAnchorDate]);

  const handleDateChange = useCallback((date: Date) => {
    setAnchorDate(date);
  }, [setAnchorDate]);

  const handleResourceColumnResizeStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = resourceColumnWidth;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      setResourceColumnWidth(startWidth + moveEvent.clientX - startX);
    };

    const handlePointerUp = () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
  }, [resourceColumnWidth, setResourceColumnWidth]);

  return (
    <div ref={timelineRootRef} className="flex h-full flex-col" data-testid="timeline-v2-root">
      <TimelineToolbarV2
        currentDate={currentDate}
        viewMode={viewMode}
        showWeekends={showWeekends}
        onViewModeChange={setViewMode}
        onDateChange={handleDateChange}
        onToggleWeekends={toggleWeekends}
        onToday={handleToday}
      />
      {plannerFreshnessState ? (
        <TimelineDataStatusV2 tone={plannerFreshnessState.tone} message={plannerFreshnessState.message} />
      ) : null}

      {isLayoutReady ? (
        <TimelineHeaderV2
          columns={columns.columns}
          cellWidth={cellWidth}
          resourceColumnWidth={resourceColumnWidth}
          headerScrollRef={headerScrollRef}
          onHeaderScroll={handleHeaderScroll}
          onResourceColumnResizeStart={handleResourceColumnResizeStart}
        />
      ) : null}

      {isInitialTimelineLoading ? (
        <div className="flex-1 overflow-auto">
          <TimelineInitialSkeletonV2 />
        </div>
      ) : visibleIds.length === 0 ? (
        <div className="flex-1 overflow-auto">
          <TimelineEmptyStateV2 />
        </div>
      ) : (
        <TimelineBodyV2
          bodyScrollRef={bodyScrollRef}
          onBodyScroll={handleBodyScroll}
          rowVirtualizer={rowVirtualizer}
          virtualRows={virtualRows}
          visibleIds={visibleIds}
          rowModels={rowModels}
          columns={columns.columns}
          cellWidth={cellWidth}
          resourceColumnWidth={resourceColumnWidth}
          viewMode={viewMode}
          showTimelineLoading={rowLoadingState.showTimelineLoading}
          showExpandedLoading={rowLoadingState.showExpandedLoading}
          canEditAssignments={rowLoadingState.canEditAssignments && !!session?.access?.can_view_all}
          brandId={brandId}
          projectId={projectId}
          onUpdatePlanned={controller.handleUpdatePlannedAssignment}
          onDeletePlanned={controller.handleDeletePlannedAssignment}
          onOpenPlannedCreate={controller.handleCreatePlannedAssignment}
          onOpenMonthlyAllocation={controller.handleOpenMonthlyAllocation}
          isFetchingNextEmployeePage={isFetchingNextEmployeePage}
        />
      )}

      {controller.plannedPopover ? (
        <AssignmentPopover
          resourceId={controller.plannedPopover.resourceId}
          projectId={controller.plannedPopover.projectId}
          startDate={controller.plannedPopover.startDate}
          endDate={controller.plannedPopover.endDate}
          onClose={controller.closePlannedPopover}
          onSave={controller.handleSavePlannedPopover}
          isCreating={false}
        />
      ) : null}

      {controller.monthlyAllocationModal ? (
        <MonthlyAllocationModal
          key={controller.monthlyAllocationModal.existingAssignment?.id ?? "create"}
          monthStart={controller.monthlyAllocationModal.monthStart}
          monthEnd={controller.monthlyAllocationModal.monthEnd}
          resource={{
            id: controller.monthlyAllocationModal.resourceId,
            name: "",
            role: "",
          }}
          project={controller.monthlyAllocationModal.project}
          existingAssignment={controller.monthlyAllocationModal.existingAssignment}
          adjustmentAssignments={controller.monthlyAllocationModal.adjustmentAssignments}
          isFullAccess={session?.access?.can_view_all}
          monthlyTotalHours={controller.monthlyAllocationModal.monthlyTotalHours}
          planTotalHours={controller.monthlyAllocationModal.planTotalHours}
          adjustmentTotalHours={controller.monthlyAllocationModal.adjustmentTotalHours}
          onClose={controller.closeMonthlyAllocationModal}
          onSave={(data) => controller.handleSaveMonthlyAllocation(data, controller.monthlyAllocationModal?.existingAssignment)}
          onDelete={controller.handleDeleteMonthlyAllocation}
        />
      ) : null}

      {controller.monthlyAllocationConfirm ? (
        <MonthlyAllocationConfirmation
          data={controller.monthlyAllocationConfirm.data}
          isEditMode={controller.monthlyAllocationConfirm.isEditMode}
          onConfirm={controller.handleConfirmMonthlyAllocation}
          onCancel={controller.closeMonthlyAllocationConfirm}
        />
      ) : null}
    </div>
  );
}
