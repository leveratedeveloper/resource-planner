"use client";

import React, { useRef, useMemo, useCallback, useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { useEmployees, useBrands } from "@/lib/query/hooks";
import { useAssignments } from "@/lib/query/hooks/useAssignments";
import { ResourceRow } from "./ResourceRow";
import { AssignProjectModal } from "./AssignProjectModal";
import { TimelineHeaderControls, ViewMode } from "./TimelineHeaderControls";
import { addDays, addWeeks, addMonths, format, startOfWeek, startOfMonth, eachDayOfInterval, eachWeekOfInterval, endOfWeek, differenceInDays } from "date-fns";
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
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  
  // Modal state for assigning projects
  const [assignModalResourceId, setAssignModalResourceId] = useState<string | null>(null);
  
  // Timeline state
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [showWeekends, setShowWeekends] = useState(false); // Default: hidden
  
  // Initialize dates client-side to avoid hydration mismatch
  useEffect(() => {
    setCurrentDate(startOfWeek(new Date(), { weekStartsOn: 1 }));
    
    // Load weekend preference from localStorage
    const savedShowWeekends = localStorage.getItem('showWeekends');
    if (savedShowWeekends !== null) {
      setShowWeekends(savedShowWeekends === 'true');
    }
  }, []);

  // Calculate days/weeks based on view mode and current date
  const allDays = useMemo(() => {
    if (!currentDate) return [];

    switch (viewMode) {
      case "week": {
        // Show 4 weeks (28 days)
        const endDate = addDays(currentDate, 27);
        return eachDayOfInterval({ start: currentDate, end: endDate });
      }
      case "month": {
        // Show 6 weeks (42 days)
        const endDate = addDays(currentDate, 41);
        return eachDayOfInterval({ start: currentDate, end: endDate });
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

  // Cell width based on view mode
  const cellWidth = useMemo(() => {
    switch (viewMode) {
      case "week": return 100;
      case "month": return 40;
      case "quarter": return 80;
      case "halfYear": return 60;
      case "year": return 40;
      default: return 100;
    }
  }, [viewMode]);

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
           .filter((a) => a.project?.brand?.id === brandId)
           .map((a) => a.employeeId)
       );
       filtered = filtered.filter(
         (emp) => memberIds.has(emp.id) || assignmentIds.has(emp.id)
       );
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
  }, [brandId, department, searchQuery, employees, brands, allAssignments]);

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
    setCurrentDate(startOfWeek(new Date(), { weekStartsOn: 1 }));
  }, []);

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
        >
          <div className="flex" style={{ width: `${days.length * cellWidth}px` }}>
            {days.map((day) => {
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              const isWeekView = viewMode === "quarter" || viewMode === "halfYear" || viewMode === "year";

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "shrink-0 border-r p-2 text-center text-sm",
                    isWeekend && !isWeekView ? "bg-muted/50" : "bg-background"
                  )}
                  style={{ width: cellWidth }}
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
        <div className="flex flex-col" style={{ width: `${250 + days.length * cellWidth}px` }}>
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
