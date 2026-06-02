"use client";

import React, { useRef, useMemo, useCallback, useState, useEffect } from "react";
import {
  useBrands,
  useEmployees,
  useInfiniteEmployees,
  usePlannerTimeline,
  useProjectsByBrand,
  useProjectOptions,
} from "@/lib/query/hooks";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  getActualAssignmentsForEmployee,
  groupActualAssignmentsByEmployee,
} from "@/lib/timeline/actuals";
import {
  filterTimelineEmployees,
  getLoadedTimelineEmployees,
  shouldUseCompleteEmployeeList,
} from "@/lib/timeline/employees";
import {
  getProjectById,
  getProjectIdSet,
  mergeProjectsById,
} from "@/lib/timeline/project-index";
import {
  DEFAULT_TIMELINE_VIEW,
  getInitialTimelineDateRange,
  shouldEnableTimelineAssignments,
  type TimelineAssignmentDateRange,
} from "@/lib/timeline/initial-load";
import { getTimelineResolution } from "@/lib/timeline/planner-loading";
import { getResourceRowLoadingState } from "@/lib/timeline/resource-row-loading";
import {
  getTimelineRowStateResetKey,
  hasEmployeeFlag,
  setEmployeeFlag,
} from "@/lib/timeline/row-state";
import { getTimelineHeaderLayout } from "@/lib/timeline/header-layout";
import { ResourceRow } from "./ResourceRow";
import { TimelineDataStatus } from "./TimelineDataStatus";
import { TimelineHeaderControls, ViewMode } from "./TimelineHeaderControls";
import { addDays, addMonths, format, startOfWeek, startOfMonth, eachDayOfInterval, eachMonthOfInterval, startOfDay, isToday, getMonth, getYear } from "date-fns";
import { cn, toLocalDateString } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface TimelineProps {
  initialTimelineAnchor: string;
  brandId: string | null;
  department: string | null;
  searchQuery?: string;
  projectId: string | null;
  category: string | null;
  status: string | null;
}

const EMPTY_ASSIGNMENTS: NonNullable<import("@/lib/timeline/planner-loading").PlannerTimelineResponse["assignments"]> = [];
const EMPTY_ACTUAL_ASSIGNMENTS: NonNullable<import("@/lib/timeline/planner-loading").PlannerTimelineResponse["actualAssignments"]> = [];
const DEFAULT_RESOURCE_COLUMN_WIDTH = 250;
const MIN_RESOURCE_COLUMN_WIDTH = 220;
const MAX_RESOURCE_COLUMN_WIDTH = 420;
const TIMELINE_ROW_ESTIMATE = 56;

function clampResourceColumnWidth(width: number) {
  return Math.min(MAX_RESOURCE_COLUMN_WIDTH, Math.max(MIN_RESOURCE_COLUMN_WIDTH, width));
}

export const Timeline: React.FC<TimelineProps> = ({
  initialTimelineAnchor,
  brandId,
  department,
  searchQuery,
  projectId,
  category,
  status,
}) => {
  // Fetch data using React Query (assignments fetched after date range is calculated)
  const useCompleteEmployeeList = shouldUseCompleteEmployeeList({ brandId, department, projectId, searchQuery });
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
  });
  const employees = useCompleteEmployeeList
    ? completeEmployees
    : getLoadedTimelineEmployees(incrementalEmployeePages?.pages);
  const isLoadingEmployees = useCompleteEmployeeList
    ? isLoadingCompleteEmployees
    : isLoadingIncrementalEmployees;
  const { data: brands = [] } = useBrands();
  const { data: projects = [], isLoading: isLoadingProjects } = useProjectOptions();
  const {
    data: selectedBrandProjects = [],
    isLoading: isLoadingSelectedBrandProjects,
  } = useProjectsByBrand(brandId ?? "");
  const isLoadingBrandProjectLookup = !!brandId && isLoadingSelectedBrandProjects;
  const timelineProjects = useMemo(
    () => mergeProjectsById({ projects, selectedBrandProjects }),
    [projects, selectedBrandProjects]
  );
  const selectedBrandProjectIds = useMemo(
    () => getProjectIdSet(selectedBrandProjects),
    [selectedBrandProjects]
  );
  const projectById = useMemo(
    () => getProjectById(timelineProjects),
    [timelineProjects]
  );
  const brandById = useMemo(
    () => new Map(brands.map((brand) => [brand.id, brand])),
    [brands]
  );

  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const timelineRootRef = useRef<HTMLDivElement>(null);

  // Timeline state
  const [currentDate, setCurrentDate] = useState<Date>(
    () => new Date(`${initialTimelineAnchor}T00:00:00`)
  );
  const [viewMode, setViewMode] = useState<ViewMode>(DEFAULT_TIMELINE_VIEW);
  const [showWeekends, setShowWeekends] = useState(false); // Default: hidden
  const [containerWidth, setContainerWidth] = useState(1400); // Track actual container width
  const [resourceColumnWidth, setResourceColumnWidth] = useState(DEFAULT_RESOURCE_COLUMN_WIDTH);

  useEffect(() => {
    // Load weekend preference from localStorage
    const savedShowWeekends = localStorage.getItem('showWeekends');
    if (savedShowWeekends !== null) {
      setShowWeekends(savedShowWeekends === 'true');
    }
  }, []);

  // Track container width with ResizeObserver on timeline-root container
  useEffect(() => {
    const rootContainer = timelineRootRef.current;
    if (!rootContainer) {
      return;
    }

    const updateWidth = () => {
      // Use requestAnimationFrame to ensure measurement happens after layout is complete
      requestAnimationFrame(() => {
        if (!rootContainer) return;
        // Measure the timeline-root container width (excluding borders and scrollbars)
        const rootWidth = rootContainer.clientWidth;
        // Subtract the resizable resource sidebar width to get available width for timeline
        const availableWidth = rootWidth - resourceColumnWidth;
        setContainerWidth(Math.max(availableWidth, 100)); // Minimum 100px
      });
    };

    const resizeObserver = new ResizeObserver(() => {
      updateWidth();
    });

    resizeObserver.observe(rootContainer);
    updateWidth();

    return () => {
      resizeObserver.disconnect();
    };
  }, [currentDate, resourceColumnWidth]); // Re-run when currentDate changes to ensure ref is ready

  // Calculate days/weeks based on view mode and current date
  const allDays = useMemo(() => {
    switch (viewMode) {
      case "week": {
        // Show 7 days (Mon-Sun) - start from Monday of current week
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const weekEnd = addDays(weekStart, 6);
        return eachDayOfInterval({ start: weekStart, end: weekEnd });
      }
      case "month": {
        // Show all days in the month (daily view like week view)
        const monthStart = startOfMonth(currentDate);
        const monthEnd = addDays(startOfMonth(addMonths(currentDate, 1)), -1);
        return eachDayOfInterval({ start: monthStart, end: monthEnd });
      }
      case "quarter": {
        // Show calendar quarter (Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec)
        const currentMonth = currentDate.getMonth();
        const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
        const quarterStart = new Date(currentDate.getFullYear(), quarterStartMonth, 1);
        const quarterEnd = new Date(currentDate.getFullYear(), quarterStartMonth + 2, 1);
        return eachMonthOfInterval({ start: quarterStart, end: quarterEnd });
      }
      case "halfYear": {
        // Show calendar half year (H1: Jan-Jun, H2: Jul-Dec)
        const currentMonth = currentDate.getMonth();
        const halfYearStartMonth = currentMonth < 6 ? 0 : 6;
        const halfYearStart = new Date(currentDate.getFullYear(), halfYearStartMonth, 1);
        const halfYearEnd = new Date(currentDate.getFullYear(), halfYearStartMonth + 5, 1);
        return eachMonthOfInterval({ start: halfYearStart, end: halfYearEnd });
      }
      case "year": {
        // Show full calendar year (Jan-Dec)
        const yearStart = new Date(currentDate.getFullYear(), 0, 1);
        const yearEnd = new Date(currentDate.getFullYear(), 11, 1);
        return eachMonthOfInterval({ start: yearStart, end: yearEnd });
      }
      default:
        return [];
    }
  }, [currentDate, viewMode]);

  // Filter out weekends if needed (for week and month views)
  const days = useMemo(() => {
    // For quarter, halfYear, and year views, we're showing months - no weekend filtering
    if (viewMode === "quarter" || viewMode === "halfYear" || viewMode === "year") {
      return allDays;
    }

    // For week and month views, apply weekend filter if needed
    if (showWeekends) return allDays;
    return allDays.filter(day => {
      const dayOfWeek = day.getDay();
      return dayOfWeek !== 0 && dayOfWeek !== 6;
    });
  }, [allDays, showWeekends, viewMode]);

  // Cell width based on visible days - fills available space exactly
  const cellWidth = useMemo(() => {
    // Always use visible days count for cell width
    // This ensures cells expand to fill available width when weekends are hidden
    const dayCount = days.length;
    if (dayCount === 0) return 100;

    const calculatedWidth = containerWidth / dayCount;
    return calculatedWidth;
  }, [days.length, containerWidth]);
  const headerLayout = getTimelineHeaderLayout({
    columnCount: days.length,
    cellWidth,
  });

  // Determine if we're in week view mode (where each cell = 1 month)
  // Month view now shows daily columns like week view, so it's not included here
  const isWeekView = viewMode === "quarter" || viewMode === "halfYear" || viewMode === "year";

  // PERFORMANCE: Calculate date range for assignments API filtering.
  const assignmentDateRange = useMemo<TimelineAssignmentDateRange | undefined>(() => {
    if (days.length === 0) return undefined;
    return getInitialTimelineDateRange(toLocalDateString(currentDate), viewMode);
  }, [currentDate, days.length, viewMode]);

  const plannerRequest = useMemo(() => {
    if (!assignmentDateRange || !shouldEnableTimelineAssignments(assignmentDateRange)) {
      return undefined;
    }

    return {
      viewMode,
      resolution: getTimelineResolution(viewMode),
      startDate: assignmentDateRange.startDate,
      endDate: assignmentDateRange.endDate,
      filters: {
        category,
        status,
      },
    };
  }, [assignmentDateRange, category, status, viewMode]);

  const {
    data: plannerTimeline,
    isLoadingCurrentData: isLoadingPlannerTimeline,
    isFetching: isFetchingPlannerTimeline,
    isRefetchError: isPlannerTimelineRefetchError,
    isShowingPreviousData: isPlannerTimelineApplyingFilters,
  } = usePlannerTimeline(plannerRequest, {
    enabled: shouldEnableTimelineAssignments(assignmentDateRange),
  });
  const dateFilteredAssignments = plannerTimeline?.assignments ?? EMPTY_ASSIGNMENTS;
  const visibleActualAssignments = plannerTimeline?.actualAssignments ?? EMPTY_ACTUAL_ASSIGNMENTS;

  const actualAssignmentsByEmployee = useMemo(
    () => groupActualAssignmentsByEmployee(visibleActualAssignments),
    [visibleActualAssignments]
  );

  const filteredAssignments = dateFilteredAssignments;


  // PERFORMANCE: Pre-group assignments by employee ID to avoid N+1 query problem
  // Each ResourceRow was previously fetching ALL assignments and filtering them
  // This eliminates 100,000+ comparisons per render (100 employees × 1000 assignments)
  const assignmentsByEmployee = useMemo(() => {
    const grouped = new Map<string, typeof filteredAssignments>();
    filteredAssignments.forEach(a => {
      if (!grouped.has(a.employeeId)) {
        grouped.set(a.employeeId, []);
      }
      grouped.get(a.employeeId)!.push(a);
    });
    return grouped;
  }, [filteredAssignments]);

  // Filter employees based on selected Brand, Department, Project, and Search Query
  const visibleEmployees = useMemo(() => filterTimelineEmployees({
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
  }), [
    brandId,
    dateFilteredAssignments,
    department,
    employees,
    projectById,
    projectId,
    searchQuery,
    selectedBrandProjectIds,
    visibleActualAssignments,
  ]);

  const rowVirtualizer = useVirtualizer({
    count: visibleEmployees.length,
    getScrollElement: () => bodyScrollRef.current,
    estimateSize: () => TIMELINE_ROW_ESTIMATE,
    overscan: 8,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const [expandedEmployeeIds, setExpandedEmployeeIds] = useState<Set<string>>(new Set());
  const rowStateResetKey = useMemo(
    () =>
      getTimelineRowStateResetKey({
        brandId,
        department,
        projectId,
        category,
        status,
        searchQuery,
      }),
    [brandId, category, department, projectId, searchQuery, status]
  );
  const previousRowStateResetKeyRef = useRef(rowStateResetKey);

  useEffect(() => {
    if (useCompleteEmployeeList || !hasNextEmployeePage || isFetchingNextEmployeePage) {
      return;
    }

    const lastVirtualRow = virtualRows[virtualRows.length - 1];
    const shouldPrefetchInitialRows = !isLoadingEmployees && visibleEmployees.length < 20;
    const shouldPrefetchNearEnd =
      !!lastVirtualRow && lastVirtualRow.index >= visibleEmployees.length - 10;

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

  useEffect(() => {
    if (previousRowStateResetKeyRef.current === rowStateResetKey) {
      return;
    }

    previousRowStateResetKeyRef.current = rowStateResetKey;
    setExpandedEmployeeIds(new Set());
    rowVirtualizer.scrollToOffset(0);
  }, [rowStateResetKey, rowVirtualizer]);

  // Synchronize horizontal scroll between header and body
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

    // Scroll to center today's date
    setTimeout(() => {
      if (bodyScrollRef.current) {
        const todayIndex = days.findIndex(d =>
          startOfDay(d).getTime() === startOfDay(today).getTime()
        );

        if (todayIndex >= 0) {
          const container = bodyScrollRef.current;
          const containerWidth = container.offsetWidth;
          const cellWidth = containerWidth / days.length;

          // Calculate position to center today: today's position - half container width + half cell width
          const scrollLeft = (todayIndex * cellWidth) - (containerWidth / 2) + (cellWidth / 2);

          container.scrollTo({
            left: Math.max(0, scrollLeft),
            behavior: 'smooth'
          });
        }
      }
    }, 100); // Small delay to ensure DOM is updated
  }, [days]);

  const handleDateChange = useCallback((date: Date) => {
    setCurrentDate(startOfWeek(date, { weekStartsOn: 1 }));
  }, []);

  const handleToggleWeekends = useCallback(() => {
    setShowWeekends(prev => {
      const newValue = !prev;
      localStorage.setItem('showWeekends', String(newValue));
      return newValue;
    });
  }, []);

  const handleResourceColumnResizeStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    const startX = event.clientX;
    const startWidth = resourceColumnWidth;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      setResourceColumnWidth(clampResourceColumnWidth(startWidth + moveEvent.clientX - startX));
    };

    const handlePointerUp = () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
  }, [resourceColumnWidth]);

  const hasPlannerData = !!plannerTimeline;
  const isPlannerRefreshingFromCachedData =
    hasPlannerData && isFetchingPlannerTimeline;
  const hasPlannerRefreshError =
    hasPlannerData && isPlannerTimelineRefetchError;
  const rowLoadingState = getResourceRowLoadingState({
    hasPlannerData,
    isPlannerApplyingFilters: isPlannerTimelineApplyingFilters,
    isPlannerRefreshing: isPlannerRefreshingFromCachedData,
    hasPlannerRefreshError,
  });
  const isInitialTimelineLoading =
    isLoadingEmployees || isLoadingBrandProjectLookup || rowLoadingState.showInitialSkeleton;
  const plannerFreshnessState = hasPlannerRefreshError
    ? {
        tone: "warning" as const,
        message: "Showing saved planner data. Refresh failed.",
      }
    : isPlannerTimelineApplyingFilters
      ? {
          tone: "syncing" as const,
          message: "Applying filters...",
        }
      : isPlannerRefreshingFromCachedData
        ? {
            tone: "syncing" as const,
            message: "Updating planner...",
          }
        : null;

  return (
    <div ref={timelineRootRef} className="flex flex-col h-full" data-testid="timeline-root">
      {/* Timeline Controls */}
      <TimelineHeaderControls
        currentDate={currentDate}
        viewMode={viewMode}
        showWeekends={showWeekends}
        onViewModeChange={setViewMode}
        onDateChange={handleDateChange}
        onToggleWeekends={handleToggleWeekends}
        onToday={handleToday}
      />
      {plannerFreshnessState ? (
        <TimelineDataStatus
          tone={plannerFreshnessState.tone}
          message={plannerFreshnessState.message}
        />
      ) : null}

      {/* Timeline Header (Days) - Sticky */}
      <div className="flex border-b bg-muted/40 sticky top-0 z-10">
        <div
          className="relative shrink-0 p-4 font-semibold border-r bg-background"
          style={{ width: resourceColumnWidth }}
        >
          Resources
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize resources column"
            className="absolute right-0 top-0 h-full w-2 translate-x-1 cursor-col-resize touch-none"
            onPointerDown={handleResourceColumnResizeStart}
          >
            <div className="mx-auto h-full w-px bg-border transition-colors hover:bg-primary/60" />
          </div>
        </div>
        <div 
          ref={headerScrollRef}
          onScroll={handleHeaderScroll}
          className="flex-1 overflow-x-auto scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          tabIndex={0}
          aria-label="Timeline day headers"
        >
          <div className="flex relative" style={{ width: headerLayout.headerWidth }}>
            {days.map((day) => {
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              const isMonthRangeView = viewMode === "quarter" || viewMode === "halfYear" || viewMode === "year";
              const today = isToday(day);
              const currentMonth = getMonth(day) === getMonth(new Date()) && getYear(day) === getYear(new Date());

              // Month view now shows individual days, not weeks - no week range calculation needed

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "border-r text-center text-sm shrink-0 relative",
                    isMonthRangeView ? "p-4" : "p-2",
                    isWeekend && !isMonthRangeView ? "bg-muted/50" : "bg-background",
                    today && "border-b-2 border-b-primary bg-muted/30",
                    isMonthRangeView && currentMonth && "border-b-2 border-b-primary bg-muted/30"
                  )}
                  style={{ width: headerLayout.columnWidth }}
                  data-testid="timeline-day-cell"
                  data-date={format(day, "yyyy-MM-dd")}
                  data-weekend={String(isWeekend)}
                  data-today={String(today)}
                >
                  {isMonthRangeView ? (
                    <div className="flex flex-col justify-center">
                      <div className="font-semibold">{format(day, "MMMM")}</div>
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      <div className="font-semibold">{format(day, "EEE")}</div>
                      <div className="text-muted-foreground">{format(day, "d")}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Timeline Body (Employees) */}
      <div 
        ref={bodyScrollRef}
        onScroll={handleBodyScroll}
        className="flex-1 overflow-auto"
      >
        <div className="flex flex-col w-full">
          {isInitialTimelineLoading ? (
             <div className="space-y-0">
               {[1, 2, 3, 4, 5].map((i) => (
                 <div key={i} className="flex border-b">
	                   <div
                       className="shrink-0 p-3 border-r sticky left-0 bg-background z-20 flex items-center gap-3"
                       style={{ width: resourceColumnWidth }}
                     >
                     <Skeleton className="h-8 w-8 rounded-full" />
                     <div className="space-y-2 flex-1">
                       <Skeleton className="h-4 w-3/4" />
                       <Skeleton className="h-3 w-1/2" />
                     </div>
                   </div>
                   <div className="flex-1 px-2 py-4 space-y-2">
                     <Skeleton className="h-full w-full opacity-20" />
                   </div>
                 </div>
               ))}
             </div>
          ) : visibleEmployees.length === 0 ? (
             <div className="p-8 text-center text-muted-foreground">
                 No results found
             </div>
          ) : (
             <div
               className="relative w-full"
               style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
             >
               {virtualRows.map((virtualRow) => {
                 const employee = visibleEmployees[virtualRow.index];
                 if (!employee) return null;

                 const employeeIsExpanded = hasEmployeeFlag(expandedEmployeeIds, employee.id);

                 return (
                   <div
                     key={`${employee.id}:${rowStateResetKey}`}
                     data-index={virtualRow.index}
                     ref={rowVirtualizer.measureElement}
                     className="absolute left-0 top-0 w-full"
                     style={{ transform: `translateY(${virtualRow.start}px)` }}
                   >
                     <ResourceRow
                       resource={{
                         id: employee.id,
                         name: employee.fullName,
                         role: employee.position,
                         department: employee.department?.name || "",
                         capacity: employee.weeklyCapacity,
                       }}
                       days={days}
                       brandId={brandId}
                       selectedProjectId={projectId}
                       cellWidth={cellWidth}
	                       isWeekView={isWeekView}
                       resourceColumnWidth={resourceColumnWidth}
	                       assignments={assignmentsByEmployee.get(employee.id) || []}
                       actualAssignments={getActualAssignmentsForEmployee(actualAssignmentsByEmployee, employee.id)}
                       isExpanded={employeeIsExpanded}
                       setIsExpanded={(value) =>
                         setExpandedEmployeeIds((prev) =>
                           setEmployeeFlag(
                             prev,
                             employee.id,
                             typeof value === "function" ? value(hasEmployeeFlag(prev, employee.id)) : value
                           )
                         )
                       }
                       viewMode={viewMode}
                       projects={timelineProjects}
                       projectById={projectById}
                       brandById={brandById}
                       isLoadingProjects={isLoadingProjects}
                       showTimelineLoading={rowLoadingState.showTimelineLoading}
                       showExpandedLoading={rowLoadingState.showExpandedLoading}
                       canEditAssignments={rowLoadingState.canEditAssignments}
                     />
                   </div>
                 );
               })}
               {!useCompleteEmployeeList && isFetchingNextEmployeePage ? (
                 <div
                   className="absolute left-0 w-full border-b bg-background p-4 text-sm text-muted-foreground"
                   style={{ transform: `translateY(${rowVirtualizer.getTotalSize()}px)` }}
                 >
                   Loading more employees...
                 </div>
               ) : null}
             </div>
          )}
        </div>
      </div>

    </div>
  );
};
