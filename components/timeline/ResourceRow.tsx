"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Resource, AssignmentCategory } from "@/types";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import { differenceInDays, isWithinInterval, startOfDay, addDays, format } from "date-fns";
import { useCreateAssignment, useUpdateAssignment, useDeleteAssignment } from "@/lib/query/hooks/useAssignments";
import { useActualAssignments, useCreateActualAssignment, useUpdateActualAssignment, useDeleteActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import { useProjects } from "@/lib/query/hooks/useProjects";
import { useBrands } from "@/lib/query/hooks/useBrands";
import { useQueryClient } from "@tanstack/react-query";
import { AssignmentBlock } from "./AssignmentBlock";
import { ActualAssignmentBlock } from "./ActualAssignmentBlock";
import { DraggableTimelineCell } from "./DraggableTimelineCell";
import { AssignmentPopover } from "./AssignmentPopover";
import { ActualAssignmentPopover } from "./ActualAssignmentPopover";
import { Icon } from "@iconify/react";

// Component for grouped actual assignments is no longer needed
// Actual assignments now use the same structure as assignments (start_date, end_date)
// They will be rendered using ActualAssignmentBlock directly

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, toLocalDateString } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { WORK_DAYS_PER_WEEK } from "@/lib/constants";
import { useAuth } from "@/context/AuthContext";

interface ResourceRowProps {
  resource: Resource;
  days: Date[];
  brandId: string | null;
  cellWidth?: number;
  isWeekView?: boolean;
  assignments: Assignment[]; // Pre-filtered assignments for this employee
}

// Props for AllocationCell
interface AllocationCellProps {
  day: Date;
  resource: Resource;
  assignments: Assignment[];
  actualAssignments: ActualAssignment[];
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
  actualAssignments = [], // Default array kosong
  cellWidth,
  isWeekView = false
}) {
  const dailyCapacity = resource.capacity / WORK_DAYS_PER_WEEK;

  const getDaysToCheck = () => {
    if (!isWeekView) return [startOfDay(new Date(day))];
    // Include all 7 days in week view (not just weekdays)
    const allDays: Date[] = [];
    const weekStart = startOfDay(new Date(day));
    for (let i = 0; i < 7; i++) {
      allDays.push(addDays(weekStart, i));
    }
    return allDays;
  };

  const daysToCheck = getDaysToCheck();

  // Hitung total jam untuk PLAN dan ACTUAL
  let totalPlanHours = 0;
  let totalActualHours = 0;
  let daysWithScheduleCount = 0; // Count days that have schedule (including weekends)

  for (const currentDay of daysToCheck) {
    const dayOfWeek = currentDay.getDay();

    // Hitung Plan hours untuk hari ini (termasuk weekend)
    const dayPlanHours = assignments.filter(a => !a.isTimeOff).reduce((total, assignment) => {
      if (assignment.employeeId !== resource.id) return total;
      const assignStart = startOfDay(new Date(assignment.startDate));
      const assignEnd = startOfDay(new Date(assignment.endDate));
      if (currentDay >= assignStart && currentDay <= assignEnd) {
        return total + parseHoursSafe(assignment.hoursPerDay);
      }
      return total;
    }, 0);

    // Hitung Actual hours untuk hari ini (termasuk weekend)
    const dayActualHours = actualAssignments.filter(a => !a.isTimeOff).reduce((total, assignment) => {
      if (assignment.employeeUuid && assignment.employeeUuid !== resource.id) return total;
      const assignStart = startOfDay(new Date(assignment.startDate));
      const assignEnd = startOfDay(new Date(assignment.endDate));
      if (currentDay >= assignStart && currentDay <= assignEnd) {
        return total + parseHoursSafe(assignment.hoursPerDay);
      }
      return total;
    }, 0);

    // Only count this day if it has schedule (plan or actual) OR it's a weekday
    if (dayPlanHours > 0 || dayActualHours > 0 || (dayOfWeek !== 0 && dayOfWeek !== 6)) {
      daysWithScheduleCount++;
      totalPlanHours += dayPlanHours;
      totalActualHours += dayActualHours;
    }
  }

  const dailyPlanHours = daysWithScheduleCount > 0 ? totalPlanHours / daysWithScheduleCount : 0;
  const dailyActualHours = daysWithScheduleCount > 0 ? totalActualHours / daysWithScheduleCount : 0;

  // Cek Time Off (dari data plan assignment)
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

  // Jika sedang Time Off, tampilkan 1 blok abu-abu full
  if (hasTimeOff) {
    return (
      <div
        className="shrink-0 h-[60px] border-r border-white/20 bg-gray-400 flex items-center justify-center text-xs font-bold text-white"
        style={{ width: `${cellWidth}px` }}
      >
        Time Off
      </div>
    );
  }

  const safePlanHours = isNaN(dailyPlanHours) ? 0 : dailyPlanHours;
  const safeActualHours = isNaN(dailyActualHours) ? 0 : dailyActualHours;

  const planPct = dailyCapacity > 0 ? safePlanHours / dailyCapacity : 0;
  const actualPct = dailyCapacity > 0 ? safeActualHours / dailyCapacity : 0;

  // Jika KEDUANYA 0, kembalikan garis putus-putus kosong
  if (planPct <= 0 && actualPct <= 0) {
    return (
      <div
        className="shrink-0 h-[60px] border-r border-dashed"
        style={{ width: `${cellWidth}px` }}
      />
    );
  }

  // Fungsi helper untuk mendapatkan warna (Biru untuk plan, Hijau untuk actual)
  const getStyles = (pct: number, type: 'plan' | 'actual') => {
    if (pct <= 0) return { bg: "bg-transparent", text: "text-transparent", border: "", label: "" };

    let bg = "";
    let text = "text-white";
    let border = "";
    const label = `${Math.round(pct * 100)}%`;

    if (pct <= 1) {
      if (pct <= 0.25) {
        bg = type === 'plan' ? "bg-blue-200" : "bg-emerald-200";
        text = type === 'plan' ? "text-blue-900" : "text-emerald-900";
      } else if (pct <= 0.5) {
        bg = type === 'plan' ? "bg-blue-300" : "bg-emerald-300";
        text = type === 'plan' ? "text-blue-900" : "text-emerald-900";
      } else if (pct <= 0.75) {
        bg = type === 'plan' ? "bg-blue-400" : "bg-emerald-400";
        text = "text-white";
      } else {
        bg = type === 'plan' ? "bg-blue-500" : "bg-emerald-500";
        text = "text-white";
      }
    } else {
      bg = type === 'plan' ? "bg-blue-800" : "bg-emerald-800";
      text = "text-white";
      border = "border-t-2 border-red-500";
    }
    return { bg, text, border, label };
  };

  const planStyles = getStyles(planPct, 'plan');
  const actualStyles = getStyles(actualPct, 'actual');

  return (
    <div
      className="shrink-0 h-[60px] border-r border-white/20 flex flex-col overflow-hidden"
      style={{ width: `${cellWidth}px` }}
    >
      {/* KOTAK PLAN (Atas - Warna Biru) */}
      <div
        className={cn(
          "flex-1 flex items-center justify-center text-[10px] font-bold transition-all",
          planStyles.bg, planStyles.text, planStyles.border,
          planPct > 0 ? "border-b border-white/20" : "border-b border-dashed"
        )}
      >
        {planStyles.label}
      </div>

      {/* KOTAK ACTUAL (Bawah - Warna Hijau) */}
      <div
        className={cn(
          "flex-1 flex items-center justify-center text-[10px] font-bold transition-all",
          actualStyles.bg, actualStyles.text, actualStyles.border
        )}
      >
        {actualStyles.label}
      </div>
    </div>
  );
});


export const ResourceRow: React.FC<ResourceRowProps> = ({ resource, days, brandId, cellWidth = 100, isWeekView = false, assignments: resourceAssignments }) => {
  const { data: projects = [], isLoading: isLoadingProjects } = useProjects();
  const { data: brands = [] } = useBrands();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const createAssignment = useCreateAssignment();
  const updateAssignmentMutation = useUpdateAssignment();
  const deleteAssignmentMutation = useDeleteAssignment();

  // Actual assignments hooks - fetch for the resource being displayed, not just logged-in user
  const { data: actualAssignments = [], isLoading: actualsLoading } = useActualAssignments({
    employee_uuid: resource.id,  // ← FIXED: Use resource.id instead of session?.employee.uuid
    start_date: toLocalDateString(days[0]),
    end_date: toLocalDateString(days[days.length - 1]),
  });

  // Debug: log actual assignments
  // console.log('[ResourceRow] actualAssignments:', actualAssignments);
  // console.log('[ResourceRow] actualsLoading:', actualsLoading);
  const createActualAssignment = useCreateActualAssignment();
  const updateActualAssignment = useUpdateActualAssignment();
  const deleteActualAssignment = useDeleteActualAssignment();

  const [isExpanded, setIsExpanded] = useState(false);
  const PROJECT_DISPLAY_LIMIT = 5;
  const [updatingAssignmentId, setUpdatingAssignmentId] = useState<string | null>(null);

  // State untuk fitur Select Project
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [isProjectsInitialized, setIsProjectsInitialized] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Drag state - using refs for immediate synchronous access
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartIndex = useRef<number | null>(null);
  const dragEndIndexRef = useRef<number | null>(null);
  const [dragEndIndex, setDragEndIndex] = useState<number | null>(null);
  const dragProjectIdRef = useRef<string | null>(null);
  const [dragProjectId, setDragProjectId] = useState<string | null>(null);
  const dragProjectColorRef = useRef<string>("");
  const [dragProjectColor, setDragProjectColor] = useState<string>("");
  const dragRowTypeRef = useRef<'plan' | 'actual' | null>(null);
  const [dragRowType, setDragRowType] = useState<'plan' | 'actual' | null>(null);
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

  // Popover state for creating actual assignments
  const [actualPopoverData, setActualPopoverData] = useState<{
    projectId: string;
    startDate: Date;
    endDate: Date;
    position: { x: number; y: number };
  } | null>(null);

  // Get projects this resource is assigned to
  const resourceProjects = useMemo(() => {
    const projectIds = new Set(resourceAssignments.filter(a => !a.isTimeOff).map(a => a.projectId));
    return projects.filter(p => projectIds.has(p.id));
  }, [resourceAssignments, projects]);

  // Sort projects by priority: brand match → active in timeline → recent → alphabetical
  const sortedProjects = useMemo(() => {
    const timelineStart = days[0] ? startOfDay(days[0]) : null;
    const timelineEnd = days[days.length - 1] ? startOfDay(days[days.length - 1]) : null;

    return [...resourceProjects].sort((a, b) => {
      // Priority 1: Brand match (if brand filter is active)
      if (brandId) {
        const aBrandMatch = a.brandId === brandId;
        const bBrandMatch = b.brandId === brandId;
        if (aBrandMatch !== bBrandMatch) {
          return aBrandMatch ? -1 : 1;
        }
      }

      // Priority 2: Active assignments in current timeline view
      const aHasActive = resourceAssignments.some(assign =>
        assign.projectId === a.id &&
        !assign.isTimeOff &&
        timelineStart && timelineEnd &&
        isWithinInterval(startOfDay(new Date(assign.startDate)), {
          start: timelineStart,
          end: timelineEnd
        })
      );
      const bHasActive = resourceAssignments.some(assign =>
        assign.projectId === b.id &&
        !assign.isTimeOff &&
        timelineStart && timelineEnd &&
        isWithinInterval(startOfDay(new Date(assign.startDate)), {
          start: timelineStart,
          end: timelineEnd
        })
      );
      if (aHasActive !== bHasActive) {
        return aHasActive ? -1 : 1;
      }

      // Priority 3: Most recent assignment startDate
      const aLatest = resourceAssignments
        .filter(assign => assign.projectId === a.id && !assign.isTimeOff)
        .reduce((latest, curr) => {
          const currDate = new Date(curr.startDate);
          const latestDate = new Date(latest?.startDate || 0);
          return currDate > latestDate ? curr : latest;
        }, null as Assignment | null);

      const bLatest = resourceAssignments
        .filter(assign => assign.projectId === b.id && !assign.isTimeOff)
        .reduce((latest, curr) => {
          const currDate = new Date(curr.startDate);
          const latestDate = new Date(latest?.startDate || 0);
          return currDate > latestDate ? curr : latest;
        }, null as Assignment | null);

      if (aLatest && bLatest) {
        const aDate = new Date(aLatest.startDate);
        const bDate = new Date(bLatest.startDate);
        if (aDate.getTime() !== bDate.getTime()) {
          return bDate.getTime() - aDate.getTime(); // Descending (newest first)
        }
      } else if (aLatest && !bLatest) {
        return -1;
      } else if (!aLatest && bLatest) {
        return 1;
      }

      // Priority 4: Alphabetical by name
      return a.name.localeCompare(b.name);
    });
  }, [resourceProjects, brandId, resourceAssignments, days]);

  // Set default 5 project pertama saat data siap
  useEffect(() => {
    if (!isProjectsInitialized && sortedProjects.length > 0) {
      const defaultTop5 = sortedProjects.slice(0, PROJECT_DISPLAY_LIMIT).map(p => p.id);
      setSelectedProjectIds(new Set(defaultTop5));
      setIsProjectsInitialized(true);
    }
  }, [sortedProjects, isProjectsInitialized]);

  const visibleProjects = useMemo(() => {
    if (!isProjectsInitialized) {
      return sortedProjects.slice(0, PROJECT_DISPLAY_LIMIT);
    }
    // Filter berdasarkan project yang dicentang user, dan pertahankan urutan dari sortedProjects
    return sortedProjects.filter(p => selectedProjectIds.has(p.id));
  }, [sortedProjects, selectedProjectIds, isProjectsInitialized]);

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
    setPopoverData({ projectId, startDate: startDay, endDate: endDay, position });
  }, []);

  // Handle actual drag complete - open popover
  const handleActualDragComplete = useCallback((
    projectId: string,
    startDay: Date,
    endDay: Date,
    position: { x: number; y: number }
  ) => {
    console.log('[ACTUAL DRAG COMPLETE] startDay:', startDay.toISOString(), 'endDay:', endDay.toISOString(), 'workDays:', Math.ceil((endDay.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    setActualPopoverData({
      projectId,
      startDate: startDay,
      endDate: endDay,
      position,
    });
  }, []);

  // Handle time-off drag complete - create time-off directly (no popover needed)
  const handleSaveAssignment = useCallback((data: {
    hoursPerDay: number;
    workDays: number;
    category: AssignmentCategory;
    isBillable: boolean;
    note?: string;
  }) => {
    if (!popoverData) return;

    // Use the ORIGINAL dragged endDate to match the visual selection exactly
    // This ensures the assignment block aligns perfectly with the drag preview
    const finalEndDate = new Date(popoverData.endDate);

    // Close popover immediately - optimistic update will show the block
    setPopoverData(null);

    createAssignment.mutate({
      employeeId: resource.id,
      projectId: popoverData.projectId,
      taskId: null,
      startDate: toLocalDateString(popoverData.startDate),
      endDate: toLocalDateString(finalEndDate),
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
  const measureCellBoundaries = useCallback((container: HTMLDivElement | null) => {
    if (!container) return [];

    const allChildren = container.children;
    const cellCount = days.length;
    const boundaries: Array<{ left: number; right: number }> = [];
    const containerRect = container.getBoundingClientRect();

    // Filter to only DraggableTimelineCell elements (they have data-testid attribute ending with "-cell")
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

    cellBoundariesRef.current = boundaries;
    return boundaries;
  }, [days.length]);

  // Drag handlers for timeline cells - with rowType parameter
  const handleDragStart = useCallback((dayIndex: number, projectId: string, projectColor: string, containerRef: HTMLDivElement | null, rowType: 'plan' | 'actual' | null = null, e?: React.MouseEvent | MouseEvent) => {
    if (createAssignment.isPending) return;

    // If containerRef is not provided but we have an event, try to find the container from the event
    let actualContainerRef = containerRef;
    if (!actualContainerRef && e) {
      const target = e.currentTarget as HTMLElement;
      if (target) {
        actualContainerRef = target.closest('.flex.relative.flex-1.overflow-hidden') as HTMLDivElement;
      }
    }

    if (!actualContainerRef) return;

    // Measure cell boundaries for accurate positioning
    measureCellBoundaries(containerRef);

    console.log('DRAG START - dayIndex:', dayIndex, 'Date:', days[dayIndex]?.toISOString(), 'Project:', projectId, 'RowType:', rowType);

    // Set refs immediately for synchronous access
    isDraggingRef.current = true;
    dragStartIndex.current = dayIndex;
    dragEndIndexRef.current = dayIndex;
    dragProjectIdRef.current = projectId;
    dragProjectColorRef.current = projectColor;
    dragRowTypeRef.current = rowType;

    // Set states for re-render
    setIsDragging(true);
    setDragEndIndex(dayIndex);
    setDragProjectId(projectId);
    setDragProjectColor(projectColor);
    setDragRowType(rowType);

    const handleMouseMove = (moveEvent: MouseEvent) => {
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
      } else {
        // Fallback to percentage-based calculation if boundaries not available
        const actualCellWidth = rect.width / days.length;
        rawIndex = Math.max(0, Math.min(days.length - 1, Math.floor(x / actualCellWidth)));
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

        console.log('[DRAG END] startIdx:', start, 'endIdx:', end, 'rowType:', dragRowTypeRef.current);

        // Call the appropriate drag complete handler based on rowType
        const currentProjectId = dragProjectIdRef.current;
        const currentRowType = dragRowTypeRef.current;

        if (currentProjectId) {
          // Use actual handler for actual row, plan handler for plan row
          if (currentRowType === 'actual') {
            handleActualDragComplete(currentProjectId, days[start], days[end], {
              x: upEvent.clientX,
              y: upEvent.clientY,
            });
          } else {
            handleDragComplete(currentProjectId, days[start], days[end], {
              x: upEvent.clientX,
              y: upEvent.clientY,
            });
          }
        } else {
          handleTimeOffDragComplete(days[start], days[end]);
        }
      }

      // Reset refs
      isDraggingRef.current = false;
      dragEndIndexRef.current = null;
      dragStartIndex.current = null;
      dragProjectIdRef.current = null;
      dragProjectColorRef.current = "";
      dragRowTypeRef.current = null;

      // Reset states
      setIsDragging(false);
      setDragEndIndex(null);
      setDragProjectId(null);
      setDragProjectColor("");
      setDragRowType(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [days, createAssignment.isPending, handleDragComplete, handleActualDragComplete, handleTimeOffDragComplete, measureCellBoundaries]);

  // Check if a day index is in the current drag range - using refs for synchronous access
  const isInDragRange = useCallback((dayIndex: number, rowType?: 'plan' | 'actual' | null) => {
    const isDragging = isDraggingRef.current;
    const dragRowType = dragRowTypeRef.current;
    const startIdx = dragStartIndex.current;
    const endIdx = dragEndIndexRef.current;

    if (!isDragging || startIdx === null || endIdx === null) return false;
    // Check if this row type matches the current drag row type
    // If dragRowType is null (time off mode), allow highlighting any row
    // If dragRowType is 'plan' or 'actual', only highlight matching row
    if (dragRowType !== null && rowType !== dragRowType) return false;
    const start = Math.min(startIdx, endIdx);
    const end = Math.max(startIdx, endIdx);
    return dayIndex >= start && dayIndex <= end;
  }, []);

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
    console.log('[ResourceRow] handleUpdateAssignment called:', {
      id,
      updates,
      resourceId: resource.id,
    });

    // Look up the current assignment to provide required fields for strict PUT schema
    const currentAssignment = resourceAssignments.find((a) => a.id === id);

    const payload: any = { id };

    // Only include required fields from current assignment if not in updates
    if (currentAssignment) {
      payload.employeeId = currentAssignment.employeeId;
      // Only set dates from currentAssignment if NOT being updated
      if (updates.startDate === undefined) {
        payload.startDate = currentAssignment.startDate;
      }
      if (updates.endDate === undefined) {
        payload.endDate = currentAssignment.endDate;
      }
    }

    // Handle date conversions if updates contain Date objects (overrides defaults)
    if (updates.startDate !== undefined) {
      payload.startDate = updates.startDate instanceof Date
        ? toLocalDateString(updates.startDate)
        : updates.startDate;
    }
    if (updates.endDate !== undefined) {
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
    console.log('[ResourceRow] Calling updateAssignmentMutation.mutate:', payload);
    updateAssignmentMutation.mutate(payload, {
      onSuccess: () => {
        console.log('[ResourceRow] Update successful');
      },
      onError: (error) => {
        console.error('[ResourceRow] Update failed:', error);
      },
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

  // Handle save actual assignment - Struktur sama dengan assignments
  const handleSaveActualAssignment = useCallback((data: {
    startDate: string;
    endDate: string;
    hoursPerDay: number;
    category: AssignmentCategory;
    isBillable: boolean;
    note?: string;
  }) => {
    if (!actualPopoverData) return;

    // Create a single actual assignment with date range (struktur sama dengan assignments)
    const actualData = {
      employeeUuid: resource.id,
      projectUuid: actualPopoverData.projectId,
      taskUuid: null,
      startDate: toLocalDateString(new Date(data.startDate)),
      endDate: toLocalDateString(new Date(data.endDate)),
      hoursPerDay: data.hoursPerDay,
      allocationPercentage: null,
      isTimeOff: false,
      timeOffTypeUuid: null,
      category: data.category || null,
      isBillable: data.isBillable,
      status: 'confirmed',
      note: data.note || null,
      createdByUuid: session?.employee?.uuid || null,
    };

    createActualAssignment.mutate(actualData);

    // Close popover
    setActualPopoverData(null);
  }, [actualPopoverData, resource.id, createActualAssignment, session]);

  // Handle actual assignment update - Struktur sama dengan assignments
  const handleUpdateActualAssignment = useCallback((uuid: string, updates: Partial<{
    startDate: string;
    endDate: string;
    hoursPerDay: number;
    allocationPercentage: number | null;
    isTimeOff: boolean;
    timeOffTypeUuid: string | null;
    category: string | null;
    isBillable: boolean;
    status: string;
    note: string | null;
    projectUuid: string | null;
    taskUuid: string | null;
  }>) => {
    console.log('[ResourceRow] handleUpdateActualAssignment called:', {
      uuid,
      updates,
      resourceId: resource.id,
    });
    updateActualAssignment.mutate(
      { uuid, ...updates },
      {
        onError: (error) => {
          console.error('[ResourceRow] Failed to update actual assignment:', error);
          // Error will be shown through toast notification from the hook
        },
      }
    );
  }, [updateActualAssignment]);

  // Handle actual assignment delete
  const handleDeleteActualAssignment = useCallback((uuid: string) => {
    deleteActualAssignment.mutate(uuid);
  }, [deleteActualAssignment]);

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
        <div className="flex relative" style={{ width: `${days.length * cellWidth}px` }}>
          {days.map((day) => (
            <AllocationCell
              key={day.toISOString()}
              day={day}
              resource={resource}
              assignments={resourceAssignments}
              actualAssignments={actualAssignments}
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
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          "border-b",
          isFilterOpen ? "relative z-50" : "relative z-0"
        )}
        data-testid="resource-row"
        data-resource-id={resource.id}
      >
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
          <div className="flex relative" style={{ width: `${days.length * cellWidth}px` }}>
            {days.map((day) => (
              <AllocationCell
                key={day.toISOString()}
                day={day}
                resource={resource}
                assignments={resourceAssignments}
                actualAssignments={actualAssignments}
                cellWidth={cellWidth}
                isWeekView={isWeekView}
              />
            ))}
          </div>
        </div>

        {/* Time Off Row */}
        <div className="flex bg-gray-50/50 h-[40px]" data-testid="timeoff-row" data-resource-id={resource.id}>
          <div className="w-[250px] shrink-0 px-4 border-r sticky left-0 bg-gray-50/50 z-20 flex items-center gap-2 pl-12 h-[40px]">
            <Icon icon="lucide:calendar-off" className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600">Time Off</span>
          </div>
          <div ref={timeOffTimelineRef} className="flex relative h-[40px]" style={{ width: `${days.length * cellWidth}px` }}>
            {days.map((day, dayIndex) => (
              <DraggableTimelineCell
                key={day.toISOString()}
                day={day}
                projectId=""
                projectColor="#6b7280"
                days={days}
                cellWidth={cellWidth}
                cellHeight={40}
                isTimeOffMode={true}
                containerRef={timeOffTimelineRef.current}
                onDragComplete={(startDay, endDay) =>
                  handleTimeOffDragComplete(startDay, endDay)
                }
                disabled={createAssignment.isPending}
                isDragging={isDraggingRef.current && dragProjectIdRef.current === ""}
                isInDragRange={isInDragRange(dayIndex, null)}
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
                resourceRowHeight={40}
                cellWidth={cellWidth}
                isWeekView={isWeekView}
                onUpdate={handleUpdateAssignment}
                onDelete={handleDeleteAssignment}
                isUpdating={updatingAssignmentId === assignment.id}
              />
            ))}
            {/* Drag preview overlay for Time Off */}
            {isDraggingRef.current && dragProjectIdRef.current === "" && dragStartIndex.current !== null && dragEndIndexRef.current !== null && (() => {
              const startIdx = Math.min(dragStartIndex.current, dragEndIndexRef.current);
              const endIdx = Math.max(dragStartIndex.current, dragEndIndexRef.current);
              const boundaries = cellBoundariesRef.current;

              // Use measured boundaries for accurate positioning
              if (boundaries.length > 0 && boundaries[startIdx] && boundaries[endIdx]) {
                const left = boundaries[startIdx].left;
                const width = boundaries[endIdx].right - boundaries[startIdx].left;


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
                <div className="flex relative" style={{ width: `${days.length * cellWidth}px`, height: 60 }}>
                  <div className="w-full h-full p-2">
                    <Skeleton className="h-full w-full opacity-20" />
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Project Rows - 3 rows per project (Header + Plan + Actual) */}
        {visibleProjects.map((project) => {
          const brand = brands.find(b => b.id === project.brandId);

          // Filter plan assignments (from assignments table) - include all statuses
          const planAssignments = resourceAssignments.filter(
            a => a.projectId === project.id && !a.isTimeOff && (() => {
              const hours = parseFloat(a.hoursPerDay);
              return isNaN(hours) ? true : hours > 0;
            })()
          );

          // Filter actual assignments (from actual table) - Struktur sama dengan assignments
          const projectActualAssignments = actualAssignments.filter(a =>
            a.projectUuid === project.id
          );

          return (
            <React.Fragment key={project.id}>
              {/* Project Group Container */}
              <div className="flex flex-col">
                {/* Sidebar - Merged for PLAN & ACTUAL */}
                <div className="flex" data-testid="project-group" data-resource-id={resource.id} data-project-id={project.id}>
                  <div className="w-[250px] shrink-0 px-4 py-2 border-r sticky left-0 bg-background z-20 flex pl-12" style={{ height: 80 }}>
                    <div className="flex items-center gap-2 w-4/6">
                      <div className="w-4 h-4 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: project.color }}>
                        <Icon icon="lucide:folder" className="h-3 w-3 text-white" />
                      </div>
                      <div className="flex flex-col justify-center min-w-0">
                        <div className="text-sm font-semibold truncate">{project.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{brand?.name}</div>
                      </div>
                    </div>
                    <div className="flex flex-col justify-center gap-2 text-xs font-semibold w-2/5">
                      <span className="text-blue-600">PLAN</span>
                      <span className="text-green-600">ACTUAL</span>
                    </div>
                  </div>

                  {/* Timeline Content Container */}
                  <div className="flex-1 flex flex-col">
                    {/* PLAN Row - from assignments table */}
                    <div className="flex-1 bg-blue-50/30" style={{ height: 40 }} data-testid="plan-row" data-resource-id={resource.id} data-project-id={project.id}>
                      {!session?.access.can_view_all ? (
                        <div
                          ref={(el) => { if (el) projectTimelineRefs.current.set(`plan-${project.id}`, el); }}
                          className="flex relative"
                          style={{ width: `${days.length * cellWidth}px`, height: 40 }}
                        >
                          {days.map((day) => (
                            <div key={day.toISOString()} className="shrink-0 h-[40px] border-r border-white/20 bg-gray-100/50" style={{ width: `${cellWidth}px` }} />
                          ))}
                          {/* Show plan assignments but disabled (no click, resize, drag) */}
                          {planAssignments.map((assignment) => (
                            <AssignmentBlock
                              key={assignment.id}
                              assignment={assignment}
                              project={projectMap.get(assignment.projectId ?? '')}
                              days={days}
                              resourceRowHeight={40}
                              cellWidth={cellWidth}
                              isWeekView={isWeekView}
                              onUpdate={handleUpdateAssignment}
                              onDelete={handleDeleteAssignment}
                              timeOffAssignments={timeOffAssignments}
                              isUpdating={updatingAssignmentId === assignment.id}
                              disabled={true}
                            />
                          ))}
                        </div>
                      ) : (
                        <div
                          ref={(el) => { if (el) projectTimelineRefs.current.set(`plan-${project.id}`, el); }}
                          className="flex relative"
                          style={{ width: `${days.length * cellWidth}px`, height: 40 }}
                        >
                          {days.map((day, dayIndex) => (
                            <DraggableTimelineCell
                              key={day.toISOString()}
                              day={day}
                              projectId={project.id}
                              projectColor={project.color}
                              days={days}
                              cellWidth={cellWidth}
                              cellHeight={40}
                              timeOffAssignments={timeOffAssignments}
                              containerRef={projectTimelineRefs.current.get(`plan-${project.id}`) || null}
                              onDragComplete={(startDay, endDay, position) =>
                                handleDragComplete(project.id, startDay, endDay, position)
                              }
                              disabled={createAssignment.isPending}
                              isDragging={isDraggingRef.current && dragProjectIdRef.current === project.id && dragRowTypeRef.current === 'plan'}
                              isInDragRange={isInDragRange(dayIndex, 'plan')}
                              onMouseDown={(index, containerRef) => handleDragStart(index, project.id, project.color, containerRef, 'plan')}
                            />
                          ))}
                          {/* Plan Assignments */}
                          {planAssignments.map((assignment) => (
                            <AssignmentBlock
                              key={assignment.id}
                              assignment={assignment}
                              project={projectMap.get(assignment.projectId ?? '')}
                              days={days}
                              resourceRowHeight={40}
                              cellWidth={cellWidth}
                              isWeekView={isWeekView}
                              onUpdate={handleUpdateAssignment}
                              onDelete={handleDeleteAssignment}
                              timeOffAssignments={timeOffAssignments}
                              isUpdating={updatingAssignmentId === assignment.id}
                            />
                          ))}
                          {/* Drag preview overlay - PLAN only */}
                          {(() => {
                            // Use refs for synchronous access
                            const shouldShow = isDraggingRef.current && dragProjectIdRef.current === project.id && dragRowTypeRef.current === 'plan';
                            if (!shouldShow || dragStartIndex.current === null || dragEndIndexRef.current === null) return null;
                            const startIdx = Math.min(dragStartIndex.current, dragEndIndexRef.current);
                            const endIdx = Math.max(dragStartIndex.current, dragEndIndexRef.current);
                            const boundaries = cellBoundariesRef.current;

                            if (boundaries.length > 0 && boundaries[startIdx] && boundaries[endIdx]) {
                              const left = boundaries[startIdx].left;
                              const width = boundaries[endIdx].right - boundaries[startIdx].left;
                              return (
                                <div
                                  className="absolute rounded-md opacity-80 flex items-center justify-center text-white text-xs font-medium pointer-events-none z-10"
                                  style={{
                                    top: 4,
                                    height: 'calc(100% - 4px)',
                                    backgroundColor: dragProjectColorRef.current,
                                    left: `${left}px`,
                                    width: `${width}px`,
                                  }}
                                >
                                  {countWorkdays(days[startIdx], days[endIdx])} workdays
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      )}
                    </div>

                    {/* ACTUAL Row - from actual table */}
                    <div className="flex-1 bg-green-50/30" style={{ height: 40 }} data-testid="actual-row" data-resource-id={resource.id} data-project-id={project.id}>
                      <div
                        ref={(el) => {
                          if (el) {
                            projectTimelineRefs.current.set(`actual-${project.id}`, el);
                            console.log('[ACTUAL ROW] Container ref set for:', project.name);
                          }
                        }}
                        className="flex relative"
                        style={{ width: `${days.length * cellWidth}px`, height: 40 }}
                      >
                        {days.map((day, dayIndex) => (
                          <DraggableTimelineCell
                            key={day.toISOString()}
                            day={day}
                            projectId={project.id}
                            projectColor={project.color}
                            days={days}
                            cellWidth={cellWidth}
                            cellHeight={40}
                            timeOffAssignments={timeOffAssignments}
                            containerRef={projectTimelineRefs.current.get(`actual-${project.id}`)}
                            onDragComplete={(startDay, endDay, position) =>
                              handleActualDragComplete(project.id, startDay, endDay, position)
                            }
                            disabled={createActualAssignment.isPending || resource.id !== session?.employee?.uuid}
                            isDragging={isDraggingRef.current && dragProjectIdRef.current === project.id && dragRowTypeRef.current === 'actual'}
                            isInDragRange={isInDragRange(dayIndex, 'actual')}
                            onMouseDown={(index, containerRef) => handleDragStart(index, project.id, project.color, containerRef, 'actual')}
                          />
                        ))}
                        {/* Actual Assignments - Struktur sama dengan plan assignments */}
                        {projectActualAssignments.map((actualAssignment) => (
                          <ActualAssignmentBlock
                            key={actualAssignment.uuid}
                            assignment={actualAssignment}
                            project={projectMap.get(actualAssignment.projectUuid ?? '')}
                            days={days}
                            resourceRowHeight={40}
                            cellWidth={cellWidth}
                            isWeekView={isWeekView}
                            onUpdate={handleUpdateActualAssignment}
                            onDelete={handleDeleteActualAssignment}
                            timeOffAssignments={timeOffAssignments as any}
                            disabled={actualAssignment.createdByUuid !== session?.employee?.uuid}
                          />
                        ))}
                        {/* Drag preview overlay for actual - ACTUAL only */}
                        {(() => {
                          // Use refs for synchronous access
                          const shouldShow = isDraggingRef.current && dragProjectIdRef.current === project.id && dragRowTypeRef.current === 'actual';
                          if (!shouldShow || dragStartIndex.current === null || dragEndIndexRef.current === null) return null;
                          const startIdx = Math.min(dragStartIndex.current, dragEndIndexRef.current);
                          const endIdx = Math.max(dragStartIndex.current, dragEndIndexRef.current);
                          const boundaries = cellBoundariesRef.current;

                          if (boundaries.length > 0 && boundaries[startIdx] && boundaries[endIdx]) {
                            const left = boundaries[startIdx].left;
                            const width = boundaries[endIdx].right - boundaries[startIdx].left;
                            return (
                              <div
                                className="absolute rounded-md opacity-80 flex items-center justify-center text-white text-xs font-medium pointer-events-none z-10 bg-emerald-500"
                                style={{
                                  top: -4,
                                  height: 'calc(100% - 4px)',
                                  left: `${left}px`,
                                  width: `${width}px`,
                                }}
                              >
                                {countWorkdays(days[startIdx], days[endIdx])} workdays
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}

        {/* Project Filter Select Row */}
        {sortedProjects.length > PROJECT_DISPLAY_LIMIT && (
          <div className="flex bg-gray-50/30">
            <div
              className={cn(
                "w-[250px] shrink-0 px-4 py-2 border-r sticky left-0 bg-gray-50/30 flex items-center pl-12 overflow-visible",
                isFilterOpen ? "z-50" : "z-20" // <-- Tambahkan logika ini
              )}
            >

              {/* Dropdown Wrapper */}
              <div className="relative w-full">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between text-xs h-7 text-primary hover:text-primary border border-transparent hover:bg-accent"
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  data-testid="select-project-filter"
                >
                  <span className="truncate">Select Project ({selectedProjectIds.size}/{sortedProjects.length})</span>
                  <Icon
                    icon={isFilterOpen ? "lucide:chevron-up" : "lucide:chevron-down"}
                    className="h-3 w-3 ml-1 shrink-0"
                  />
                </Button>

                {/* Popover/Dropdown Menu */}
                {isFilterOpen && (
                  <>
                    {/* Invisible backdrop to close dropdown when clicking outside */}
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsFilterOpen(false)}
                    />

                    {/* Ubah lebar menjadi w-[450px] dan tinggi menjadi max-h-[500px] */}
                    <div className="absolute bottom-full left-0 mb-1 w-[450px] max-w-[95vw] bg-background border border-border rounded-md shadow-2xl z-50 max-h-[500px] overflow-y-auto py-2">
                      {sortedProjects.map(p => {
                        const isSelected = selectedProjectIds.has(p.id);
                        const projectBrand = brands?.find(b => b.id === p.brandId);

                        return (
                          <label
                            key={p.id}
                            // Perbesar padding (px-5 py-4) dan jarak antar elemen (gap-4)
                            className="flex items-start gap-4 px-5 py-4 transition-colors cursor-pointer hover:bg-muted/50 border-b border-border/50 last:border-0"
                          >
                            <input
                              type="checkbox"
                              // Perbesar ukuran checkbox menjadi h-5 w-5 (sebelumnya h-4 w-4 atau h-3 w-3)
                              className="rounded border-primary text-primary focus:ring-primary h-5 w-5 mt-1 cursor-pointer shrink-0"
                              checked={isSelected}
                              onChange={() => {
                                setSelectedProjectIds(prev => {
                                  const next = new Set(prev);
                                  if (next.has(p.id)) {
                                    next.delete(p.id);
                                  } else {
                                    next.add(p.id);
                                  }
                                  return next;
                                });
                              }}
                            />
                            <div className="flex flex-col min-w-0">
                              {/* Perbesar nama project menjadi text-base (ukuran standar teks website) dan lebih tebal */}
                              <span className="text-sm font-semibold text-foreground leading-snug">
                                {p.name}
                              </span>
                              {/* Perbesar nama brand menjadi text-sm (sebelumnya sangat kecil text-[10px]) */}
                              {projectBrand && (
                                <span className="text-sm text-muted-foreground mt-1">
                                  {projectBrand.name}
                                </span>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

            </div>

            {/* Timeline filler (garis-garis putus kosong di sisa row) */}
            <div className="flex relative flex-1" style={{ width: `${days.length * cellWidth}px` }}>
              {days.map((day) => (
                <div
                  key={day.toISOString()}
                  className="shrink-0 h-[44px] border-r border-dashed"
                  style={{ width: `${cellWidth}px` }}
                />
              ))}
            </div>
          </div>
        )}

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

        {/* Actual Assignment Popover */}
        {actualPopoverData && (
          <ActualAssignmentPopover
            projectId={actualPopoverData.projectId}
            startDate={actualPopoverData.startDate}
            endDate={actualPopoverData.endDate}
            position={actualPopoverData.position}
            onClose={() => setActualPopoverData(null)}
            onSave={handleSaveActualAssignment}
            isCreating={createActualAssignment.isPending}
          />
        )}
      </div>
    </TooltipProvider>
  );
};
