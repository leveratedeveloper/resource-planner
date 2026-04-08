"use client";

import React, { useRef, useMemo, useCallback, useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { useEmployees, useBrands, useProjects } from "@/lib/query/hooks";
import { useAssignments } from "@/lib/query/hooks/useAssignments";
import { ResourceRow } from "./ResourceRow";
import { AssignProjectModal } from "./AssignProjectModal";
import { TimelineHeaderControls, ViewMode } from "./TimelineHeaderControls";
import { addDays, addWeeks, addMonths, format, startOfWeek, startOfMonth, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, endOfWeek, differenceInDays, startOfDay, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface TimelineProps {
  brandId: string | null;
  department: string | null;
  searchQuery?: string;
  projectId: string | null;
  category: string | null;
  status: string | null;
}

export const Timeline: React.FC<TimelineProps> = ({ brandId, department, searchQuery, projectId, category, status }) => {
  // Fetch data using React Query (assignments fetched after date range is calculated)
  const { data: employees = [], isLoading: isLoadingEmployees } = useEmployees();
  const { data: brands = [] } = useBrands();
  const { data: projects = [] } = useProjects();

  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const timelineRootRef = useRef<HTMLDivElement>(null);

  // Modal state for assigning projects
  const [assignModalResourceId, setAssignModalResourceId] = useState<string | null>(null);

  // Timeline state
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [showWeekends, setShowWeekends] = useState(false); // Default: hidden
  const [containerWidth, setContainerWidth] = useState(1400); // Track actual container width

  // Initialize dates client-side to avoid hydration mismatch
  useEffect(() => {
    setCurrentDate(startOfWeek(new Date(), { weekStartsOn: 1 }));

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
        // Subtract the fixed sidebar width (250px) to get available width for timeline
        const sidebarWidth = 250;
        const availableWidth = rootWidth - sidebarWidth;
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
  }, [currentDate]); // Re-run when currentDate changes to ensure ref is ready

  // Calculate days/weeks based on view mode and current date
  const allDays = useMemo(() => {
    if (!currentDate) return [];

    switch (viewMode) {
      case "week": {
        // Show 7 days (Mon-Sun) - start from Monday of current week
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const weekEnd = addDays(weekStart, 6);
        return eachDayOfInterval({ start: weekStart, end: weekEnd });
      }
      case "month": {
        // Show weeks in the month (Mondays only)
        const monthStart = startOfMonth(currentDate);
        const monthEnd = addDays(startOfMonth(addMonths(currentDate, 1)), -1);
        return eachWeekOfInterval(
          { start: monthStart, end: monthEnd },
          { weekStartsOn: 1 }
        );
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

  // Filter out weekends if needed (only for week view)
  const days = useMemo(() => {
    // For month, quarter, halfYear, and year views, we're showing weeks/months - no weekend filtering
    if (viewMode === "month" || viewMode === "quarter" || viewMode === "halfYear" || viewMode === "year") {
      return allDays;
    }

    // For week view, apply weekend filter if needed
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

  // Determine if we're in week view mode (where each cell = 1 week/month)
  const isWeekView = viewMode === "month" || viewMode === "quarter" || viewMode === "halfYear" || viewMode === "year";

  // PERFORMANCE: Calculate date range for assignments API filtering
  // This reduces data transfer by ~80% for timeline views
  const assignmentDateRange = useMemo(() => {
    if (days.length === 0) return undefined;

    // Add buffer before/after visible range for assignments that may extend into view
    const startDate = startOfDay(days[0]);
    const endDate = startOfDay(days[days.length - 1]);

    return {
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
    };
  }, [days]);

  // Fetch assignments with date filtering for display
  const { data: dateFilteredAssignments = [] } = useAssignments(assignmentDateRange);

  // Fetch ALL assignments (no date filter) for employee filtering by brand
  // This ensures employees with assignments outside the visible date range are still shown
  // PERFORMANCE: When brandId is selected, filter assignments by project UUIDs at the server level
  // This reduces the dataset by ~90% when a brand is selected
  const brandProjectIds = useMemo(() => {
    if (!brandId || !projects.length) return undefined;
    return projects.filter(p => p.brandId === brandId).map(p => p.id);
  }, [brandId, projects]);

  const { data: allAssignments = [] } = useAssignments(
    brandProjectIds && brandProjectIds.length > 0 ? { projectIds: brandProjectIds } : undefined
  );

  // Apply additional filters (project, category, status) to date-filtered assignments for display
  const filteredAssignments = useMemo(() => {
    let filtered = dateFilteredAssignments;

    // Filter by project
    if (projectId) {
      filtered = filtered.filter(a => a.projectId === projectId);
    }

    // Filter by category
    if (category) {
      filtered = filtered.filter(a => a.category === category);
    }

    // Filter by status
    if (status) {
      filtered = filtered.filter(a => a.status === status);
    }

    return filtered;
  }, [dateFilteredAssignments, projectId, category, status]);


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

  // Filter employees based on selected Brand, Department, and Search Query
  const visibleEmployees = useMemo(() => {
    let filtered = employees;

    if (brandId) {
       // Hybrid brand visibility: explicit membership OR assignment to a project in this brand
       const brand = brands.find((b) => b.id === brandId);
       const memberIds = new Set(
         brand?.employeeBrandAssignments?.map((a) => a.employeeId) ?? []
       );
       const assignmentIds = new Set(
         allAssignments
           .filter((a) => {
             // Use nested data when available, fall back to project map for optimistic entries
             if (a.project?.brand?.id === brandId) return true;
             const project = projects.find((p) => p.id === a.projectId);
             return project?.brandId === brandId;
           })
           .map((a) => a.employeeId)
       );

       // If employeeBrandAssignments data is available (PostgreSQL), use hybrid logic
       // Otherwise (MySQL API), only filter by project assignments
       // If NEITHER is available, show all employees (allow users to create assignments)
       const hasEmployeeBrandData = brand?.employeeBrandAssignments && brand.employeeBrandAssignments.length > 0;
       const hasAssignmentData = assignmentIds.size > 0;

       // Skip filtering entirely if we have no brand relationship data at all
       // This allows users to see all employees and create assignments
       if (!hasEmployeeBrandData && !hasAssignmentData) {
         // No filtering - show all employees
       } else {
         filtered = filtered.filter((emp) => {
           // When employeeBrandAssignments is available, require either membership OR assignment
           if (hasEmployeeBrandData) {
             return memberIds.has(emp.id) || assignmentIds.has(emp.id);
           }
           // When employeeBrandAssignments is NOT available (MySQL API), only filter by assignment
           // This ensures employees with project assignments in the brand are still shown
           return assignmentIds.has(emp.id);
         });
       }
    }

    if (department) {
      filtered = filtered.filter((emp) => emp.departmentId === department);
    }

    // Search filter - matches employee name, position, department, projects, tasks, and brands
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((emp) => {
        // Match employee name
        if (emp.fullName.toLowerCase().includes(query)) return true;
        
        // Match position
        if (emp.position?.toLowerCase().includes(query)) return true;
        
        // Match department name
        if (emp.department?.name?.toLowerCase().includes(query)) return true;
        
        // Match assigned projects and tasks
        if (emp.assignments) {
          for (const assignment of emp.assignments) {
            // Match project name
            if (assignment.project?.name?.toLowerCase().includes(query)) return true;
          }
        }
        
        // Match assigned brands
        if (emp.employeeBrandAssignments) {
          for (const brandAssignment of emp.employeeBrandAssignments) {
            if (brandAssignment.brand?.name?.toLowerCase().includes(query)) return true;
          }
        }
        
        return false;
      });
    }

    return filtered;
  }, [brandId, department, searchQuery, employees, brands, allAssignments, projects]);

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

  // Show loading while days initializes
  if (!currentDate || days.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading timeline...</div>
      </div>
    );
  }

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

      {/* Timeline Header (Days) - Sticky */}
      <div className="flex border-b bg-muted/40 sticky top-0 z-10">
        <div className="w-[250px] shrink-0 p-4 font-semibold border-r bg-background">
          Resources
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
              const isMonthView = viewMode === "month";
              const isMonthRangeView = viewMode === "quarter" || viewMode === "halfYear" || viewMode === "year";
              const today = isToday(day);

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "border-r p-2 text-center text-sm shrink-0 relative",
                    isWeekend && !isMonthRangeView ? "bg-muted/50" : "bg-background",
                    today && "border-b-2 border-b-primary bg-muted/30"
                  )}
                  style={{ width: `${cellWidth}px` }}
                  data-testid="timeline-day-cell"
                  data-date={format(day, "yyyy-MM-dd")}
                  data-weekend={String(isWeekend)}
                  data-today={String(today)}
                >
                  {isMonthView ? (
                    <div className="flex flex-col justify-center">
                      <div className="font-semibold">{format(day, "d MMM")} - {format(endOfWeek(day, { weekStartsOn: 1 }), "d MMM")}</div>
                    </div>
                  ) : isMonthRangeView ? (
                    <div className="flex flex-col justify-center">
                      <div className="font-semibold">{format(day, "MMMM")}</div>
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      <div className="font-semibold">{format(day, "EEE")}</div>
                      <div className="text-muted-foreground">{format(day, "d MMM")}</div>
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
          {isLoadingEmployees ? (
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
             visibleEmployees.map((employee) => (
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
                  assignments={assignmentsByEmployee.get(employee.id) || []}
                />
              ))
          )}
        </div>
      </div>

      {/* Assign Project Modal */}
      <AssignProjectModal 
        resourceId={assignModalResourceId}
        open={!!assignModalResourceId}
        onOpenChange={(open) => !open && setAssignModalResourceId(null)}
      />
    </div>
  );
};
