"use client";

import React, { useState, useMemo, useCallback, useRef } from "react";
import { Resource, AssignmentCategory } from "@/types";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import { differenceInDays, startOfWeek, endOfWeek, isWithinInterval, startOfDay, addWeeks, addDays } from "date-fns";
import { useAssignments, useCreateAssignment, useUpdateAssignment, useDeleteAssignment } from "@/lib/query/hooks/useAssignments";
import { useProjects } from "@/lib/query/hooks/useProjects";
import { useBrands } from "@/lib/query/hooks/useBrands";
import { AssignmentBlock } from "./AssignmentBlock";
import { DraggableTimelineCell } from "./DraggableTimelineCell";
import { AssignmentPopover } from "./AssignmentPopover";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@iconify/react";
import { cn, toLocalDateString } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { WORK_DAYS_PER_WEEK } from "@/lib/constants";

interface ResourceRowProps {
  resource: Resource;
  days: Date[];
  brandId: string | null;
  onAssignProject?: (resourceId: string) => void;
  cellWidth?: number;
  isWeekView?: boolean;
}

// Props for AllocationCell
interface AllocationCellProps {
  day: Date;
  resource: Resource;
  assignments: Assignment[];
  cellWidth: number;
  isWeekView?: boolean;
}

// Helper function to safely parse hours - returns 0 for invalid values
// Handles string | number | null | undefined inputs
// Supports both dot (.) and comma (,) as decimal separator
const parseHoursSafe = (hours?: string | number | null): number => {
  if (hours === null || hours === undefined) return 0;
  // Normalize comma to dot for parseFloat (supports both "0.5" and "0,5" formats)
  const normalized = String(hours).replace(',', '.');
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
};

// Memoized Allocation Cell Component for performance
const AllocationCell = React.memo<AllocationCellProps>(function AllocationCell({
  day,
  resource,
  assignments,
  cellWidth,
  isWeekView = false
}) {
  const dailyCapacity = resource.capacity / WORK_DAYS_PER_WEEK;
  
  // For week view, aggregate hours across the week (Mon-Fri)
  // For day view, just check the single day
  const getDaysToCheck = () => {
    if (!isWeekView) {
      return [startOfDay(new Date(day))];
    }
    // Return all weekdays in the week starting from this day
    const weekDays: Date[] = [];
    const weekStart = startOfDay(new Date(day));
    for (let i = 0; i < 5; i++) {
      const d = addDays(weekStart, i);
      if (d.getDay() !== 0 && d.getDay() !== 6) {
        weekDays.push(d);
      }
    }
    return weekDays;
  };
  
  const daysToCheck = getDaysToCheck();
  
  // Calculate average hours per day across the period
  let totalHours = 0;
  let workingDaysCount = 0;
  
  for (const currentDay of daysToCheck) {
    const dayOfWeek = currentDay.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;
    
    workingDaysCount++;
    
    const dayHours = assignments.filter(a => !a.isTimeOff).reduce((total, assignment) => {
      if (assignment.employeeId !== resource.id) return total;

      const assignStart = startOfDay(new Date(assignment.startDate));
      const assignEnd = startOfDay(new Date(assignment.endDate));

      if (currentDay >= assignStart && currentDay <= assignEnd) {
        return total + parseHoursSafe(assignment.hoursPerDay);
      }

      return total;
    }, 0);
    
    totalHours += dayHours;
  }
  
  const dailyHours = workingDaysCount > 0 ? totalHours / workingDaysCount : 0;

  // Time off check - check if ANY day in the period has time off
  const hasTimeOff = daysToCheck.some(currentDay =>
    assignments.some(a =>
      a.employeeId === resource.id &&
      a.isTimeOff &&
      isWithinInterval(currentDay, {
        start: startOfDay(new Date(a.startDate)),
        end: startOfDay(new Date(a.endDate))
      })
    )
  );

  if (hasTimeOff) {
    return (
      <div
        className="flex-1 h-[60px] border-r border-white/20 bg-gray-400 flex items-center justify-center text-xs font-bold text-white"
      >
        Time Off
      </div>
    );
  }

  // Ensure dailyHours is a valid number before calculating percentage
  const safeDailyHours = isNaN(dailyHours) ? 0 : dailyHours;
  const percentage = dailyCapacity > 0 ? safeDailyHours / dailyCapacity : 0;

  // Styling based on percentage
  let bgClass = "";
  let textClass = "text-white"; // Default white text for darker backgrounds
  let label = "";
  let borderClass = "";

  if (percentage <= 0) {
    return (
      <div
        className="flex-1 h-[60px] border-r border-dashed"
      />
    );
  } else if (percentage <= 1) {
    // Dynamic blue scale for 1-100%
    // 0-25%: blue-200 (lightest visible)
    // 26-50%: blue-300
    // 51-75%: blue-400
    // 76-100%: blue-500
    if (percentage <= 0.25) {
      bgClass = "bg-blue-200";
      textClass = "text-blue-900"; // Dark text for light background
    } else if (percentage <= 0.5) {
      bgClass = "bg-blue-300";
      textClass = "text-blue-900";
    } else if (percentage <= 0.75) {
      bgClass = "bg-blue-400";
      textClass = "text-white";
    } else {
      bgClass = "bg-blue-500";
      textClass = "text-white";
    }
    
    label = `${Math.round(percentage * 100)}%`;
  } else {
    bgClass = "bg-blue-800"; // Over 100%
    textClass = "text-white";
    label = `${Math.round(percentage * 100)}%`;
    borderClass = "border-t-4 border-red-500";
  }

  return (
    <div
      className={cn(
        "flex-1 h-[60px] border-r border-white/20 flex items-center justify-center text-xs font-bold transition-all",
        bgClass,
        textClass,
        borderClass
      )}
    >
      {label}
    </div>
  );
});

export const ResourceRow: React.FC<ResourceRowProps> = ({ resource, days, brandId, onAssignProject, cellWidth = 100, isWeekView = false }) => {
  const { data: assignments = [] } = useAssignments();
  const { data: projects = [], isLoading: isLoadingProjects } = useProjects();
  const { data: brands = [] } = useBrands();
  const createAssignment = useCreateAssignment();
  const updateAssignmentMutation = useUpdateAssignment();
  const deleteAssignmentMutation = useDeleteAssignment();
  const [isExpanded, setIsExpanded] = useState(false);
  const [updatingAssignmentId, setUpdatingAssignmentId] = useState<string | null>(null);

  // Drag state for timeline cells
  const [isDragging, setIsDragging] = useState(false);
  const dragStartIndex = useRef<number | null>(null);
  const dragEndIndexRef = useRef<number | null>(null);
  const [dragEndIndex, setDragEndIndex] = useState<number | null>(null);
  const dragProjectIdRef = useRef<string | null>(null);
  const [dragProjectId, setDragProjectId] = useState<string | null>(null);
  const dragProjectColorRef = useRef<string>("");
  const [dragProjectColor, setDragProjectColor] = useState<string>("");
  // Create refs for each timeline container
  const timeOffTimelineRef = useRef<HTMLDivElement>(null);
  const projectTimelineRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const cellBoundariesRef = useRef<Array<{ left: number; right: number }>>([]);

  // Popover state for creating assignments
  const [popoverData, setPopoverData] = useState<{
    projectId: string;
    startDate: Date;
    endDate: Date;
    position: { x: number; y: number };
  } | null>(null);

  // All assignments for this resource
  const resourceAssignments = assignments.filter((a) => a.employeeId === resource.id);
  
  // Get projects this resource is assigned to
  const resourceProjects = useMemo(() => {
    const projectIds = new Set(resourceAssignments.filter(a => !a.isTimeOff).map(a => a.projectId));
    return projects.filter(p => projectIds.has(p.id));
  }, [resourceAssignments, projects]);

  // O(1) project lookup by ID
  const projectMap = useMemo(() => 
    new Map(projects.map(p => [p.id, p])), 
    [projects]
  );

  // Check if has time off
  const hasTimeOff = resourceAssignments.some(a => a.isTimeOff);
  
  // Get time-off assignments for this resource (used to block scheduling on time-off days)
  const timeOffAssignments = useMemo(() => 
    resourceAssignments.filter(a => a.isTimeOff),
    [resourceAssignments]
  );

  // Handle drag complete - open popover
  const handleDragComplete = useCallback((projectId: string, startDay: Date, endDay: Date, position: { x: number; y: number }) => {
    console.log('DRAG COMPLETE - startDay:', startDay.toISOString(), 'endDay:', endDay.toISOString());
    setPopoverData({ projectId, startDate: startDay, endDate: endDay, position });
  }, []);

  // Handle save assignment
  const handleSaveAssignment = useCallback((data: {
    hoursPerDay: number;
    workDays: number;
    category: AssignmentCategory;
    isBillable: boolean;
    note?: string;
  }) => {
    if (!popoverData) return;

    console.log('SAVE ASSIGNMENT - popoverData.startDate:', popoverData.startDate.toISOString());
    console.log('SAVE ASSIGNMENT - workDays:', data.workDays);

    // Calculate end date based on workDays (skip weekends)
    let endDate = new Date(popoverData.startDate);
    let daysAdded = 1; // Start date counts as day 1

    while (daysAdded < data.workDays) {
      endDate = addDays(endDate, 1);
      const dayOfWeek = endDate.getDay();
      // Skip weekends (Saturday = 6, Sunday = 0)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        daysAdded++;
      }
    }

    console.log('SAVE ASSIGNMENT - calculated endDate:', endDate.toISOString());

    // Close popover immediately - optimistic update will show the block
    setPopoverData(null);

    createAssignment.mutate({
      employeeId: resource.id,
      projectId: popoverData.projectId,
      taskId: null,
      startDate: toLocalDateString(popoverData.startDate),
      endDate: toLocalDateString(endDate),
      hoursPerDay: data.hoursPerDay.toString(),
      allocationPercentage: null,
      isTimeOff: false,
      timeOffTypeId: null,
      category: data.category,
      isBillable: data.isBillable,
      status: 'draft',
      note: data.note || null,
      createdById: null,
    });
  }, [popoverData, resource.id, createAssignment]);

  // Handle time-off drag complete - create time-off directly (no popover needed)
  const handleTimeOffDragComplete = useCallback((startDay: Date, endDay: Date) => {
    console.log('TIME OFF DRAG COMPLETE - startDay:', startDay.toISOString(), 'endDay:', endDay.toISOString());
    // Optimistic update will show the block immediately
    createAssignment.mutate({
      employeeId: resource.id,
      projectId: null, // No project for time-off
      taskId: null,
      startDate: toLocalDateString(startDay),
      endDate: toLocalDateString(endDay),
      hoursPerDay: '8', // Full day time-off
      allocationPercentage: null,
      isTimeOff: true,
      timeOffTypeId: null,
      category: 'Other',
      isBillable: false,
      status: 'confirmed',
      note: 'Time Off',
      createdById: null,
    });
  }, [resource.id, createAssignment]);

  // Measure cell boundaries for accurate drag preview positioning
  const measureCellBoundaries = useCallback((container: HTMLDivElement) => {
    const allChildren = container.children;
    const cellCount = days.length;
    const boundaries: Array<{ left: number; right: number }> = [];
    const containerRect = container.getBoundingClientRect();

    // Filter to only DraggableTimelineCell elements (they have data-testid attribute ending with "-cell")
    // We need to measure them in order - they're interspersed with AssignmentBlocks which use absolute positioning
    const cellElements: HTMLElement[] = [];
    for (let i = 0; i < allChildren.length; i++) {
      const child = allChildren[i] as HTMLElement;
      const testId = child.getAttribute('data-testid');
      if (testId && (testId === 'timeline-project-cell' || testId === 'timeline-timeoff-cell')) {
        cellElements.push(child);
      }
    }

    // Measure the cell elements in order
    for (let i = 0; i < Math.min(cellCount, cellElements.length); i++) {
      const cell = cellElements[i];
      const rect = cell.getBoundingClientRect();
      boundaries.push({
        left: rect.left - containerRect.left,
        right: rect.right - containerRect.left,
      });
    }

    console.log('Measured boundaries:', boundaries.map((b, i) => `Cell ${i}: ${b.left.toFixed(1)}-${b.right.toFixed(1)}`).join(', '));
    console.log('Total cells found:', cellElements.length, 'Expected:', cellCount);
    cellBoundariesRef.current = boundaries;
    return boundaries;
  }, [days.length]);

  // Drag handlers for timeline cells
  const handleDragStart = useCallback((dayIndex: number, projectId: string, projectColor: string, containerRef: HTMLDivElement) => {
    if (createAssignment.isPending) return;

    // Measure cell boundaries for accurate positioning
    measureCellBoundaries(containerRef);

    console.log('DRAG START - dayIndex:', dayIndex, 'Date:', days[dayIndex]?.toISOString(), 'Project:', projectId);

    setIsDragging(true);
    dragStartIndex.current = dayIndex;
    dragEndIndexRef.current = dayIndex;
    setDragEndIndex(dayIndex);
    dragProjectIdRef.current = projectId;
    setDragProjectId(projectId);
    dragProjectColorRef.current = projectColor;
    setDragProjectColor(projectColor);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Use the container ref passed from the clicked cell
      const container = containerRef;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const x = moveEvent.clientX - rect.left;

      // Use measured cell boundaries for accurate index calculation
      const boundaries = cellBoundariesRef.current;
      let rawIndex: number;

      if (boundaries.length > 0) {
        // Find which cell contains the x position using measured boundaries
        rawIndex = boundaries.findIndex(boundary => x >= boundary.left && x < boundary.right);
        // If x is past the last cell's right edge, use the last index
        if (rawIndex === -1 && x >= boundaries[boundaries.length - 1].right) {
          rawIndex = boundaries.length - 1;
        }
        // Clamp to valid range
        rawIndex = Math.max(0, Math.min(days.length - 1, rawIndex));

        // Debug: show which boundary matched
        const matchedBoundary = boundaries[rawIndex];
        console.log(`x: ${x.toFixed(1)} -> matched boundary [${matchedBoundary.left.toFixed(1)}, ${matchedBoundary.right.toFixed(1)}] -> index ${rawIndex}`);
      } else {
        // Fallback to percentage-based calculation if boundaries not available
        const actualCellWidth = rect.width / days.length;
        rawIndex = Math.max(0, Math.min(days.length - 1, Math.floor(x / actualCellWidth)));
        console.log('x:', x.toFixed(1), 'rawIndex (fallback):', rawIndex);
      }

      dragEndIndexRef.current = rawIndex;
      setDragEndIndex(rawIndex);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);

      if (dragStartIndex.current !== null) {
        const endIdx = dragEndIndexRef.current ?? dragStartIndex.current;
        const start = Math.min(dragStartIndex.current, endIdx);
        const end = Math.max(dragStartIndex.current, endIdx);

        console.log('DRAG END - dragStartIndex:', dragStartIndex.current, 'dragEndIndex:', endIdx);
        console.log('DRAG END - Using start index:', start, 'Date:', days[start]?.toISOString());
        console.log('DRAG END - Using end index:', end, 'Date:', days[end]?.toISOString());

        // Call the appropriate drag complete handler
        const currentProjectId = dragProjectIdRef.current;
        if (currentProjectId) {
          handleDragComplete(currentProjectId, days[start], days[end], {
            x: upEvent.clientX,
            y: upEvent.clientY,
          });
        } else {
          handleTimeOffDragComplete(days[start], days[end]);
        }
      }

      setIsDragging(false);
      setDragEndIndex(null);
      dragEndIndexRef.current = null;
      dragStartIndex.current = null;
      dragProjectIdRef.current = null;
      setDragProjectId(null);
      dragProjectColorRef.current = "";
      setDragProjectColor("");
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [days, createAssignment.isPending, handleDragComplete, handleTimeOffDragComplete, measureCellBoundaries]);

  // Check if a day index is in the current drag range
  const isInDragRange = useCallback((dayIndex: number) => {
    if (!isDragging || dragStartIndex.current === null || dragEndIndex === null) return false;
    const start = Math.min(dragStartIndex.current, dragEndIndex);
    const end = Math.max(dragStartIndex.current, dragEndIndex);
    return dayIndex >= start && dayIndex <= end;
  }, [isDragging, dragEndIndex]);

  // Count weekdays (Mon-Fri) between two dates, inclusive
  const countWorkdays = useCallback((start: Date, end: Date): number => {
    let count = 0;
    const current = new Date(start);
    while (current <= end) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) count++;
      current.setDate(current.getDate() + 1);
    }
    return Math.max(1, count);
  }, []);

  // Handle assignment update (resize/drag or field updates)
  const handleUpdateAssignment = useCallback((id: string, updates: any) => {
    // Look up the current assignment to provide required fields for strict PUT schema
    const currentAssignment = resourceAssignments.find((a) => a.id === id);

    const payload: any = { id };

    // Always include required fields from current assignment as defaults
    if (currentAssignment) {
      payload.employeeId = currentAssignment.employeeId;
      payload.startDate = currentAssignment.startDate;
      payload.endDate = currentAssignment.endDate;
    }

    // Handle date conversions if updates contain Date objects (overrides defaults)
    if (updates.startDate) {
      payload.startDate = updates.startDate instanceof Date
        ? toLocalDateString(updates.startDate)
        : updates.startDate;
    }
    if (updates.endDate) {
      payload.endDate = updates.endDate instanceof Date
        ? toLocalDateString(updates.endDate)
        : updates.endDate;
    }

    // Forward employeeId/projectId if explicitly passed (e.g., from EditAssignmentDialog)
    if (updates.employeeId) payload.employeeId = updates.employeeId;
    if (updates.projectId !== undefined) payload.projectId = updates.projectId;

    // Add other fields
    if (updates.hoursPerDay !== undefined) payload.hoursPerDay = updates.hoursPerDay;
    if (updates.category) payload.category = updates.category;
    if (updates.isBillable !== undefined) payload.isBillable = updates.isBillable;
    if (updates.status) payload.status = updates.status;
    if (updates.note !== undefined) payload.note = updates.note;

    // Track which assignment is being updated
    setUpdatingAssignmentId(id);
    updateAssignmentMutation.mutate(payload, {
      onSettled: () => {
        setUpdatingAssignmentId(null);
      },
    });
  }, [updateAssignmentMutation, resourceAssignments]);

  // Handle assignment delete
  const handleDeleteAssignment = useCallback((id: string) => {
    // Optimistic update removes the block immediately
    deleteAssignmentMutation.mutate(id);
  }, [deleteAssignmentMutation]);

  // Collapsed row content
  if (!isExpanded) {
    return (
      <div className="flex border-b hover:bg-accent/5 transition-colors group" data-testid="resource-row" data-resource-id={resource.id}>
        {/* Sidebar Info - Collapsed */}
        <div className="w-[250px] shrink-0 p-4 border-r sticky left-0 bg-background z-20 flex items-center gap-3">
          <button 
            onClick={() => setIsExpanded(true)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            data-testid="resource-row-expand"
            aria-label="Expand resource row"
          >
            <Icon icon="lucide:chevron-right" className="h-4 w-4" />
          </button>
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
            {resource.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{resource.name}</div>
            <div className="text-xs text-muted-foreground truncate">{resource.role} | {resource.department}</div>
          </div>
        </div>

        {/* Allocation Bar - Collapsed */}
        <div className="flex relative flex-1 overflow-hidden">
          {days.map((day) => (
            <AllocationCell 
              key={day.toISOString()}
              day={day}
              resource={resource}
              assignments={resourceAssignments}
              cellWidth={cellWidth}
              isWeekView={isWeekView}
            />
          ))}
        </div>
      </div>
    );
  }

  // Expanded row content
  return (
    <div className="border-b" data-testid="resource-row" data-resource-id={resource.id}>
      {/* Main Row Header */}
      <div className="flex hover:bg-accent/5 transition-colors group">
        <div className="w-[250px] shrink-0 p-4 border-r sticky left-0 bg-background z-20 flex items-center gap-3">
          <button 
            onClick={() => setIsExpanded(false)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            data-testid="resource-row-collapse"
            aria-label="Collapse resource row"
          >
            <Icon icon="lucide:chevron-down" className="h-4 w-4" />
          </button>
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
            {resource.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{resource.name}</div>
            <div className="text-xs text-muted-foreground truncate">{resource.role} | {resource.department}</div>
          </div>
        </div>

        {/* Allocation Bar - Expanded (Header) */}
        <div className="flex relative flex-1 overflow-hidden">
          {days.map((day) => (
            <AllocationCell 
              key={day.toISOString()}
              day={day}
              resource={resource}
              assignments={resourceAssignments}
              cellWidth={cellWidth}
              isWeekView={isWeekView}
            />
          ))}
        </div>
      </div>

      {/* Time Off Row */}
      <div className="flex bg-gray-50/50 h-[50px]" data-testid="timeoff-row" data-resource-id={resource.id}>
        <div className="w-[250px] shrink-0 px-4 border-r sticky left-0 bg-gray-50/50 z-20 flex items-center gap-2 pl-12 h-[50px]">
          <Icon icon="lucide:calendar-off" className="h-4 w-4 text-gray-500" />
          <span className="text-sm text-gray-600">Time Off</span>
        </div>
        <div ref={timeOffTimelineRef} className="flex relative flex-1 h-[50px] overflow-hidden">
          {days.map((day, dayIndex) => (
            <DraggableTimelineCell
              key={day.toISOString()}
              day={day}
              projectId=""
              projectColor="#6b7280"
              days={days}
              cellWidth={cellWidth}
              cellHeight={50}
              isTimeOffMode={true}
              containerRef={timeOffTimelineRef.current}
              onDragComplete={(startDay, endDay) =>
                handleTimeOffDragComplete(startDay, endDay)
              }
              disabled={createAssignment.isPending}
              isDragging={isDragging && dragProjectId === ""}
              isInDragRange={isInDragRange(dayIndex)}
              onMouseDown={(index, containerRef) => handleDragStart(index, "", "#6b7280", containerRef)}
            />
          ))}
          {/* Time Off Assignments */}
          {resourceAssignments.filter(a => a.isTimeOff).map((assignment) => (
            <AssignmentBlock
              key={assignment.id}
              assignment={assignment}
              project={undefined}
              days={days}
              resourceRowHeight={50}
              cellWidth={cellWidth}
              isWeekView={isWeekView}
              onUpdate={handleUpdateAssignment}
              onDelete={handleDeleteAssignment}
              isUpdating={updatingAssignmentId === assignment.id}
            />
          ))}
          {/* Drag preview overlay for Time Off */}
          {isDragging && dragProjectId === "" && dragStartIndex.current !== null && dragEndIndex !== null && (() => {
            const startIdx = Math.min(dragStartIndex.current, dragEndIndex);
            const endIdx = Math.max(dragStartIndex.current, dragEndIndex);
            const boundaries = cellBoundariesRef.current;

            // Use measured boundaries for accurate positioning
            if (boundaries.length > 0 && boundaries[startIdx] && boundaries[endIdx]) {
              const left = boundaries[startIdx].left;
              const width = boundaries[endIdx].right - boundaries[startIdx].left;

              console.log('Preview Time Off - startIdx:', startIdx, 'endIdx:', endIdx, 'left:', left.toFixed(1), 'width:', width.toFixed(1));

              return (
                <div
                  className="absolute top-2 h-[calc(100%-16px)] rounded-md opacity-80 flex items-center justify-center text-white text-xs font-medium pointer-events-none z-10"
                  style={{
                    backgroundColor: dragProjectColorRef.current,
                    left: `${left}px`,
                    width: `${width}px`,
                  }}
                >
                  {countWorkdays(days[startIdx], days[endIdx])} workdays
                </div>
              );
            } else {
              // Fallback to percentage-based if boundaries not available
              console.log('Preview Time Off - fallback to percentage');
              return null;
            }
          })()}
        </div>
      </div>

      {/* Loading Skeletons */}
      {isLoadingProjects && (
        <>
          {[1, 2].map((i) => (
            <div key={`skeleton-${i}`} className="flex bg-white border-b">
              <div className="w-[250px] shrink-0 px-4 py-2 border-r sticky left-0 bg-white z-20 flex items-center gap-2 pl-12 h-[60px]">
                <Skeleton className="w-4 h-4 rounded" />
                <div className="flex-1 min-w-0 space-y-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <div className="flex relative flex-1 overflow-hidden" style={{ height: 60 }}>
                <div className="w-full h-full p-2">
                   <Skeleton className="h-full w-full opacity-20" />
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Project Rows */}
      {resourceProjects.map((project) => {
        const brand = brands.find(b => b.id === project.brandId);
        // Filter out 0-hour placeholder assignments from timeline (they exist just to keep project in list)
        // Keep assignment visible even if hoursPerDay is NaN (defensive) - parseHoursSafe keeps allocation stable
        const projectAssignments = resourceAssignments.filter(
          a => a.projectId === project.id && !a.isTimeOff && (() => {
            const hours = parseFloat(a.hoursPerDay);
            // If NaN, show the block (defensive) - Step 2 guards keep allocation stable
            return isNaN(hours) ? true : hours > 0;
          })()
        );
        
        return (
          <div key={project.id} className="flex bg-white" data-testid="project-row" data-resource-id={resource.id} data-project-id={project.id}>
            <div className="w-[250px] shrink-0 px-4 py-2 border-r sticky left-0 bg-white z-20 flex items-center gap-2 pl-12">
              <div
                className="w-4 h-4 rounded flex items-center justify-center"
                style={{ backgroundColor: project.color }}
              >
                <Icon icon="lucide:folder" className="h-3 w-3 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{project.name}</div>
                <div className="text-xs text-muted-foreground truncate">{brand?.name}</div>
              </div>
            </div>
            <div
              ref={(el) => { if (el) projectTimelineRefs.current.set(project.id, el); }}
              className="flex relative flex-1 overflow-hidden"
              style={{ height: 60 }}
            >
              {days.map((day, dayIndex) => (
                <DraggableTimelineCell
                  key={day.toISOString()}
                  day={day}
                  projectId={project.id}
                  projectColor={project.color}
                  days={days}
                  cellWidth={cellWidth}
                  cellHeight={60}
                  timeOffAssignments={timeOffAssignments}
                  containerRef={projectTimelineRefs.current.get(project.id) || null}
                  onDragComplete={(startDay, endDay, position) =>
                    handleDragComplete(project.id, startDay, endDay, position)
                  }
                  disabled={createAssignment.isPending}
                  isDragging={isDragging && dragProjectId === project.id}
                  isInDragRange={isInDragRange(dayIndex)}
                  onMouseDown={(index, containerRef) => handleDragStart(index, project.id, project.color, containerRef)}
                />
              ))}
              {/* Project Assignments */}
              {projectAssignments.map((assignment) => (
                <AssignmentBlock
                  key={assignment.id}
                  assignment={assignment}
                  project={projectMap.get(assignment.projectId ?? '')}
                  days={days}
                  resourceRowHeight={60}
                  cellWidth={cellWidth}
                  isWeekView={isWeekView}
                  onUpdate={handleUpdateAssignment}
                  onDelete={handleDeleteAssignment}
                  timeOffAssignments={timeOffAssignments}
                  isUpdating={updatingAssignmentId === assignment.id}
                />
              ))}
              {/* Drag preview overlay */}
              {isDragging && dragProjectId === project.id && dragStartIndex.current !== null && dragEndIndex !== null && (() => {
                const startIdx = Math.min(dragStartIndex.current, dragEndIndex);
                const endIdx = Math.max(dragStartIndex.current, dragEndIndex);
                const boundaries = cellBoundariesRef.current;

                // Use measured boundaries for accurate positioning
                if (boundaries.length > 0 && boundaries[startIdx] && boundaries[endIdx]) {
                  const left = boundaries[startIdx].left;
                  const width = boundaries[endIdx].right - boundaries[startIdx].left;

                  console.log('Preview Project - startIdx:', startIdx, 'endIdx:', endIdx, 'left:', left.toFixed(1), 'width:', width.toFixed(1));

                  return (
                    <div
                      className="absolute top-2 h-[calc(100%-16px)] rounded-md opacity-80 flex items-center justify-center text-white text-xs font-medium pointer-events-none z-10"
                      style={{
                        backgroundColor: dragProjectColorRef.current,
                        left: `${left}px`,
                        width: `${width}px`,
                      }}
                    >
                      {countWorkdays(days[startIdx], days[endIdx])} workdays
                    </div>
                  );
                } else {
                  // Fallback to percentage-based if boundaries not available
                  console.log('Preview Project - fallback to percentage');
                  return null;
                }
              })()}
            </div>
          </div>
        );
      })}

      {/* Assign Project Button Row */}
      <div className="flex bg-gray-50/30">
        <div className="w-[250px] shrink-0 px-4 py-3 border-r sticky left-0 bg-gray-50/30 z-20 flex items-center gap-4 pl-12">
          <Button 
            variant="outline" 
            size="sm" 
            className="text-xs"
            onClick={() => onAssignProject?.(resource.id)}
            data-testid="assign-project-button"
          >
            <Icon icon="lucide:plus" className="h-3 w-3 mr-1" />
            Assign Project
          </Button>
          {resourceProjects.length > 2 && (
            <span className="text-xs text-muted-foreground">
              Show all ({resourceProjects.length})
            </span>
          )}
        </div>
        <div className="flex relative flex-1">
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className="flex-1 h-[40px] border-r border-dashed min-w-0"
            />
          ))}
        </div>
      </div>

      {/* Assignment Popover */}
      {popoverData && (
        <AssignmentPopover
          resourceId={resource.id}
          projectId={popoverData.projectId}
          startDate={popoverData.startDate}
          endDate={popoverData.endDate}
          position={popoverData.position}
          onClose={() => setPopoverData(null)}
          onSave={handleSaveAssignment}
          isCreating={createAssignment.isPending}
        />
      )}
    </div>
  );
};
