"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useAuth } from "@/context/AuthContext";
import {
  useBrands,
  useEmployees,
  useInfiniteEmployees,
  usePlannerHomeBootstrap,
  usePlannerTimeline,
  useProjectsByBrand,
  useProjectOptions,
} from "@/lib/query/hooks";
import { filterTimelineEmployees, getLoadedTimelineEmployees, shouldUseCompleteEmployeeList } from "@/lib/timeline/employees";
import { mergeProjectsById, getProjectById, getProjectIdSet } from "@/lib/timeline/project-index";
import { getResourceRowLoadingState } from "@/lib/timeline/resource-row-loading";
import { getTimelineRowStateResetKey, hasEmployeeFlag, setEmployeeFlag } from "@/lib/timeline/row-state";
import { shouldEnableTimelineAssignments, type TimelineAssignmentDateRange } from "@/lib/timeline/initial-load";
import { getTimelineV2Columns, getTimelineV2Resolution } from "@/lib/timeline-v2/date-range";
import { buildTimelineV2Rows } from "@/lib/timeline-v2/row-model";
import { TIMELINE_V2_DEFAULT_RESOURCE_COLUMN_WIDTH, TIMELINE_V2_ROW_ESTIMATE, clampTimelineV2ResourceColumnWidth } from "@/lib/timeline-v2/layout";
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

const DEFAULT_TIMELINE_VIEW: TimelineV2ViewMode = "quarter";

type TimelineV2Props = {
  initialTimelineAnchor: string;
  brandId: string | null;
  department: string | null;
  searchQuery?: string;
  projectId: string | null;
};

function getInitialDate(anchor: string) {
  return new Date(`${anchor}T00:00:00`);
}

export function TimelineV2({
  initialTimelineAnchor,
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
  const [containerWidth, setContainerWidth] = useState(1400);
  const [resourceColumnWidth, setResourceColumnWidth] = useState(TIMELINE_V2_DEFAULT_RESOURCE_COLUMN_WIDTH);
  const [expandedEmployeeIds, setExpandedEmployeeIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const savedShowWeekends = localStorage.getItem("showWeekends");
    if (savedShowWeekends !== null) {
      setShowWeekends(savedShowWeekends === "true");
    }
  }, []);

  useEffect(() => {
    const rootContainer = timelineRootRef.current;
    if (!rootContainer) return;

    const updateWidth = () => {
      requestAnimationFrame(() => {
        if (!rootContainer) return;
        const rootWidth = rootContainer.clientWidth;
        const availableWidth = rootWidth - resourceColumnWidth;
        setContainerWidth(Math.max(availableWidth, 100));
      });
    };

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(rootContainer);
    updateWidth();
    return () => observer.disconnect();
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
    if (columns.columns.length === 0) return 100;
    return containerWidth / columns.columns.length;
  }, [columns.columns.length, containerWidth]);
  const shouldUseHomeBootstrap = process.env.NEXT_PUBLIC_PLANNER_HOME_BOOTSTRAP === "true";

  const useCompleteEmployeeList = shouldUseCompleteEmployeeList({
    brandId,
    department,
    projectId,
    searchQuery,
  });

  const { data: completeEmployees = [], isLoading: isLoadingCompleteEmployees } = useEmployees({
    enabled: !shouldUseHomeBootstrap && useCompleteEmployeeList,
  });
  const {
    data: incrementalEmployeePages,
    isLoading: isLoadingIncrementalEmployees,
    hasNextPage: hasNextEmployeePage,
    isFetchingNextPage: isFetchingNextEmployeePage,
    fetchNextPage: fetchNextEmployeePage,
  } = useInfiniteEmployees(searchQuery, { enabled: !shouldUseHomeBootstrap && !useCompleteEmployeeList });

  const { data: brands = [] } = useBrands();
  const { data: projects = [] } = useProjectOptions();
  const { data: selectedBrandProjects = [], isLoading: isLoadingSelectedBrandProjects } = useProjectsByBrand(brandId ?? "");
  const isLoadingBrandProjectLookup = !!brandId && isLoadingSelectedBrandProjects;
  const timelineProjects = useMemo(() => mergeProjectsById({ projects, selectedBrandProjects }), [projects, selectedBrandProjects]);
  const selectedBrandProjectIds = useMemo(() => getProjectIdSet(selectedBrandProjects), [selectedBrandProjects]);
  const projectById = useMemo(() => getProjectById(timelineProjects), [timelineProjects]);
  const brandById = useMemo(() => new Map(brands.map((brand) => [brand.id, brand])), [brands]);

  const assignmentDateRange = useMemo<TimelineAssignmentDateRange | undefined>(() => {
    if (!columns.startDate || !columns.endDate) return undefined;
    return {
      startDate: columns.startDate,
      endDate: columns.endDate,
    };
  }, [columns.endDate, columns.startDate]);

  const plannerRequest = useMemo(() => {
    if (!assignmentDateRange || !shouldEnableTimelineAssignments(assignmentDateRange)) {
      return undefined;
    }

    return {
      viewMode,
      resolution: getTimelineV2Resolution(viewMode),
      startDate: assignmentDateRange.startDate,
      endDate: assignmentDateRange.endDate,
    };
  }, [assignmentDateRange, viewMode]);

  const bootstrapRequest = useMemo(() => {
    if (!plannerRequest) return undefined;

    return {
      ...plannerRequest,
      employeeLimit: 24,
      employeeOffset: 0,
      brandId,
      department,
      projectId,
      search: searchQuery ?? null,
    };
  }, [brandId, department, plannerRequest, projectId, searchQuery]);
  const {
    data: plannerHomeBootstrap,
    isLoading: isLoadingPlannerHomeBootstrap,
    isFetching: isFetchingPlannerHomeBootstrap,
  } = usePlannerHomeBootstrap(bootstrapRequest, {
    enabled: shouldUseHomeBootstrap && shouldEnableTimelineAssignments(assignmentDateRange),
  });
  const {
    data: queriedPlannerTimeline,
    isFetching: isFetchingPlannerTimeline,
    isRefetchError: isPlannerTimelineRefetchError,
    isShowingPreviousData: isPlannerTimelineApplyingFilters,
  } = usePlannerTimeline(plannerRequest, {
    enabled: !shouldUseHomeBootstrap && shouldEnableTimelineAssignments(assignmentDateRange),
  });

  const bootstrapEmployees = shouldUseHomeBootstrap ? plannerHomeBootstrap?.employees : undefined;
  const bootstrapPlannerTimeline = shouldUseHomeBootstrap ? plannerHomeBootstrap?.plannerTimeline : undefined;
  const employees = bootstrapEmployees ?? (
    useCompleteEmployeeList
      ? completeEmployees
      : getLoadedTimelineEmployees(incrementalEmployeePages?.pages)
  );
  const isLoadingEmployees = useCompleteEmployeeList ? isLoadingCompleteEmployees : isLoadingIncrementalEmployees;
  const plannerTimeline = bootstrapPlannerTimeline ?? queriedPlannerTimeline;
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
        selectedBrandProjectIds,
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
      selectedBrandProjectIds,
      timelineProjects,
      visibleActualAssignments,
      visibleEmployees,
    ]
  );

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => bodyScrollRef.current,
    estimateSize: () => TIMELINE_V2_ROW_ESTIMATE,
    overscan: 8,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

  useEffect(() => {
    if (previousRowStateResetKeyRef.current === rowStateResetKey) return;
    previousRowStateResetKeyRef.current = rowStateResetKey;
    setExpandedEmployeeIds(new Set());
    rowVirtualizer.scrollToOffset(0);
  }, [rowStateResetKey, rowVirtualizer]);

  useEffect(() => {
    if (shouldUseHomeBootstrap || useCompleteEmployeeList || !hasNextEmployeePage || isFetchingNextEmployeePage) return;
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
    shouldUseHomeBootstrap,
    useCompleteEmployeeList,
    virtualRows,
    visibleEmployees.length,
  ]);

  const rowLoadingState = getResourceRowLoadingState({
    hasPlannerData: !!plannerTimeline,
    isPlannerApplyingFilters: isPlannerTimelineApplyingFilters,
    isPlannerRefreshing: !!plannerTimeline && (isFetchingPlannerTimeline || isFetchingPlannerHomeBootstrap),
    hasPlannerRefreshError: !!plannerTimeline && isPlannerTimelineRefetchError,
  });
  const isInitialTimelineLoading =
    (shouldUseHomeBootstrap && isLoadingPlannerHomeBootstrap) ||
    (!shouldUseHomeBootstrap && (isLoadingEmployees || isLoadingBrandProjectLookup || rowLoadingState.showInitialSkeleton));
  const plannerFreshnessState = isPlannerTimelineRefetchError
    ? { tone: "warning" as const, message: "Showing saved planner data. Refresh failed." }
    : isPlannerTimelineApplyingFilters
      ? { tone: "syncing" as const, message: "Applying filters..." }
      : !!plannerTimeline && (isFetchingPlannerTimeline || isFetchingPlannerHomeBootstrap)
        ? { tone: "syncing" as const, message: "Updating planner..." }
        : null;

  const controller = useTimelineV2Controller({
    canEditAssignments: rowLoadingState.canEditAssignments && !!session?.access?.can_view_all,
    createdByUuid: session?.employee?.uuid ?? null,
  });

  const handleBodyScroll = useCallback(() => {
    if (bodyScrollRef.current && headerScrollRef.current) {
      headerScrollRef.current.scrollLeft = bodyScrollRef.current.scrollLeft;
    }
  }, []);

  const handleHeaderScroll = useCallback(() => {
    if (headerScrollRef.current && bodyScrollRef.current) {
      bodyScrollRef.current.scrollLeft = headerScrollRef.current.scrollLeft;
    }
  }, []);

  const handleToday = useCallback(() => {
    const today = new Date();
    setCurrentDate(startOfWeek(today, { weekStartsOn: 1 }));
    setTimeout(() => {
      if (!bodyScrollRef.current) return;
      const todayIndex = columns.columns.findIndex((column) => startOfDay(column.date).getTime() === startOfDay(today).getTime());
      if (todayIndex < 0) return;
      const container = bodyScrollRef.current;
      const containerWidthPx = container.offsetWidth;
      const scrollLeft = (todayIndex * cellWidth) - (containerWidthPx / 2) + (cellWidth / 2);
      container.scrollTo({ left: Math.max(0, scrollLeft), behavior: "smooth" });
    }, 100);
  }, [cellWidth, columns.columns]);

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

      <TimelineHeaderV2
        columns={columns.columns}
        cellWidth={cellWidth}
        resourceColumnWidth={resourceColumnWidth}
        headerScrollRef={headerScrollRef}
        onHeaderScroll={handleHeaderScroll}
        onResourceColumnResizeStart={handleResourceColumnResizeStart}
      />

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
