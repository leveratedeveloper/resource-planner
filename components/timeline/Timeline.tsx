"use client";

import React, { useRef, useMemo, useCallback, useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { useEmployees, useBrands, useProjects } from "@/lib/query/hooks";
import { useAssignments } from "@/lib/query/hooks/useAssignments";
import { ResourceRow } from "./ResourceRow";
import { AssignProjectModal } from "./AssignProjectModal";
import { TimelineHeaderControls, ViewMode } from "./TimelineHeaderControls";
import { addDays, addWeeks, addMonths, format, startOfWeek, startOfMonth, eachDayOfInterval, eachWeekOfInterval, endOfWeek, differenceInDays, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface TimelineProps {
  brandId: string | null;
  department: string | null;
  searchQuery?: string;
}

export const Timeline: React.FC<TimelineProps> = ({ brandId, department, searchQuery }) => {
  // Fetch data using React Query
  const { data: employees = [], isLoading: isLoadingEmployees } = useEmployees();
  const { data: brands = [] } = useBrands();
  const { data: allAssignments = [] } = useAssignments();
  const { data: projects = [] } = useProjects();

  // Debug logging to understand data flow
  useEffect(() => {
    console.log('[Timeline Debug] Data state:', {
      employeesCount: employees.length,
      brandsCount: brands.length,
      assignmentsCount: allAssignments.length,
      projectsCount: projects.length,
      isLoadingEmployees,
      brandId,
      department,
      searchQuery,
    });
    if (employees.length > 0) {
      console.log('[Timeline Debug] First employee:', employees[0]);
    }
  }, [employees, brands, allAssignments, projects, isLoadingEmployees, brandId, department, searchQuery]);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);

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

  // Track container width with ResizeObserver on parent container
  useEffect(() => {
    const headerContainer = headerScrollRef.current?.parentElement;
    if (!headerContainer) return;

    const updateWidth = () => {
      setContainerWidth(headerContainer.offsetWidth);
    };

    const resizeObserver = new ResizeObserver(() => {
      updateWidth();
    });

    resizeObserver.observe(headerContainer);

    // Initial measurement
    updateWidth();

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

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
        // Show full month grid (from 1st to last day of month)
        const monthStart = startOfMonth(currentDate);
        const monthEnd = addDays(startOfMonth(addMonths(currentDate, 1)), -1);
        return eachDayOfInterval({ start: monthStart, end: monthEnd });
      }
      case "quarter": {
        // Show 13 weeks (Mondays only)
        const endDate = addWeeks(currentDate, 12);
        return eachWeekOfInterval(
          { start: currentDate, end: endDate },
          { weekStartsOn: 1 }
        );
      }
      case "halfYear": {
        // Show 26 weeks (Mondays only)
        const endDate = addWeeks(currentDate, 25);
        return eachWeekOfInterval(
          { start: currentDate, end: endDate },
          { weekStartsOn: 1 }
        );
      }
      case "year": {
        // Show 52 weeks (Mondays only)
        const endDate = addWeeks(currentDate, 51);
        return eachWeekOfInterval(
          { start: currentDate, end: endDate },
          { weekStartsOn: 1 }
        );
      }
      default:
        return [];
    }
  }, [currentDate, viewMode]);

  // Filter out weekends if needed (only for week and month views)
  const days = useMemo(() => {
    // For quarter, halfYear, and year views, we're already showing weeks (Mondays only)
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

  // Cell width based on view mode - calculated to fill available space exactly
  const cellWidth = useMemo(() => {
    const dayCount = days.length;
    if (dayCount === 0) return 100;

    // Keep decimal precision to match flexbox behavior
    // This ensures AssignmentBlock positioning aligns with flex cells
    return containerWidth / dayCount;
  }, [days.length, containerWidth]);

  // Determine if we're in week view mode (where each cell = 1 week)
  const isWeekView = viewMode === "quarter" || viewMode === "halfYear" || viewMode === "year";

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

       console.log('[Timeline Filter] Brand filtering:', {
         brandId,
         brandFound: !!brand,
         brandName: brand?.name,
         memberIdsCount: memberIds.size,
         assignmentIdsCount: assignmentIds.size,
         hasEmployeeBrandData,
         hasAssignmentData,
         willSkipFilter: !hasEmployeeBrandData && !hasAssignmentData,
         employeesBeforeFilter: filtered.length,
       });

       // Skip filtering entirely if we have no brand relationship data at all
       // This allows users to see all employees and create assignments
       if (!hasEmployeeBrandData && !hasAssignmentData) {
         // No filtering - show all employees
         console.log('[Timeline Filter] Skipping brand filter - no relationship data available');
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
         console.log('[Timeline Filter] After brand filter:', {
           employeesAfterFilter: filtered.length,
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

    console.log('[Timeline Filter] Final result:', {
      originalEmployeesCount: employees.length,
      filteredEmployeesCount: filtered.length,
      brandId,
      department,
      searchQuery,
    });

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

  const handleAssignProject = useCallback((resourceId: string) => {
    setAssignModalResourceId(resourceId);
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
    <div className="flex flex-col h-full" data-testid="timeline-root">
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
          <div className="flex w-full">
            {days.map((day) => {
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              const isWeekView = viewMode === "quarter" || viewMode === "halfYear" || viewMode === "year";

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "flex-1 border-r p-2 text-center text-sm min-w-0",
                    isWeekend && !isWeekView ? "bg-muted/50" : "bg-background"
                  )}
                  data-testid="timeline-day-cell"
                  data-date={format(day, "yyyy-MM-dd")}
                  data-weekend={String(isWeekend)}
                >
                  {isWeekView ? (
                    <>
                      <div className="font-semibold">{format(day, "MMM")}</div>
                      <div className="text-muted-foreground">{format(day, "d")}</div>
                    </>
                  ) : (
                    <>
                      <div className="font-semibold">{format(day, "EEE")}</div>
                      <div className="text-muted-foreground">{format(day, "d MMM")}</div>
                    </>
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
                  onAssignProject={handleAssignProject}
                  cellWidth={cellWidth}
                  isWeekView={isWeekView}
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
