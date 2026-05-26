"use client";

import React, { useRef, useMemo, useCallback, useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useEmployees, useBrands, useProjects, useDepartments } from "@/lib/query/hooks";
import { useAssignments, type Assignment } from "@/lib/query/hooks/useAssignments";
import { useActualAssignments, type ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import { ResourceRow } from "./ResourceRow";
import { AggregatedRow } from "./AggregatedRow";
import { AssignProjectModal } from "./AssignProjectModal";
import { TimelineHeaderControls, ViewMode, ResourceView } from "./TimelineHeaderControls";
import { addDays, addMonths, format, startOfWeek, startOfMonth, eachDayOfInterval, eachMonthOfInterval, startOfDay, isToday, getMonth, getYear } from "date-fns";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TIMELINE_LOAD_MORE_THRESHOLD_PX,
  TIMELINE_ROW_BATCH_SIZE,
  getEffectiveRenderedRowCount,
  getNextRenderedRowCount,
  groupActualAssignmentsByEmployee,
} from "./timeline-performance";
import {
  getAssignmentDepartmentId,
  groupAssignmentsByDepartment,
} from "./timeline-aggregation";
import { getTimelineDateRange } from "./timeline-date-range";

interface TimelineProps {
  initialTimelineAnchor: string;
  brandId: string | null;
  department: string | null;
  searchQuery?: string;
  projectId: string | null;
  category: string | null;
  status: string | null;
}

const EMPTY_ASSIGNMENTS: Assignment[] = [];
const EMPTY_ACTUAL_ASSIGNMENTS: ActualAssignment[] = [];

export const Timeline: React.FC<TimelineProps> = ({ brandId, department, searchQuery, projectId, category, status }) => {
  // Fetch data using React Query
  const { data: employees = [], isLoading: isLoadingEmployees } = useEmployees();
  const { data: brands = [], isLoading: isLoadingBrands, isError: isBrandsError } = useBrands();
  const { data: departments = [], isLoading: isLoadingDepartments, isError: isDepartmentsError } = useDepartments();
  const { data: projects = [] } = useProjects();

  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const timelineRootRef = useRef<HTMLDivElement>(null);

  // Modal state for assigning projects
  const [assignModalResourceId, setAssignModalResourceId] = useState<string | null>(null);

  // Timeline state
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [showWeekends, setShowWeekends] = useState(false);
  const [resourceView, setResourceView] = useState<ResourceView>("employee");
  const [containerWidth, setContainerWidth] = useState(1400);
  const [renderWindow, setRenderWindow] = useState({
    key: "",
    count: TIMELINE_ROW_BATCH_SIZE,
  });

  // Initialize dates client-side
  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      setCurrentDate(startOfWeek(new Date(), { weekStartsOn: 1 }));

      // Load weekend preference from localStorage
      const savedShowWeekends = localStorage.getItem('showWeekends');
      if (savedShowWeekends !== null) {
        setShowWeekends(savedShowWeekends === 'true');
      }
    });

    return () => cancelAnimationFrame(frameId);
  }, []);

  // Track container width
  useEffect(() => {
    const rootContainer = timelineRootRef.current;
    if (!rootContainer) return;

    const updateWidth = () => {
      requestAnimationFrame(() => {
        if (!rootContainer) return;
        const rootWidth = rootContainer.clientWidth;
        const sidebarWidth = 250;
        const availableWidth = rootWidth - sidebarWidth;
        setContainerWidth(Math.max(availableWidth, 100));
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
  }, [currentDate]);

  // Calculate days/weeks based on view mode
  const allDays = useMemo(() => {
    switch (viewMode) {
      case "week": {
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const weekEnd = addDays(weekStart, 6);
        return eachDayOfInterval({ start: weekStart, end: weekEnd });
      }
      case "month": {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = addDays(startOfMonth(addMonths(currentDate, 1)), -1);
        return eachDayOfInterval({ start: monthStart, end: monthEnd });
      }
      case "quarter": {
        const currentMonth = currentDate.getMonth();
        const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
        const quarterStart = new Date(currentDate.getFullYear(), quarterStartMonth, 1);
        const quarterEnd = new Date(currentDate.getFullYear(), quarterStartMonth + 2, 1);
        return eachMonthOfInterval({ start: quarterStart, end: quarterEnd });
      }
      case "halfYear": {
        const currentMonth = currentDate.getMonth();
        const halfYearStartMonth = currentMonth < 6 ? 0 : 6;
        const halfYearStart = new Date(currentDate.getFullYear(), halfYearStartMonth, 1);
        const halfYearEnd = new Date(currentDate.getFullYear(), halfYearStartMonth + 5, 1);
        return eachMonthOfInterval({ start: halfYearStart, end: halfYearEnd });
      }
      case "year": {
        const yearStart = new Date(currentDate.getFullYear(), 0, 1);
        const yearEnd = new Date(currentDate.getFullYear(), 11, 1);
        return eachMonthOfInterval({ start: yearStart, end: yearEnd });
      }
      default:
        return [];
    }
  }, [currentDate, viewMode]);

  // Filter weekends
  const days = useMemo(() => {
    if (viewMode === "quarter" || viewMode === "halfYear" || viewMode === "year") {
      return allDays;
    }
    if (showWeekends) return allDays;
    return allDays.filter(day => {
      const dayOfWeek = day.getDay();
      return dayOfWeek !== 0 && dayOfWeek !== 6;
    });
  }, [allDays, showWeekends, viewMode]);

  const cellWidth = useMemo(() => {
    const dayCount = days.length;
    if (dayCount === 0) return 100;
    return containerWidth / dayCount;
  }, [days.length, containerWidth]);
  const headerLayout = getTimelineHeaderLayout({
    columnCount: days.length,
    cellWidth,
  });

  const isWeekView = viewMode === "quarter" || viewMode === "halfYear" || viewMode === "year";

  const assignmentParams = useMemo(
    () => getTimelineDateRange(days, viewMode),
    [days, viewMode]
  );

  const { data: dateFilteredAssignments = [] } = useAssignments(assignmentParams, {
    enabled: days.length > 0,
  });

  const actualAssignmentParams = useMemo(() => {
    if (!assignmentParams) return undefined;
    return {
      start_date: assignmentParams.startDate,
      end_date: assignmentParams.endDate,
    };
  }, [assignmentParams]);

  const { data: actualAssignments = [] } = useActualAssignments(actualAssignmentParams, {
    enabled: days.length > 0,
  });

  const projectById = useMemo(() => {
    return new Map(projects.map((project) => [project.id, project]));
  }, [projects]);

  const employeeById = useMemo(() => {
    return new Map(employees.map((employee) => [employee.id, employee]));
  }, [employees]);

  const brandById = useMemo(() => {
    return new Map(brands.map((brand) => [brand.id, brand]));
  }, [brands]);

  // Apply filters
  const filteredAssignments = useMemo(() => {
    let filtered = dateFilteredAssignments;

    if (projectId) {
      filtered = filtered.filter(a => a.projectId === projectId);
    }

    if (brandId) {
      filtered = filtered.filter((assignment) => {
        if (assignment.project?.brand?.id === brandId) return true;
        const project = assignment.projectId ? projectById.get(assignment.projectId) : undefined;
        return project?.brandId === brandId;
      });
    }

    if (department) {
      filtered = filtered.filter((assignment) => {
        const assignmentDepartmentId = getAssignmentDepartmentId(assignment, employeeById);
        return assignmentDepartmentId === department;
      });
    }

    if (category) {
      filtered = filtered.filter(a => a.category === category);
    }

    if (status) {
      filtered = filtered.filter(a => a.status === status);
    }

    return filtered;
  }, [dateFilteredAssignments, projectId, brandId, department, category, status, projectById, employeeById]);

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

  const actualAssignmentsByEmployee = useMemo(
    () => groupActualAssignmentsByEmployee(actualAssignments),
    [actualAssignments]
  );

  // Aggregate by Department
  const assignmentsByDepartment = useMemo(() => {
    if (resourceView !== "department") return new Map<string, { name: string; color: string; assignments: typeof filteredAssignments }>();

    return groupAssignmentsByDepartment({
      assignments: filteredAssignments,
      departments,
      employeeById,
      selectedDepartmentId: department,
      searchQuery,
    });
  }, [filteredAssignments, resourceView, employeeById, departments, department, searchQuery]);

  // Aggregate by Brand
  const assignmentsByBrand = useMemo(() => {
    if (resourceView !== "brand") return new Map<string, { name: string; color: string; assignments: typeof filteredAssignments }>();

    const grouped = new Map<string, { name: string; color: string; assignments: typeof filteredAssignments }>();
    let filteredBrands = brands;

    if (brandId) {
      filteredBrands = filteredBrands.filter(b => b.id === brandId);
    }

    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filteredBrands = filteredBrands.filter(b => b.name.toLowerCase().includes(query));
    }

    for (const brand of filteredBrands) {
      grouped.set(brand.id, {
        name: brand.name,
        color: brand.color || "#6b7280",
        assignments: [],
      });
    }

    for (const assignment of filteredAssignments) {
      const project = assignment.projectId ? projectById.get(assignment.projectId) : undefined;
      const brand = assignment.project?.brand ?? (project?.brandId ? brandById.get(project.brandId) : undefined);
      if (!brand) continue;
      grouped.get(brand.id)?.assignments.push(assignment);
    }

    return new Map([...grouped.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name)));
  }, [filteredAssignments, resourceView, projectById, brandById, brands, brandId, searchQuery]);

  const visibleEmployees = useMemo(() => {
    let filtered = employees;

    if (brandId) {
      const brand = brands.find((b) => b.id === brandId);
      const memberIds = new Set(brand?.employeeBrandAssignments?.map((a) => a.employeeId) ?? []);

      // PERFORMANCE: Use dateFilteredAssignments instead of allAssignments for filtering
      const assignmentIds = new Set(
        dateFilteredAssignments
          .filter((a) => {
            if (a.project?.brand?.id === brandId) return true;
            const project = projects.find((p) => p.id === a.projectId);
            return project?.brandId === brandId;
          })
          .map((a) => a.employeeId)
      );

      const hasEmployeeBrandData = brand?.employeeBrandAssignments && brand.employeeBrandAssignments.length > 0;
      const hasAssignmentData = assignmentIds.size > 0;

      if (hasEmployeeBrandData || hasAssignmentData) {
        filtered = filtered.filter((emp) => {
          if (hasEmployeeBrandData) {
            return memberIds.has(emp.id) || assignmentIds.has(emp.id);
          }
          return assignmentIds.has(emp.id);
        });
      }
    }

    if (department) {
      filtered = filtered.filter((emp) => emp.departmentId === department);
    }

    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((emp) => {
        if (emp.fullName.toLowerCase().includes(query)) return true;
        if (emp.position?.toLowerCase().includes(query)) return true;
        if (emp.department?.name?.toLowerCase().includes(query)) return true;

        if (emp.assignments) {
          for (const assignment of emp.assignments) {
            if (assignment.project?.name?.toLowerCase().includes(query)) return true;
          }
        }

        if (emp.employeeBrandAssignments) {
          for (const brandAssignment of emp.employeeBrandAssignments) {
            if (brandAssignment.brand?.name?.toLowerCase().includes(query)) return true;
          }
        }
        return false;
      });
    }

    const sorted = [...filtered].sort((a, b) => {
      const aIsCurrentUser = a.id === session?.employee?.uuid;
      const bIsCurrentUser = b.id === session?.employee?.uuid;
      if (aIsCurrentUser && !bIsCurrentUser) return -1;
      if (!aIsCurrentUser && bIsCurrentUser) return 1;
      return a.fullName.localeCompare(b.fullName);
    });

    return sorted;
  }, [brandId, department, searchQuery, employees, brands, dateFilteredAssignments, projects, session]);

  const renderWindowKey = useMemo(
    () => [
      brandId ?? "",
      department ?? "",
      searchQuery?.trim() ?? "",
      projectId ?? "",
      category ?? "",
      status ?? "",
      viewMode,
      resourceView,
    ].join("|"),
    [brandId, department, searchQuery, projectId, category, status, viewMode, resourceView]
  );

  const renderedRowCount = getEffectiveRenderedRowCount(
    renderWindow,
    renderWindowKey,
    TIMELINE_ROW_BATCH_SIZE
  );

  const renderedEmployees = useMemo(
    () => visibleEmployees.slice(0, renderedRowCount),
    [visibleEmployees, renderedRowCount]
  );

  const visibleBrands = useMemo(
    () => Array.from(assignmentsByBrand.entries()),
    [assignmentsByBrand]
  );

  const renderedBrands = useMemo(
    () => visibleBrands.slice(0, renderedRowCount),
    [visibleBrands, renderedRowCount]
  );

  const visibleDepartments = useMemo(
    () => Array.from(assignmentsByDepartment.entries()),
    [assignmentsByDepartment]
  );

  const renderedDepartments = useMemo(
    () => visibleDepartments.slice(0, renderedRowCount),
    [visibleDepartments, renderedRowCount]
  );

  useEffect(() => {
    if (bodyScrollRef.current) {
      bodyScrollRef.current.scrollTop = 0;
    }
  }, [renderWindowKey]);

  const maybeLoadMoreRows = useCallback(() => {
    if (resourceView !== "employee" && resourceView !== "brand" && resourceView !== "department") return;
    const container = bodyScrollRef.current;
    if (!container) return;

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom > TIMELINE_LOAD_MORE_THRESHOLD_PX) return;

    const totalVisibleRows = resourceView === "employee"
      ? visibleEmployees.length
      : resourceView === "brand"
        ? visibleBrands.length
        : visibleDepartments.length;

    setRenderWindow((current) => {
      const currentCount = getEffectiveRenderedRowCount(
        current,
        renderWindowKey,
        TIMELINE_ROW_BATCH_SIZE
      );
      if (currentCount >= totalVisibleRows) return current;
      return {
        key: renderWindowKey,
        count: getNextRenderedRowCount(
          currentCount,
          totalVisibleRows,
          TIMELINE_ROW_BATCH_SIZE
        ),
      };
    });
  }, [renderWindowKey, visibleEmployees.length, visibleBrands.length, visibleDepartments.length, resourceView]);

  const handleBodyScroll = useCallback(() => {
    if (bodyScrollRef.current && headerScrollRef.current) {
      headerScrollRef.current.scrollLeft = bodyScrollRef.current.scrollLeft;
    }
    maybeLoadMoreRows();
  }, [maybeLoadMoreRows]);

  const handleHeaderScroll = useCallback(() => {
    if (headerScrollRef.current && bodyScrollRef.current) {
      bodyScrollRef.current.scrollLeft = headerScrollRef.current.scrollLeft;
    }
  }, []);

  const handleToday = useCallback(() => {
    const today = new Date();
    setCurrentDate(startOfWeek(today, { weekStartsOn: 1 }));

    setTimeout(() => {
      if (bodyScrollRef.current) {
        const todayIndex = days.findIndex(d =>
          startOfDay(d).getTime() === startOfDay(today).getTime()
        );

        if (todayIndex >= 0) {
          const container = bodyScrollRef.current;
          const containerWidth = container.offsetWidth;
          const currentCellWidth = containerWidth / days.length;
          const scrollLeft = (todayIndex * currentCellWidth) - (containerWidth / 2) + (currentCellWidth / 2);

          container.scrollTo({
            left: Math.max(0, scrollLeft),
            behavior: 'smooth'
          });
        }
      }
    }, 100);
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

  if (!currentDate || days.length === 0 || isLoadingDepartments) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading timeline...</div>
      </div>
    );
  }

  return (
    <div ref={timelineRootRef} className="flex flex-col h-full" data-testid="timeline-root">
      <TimelineHeaderControls
        currentDate={currentDate}
        viewMode={viewMode}
        showWeekends={showWeekends}
        resourceView={resourceView}
        onViewModeChange={setViewMode}
        onDateChange={handleDateChange}
        onToggleWeekends={handleToggleWeekends}
        onToday={handleToday}
        onResourceViewChange={setResourceView}
      />

      <div className="flex border-b bg-muted/40 sticky top-0 z-10">
        <div className="w-[250px] shrink-0 p-4 font-semibold border-r bg-background">
          {resourceView === "employee" ? "Resources" : resourceView === "department" ? "Departments" : "Brands"}
        </div>
        <div
          ref={headerScrollRef}
          onScroll={handleHeaderScroll}
          className="flex-1 overflow-x-auto scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          tabIndex={0}
          aria-label="Timeline day headers"
        >
          <div className="flex relative" style={{ width: `${days.length * cellWidth}px` }}>
            {days.map((day) => {
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              const isMonthRangeView = viewMode === "quarter" || viewMode === "halfYear" || viewMode === "year";
              const today = isToday(day);
              const currentMonth = getMonth(day) === getMonth(new Date()) && getYear(day) === getYear(new Date());

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

      <div
        ref={bodyScrollRef}
        onScroll={handleBodyScroll}
        className="flex-1 overflow-auto"
      >
        <div className="flex flex-col w-full">
          {resourceView === "employee" ? (
            isLoadingEmployees ? (
              <div className="space-y-0">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex border-b">
                    <div className="w-[250px] shrink-0 p-4 border-r sticky left-0 bg-background z-20 flex items-center gap-3">
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
                No employees found for this selection. Go to Setup to assign employees to this brand.
              </div>
            ) : (
              renderedEmployees.map((employee) => (
                <ResourceRow
                  key={employee.id}
                  resource={{
                    id: employee.id,
                    name: employee.fullName,
                    role: employee.position,
                    department: employee.department?.name || "",
                    capacity: employee.weeklyCapacity,
                  }}
                  days={days}
                  brandId={brandId}
                  cellWidth={cellWidth}
                  isWeekView={isWeekView}
                  assignments={assignmentsByEmployee.get(employee.id) || EMPTY_ASSIGNMENTS}
                  actualAssignments={actualAssignmentsByEmployee.get(employee.id) || EMPTY_ACTUAL_ASSIGNMENTS}
                  viewMode={viewMode}
                />
              ))
            )
          ) : resourceView === "department" ? (
            isLoadingDepartments ? (
              <div className="p-8 text-center text-muted-foreground">
                Loading departments...
              </div>
            ) : isDepartmentsError ? (
              <div className="p-8 text-center text-muted-foreground">
                Failed to load departments.
              </div>
            ) : assignmentsByDepartment.size === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No departments found for this selection.
              </div>
            ) : (
              renderedDepartments.map(([deptId, dept]) => (
                <AggregatedRow
                  key={deptId}
                  name={dept.name}
                  color={dept.color}
                  days={days}
                  cellWidth={cellWidth}
                  assignments={dept.assignments}
                  viewMode={viewMode}
                />
              ))
            )
          ) : (
            isLoadingBrands ? (
              <div className="p-8 text-center text-muted-foreground">
                Loading brands...
              </div>
            ) : isBrandsError ? (
              <div className="p-8 text-center text-muted-foreground">
                Failed to load brands.
              </div>
            ) : assignmentsByBrand.size === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No brands found for this selection.
              </div>
            ) : (
              renderedBrands.map(([brandId, brand]) => (
                <AggregatedRow
                  key={brandId}
                  name={brand.name}
                  color={brand.color}
                  days={days}
                  cellWidth={cellWidth}
                  assignments={brand.assignments}
                  viewMode={viewMode}
                />
              ))
            )
          )}
        </div>
      </div>

      <AssignProjectModal
        resourceId={assignModalResourceId}
        open={!!assignModalResourceId}
        onOpenChange={(open) => !open && setAssignModalResourceId(null)}
      />
    </div>
  );
};
