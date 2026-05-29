"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Resource, AssignmentCategory } from "@/types";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import { startOfDay, addDays, startOfMonth, endOfMonth } from "date-fns";
import { useCreateAssignment, useUpdateAssignment, useDeleteAssignment } from "@/lib/query/hooks/useAssignments";
import { useCreateActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import { calculatePlannedHoursForMonth, calculateActualHoursForMonth } from "@/lib/utils/actual-hours-validation";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import type { Brand } from "@/lib/query/hooks/useBrands";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/queryKeys";
import {
  shouldLoadPlannerAssignmentDetail,
} from "@/lib/timeline/planner-loading";
import { getMonthlyDetailKey } from "@/lib/timeline/resource-row-model";
import {
  getResourceProjects,
  groupProjectsByDeliverable,
  sortResourceProjects,
} from "@/lib/timeline/resource-project-model";
import { AssignmentBlock } from "./AssignmentBlock";
import { AllocationCell } from "./AllocationCell";
import { DraggableTimelineCell } from "./DraggableTimelineCell";
import { AssignmentPopover } from "./AssignmentPopover";
import { ActualAssignmentPopover } from "./ActualAssignmentPopover";
import { MonthlyAllocationModal } from "./MonthlyAllocationModal";
import { MonthlyAllocationConfirmation, type MonthlyAllocationData } from "./MonthlyAllocationConfirmation";
import { Icon } from "@iconify/react";

import {
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, toLocalDateString } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";

type MonthlyDetailRequest = {
  key: string;
  controller: AbortController;
};

type MonthlyAllocationSaveData = {
  projectId: string;
  totalHours: number;
  startDate: Date;
  endDate: Date;
  distributions: Array<{ date: Date; hours: number }>;
  category: AssignmentCategory;
  isBillable: boolean;
  note?: string;
  adjustmentHours?: number;
  adjustmentStartDate?: Date;
  adjustmentEndDate?: Date;
  adjustmentDistributions?: Array<{ date: Date; hours: number }>;
  removeAdjustment?: boolean;
  planHoursChanged?: boolean;
};

type PendingMonthlyAllocationSave = {
  data: MonthlyAllocationSaveData;
  existingAssignment?: Assignment;
};

type AssignmentUpdateInput = Partial<
  Omit<Assignment, "startDate" | "endDate" | "createdAt" | "updatedAt">
> & {
  startDate?: string | Date;
  endDate?: string | Date;
};

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

interface ResourceRowProps {
  resource: Resource;
  days: Date[];
  brandId: string | null;
  cellWidth?: number;
  isWeekView?: boolean;
  assignments: Assignment[]; // Pre-filtered assignments for this employee
  actualAssignments: ActualAssignment[]; // Pre-filtered actual assignments for this employee
  isExpanded: boolean;
  setIsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  selectedProjectIds: Set<string>;
  setSelectedProjectIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  isProjectsInitialized: boolean;
  setIsProjectsInitialized: React.Dispatch<React.SetStateAction<boolean>>;
  isFilterOpen: boolean;
  setIsFilterOpen: React.Dispatch<React.SetStateAction<boolean>>;
  viewMode?: 'week' | 'month' | 'quarter' | 'halfYear' | 'year';
  projects: ProjectOption[];
  projectById: Map<string, ProjectOption>;
  brandById: Map<string, Brand>;
  isLoadingProjects: boolean;
}

// Component for weekly/monthly time off blocks in Quarter/HalfYear/Year view
// Note: Month view now shows daily columns like week view, so this component is not used for month view
interface WeeklyTimeOffBlockProps {
  assignment: Assignment;
  days: Date[];
  isMonthRangeView?: boolean; // true for Quarter/HalfYear/Year view (monthly columns)
}

const WeeklyTimeOffBlock = React.memo<WeeklyTimeOffBlockProps>(function WeeklyTimeOffBlock({
  assignment,
  days,
  isMonthRangeView = false
}) {
  const hoursPerDay = parseFloat(assignment.hoursPerDay) || 8; // Default 8 hours for time off
  const assignmentStart = startOfDay(new Date(assignment.startDate));
  const assignmentEnd = startOfDay(new Date(assignment.endDate));

  // Calculate blocks for each week/month that this time off covers
  const weeklyBlocks = useMemo(() => {
    const blocks: Array<{ startIndex: number; endIndex: number; hours: number }> = [];

    // Check if this is MonthRange view (Quarter/HalfYear/Year with monthly columns)
    // Note: Month view now shows daily columns, so this component is not used for month view anymore
    const isMonthView = !isMonthRangeView; // Legacy: this branch is now dead code

    // For Month view, we need to know the month boundaries (legacy - no longer used)
    let monthStart: Date | null = null;
    let monthEnd: Date | null = null;
    if (isMonthView && days.length > 0) {
      // Use startOfMonth to get the actual first day of the month
      monthStart = startOfDay(startOfMonth(days[0]));
      monthEnd = startOfDay(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0));
    }

    for (let i = 0; i < days.length; i++) {
      let rangeStart: Date;
      let rangeEnd: Date;

      if (isMonthView && monthStart && monthEnd) {
        // Use same logic as Timeline.tsx header for consistency
        // First column: from day 1 (monthStart) to first Sunday
        if (i === 0) {
          rangeStart = monthStart;
          const dayOfWeek = monthStart.getDay();
          const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
          rangeEnd = addDays(rangeStart, daysUntilSunday);
        }
        // Last column: from last Monday to last day of month
        else if (i === days.length - 1) {
          rangeStart = startOfDay(days[i]);
          rangeEnd = monthEnd;
        }
        // Middle columns: Monday to Sunday (7 days)
        else {
          rangeStart = startOfDay(days[i]);
          rangeEnd = addDays(rangeStart, 6);
        }
      } else if (isMonthRangeView) {
        // Quarter/HalfYear/Year view: 1 month range (from 1st to last day of month)
        rangeStart = startOfDay(days[i]);
        rangeEnd = new Date(rangeStart.getFullYear(), rangeStart.getMonth() + 1, 0);
      } else {
        // Fallback: shouldn't happen
        rangeStart = startOfDay(days[i]);
        rangeEnd = addDays(rangeStart, 6);
      }

      // Calculate overlap between assignment and this range
      const overlapStart = assignmentStart > rangeStart ? assignmentStart : rangeStart;
      const overlapEnd = assignmentEnd < rangeEnd ? assignmentEnd : rangeEnd;

      if (overlapStart <= overlapEnd) {
        // Calculate total days in overlap period (including weekends for time off)
        let totalDays = 0;
        const checkDate = new Date(overlapStart);
        while (checkDate <= overlapEnd) {
          totalDays++;
          checkDate.setDate(checkDate.getDate() + 1);
        }

        const rangeHours = totalDays * hoursPerDay;

        if (rangeHours > 0) {
          blocks.push({
            startIndex: i,
            endIndex: i,
            hours: rangeHours
          });
        }
      }
    }

    return blocks;
  }, [assignmentStart, assignmentEnd, days, hoursPerDay, isMonthRangeView]);

  if (weeklyBlocks.length === 0) return null;

  return (
    <>
      {weeklyBlocks.map((block, index) => {
        const cellPercentage = 100 / days.length;
        const leftOffset = block.startIndex * cellPercentage;
        const width = cellPercentage; // 1 column wide

        return (
          <div
            key={`${assignment.id}-${index}`}
            className="absolute rounded-md shadow-sm border text-xs text-white overflow-hidden flex items-center bg-gray-600"
            style={{
              left: `${leftOffset}%`,
              width: `${width}%`,
              top: 4,
              height: 36, // Same as AssignmentBlock (40 - 4)
              zIndex: 10,
            }}
            title={`Time Off: ${Math.round(block.hours)}h`}
          >
            <div className="flex-1 px-2 py-1 min-w-0 pointer-events-none">
              <div className="font-bold truncate text-xs">Time Off</div>
              <div className="truncate opacity-90 text-xs">{Math.round(block.hours)}h</div>
            </div>
          </div>
        );
      })}
    </>
  );
});


export const ResourceRow: React.FC<ResourceRowProps> = ({
  resource,
  days,
  brandId,
  cellWidth = 100,
  isWeekView = false,
  assignments: resourceAssignments,
  actualAssignments,
  isExpanded,
  setIsExpanded,
  selectedProjectIds,
  setSelectedProjectIds,
  isProjectsInitialized,
  setIsProjectsInitialized,
  isFilterOpen,
  setIsFilterOpen,
  viewMode = 'week',
  projects,
  projectById,
  brandById,
  isLoadingProjects,
}) => {
  // Determine if this is MonthRange view (Quarter/HalfYear/Year)
  // These views show monthly columns instead of weekly columns
  const isMonthRangeView = viewMode === 'quarter' || viewMode === 'halfYear' || viewMode === 'year';
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const createAssignment = useCreateAssignment();
  const updateAssignmentMutation = useUpdateAssignment();
  const deleteAssignmentMutation = useDeleteAssignment();

  const createActualAssignment = useCreateActualAssignment();

  const PROJECT_DISPLAY_LIMIT = 5;
  const [updatingAssignmentId, setUpdatingAssignmentId] = useState<string | null>(null);

  // Hover state for month columns in quarter/half-year/year views (for + indicator)
  const [hoveredMonthIndex, setHoveredMonthIndex] = useState<number | null>(null);
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null);
  const [hoveredRowType, setHoveredRowType] = useState<'plan' | 'actual' | null>(null);

  // State untuk fitur Select Project
  // Drag state - using refs for immediate synchronous access
  const isDraggingRef = useRef(false);
  const dragStartIndex = useRef<number | null>(null);
  const dragEndIndexRef = useRef<number | null>(null);
  const dragProjectIdRef = useRef<string | null>(null);
  const dragProjectColorRef = useRef<string>("");
  const dragRowTypeRef = useRef<'plan' | 'actual' | null>(null);
  const [, setDragRenderTick] = useState(0);
  // Create refs for each timeline container
  const timeOffTimelineRef = useRef<HTMLDivElement>(null);
  const projectTimelineRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const cellBoundariesRef = useRef<Array<{ left: number; right: number }>>([]);
  const refreshDragRender = useCallback(() => {
    setDragRenderTick((value) => value + 1);
  }, []);

  // Popover state for creating assignments
  const [popoverData, setPopoverData] = useState<{
    projectId: string;
    startDate: Date;
    endDate: Date;
  } | null>(null);

  // Popover state for creating actual assignments
  const [actualPopoverData, setActualPopoverData] = useState<{
    projectId: string;
    startDate: Date;
    endDate: Date;
    plannedHoursLimit: number;
    currentActualHours: number;
  } | null>(null);

  // Monthly allocation modal state
  const [monthlyAllocationModal, setMonthlyAllocationModal] = useState<{
    monthStart: Date;
    monthEnd: Date;
    project: ProjectOption;
    existingAssignment?: Assignment; // For edit mode
    adjustmentAssignments?: Assignment[]; // adjustment records yang sudah ada
    detailAssignments?: Assignment[];
    monthlyTotalHours?: number; // Total hours for this month (plan+adj combined)
    planTotalHours?: number; // Plan-only hours (excluding adjustments)
    adjustmentTotalHours?: number; // Adjustment-only hours for this month
  } | null>(null);

  // Monthly allocation confirmation state
  const [monthlyAllocationConfirm, setMonthlyAllocationConfirm] = useState<{
    data: MonthlyAllocationData;
    isEditMode: boolean;
  } | null>(null);
  const [pendingMonthlyAllocationSave, setPendingMonthlyAllocationSave] =
    useState<PendingMonthlyAllocationSave | null>(null);

  const [loadingMonthlyPlanDetailKey, setLoadingMonthlyPlanDetailKey] = useState<string | null>(null);
  const monthlyPlanDetailRequestRef = useRef<MonthlyDetailRequest | null>(null);

  useEffect(() => {
    return () => {
      monthlyPlanDetailRequestRef.current?.controller.abort();
    };
  }, []);

  // Get projects this resource is assigned to
  const resourceProjects = useMemo(
    () => getResourceProjects(resourceAssignments, projects),
    [resourceAssignments, projects]
  );

  // Sort projects by priority: brand match → active in timeline → recent → alphabetical
  const sortedProjects = useMemo(
    () =>
      sortResourceProjects({
        projects: resourceProjects,
        resourceAssignments,
        brandId,
        days,
      }),
    [brandId, days, resourceAssignments, resourceProjects]
  );

  // New logic: Group projects by deliverables (Primary: Deliverable, Secondary: Project)
  const deliverableGroups = useMemo(
    () =>
      groupProjectsByDeliverable({
        sortedProjects,
        resourceAssignments,
        actualAssignments,
      }),
    [actualAssignments, resourceAssignments, sortedProjects]
  );

  // Set default 5 project pertama saat data siap
  useEffect(() => {
    if (!isProjectsInitialized && sortedProjects.length > 0) {
      const defaultTop5 = sortedProjects.slice(0, PROJECT_DISPLAY_LIMIT).map(p => p.id);
      setSelectedProjectIds(new Set(defaultTop5));
      setIsProjectsInitialized(true);
    }
  }, [isProjectsInitialized, setIsProjectsInitialized, setSelectedProjectIds, sortedProjects]);

  // Get time-off assignments for this resource (used to block scheduling on time-off days)
  const timeOffAssignments = useMemo(() =>
    resourceAssignments.filter(a => a.isTimeOff),
    [resourceAssignments]
  );

  // Handle drag complete - open popover
  const handleDragComplete = useCallback((projectId: string, startDay: Date, endDay: Date) => {
    setPopoverData({ projectId, startDate: startDay, endDate: endDay });
  }, []);

  // Handle actual drag complete - open popover
  const handleActualDragComplete = useCallback((
    projectId: string,
    startDay: Date,
    endDay: Date
  ) => {
    console.log('[ACTUAL DRAG COMPLETE] startDay:', startDay.toISOString(), 'endDay:', endDay.toISOString(), 'workDays:', Math.ceil((endDay.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    // Calculate planned/actual hours limit for the month containing the drag start
    const mStart = startOfMonth(startDay);
    const mEnd = endOfMonth(startDay);
    const plannedLimit = calculatePlannedHoursForMonth(resourceAssignments, projectId, mStart, mEnd);
    const currentActual = calculateActualHoursForMonth(actualAssignments, projectId, mStart, mEnd);

    setActualPopoverData({
      projectId,
      startDate: startDay,
      endDate: endDay,
      plannedHoursLimit: plannedLimit,
      currentActualHours: currentActual,
    });
  }, [resourceAssignments, actualAssignments]);

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

    refreshDragRender();

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
      refreshDragRender();
    };

    const handleMouseUp = () => {
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
            handleActualDragComplete(currentProjectId, days[start], days[end]);
          } else {
            handleDragComplete(currentProjectId, days[start], days[end]);
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

      refreshDragRender();
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [days, createAssignment.isPending, handleDragComplete, handleActualDragComplete, handleTimeOffDragComplete, measureCellBoundaries, refreshDragRender]);

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
  const handleUpdateAssignment = useCallback((id: string, updates: AssignmentUpdateInput) => {
    console.log('[ResourceRow] handleUpdateAssignment called:', {
      id,
      updates,
      resourceId: resource.id,
    });

    // Look up the current assignment to provide required fields for strict PUT schema
    const currentAssignment = resourceAssignments.find((a) => a.id === id);

    const payload: Partial<Assignment> & { id: string } = { id };

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
  }, [resource.id, updateAssignmentMutation, resourceAssignments]);

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

  // Handle monthly allocation modal open (click on project row in month range view)
  const handleProjectRowClick = useCallback((
    monthStart: Date,
    monthEnd: Date,
    project: ProjectOption,
    clientX: number,
    clientY: number,
    clickedAssignment?: Assignment, // Present if clicked on existing block (edit mode)
    monthlyTotalHours?: number, // Total hours for this month (plan+adj combined)
    planTotalHours?: number, // Plan-only hours (excluding adjustments)
    adjustmentTotalHours?: number // Adjustment-only hours for this month
  ) => {
    // Only allow if row is expanded and in monthly range view
    if (!isExpanded || !isMonthRangeView) return;

    console.log('[handleProjectRowClick] Assignment received:', clickedAssignment ? {
      id: clickedAssignment.id,
      projectId: clickedAssignment.projectId,
      employeeId: clickedAssignment.employeeId,
      startDate: clickedAssignment.startDate,
      endDate: clickedAssignment.endDate,
      hoursPerDay: clickedAssignment.hoursPerDay,
      totalHours: clickedAssignment.totalHours
    } : 'No assignment (create mode)');

    const openModal = (detailAssignments: Assignment[] = resourceAssignments) => {
      const projectDetailAssignments = detailAssignments.filter(
        a => a.projectId === project.id
          && !a.isTimeOff
          && startOfDay(new Date(a.endDate)) >= monthStart
          && startOfDay(new Date(a.startDate)) <= monthEnd
      );
      const existingAssignment = shouldLoadPlannerAssignmentDetail(clickedAssignment)
        ? projectDetailAssignments.find((a) => !a.isAdjustment) ?? projectDetailAssignments[0]
        : clickedAssignment;

      setMonthlyAllocationModal({
        monthStart,
        monthEnd,
        project,
        existingAssignment,
        adjustmentAssignments: projectDetailAssignments.filter((a) => a.isAdjustment),
        detailAssignments: projectDetailAssignments,
        monthlyTotalHours,
        planTotalHours,
        adjustmentTotalHours
      });
    };

    if (!shouldLoadPlannerAssignmentDetail(clickedAssignment)) {
      openModal();
      return;
    }

    const url = new URL("/api/assignments", window.location.origin);
    url.searchParams.set("employeeId", resource.id);
    url.searchParams.set("projectId", project.id);
    url.searchParams.set("startDate", toLocalDateString(monthStart));
    url.searchParams.set("endDate", toLocalDateString(monthEnd));
    const requestKey = getMonthlyDetailKey(resource.id, project.id, monthStart, monthEnd);
    const existingRequest = monthlyPlanDetailRequestRef.current;

    if (existingRequest?.key === requestKey) {
      return;
    }

    existingRequest?.controller.abort();
    const controller = new AbortController();
    monthlyPlanDetailRequestRef.current = { key: requestKey, controller };
    setLoadingMonthlyPlanDetailKey(requestKey);

    fetch(url.toString(), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to load monthly assignment detail");
        const data = await response.json();
        if (monthlyPlanDetailRequestRef.current?.key !== requestKey) {
          return;
        }
        openModal(data.data ?? []);
      })
      .catch((error) => {
        if (isAbortError(error)) {
          return;
        }
        console.error("[ResourceRow] Failed to load monthly assignment detail:", error);
        toast({
          variant: "destructive",
          title: "Failed to load assignment detail",
          description: "Try opening this monthly allocation again.",
        });
      })
      .finally(() => {
        if (monthlyPlanDetailRequestRef.current?.key === requestKey) {
          monthlyPlanDetailRequestRef.current = null;
          setLoadingMonthlyPlanDetailKey(null);
        }
      });
  }, [isExpanded, isMonthRangeView, resource.id, resourceAssignments]);

  // Handle monthly allocation save from modal
  const handleSaveMonthlyAllocation = useCallback((data: MonthlyAllocationSaveData) => {
    const { existingAssignment } = monthlyAllocationModal || {};
    const project = projectById.get(data.projectId);

    if (!project) return;

    // Show confirmation dialog
    setMonthlyAllocationConfirm({
      data: {
        projectId: data.projectId,
        projectName: project.name,
        projectColor: project.color,
        totalHours: data.totalHours,
        startDate: data.startDate,
        endDate: data.endDate,
        distributions: data.distributions,
        category: data.category,
        isBillable: data.isBillable,
        note: data.note,
        adjustmentHours: data.adjustmentHours,
        adjustmentStartDate: data.adjustmentStartDate,
        adjustmentEndDate: data.adjustmentEndDate,
        removeAdjustment: data.removeAdjustment,
      },
      isEditMode: !!existingAssignment,
    });

    setPendingMonthlyAllocationSave({
      data,
      existingAssignment,
    });
  }, [monthlyAllocationModal, projectById]);

  // Handle monthly allocation confirmation
  const handleConfirmMonthlyAllocation = useCallback(() => {
    if (!pendingMonthlyAllocationSave) return;

    const { data, existingAssignment } = pendingMonthlyAllocationSave;
    const modalDetailAssignments = monthlyAllocationModal?.detailAssignments ?? resourceAssignments;
    const isEditMode = !!existingAssignment;

    // Note: No need to filter weekends here - allocation-distributor already does that
    // using UTC dates to avoid timezone issues
    const weekdayDistributions = data.distributions;

    console.log('[Monthly Allocation] Creating distributions:', {
      count: weekdayDistributions.length
    });

    // Close confirmation first
    setMonthlyAllocationConfirm(null);

    // Check if only adjustment changed (skip plan recreation to avoid deleting plan unnecessarily)
    const onlyAdjustmentChanged = isEditMode
      && !data.planHoursChanged
      && (data.removeAdjustment || data.adjustmentDistributions);

    const newRangeStart = startOfDay(data.startDate);
    const newRangeEnd = startOfDay(data.endDate);

    if (!onlyAdjustmentChanged) {
    // Find ALL assignments for this project that overlap with the new date range
    // These need to be deleted before creating new ones
    const overlappingAssignments = modalDetailAssignments.filter((a) => {
      // Skip time-off assignments
      if (a.isTimeOff) return false;
      // Skip adjustment assignments (handled separately)
      if (a.isAdjustment) return false;
      // Only check assignments for the same project
      if (a.projectId !== data.projectId) return false;
      // Check if assignment overlaps with new date range
      const assignStart = startOfDay(new Date(a.startDate));
      const assignEnd = startOfDay(new Date(a.endDate));
      return assignEnd >= newRangeStart && assignStart <= newRangeEnd;
    });

    console.log('[Monthly Allocation] Deleting overlapping assignments:', {
      projectId: data.projectId,
      newRangeStart: newRangeStart.toISOString(),
      newRangeEnd: newRangeEnd.toISOString(),
      overlappingCount: overlappingAssignments.length,
      overlappingIds: overlappingAssignments.map(a => a.id)
    });

    // Delete all overlapping assignments first, then create new ones
    // Use a counter to track when all deletes are complete

    const totalDeletes = overlappingAssignments.length;

    if (totalDeletes === 0) {
      // No overlapping assignments, create new ones immediately
      console.log('[Monthly Allocation] No overlapping assignments, creating new ones');
      let createSettled = 0;
      const totalCreates = weekdayDistributions.length;

      weekdayDistributions.forEach(({ date, hours }, index) => {
        console.log(`[Monthly Allocation] Creating assignment ${index + 1}/${totalCreates}:`, {
          date: toLocalDateString(date),
          hours
        });

        createAssignment.mutate(
          {
            employeeId: resource.id,
            projectId: data.projectId,
            taskId: null,
            startDate: toLocalDateString(date),
            endDate: toLocalDateString(date),
            hoursPerDay: hours.toString(),
            allocationPercentage: null,
            isTimeOff: false,
            timeOffTypeId: null,
            category: data.category,
            isBillable: data.isBillable,
            status: 'draft',
            note: data.note || null,
            createdById: null,
          },
          {
            onSettled: () => {
              createSettled++;
              if (createSettled === totalCreates) {
                console.log('[Monthly Allocation] All creates settled, forcing refetch...');
                queryClient.invalidateQueries({ queryKey: ['assignments'] });
                queryClient.invalidateQueries({ queryKey: queryKeys.employees });
                queryClient.refetchQueries({ queryKey: ['assignments'] });
                queryClient.refetchQueries({ queryKey: queryKeys.employees });
              }
            },
          }
        );
      });

      console.log(`[Monthly Allocation] Initiated creation of ${totalCreates} assignments`);
    } else {
      // Delete overlapping assignments using direct fetch, then create new ones
      console.log(`[Monthly Allocation] Starting delete of ${totalDeletes} overlapping assignments...`);

      // Delete all overlapping assignments in parallel using fetch
      const deletePromises = overlappingAssignments.map(a =>
        fetch(`/api/assignments/${a.id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include', // Include cookies for auth
        })
        .then(response => {
          console.log(`[Monthly Allocation] Delete response for ${a.id}:`, response.status);
          if (!response.ok) {
            return response.text().then(text => {
              throw new Error(`Failed to delete ${a.id}: ${response.status} - ${text}`);
            });
          }
          return response;
        })
        .catch(error => {
          console.error(`[Monthly Allocation] Delete error for ${a.id}:`, error);
          throw error;
        })
      );

      Promise.allSettled(deletePromises).then((results) => {
        const successful = results.filter(r => r.status === 'fulfilled' && r.value.ok).length;
        const failed = results.filter(r => r.status === 'rejected' || !r.value.ok).length;

        console.log(`[Monthly Allocation] Delete completed: ${successful}/${totalDeletes} successful, ${failed} failed`);

        // Log details of failed deletes
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.error(`[Monthly Allocation] Failed to delete ${overlappingAssignments[index].id}:`, result.reason);
          } else if (!result.value.ok) {
            console.error(`[Monthly Allocation] Failed to delete ${overlappingAssignments[index].id}:`, result.value.status, result.value.statusText);
          }
        });

        // Remove deleted assignments from cache immediately so they don't overlap with new ones
        queryClient.setQueryData<Assignment[]>(queryKeys.assignments, (old) => {
          if (!old) return old;
          const deletedIds = new Set(overlappingAssignments.map(a => a.id));
          return old.filter(a => !deletedIds.has(a.id));
        });

        // Always create new assignments, regardless of delete results
        console.log('[Monthly Allocation] Creating new assignments...');
        let createSettled = 0;
        const totalCreates = weekdayDistributions.length;

        weekdayDistributions.forEach(({ date, hours }, index) => {
          console.log(`[Monthly Allocation] Creating assignment ${index + 1}/${totalCreates}:`, {
            date: toLocalDateString(date),
            hours
          });

          createAssignment.mutate(
            {
              employeeId: resource.id,
              projectId: data.projectId,
              taskId: null,
              startDate: toLocalDateString(date),
              endDate: toLocalDateString(date),
              hoursPerDay: hours.toString(),
              allocationPercentage: null,
              isTimeOff: false,
              timeOffTypeId: null,
              category: data.category,
              isBillable: data.isBillable,
              status: 'draft',
              note: data.note || null,
              createdById: null,
            },
            {
              onSettled: () => {
                createSettled++;
                if (createSettled === totalCreates) {
                  console.log('[Monthly Allocation] All creates settled, forcing refetch...');
                  queryClient.invalidateQueries({ queryKey: ['assignments'] });
                  queryClient.invalidateQueries({ queryKey: queryKeys.employees });
                  queryClient.refetchQueries({ queryKey: ['assignments'] });
                  queryClient.refetchQueries({ queryKey: queryKeys.employees });
                }
              },
            }
          );
        });
        console.log(`[Monthly Allocation] Initiated creation of ${totalCreates} assignments`);
      });
    }
    } // end if (!onlyAdjustmentChanged)

    // Close modal
    setMonthlyAllocationModal(null);

    // Handle adjustment assignments
    const { adjustmentDistributions, adjustmentStartDate, adjustmentEndDate, removeAdjustment } = data;

    // Delete existing adjustment assignments if:
    // 1. User explicitly requested removal, or
    // 2. User is replacing with new adjustment distributions
    if (removeAdjustment || adjustmentDistributions) {
      // Find adjustment assignments that overlap with the date range
      const adjustmentAssignmentsToDelete = modalDetailAssignments.filter(a => {
        if (!a.isAdjustment || a.isTimeOff) return false;
        if (a.projectId !== data.projectId) return false;
        const assignStart = startOfDay(new Date(a.startDate));
        const assignEnd = startOfDay(new Date(a.endDate));
        const rangeStart = adjustmentStartDate ? startOfDay(adjustmentStartDate) : newRangeStart;
        const rangeEnd = adjustmentEndDate ? startOfDay(adjustmentEndDate) : newRangeEnd;
        return assignEnd >= rangeStart && assignStart <= rangeEnd;
      });

      if (adjustmentAssignmentsToDelete.length > 0) {
        console.log('[Monthly Allocation] Deleting adjustment assignments:', adjustmentAssignmentsToDelete.length);
        adjustmentAssignmentsToDelete.forEach(a => {
          fetch(`/api/assignments/${a.id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
          }).catch(err => console.error('[Monthly Allocation] Failed to delete adjustment:', err));
        });
      }
    }

    // Create new adjustment assignments if provided
    if (!removeAdjustment && adjustmentDistributions && adjustmentDistributions.length > 0) {
      console.log(`[Monthly Allocation] Creating ${adjustmentDistributions.length} adjustment assignments`);

      adjustmentDistributions.forEach(({ date, hours }) => {
        createAssignment.mutate(
          {
            employeeId: resource.id,
            projectId: data.projectId,
            taskId: null,
            startDate: toLocalDateString(date),
            endDate: toLocalDateString(date),
            hoursPerDay: hours.toString(),
            allocationPercentage: null,
            isTimeOff: false,
            isAdjustment: true,
            timeOffTypeId: null,
            category: data.category,
            isBillable: data.isBillable,
            status: 'draft',
            note: data.note || null,
            createdById: null,
          },
          {
            onSettled: () => {
              queryClient.invalidateQueries({ queryKey: ['assignments'] });
              queryClient.invalidateQueries({ queryKey: queryKeys.employees });
            },
          }
        );
      });
    }

    setPendingMonthlyAllocationSave(null);
  }, [
    createAssignment,
    monthlyAllocationModal,
    pendingMonthlyAllocationSave,
    queryClient,
    resource.id,
    resourceAssignments,
  ]);

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
              isMonthRangeView={isMonthRangeView}
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
                isMonthRangeView={isMonthRangeView}
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
            {!isWeekView && days.map((day, dayIndex) => (
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
                rowType="plan"
              />
            ))}
            {/* Time Off Assignments */}
            {isWeekView ? (
              // For Quarter/HalfYear/Year view, use WeeklyTimeOffBlock
              // Note: Month view now shows daily columns like week view
              resourceAssignments.filter(a => a.isTimeOff).map((assignment) => (
                <WeeklyTimeOffBlock
                  key={assignment.id}
                  assignment={assignment}
                  days={days}
                  isMonthRangeView={isMonthRangeView}
                />
              ))
            ) : (
              // For Week view (day view), use regular AssignmentBlock
              resourceAssignments.filter(a => a.isTimeOff).map((assignment) => (
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
              ))
            )}
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

        {deliverableGroups.map((group) => {
          const visibleProjectsInGroup = group.projects.filter(row => selectedProjectIds.has(row.project.id));
          if (visibleProjectsInGroup.length === 0) return null;

          return (
            <React.Fragment key={group.name || 'general'}>
            {/* Deliverable Header Row */}
            <div className="flex bg-gray-100/50 h-[32px] border-b">
              <div className="w-[250px] shrink-0 px-4 border-r sticky left-0 bg-gray-100/50 z-20 flex items-center gap-2 pl-12 h-[32px]">
                <Icon icon="lucide:package" className="h-3.5 w-3.5 text-blue-600" />
                <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">
                  {group.name || 'GENERAL / OTHER'}
                </span>
              </div>
              <div className="flex-1 flex" style={{ width: `${days.length * cellWidth}px` }}>
                {days.map((day) => (
                  <div key={day.toISOString()} className="shrink-0 h-[32px] border-r border-white/20" style={{ width: `${cellWidth}px` }} />
                ))}
              </div>
            </div>

            {/* Projects under this deliverable */}
            {visibleProjectsInGroup.map((row) => {
              const { project, planAssignments } = row;
              const brand = project.brandId ? brandById.get(project.brandId) : undefined;
              return (
                <React.Fragment key={row.id}>
                  {/* Project Row Container */}
                  <div className="flex flex-col border-b">
                    {/* Sidebar - Merged for PLAN & ACTUAL */}
                    <div className="flex" data-testid="project-group" data-resource-id={resource.id} data-project-id={project.id}>
                      <div className="w-[250px] shrink-0 px-4 py-2 border-r sticky left-0 bg-background z-20 flex pl-16" style={{ height: 40 }}>
                        <div className="flex items-center gap-2 w-4/6">
                          <div className="w-3.5 h-3.5 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: project.color }}>
                            <Icon icon="lucide:folder" className="h-2.5 w-2.5 text-white" />
                          </div>
                          <div className="flex flex-col justify-center min-w-0">
                            <div className="text-sm font-semibold truncate">
                              {project.name}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate">{brand?.name}</div>
                          </div>
                        </div>
                        <div className="flex flex-col justify-center gap-2 text-[10px] font-semibold w-2/5">
                          <span className="text-blue-600">PLAN</span>
                        </div>
                      </div>

                      {/* Timeline Content Container */}
                      <div className="flex-1 flex flex-col">
                        {/* PLAN Row */}
                        <div className="flex-1 bg-blue-50/10" style={{ height: 40 }} data-testid="plan-row" data-resource-id={resource.id} data-project-id={project.id}>
                          {!session?.access.can_view_all ? (
                            <div
                              ref={(el) => { if (el) projectTimelineRefs.current.set(`plan-${row.id}`, el); }}
                              className="flex relative"
                              style={{ width: `${days.length * cellWidth}px`, height: 40 }}
                            >
                              {days.map((day) => (
                                <div key={day.toISOString()} className="shrink-0 h-[40px] border-r border-white/20 bg-gray-100/50" style={{ width: `${cellWidth}px` }} />
                              ))}
                              {/* Show plan assignments but disabled */}
                              {planAssignments.map((assignment) => (
                                <AssignmentBlock
                                  key={assignment.id}
                                  assignment={assignment}
                                  project={projectById.get(assignment.projectId ?? '')}
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
                              ref={(el) => { if (el) projectTimelineRefs.current.set(`plan-${row.id}`, el); }}
                              className="flex relative"
                              style={{ width: `${days.length * cellWidth}px`, height: 40 }}
                            >
                              {!isWeekView && days.map((day, dayIndex) => (
                                <DraggableTimelineCell
                                  key={day.toISOString()}
                                  day={day}
                                  projectId={project.id}
                                  projectColor={project.color}
                                  days={days}
                                  cellWidth={cellWidth}
                                  cellHeight={40}
                                  timeOffAssignments={timeOffAssignments}
                                  containerRef={projectTimelineRefs.current.get(`plan-${row.id}`) || null}
                                  onDragComplete={(startDay, endDay) =>
                                    handleDragComplete(project.id, startDay, endDay)
                                  }
                                  disabled={createAssignment.isPending}
                                  isDragging={isDraggingRef.current && dragProjectIdRef.current === project.id && dragRowTypeRef.current === 'plan'}
                                  isInDragRange={isInDragRange(dayIndex, 'plan')}
                                  onMouseDown={(index, containerRef) => handleDragStart(index, project.id, project.color, containerRef, 'plan')}
                                  rowType="plan"
                                />
                              ))}
                              {/* Plan Assignments */}
                              {isWeekView ? (
                                <>
                                  {(() => {
                                    const monthMap = new Map<number, { planAssignments: Assignment[] }>();

                                    for (const assignment of planAssignments) {
                                      const assignStart = startOfDay(new Date(assignment.startDate));
                                      const assignEnd = startOfDay(new Date(assignment.endDate));

                                      for (let i = 0; i < days.length; i++) {
                                        const monthStart = startOfMonth(days[i]);
                                        const monthEnd = endOfMonth(monthStart);

                                        if (assignEnd >= monthStart && assignStart <= monthEnd) {
                                          if (!monthMap.has(i)) {
                                            monthMap.set(i, { planAssignments: [] });
                                          }
                                          const entry = monthMap.get(i)!;
                                          entry.planAssignments.push(assignment);
                                        }
                                      }
                                    }

                                    const blocks: React.ReactNode[] = [];

                                    monthMap.forEach(({ planAssignments: monthAssignments }, monthIndex) => {
                                      const monthStart = startOfMonth(days[monthIndex]);
                                      const monthEnd = endOfMonth(monthStart);

                                      let monthlyTotal = 0;
                                      let originalTotal = 0;
                                      let adjustmentTotal = 0;

                                      let currentDay = new Date(monthStart);
                                      while (currentDay <= monthEnd) {
                                        const dayOfWeek = currentDay.getDay();
                                        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                                          for (const a of monthAssignments) {
                                            const aStart = startOfDay(new Date(a.startDate));
                                            const aEnd = startOfDay(new Date(a.endDate));
                                            const hours = parseFloat(a.hoursPerDay) || 0;
                                            if (currentDay >= aStart && currentDay <= aEnd) {
                                              monthlyTotal += hours;
                                              if (a.isAdjustment) adjustmentTotal += hours;
                                              else originalTotal += hours;
                                            }
                                          }
                                        }
                                        currentDay = new Date(currentDay);
                                        currentDay.setDate(currentDay.getDate() + 1);
                                      }

                                      monthlyTotal = Math.round(monthlyTotal * 10) / 10;
                                      originalTotal = Math.round(originalTotal * 10) / 10;
                                      adjustmentTotal = Math.round(adjustmentTotal * 10) / 10;

                                      const representative = monthAssignments.find(a => !a.isAdjustment) || monthAssignments[0];
                                      const cellPercentage = 100 / days.length;
                                      const leftOffset = monthIndex * cellPercentage;
                                      const width = cellPercentage;
                                      const detailKey = getMonthlyDetailKey(resource.id, project.id, monthStart, monthEnd);
                                      const isLoadingDetail =
                                        loadingMonthlyPlanDetailKey === detailKey &&
                                        shouldLoadPlannerAssignmentDetail(representative);

                                      blocks.push(
                                        <div
                                          key={`project-${row.id}-month-${monthIndex}`}
                                          className="absolute rounded shadow-sm border text-[10px] text-white overflow-hidden flex flex-col bg-blue-600 hover:bg-blue-700 cursor-pointer"
                                          style={{
                                            left: `${leftOffset}%`,
                                            width: `${width}%`,
                                            top: 4,
                                            height: 32,
                                            zIndex: 10,
                                          }}
                                          title={`${project.name}${group.name ? ` - ${group.name}` : ''}: ${monthlyTotal}h`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const clickedDay = days[monthIndex];
                                            const ms = startOfMonth(clickedDay);
                                            const me = new Date(ms.getFullYear(), ms.getMonth() + 1, 0);
                                            handleProjectRowClick(ms, me, project, e.clientX, e.clientY, representative, monthlyTotal, originalTotal, adjustmentTotal);
                                          }}
                                          aria-busy={isLoadingDetail}
                                        >
                                          {adjustmentTotal > 0 && (
                                            <div className="absolute top-0 right-0 rounded-r" style={{ width: `${(adjustmentTotal / monthlyTotal) * 100}%`, height: '100%', backgroundColor: 'rgba(147, 197, 253, 0.4)' }} />
                                          )}
                                          {isLoadingDetail && (
                                            <div className="absolute inset-0 bg-blue-950/35 flex items-center justify-center z-20">
                                              <Icon icon="lucide:loader-2" className="h-3.5 w-3.5 animate-spin" />
                                            </div>
                                          )}
                                          <div className="flex-1 px-1.5 py-0.5 min-w-0 pointer-events-none flex flex-col justify-center relative z-10">
                                            <div className="font-bold truncate">{project.name}</div>
                                            <div className="truncate opacity-90">{monthlyTotal}h</div>
                                          </div>
                                        </div>
                                      );
                                    });

                                    return blocks;
                                  })()}
                                  <div
                                    className="absolute inset-0 z-0"
                                    onMouseMove={(e) => {
                                      if (!isMonthRangeView) return;
                                      const containerRect = e.currentTarget.getBoundingClientRect();
                                      const x = e.clientX - containerRect.left;
                                      const dayIndex = Math.floor(x / cellWidth);
                                      setHoveredMonthIndex(dayIndex);
                                      setHoveredProjectId(project.id);
                                      setHoveredRowType('plan');
                                    }}
                                    onMouseLeave={() => { setHoveredMonthIndex(null); setHoveredProjectId(null); setHoveredRowType(null); }}
                                    onClick={(e) => {
                                      if (!isMonthRangeView) return;
                                      const containerRect = e.currentTarget.getBoundingClientRect();
                                      const x = e.clientX - containerRect.left;
                                      const dayIndex = Math.floor(x / cellWidth);
                                      const clickedDay = days[Math.max(0, Math.min(dayIndex, days.length - 1))];
                                      const monthStart = startOfDay(startOfMonth(clickedDay));
                                      const monthEnd = startOfDay(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0));
                                      handleProjectRowClick(monthStart, monthEnd, project, e.clientX, e.clientY);
                                    }}
                                    style={{ pointerEvents: 'auto', cursor: 'cell' }}
                                  />
                                  {isMonthRangeView && hoveredProjectId === project.id && hoveredRowType === 'plan' && hoveredMonthIndex !== null && (() => {
                                    const monthStart = startOfMonth(days[hoveredMonthIndex]);
                                    const monthEnd = endOfMonth(monthStart);
                                    const hasAssignmentInMonth = planAssignments.some(assignment => {
                                      const assignStart = startOfDay(new Date(assignment.startDate));
                                      const assignEnd = startOfDay(new Date(assignment.endDate));
                                      return assignEnd >= monthStart && assignStart <= monthEnd;
                                    });
                                    return !hasAssignmentInMonth;
                                  })() && (
                                    <div className="absolute pointer-events-none z-10" style={{ left: `${hoveredMonthIndex * cellWidth + cellWidth / 2}px`, top: '50%', transform: 'translate(-50%, -50%)' }}>
                                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white shadow bg-blue-600">
                                        <Icon icon="lucide:plus" className="h-3 w-3" />
                                      </div>
                                    </div>
                                  )}
                                </>
                              ) : (
                                planAssignments.map((assignment) => (
                                  <AssignmentBlock
                                    key={assignment.id}
                                    assignment={assignment}
                                    project={projectById.get(assignment.projectId ?? '')}
                                    days={days}
                                    resourceRowHeight={40}
                                    cellWidth={cellWidth}
                                    isWeekView={isWeekView}
                                    onUpdate={handleUpdateAssignment}
                                    onDelete={handleDeleteAssignment}
                                    timeOffAssignments={timeOffAssignments}
                                    isUpdating={updatingAssignmentId === assignment.id}
                                  />
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
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

                {/* Centered Modal-style Dropdown */}
                {isFilterOpen && (
                  <>
                    {/* Darker backdrop with blur */}
                    <div
                      className="fixed inset-0 z-[90] bg-black/30 backdrop-blur-sm transition-opacity"
                      onClick={() => setIsFilterOpen(false)}
                    />
                    
                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] max-w-[90vw] bg-background border border-border rounded-xl shadow-3xl z-[100] max-h-[75vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                      {/* Header */}
                      <div className="px-6 py-4 border-b bg-muted/10 flex items-center justify-between sticky top-0 z-10 backdrop-blur-md">
                        <div>
                          <h3 className="text-base font-bold text-foreground">Select Projects</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">Showing {selectedProjectIds.size} of {sortedProjects.length} projects</p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => setIsFilterOpen(false)}
                          className="h-8 w-8 rounded-full hover:bg-muted"
                        >
                          <Icon icon="lucide:x" className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Scrollable Project List */}
                      <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
                        {sortedProjects.map(p => {
                          const isSelected = selectedProjectIds.has(p.id);
                          const projectBrand = p.brandId ? brandById.get(p.brandId) : undefined;

                          return (
                            <label
                              key={p.id}
                              className="flex items-start gap-4 px-6 py-3 transition-colors cursor-pointer hover:bg-accent/50 border-b border-border/30 last:border-0 group"
                            >
                              <div className="pt-0.5">
                                <input
                                  type="checkbox"
                                  className="rounded-md border-muted-foreground/30 text-primary focus:ring-primary h-5 w-5 cursor-pointer transition-transform group-hover:scale-105"
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
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-[14.5px] font-semibold text-foreground leading-tight">
                                  {p.name}
                                </span>
                                {projectBrand && (
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                                    <span className="text-xs text-muted-foreground font-medium">
                                      {projectBrand.name}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>

                      {/* Footer / Quick Actions */}
                      <div className="px-6 py-3 border-t bg-muted/10 flex justify-end gap-2">
                         <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-xs h-8"
                          onClick={() => {
                            setSelectedProjectIds(new Set());
                          }}
                         >
                           Clear All
                         </Button>
                         <Button 
                          variant="default" 
                          size="sm" 
                          className="text-xs h-8 bg-primary text-white"
                          onClick={() => setIsFilterOpen(false)}
                         >
                           Apply Selection
                         </Button>
                      </div>
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
            onClose={() => setPopoverData(null)}
            onSave={handleSaveAssignment}
            isCreating={createAssignment.isPending}
          />
        )}

        {/* Actual Assignment Popover */}
        {actualPopoverData && (
          <ActualAssignmentPopover
            resourceId={resource.id}
            projectId={actualPopoverData.projectId}
            startDate={actualPopoverData.startDate}
            endDate={actualPopoverData.endDate}
            onClose={() => setActualPopoverData(null)}
            onSave={handleSaveActualAssignment}
            isCreating={createActualAssignment.isPending}
            plannedHoursLimit={actualPopoverData.plannedHoursLimit}
            currentActualHours={actualPopoverData.currentActualHours}
          />
        )}

        {/* Monthly Allocation Modal */}
        {monthlyAllocationModal && (
          <MonthlyAllocationModal
            key={monthlyAllocationModal.existingAssignment?.id ?? 'create'}
            monthStart={monthlyAllocationModal.monthStart}
            monthEnd={monthlyAllocationModal.monthEnd}
            resource={resource}
            project={monthlyAllocationModal.project}
            existingAssignment={monthlyAllocationModal.existingAssignment}
            timeOffAssignments={timeOffAssignments}
            adjustmentAssignments={monthlyAllocationModal.adjustmentAssignments}
            isFullAccess={session?.access?.can_view_all}
            monthlyTotalHours={monthlyAllocationModal.monthlyTotalHours}
            planTotalHours={monthlyAllocationModal.planTotalHours}
            adjustmentTotalHours={monthlyAllocationModal.adjustmentTotalHours}
            onClose={() => setMonthlyAllocationModal(null)}
            onSave={handleSaveMonthlyAllocation}
            onDelete={monthlyAllocationModal.existingAssignment ? (() => {
              const projectId = monthlyAllocationModal.existingAssignment!.projectId;
              const monthStart = monthlyAllocationModal.monthStart;
              const monthEnd = monthlyAllocationModal.monthEnd;

              return () => {
                // Find ALL assignments for this project that fall within the month range
                const assignmentsInMonth = (
                  monthlyAllocationModal.detailAssignments ?? resourceAssignments
                ).filter((a) => {
                  if (a.isTimeOff) return false;
                  if (a.projectId !== projectId) return false;

                  const assignStart = startOfDay(new Date(a.startDate));
                  const assignEnd = startOfDay(new Date(a.endDate));

                  // Check if assignment falls within the month range
                  return assignEnd >= monthStart && assignStart <= monthEnd;
                });

                // Delete all assignments in parallel
                const deletePromises = assignmentsInMonth.map(a =>
                  fetch(`/api/assignments/${a.id}`, {
                    method: 'DELETE',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                  })
                );

                Promise.all(deletePromises)
                  .then(() => {
                    setMonthlyAllocationModal(null);
                    // Invalidate queries to refresh the data
                    queryClient.invalidateQueries({ queryKey: ["assignments"] });
                    queryClient.invalidateQueries({ queryKey: queryKeys.plannerTimeline });
                  })
                  .catch((error) => {
                    console.error('[ResourceRow] Delete failed:', error);
                    setMonthlyAllocationModal(null);
                    // Force refetch to ensure UI is in sync
                    queryClient.invalidateQueries({ queryKey: ["assignments"] });
                    queryClient.invalidateQueries({ queryKey: queryKeys.plannerTimeline });
                  });
              };
            })() : undefined}
          />
        )}

        {/* Monthly Allocation Confirmation */}
        {monthlyAllocationConfirm && (
          <MonthlyAllocationConfirmation
            data={monthlyAllocationConfirm.data}
            isEditMode={monthlyAllocationConfirm.isEditMode}
            onConfirm={handleConfirmMonthlyAllocation}
            onCancel={() => {
              setMonthlyAllocationConfirm(null);
              setPendingMonthlyAllocationSave(null);
            }}
          />
        )}

      </div>
    </TooltipProvider>
  );
};
