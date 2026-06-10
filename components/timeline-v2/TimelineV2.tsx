"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useAuth } from "@/context/AuthContext";
import {
  useEmployees,
  useInfiniteEmployees,
  usePlannerHomeBootstrap,
  usePlannerTimeline,
} from "@/lib/query/hooks";
import type { Brand } from "@/lib/query/hooks/useBrands";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import { mergePlannerTimelineResponses } from "@/lib/timeline/planner-loading";
import { filterTimelineEmployees, getLoadedTimelineEmployees, shouldUseCompleteEmployeeList } from "@/lib/timeline/employees";
import { getResourceRowLoadingState } from "@/lib/timeline/resource-row-loading";
import { getTimelineRowStateResetKey, hasEmployeeFlag, setEmployeeFlag } from "@/lib/timeline/row-state";
import { shouldEnableTimelineAssignments, type TimelineAssignmentDateRange } from "@/lib/timeline/initial-load";
import { getTimelineV2Columns, getTimelineV2Resolution } from "@/lib/timeline-v2/date-range";
import { buildTimelineV2Rows } from "@/lib/timeline-v2/row-model";
import {
  TIMELINE_V2_DEFAULT_RESOURCE_COLUMN_WIDTH,
  clampTimelineV2ResourceColumnWidth,
  getTimelineV2CellWidth,
  getTimelineV2EstimatedRowHeight,
  getTimelineV2TodayScrollLeft,
  getTimelineV2VisibleWidth,
} from "@/lib/timeline-v2/layout";
import type { TimelineV2ViewMode } from "@/lib/timeline-v2/types";
import { TimelineToolbarV2 } from "@/components/timeline-v2/TimelineToolbarV2";
import { TimelineDataStatusV2 } from "@/components/timeline-v2/TimelineDataStatusV2";
import { TimelineHeaderV2 } from "@/components/timeline-v2/TimelineHeaderV2";
import { TimelineBodyV2 } from "@/components/timeline-v2/TimelineBodyV2";
import { TimelineInitialSkeletonV2, TimelineEmptyStateV2 } from "@/components/timeline-v2/TimelineLoadingStatesV2";
import { useTimelineV2Controller } from "@/components/timeline-v2/useTimelineV2Controller";
import { AssignmentPopover } from "@/components/timeline/AssignmentPopover";
import { MonthlyAllocationModal } from "@/components/timeline/MonthlyAllocationModal";
import { MonthlyAllocationConfirmation } from "@/components/timeline/MonthlyAllocationConfirmation";
import { startOfWeek, startOfDay } from "date-fns";
import type { PlannerHomeBootstrapResponse } from "@/lib/query/server/planner-home-bootstrap";

const DEFAULT_TIMELINE_VIEW: TimelineV2ViewMode = "quarter";

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
  const [currentDate, setCurrentDate] = useState<Date>(() => getInitialDate(initialTimelineAnchor));
  const [viewMode, setViewMode] = useState<TimelineV2ViewMode>(DEFAULT_TIMELINE_VIEW);
  const [showWeekends, setShowWeekends] = useState(false);
  const [hasLoadedWeekendPreference, setHasLoadedWeekendPreference] = useState(false);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [resourceColumnWidth, setResourceColumnWidth] = useState(TIMELINE_V2_DEFAULT_RESOURCE_COLUMN_WIDTH);
  const [expandedEmployeeIds, setExpandedEmployeeIds] = useState<Set<string>>(new Set());
  const scrollSyncSourceRef = useRef<"header" | "body" | null>(null);
  const todayScrollTargetRef = useRef<Date | null>(null);
  const todayScrollRafRef = useRef<number | null>(null);
  const hasLoggedTimelineFirstVisibleRef = useRef(false);

  useEffect(() => {
    const savedShowWeekends = localStorage.getItem("showWeekends");
    if (savedShowWeekends !== null) {
      setShowWeekends(savedShowWeekends === "true");
    }
    setHasLoadedWeekendPreference(true);
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
  const isLayoutReady = hasLoadedWeekendPreference && containerWidth !== null;
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

  const useCompleteEmployeeList = shouldUseCompleteEmployeeList({
    brandId,
    department,
    projectId,
    searchQuery,
  });

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
  const bootstrapEmployeePage = useMemo(
    () =>
      plannerHomeBootstrap
        ? {
            data: plannerHomeBootstrap.employees,
            total: plannerHomeBootstrap.employeeTotal,
            hasMore: plannerHomeBootstrap.employeeHasMore,
          }
        : null,
    [plannerHomeBootstrap]
  );
  const { data: completeEmployees = [], isLoading: isLoadingCompleteEmployees } = useEmployees({
    enabled: useCompleteEmployeeList,
  });
  const {
    data: incrementalEmployeePages,
    isLoading: isLoadingIncrementalEmployees,
    hasNextPage: hasNextEmployeePage,
    isFetchingNextPage: isFetchingNextEmployeePage,
    fetchNextPage: fetchNextEmployeePage,
  } = useInfiniteEmployees(searchQuery, {
    enabled: !useCompleteEmployeeList,
    initialPage: bootstrapEmployeePage,
    initialPageUpdatedAt: plannerHomeBootstrap
      ? Date.parse(plannerHomeBootstrap.freshness.directoryFetchedAt)
      : undefined,
  });
  const employees = useMemo(
    () =>
      useCompleteEmployeeList
        ? completeEmployees.length > 0
          ? completeEmployees
          : plannerHomeBootstrap?.employees ?? []
        : getLoadedTimelineEmployees(incrementalEmployeePages?.pages),
    [
      completeEmployees,
      incrementalEmployeePages?.pages,
      plannerHomeBootstrap?.employees,
      useCompleteEmployeeList,
    ]
  );
  const isLoadingEmployees = useCompleteEmployeeList
    ? isLoadingCompleteEmployees
    : isLoadingIncrementalEmployees;
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
  const bootstrapLoadedEmployeeIds = useMemo(
    () => new Set(bootstrapPlannerTimeline?.request.employeeUuids ?? []),
    [bootstrapPlannerTimeline?.request.employeeUuids]
  );
  const lazyAssignmentEmployeeUuids = useMemo(() => {
    if (
      useCompleteEmployeeList ||
      !bootstrapRequest ||
      !bootstrapPlannerTimeline?.request.employeeUuids?.length
    ) {
      return [];
    }

    return Array.from(
      new Set(
        employees
          .map((employee) => employee.id)
          .filter((employeeId) => !bootstrapLoadedEmployeeIds.has(employeeId))
      )
    );
  }, [
    bootstrapLoadedEmployeeIds,
    bootstrapPlannerTimeline?.request.employeeUuids,
    bootstrapRequest,
    employees,
    useCompleteEmployeeList,
  ]);
  const lazyAssignmentRequest = useMemo(() => {
    if (!bootstrapPlannerTimeline || !bootstrapRequest || lazyAssignmentEmployeeUuids.length === 0) {
      return undefined;
    }

    return {
      viewMode,
      resolution: getTimelineV2Resolution(viewMode),
      startDate: bootstrapPlannerTimeline.request.startDate,
      endDate: bootstrapPlannerTimeline.request.endDate,
      employeeUuids: lazyAssignmentEmployeeUuids,
      filters: bootstrapPlannerTimeline.request.filters,
    };
  }, [
    bootstrapPlannerTimeline,
    bootstrapRequest,
    lazyAssignmentEmployeeUuids,
    viewMode,
  ]);
  const {
    data: lazyPlannerTimeline,
    previousData: previousLazyPlannerTimeline,
  } = usePlannerTimeline(lazyAssignmentRequest, {
    enabled: !!lazyAssignmentRequest,
  });
  const mergedPlannerTimeline = useMemo(
    () => mergePlannerTimelineResponses(bootstrapPlannerTimeline, [
      lazyPlannerTimeline ?? previousLazyPlannerTimeline,
    ]),
    [bootstrapPlannerTimeline, lazyPlannerTimeline, previousLazyPlannerTimeline]
  );
  const plannerTimeline = mergedPlannerTimeline;
  const dateFilteredAssignments = useMemo(() => plannerTimeline?.assignments ?? [], [plannerTimeline]);
  const visibleActualAssignments = useMemo(() => plannerTimeline?.actualAssignments ?? [], [plannerTimeline]);

  const filteredAssignments = dateFilteredAssignments;
  const visibleEmployees = useMemo(
    () =>
      filterTimelineEmployees({
        employees,
        dateFilteredAssignments,
        visibleActualAssignments,
        projectById,
        selectedBrandProjectIds,
        filters: {
          brandId,
          department,
          projectId,
          searchQuery,
        },
      }),
    [brandId, dateFilteredAssignments, department, employees, projectById, projectId, searchQuery, selectedBrandProjectIds, visibleActualAssignments]
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

  const rows = useMemo(
    () =>
      buildTimelineV2Rows({
        employees: visibleEmployees,
        assignments: filteredAssignments,
        actualAssignments: visibleActualAssignments,
        projects: timelineProjects,
        brandById,
        expandedEmployeeIds,
        filters: { brandId, department, projectId, searchQuery },
        days: columns.columns.map((column) => column.date),
        viewMode,
      }),
    [
      brandById,
      brandId,
      columns.columns,
      department,
      expandedEmployeeIds,
      filteredAssignments,
      projectId,
      searchQuery,
      timelineProjects,
      visibleActualAssignments,
      visibleEmployees,
      viewMode,
    ]
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => bodyScrollRef.current,
    estimateSize: (index) => getTimelineV2EstimatedRowHeight(rows[index]),
    overscan: 10,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

  useEffect(() => {
    if (previousRowStateResetKeyRef.current === rowStateResetKey) return;
    previousRowStateResetKeyRef.current = rowStateResetKey;
    setExpandedEmployeeIds(new Set());
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
    const shouldPrefetchInitialRows = !isLoadingEmployees && visibleEmployees.length < 20;
    const shouldPrefetchNearEnd = !!lastVirtualRow && lastVirtualRow.index >= visibleEmployees.length - 10;

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
    visibleEmployees.length,
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
      rowCount: rows.length,
      columnCount: columns.columns.length,
    });
  }, [columns.columns.length, isInitialTimelineLoading, rows.length]);

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
    setCurrentDate(startOfWeek(todayScrollTargetRef.current, { weekStartsOn: 1 }));
  }, []);

  const handleDateChange = useCallback((date: Date) => {
    setCurrentDate(startOfWeek(date, { weekStartsOn: 1 }));
  }, []);

  const handleToggleWeekends = useCallback(() => {
    setShowWeekends((prev) => {
      const next = !prev;
      localStorage.setItem("showWeekends", String(next));
      return next;
    });
  }, []);

  const handleResourceColumnResizeStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = resourceColumnWidth;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      setResourceColumnWidth(clampTimelineV2ResourceColumnWidth(startWidth + moveEvent.clientX - startX));
    };

    const handlePointerUp = () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
  }, [resourceColumnWidth]);

  return (
    <div ref={timelineRootRef} className="flex h-full flex-col" data-testid="timeline-v2-root">
      <TimelineToolbarV2
        currentDate={currentDate}
        viewMode={viewMode}
        showWeekends={showWeekends}
        onViewModeChange={setViewMode}
        onDateChange={handleDateChange}
        onToggleWeekends={handleToggleWeekends}
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
      ) : rows.length === 0 ? (
        <div className="flex-1 overflow-auto">
          <TimelineEmptyStateV2 />
        </div>
      ) : (
        <TimelineBodyV2
          bodyScrollRef={bodyScrollRef}
          onBodyScroll={handleBodyScroll}
          rowVirtualizer={rowVirtualizer}
          virtualRows={virtualRows}
          rows={rows}
          columns={columns.columns}
          cellWidth={cellWidth}
          resourceColumnWidth={resourceColumnWidth}
          viewMode={viewMode}
          showTimelineLoading={rowLoadingState.showTimelineLoading}
          showExpandedLoading={rowLoadingState.showExpandedLoading}
          canEditAssignments={rowLoadingState.canEditAssignments && !!session?.access?.can_view_all}
          onToggleExpanded={(resourceId) => {
            setExpandedEmployeeIds((prev) => setEmployeeFlag(prev, resourceId, !hasEmployeeFlag(prev, resourceId)));
          }}
          onUpdatePlanned={controller.handleUpdatePlannedAssignment}
          onDeletePlanned={controller.handleDeletePlannedAssignment}
          onOpenPlannedCreate={controller.handleCreatePlannedAssignment}
          onOpenTimeOffCreate={controller.handleCreateTimeOff}
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
          timeOffAssignments={controller.monthlyAllocationModal.detailAssignments?.filter((assignment) => assignment.isTimeOff) ?? []}
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
