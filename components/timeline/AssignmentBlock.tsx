"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { Project } from "@/lib/query/hooks/useProjects";
import { differenceInDays, startOfDay, format, addDays, startOfWeek, endOfWeek, differenceInWeeks, isBefore, isWithinInterval } from "date-fns";
import { cn, toLocalDateString } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EditAssignmentDialog } from "./EditAssignmentDialog";

interface AssignmentBlockProps {
  assignment: Assignment;
  project?: Project;  // Passed from parent for O(1) lookup
  days: Date[];
  resourceRowHeight: number;
  cellWidth?: number;
  isWeekView?: boolean; // true for quarter/halfYear/year views where each cell = 1 week
  onUpdate?: (id: string, updates: any) => void;
  onDelete?: (id: string) => void;
  timeOffAssignments?: Assignment[]; // Time-off assignments for this resource
  isDeleting?: boolean; // Show deleting state
  isUpdating?: boolean; // Show updating state (during drag/resize)
  showProjectName?: boolean; // Show project name in block (default: true, set false when already shown in row header)
}

export const AssignmentBlock: React.FC<AssignmentBlockProps> = ({
  assignment,
  project,
  days,
  resourceRowHeight,
  cellWidth = 100,
  isWeekView = false,
  onUpdate,
  onDelete,
  timeOffAssignments = [],
  isDeleting = false,
  isUpdating = false,
}) => {
  const blockRef = useRef<HTMLDivElement>(null);

  const [isResizing, setIsResizing] = useState<'left' | 'right' | null>(null);
  const [tempOffset, setTempOffset] = useState(0); // Days to adjust

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0); // Days to move

  // Edit dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Track drag vs click - only set to true after significant movement
  const hasDraggedRef = useRef(false);
  const hasResizedRef = useRef(false);
  const mouseDownPosRef = useRef({ x: 0, y: 0 });

  // Processing state for showing loading indicator after operation
  const [isProcessing, setIsProcessing] = useState(false);

  // Use ref to avoid stale closure in event handlers
  const offsetRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  // Cleanup animation frame on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // Calculate Position and Width
  // Parse dates consistently to avoid timezone issues
  // assignment.startDate and assignment.endDate are stored as YYYY-MM-DD strings
  const startDate = startOfDay(new Date(assignment.startDate));
  const endDate = startOfDay(new Date(assignment.endDate));
  const timelineStart = startOfDay(days[0]);
  const today = startOfDay(new Date());

  // Get the timeline end date for clipping
  const timelineEnd = startOfDay(days[days.length - 1]);

  // Define all callbacks BEFORE any conditional logic (to avoid hooks order issues)
  const hasTimeOffOnDate = useCallback((date: Date) => {
    return timeOffAssignments.some(a =>
      isWithinInterval(startOfDay(date), {
        start: startOfDay(new Date(a.startDate)),
        end: startOfDay(new Date(a.endDate))
      })
    );
  }, [timeOffAssignments]);

  const hasTimeOffInRange = useCallback((rangeStart: Date, rangeEnd: Date) => {
    return timeOffAssignments.some(a => {
      if (a.id === assignment.id) return false;
      const timeOffStart = startOfDay(new Date(a.startDate));
      const timeOffEnd = startOfDay(new Date(a.endDate));
      const checkStart = startOfDay(rangeStart);
      const checkEnd = startOfDay(rangeEnd);
      return checkStart <= timeOffEnd && checkEnd >= timeOffStart;
    });
  }, [timeOffAssignments, assignment.id]);

  const findVisibleIndex = useCallback((date: Date) => {
    const dateMs = startOfDay(date).getTime();
    return days.findIndex(d => startOfDay(d).getTime() === dateMs);
  }, [days]);

  const findCorrectVisibleIndex = useCallback((date: Date) => {
    if (isWeekView) {
      const dateWeek = startOfWeek(date, { weekStartsOn: 1 });
      const exactIdx = days.findIndex(d => startOfDay(d).getTime() === dateWeek.getTime());
      if (exactIdx >= 0) return exactIdx;
      const dateWeekTime = dateWeek.getTime();
      for (let i = days.length - 1; i >= 0; i--) {
        if (startOfDay(days[i]).getTime() <= dateWeekTime) {
          return i;
        }
      }
      return -1;
    } else {
      const exactIdx = findVisibleIndex(date);
      if (exactIdx >= 0) return exactIdx;
      const dateTime = startOfDay(date).getTime();
      for (let i = days.length - 1; i >= 0; i--) {
        if (startOfDay(days[i]).getTime() <= dateTime) {
          return i;
        }
      }
      return -1;
    }
  }, [days, findVisibleIndex, isWeekView]);

  // Use refs for callbacks to avoid stale closures
  const hasTimeOffInRangeRef = useRef(hasTimeOffInRange);
  hasTimeOffInRangeRef.current = hasTimeOffInRange;
  const hasTimeOffOnDateRef = useRef(hasTimeOffOnDate);
  hasTimeOffOnDateRef.current = hasTimeOffOnDate;

  let startVisibleIdx: number;
  let endVisibleIdx: number;
  let visibleDuration: number;

  // Calculate duration for tooltip display (always needed)
  const durationDays = differenceInDays(startDate, endDate) + 1;

  if (isWeekView) {
    // In week view, each cell represents a week (Monday)
    // Find which week column the start/end dates fall into
    const assignmentStartWeek = startOfWeek(startDate, { weekStartsOn: 1 });
    const assignmentEndWeek = startOfWeek(endDate, { weekStartsOn: 1 });

    // Find the indices in the days array (which contains Mondays)
    startVisibleIdx = days.findIndex(d => startOfDay(d).getTime() === assignmentStartWeek.getTime());
    endVisibleIdx = days.findIndex(d => startOfDay(d).getTime() === assignmentEndWeek.getTime());

    // If start not found, check if assignment starts before visible range
    if (startVisibleIdx === -1) {
      const assignmentStartWeekTime = assignmentStartWeek.getTime();
      const timelineStartTime = timelineStart.getTime();

      if (assignmentStartWeekTime < timelineStartTime) {
        // Assignment starts before visible range, clip to start
        startVisibleIdx = 0;
      } else {
        // Find the closest week
        for (let i = 0; i < days.length; i++) {
          if (startOfDay(days[i]).getTime() >= assignmentStartWeekTime) {
            startVisibleIdx = i;
            break;
          }
        }
        if (startVisibleIdx === -1) startVisibleIdx = 0;
      }
    }

    // If end not found, check if assignment ends after visible range
    if (endVisibleIdx === -1) {
      const assignmentEndWeekTime = assignmentEndWeek.getTime();
      const timelineEndTime = timelineEnd.getTime();

      if (assignmentEndWeekTime > timelineEndTime) {
        // Assignment ends after visible range, clip to end
        endVisibleIdx = days.length - 1;
      } else {
        for (let i = days.length - 1; i >= 0; i--) {
          if (startOfDay(days[i]).getTime() <= assignmentEndWeekTime) {
            endVisibleIdx = i;
            break;
          }
        }
        if (endVisibleIdx === -1) endVisibleIdx = days.length - 1;
      }
    }

    // Clamp indices to valid range
    startVisibleIdx = Math.max(0, Math.min(days.length - 1, startVisibleIdx));
    endVisibleIdx = Math.max(0, Math.min(days.length - 1, endVisibleIdx));

    visibleDuration = endVisibleIdx - startVisibleIdx + 1;
  } else {
    // Day view - find exact match in days array
    // First try exact match using timestamps (fastest)
    startVisibleIdx = days.findIndex(d => startOfDay(d).getTime() === startDate.getTime());
    endVisibleIdx = days.findIndex(d => startOfDay(d).getTime() === endDate.getTime());

    // If not found, use local date string comparison (timezone-safe)
    // This ensures dates are compared in the local timezone, not UTC
    if (startVisibleIdx === -1) {
      const startDateStr = toLocalDateString(startDate);
      startVisibleIdx = days.findIndex(d => {
        return toLocalDateString(startOfDay(d)) === startDateStr;
      });
    }
    if (endVisibleIdx === -1) {
      const endDateStr = toLocalDateString(endDate);
      endVisibleIdx = days.findIndex(d => {
        return toLocalDateString(startOfDay(d)) === endDateStr;
      });
    }

    // Last resort: calculate from index 0 if still not found
    if (startVisibleIdx === -1) {
      startVisibleIdx = Math.max(0, Math.min(days.length - 1, differenceInDays(startDate, timelineStart)));
    }
    if (endVisibleIdx === -1) {
      endVisibleIdx = Math.max(0, Math.min(days.length - 1, differenceInDays(endDate, timelineStart)));
    }

    // Clamp to valid range
    startVisibleIdx = Math.max(0, Math.min(days.length - 1, startVisibleIdx));
    endVisibleIdx = Math.max(0, Math.min(days.length - 1, endVisibleIdx));

    // Calculate duration in visible days (how many columns it spans)
    visibleDuration = endVisibleIdx - startVisibleIdx + 1;
  }

  // Apply temp offset during resize or drag
  // Always use visible indices for positioning to match timeline columns exactly
  let displayOffset = startVisibleIdx >= 0 ? startVisibleIdx : 0;
  let displayDuration = endVisibleIdx >= 0 && startVisibleIdx >= 0
    ? (endVisibleIdx - startVisibleIdx + 1)
    : 1; // Fallback to 1 if indices not found

  if (isResizing === 'left') {
    displayOffset = displayOffset + tempOffset;
    displayDuration = displayDuration - tempOffset;
  } else if (isResizing === 'right') {
    displayDuration = displayDuration + tempOffset;
  } else if (isDragging) {
    displayOffset = displayOffset + dragOffset;
  }

  // Clamp to valid values
  displayDuration = Math.max(1, displayDuration);

  // Use percentage-based positioning for perfect alignment with flexbox cells
  // Each cell is exactly 100% / days.length in width
  const cellPercentage = 100 / days.length;
  const LEFT_OFFSET = `${displayOffset * cellPercentage}%`;
  const WIDTH = `${displayDuration * cellPercentage}%`;

  // Time Off styling
  const isTimeOff = assignment.isTimeOff;
  const bgColor = isTimeOff ? "#6b7280" : "#2563eb";
  const displayName = isTimeOff ? "Time Off" : (project?.name || "Unknown Project");

  // Debug logging for missing project
  if (!isTimeOff && !project) {
    console.warn('[AssignmentBlock] Project not found for assignment:', {
      assignmentId: assignment.id,
      projectId: assignment.projectId,
      employeeId: assignment.employeeId,
      assignmentName: assignment.note || 'No note'
    });
  }

  // Calculate working days for effort
  let workingDays = 0;
  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const day = currentDate.getDay();
    if (day !== 0 && day !== 6) workingDays++;
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const hoursPerDay = parseFloat(assignment.hoursPerDay);
  const totalHours = workingDays * hoursPerDay;
  const formattedStartDate = format(startDate, "dd MMM");
  const formattedEndDate = format(endDate, "dd MMM");

  // Resize handlers
  const handleResizeStart = useCallback((edge: 'left' | 'right', e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const target = e.target as HTMLElement;
    try {
      target.setPointerCapture(e.pointerId);
    } catch (err) {
      // Element may already have capture or other issue
      console.warn('setPointerCapture failed:', err);
    }

    setIsResizing(edge);
    setTempOffset(0);
    offsetRef.current = 0;

    const startX = e.clientX;

    // Find current visible indices
    const startVisibleIdx = findVisibleIndex(startDate);
    const endVisibleIdx = findCorrectVisibleIndex(endDate);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaColumns = Math.round(deltaX / cellWidth);

      // Only update if value changed to reduce re-renders
      if (offsetRef.current !== deltaColumns) {
        offsetRef.current = deltaColumns;
        // Use RAF for smooth 60fps updates
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          setTempOffset(deltaColumns);
        });
      }
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      target.releasePointerCapture(upEvent.pointerId);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);

      const deltaColumns = offsetRef.current;

      console.log('[AssignmentBlock Resize] PointerUp:', {
        assignmentId: assignment.id,
        edge,
        deltaColumns,
        cellWidth,
        startVisibleIdx,
        endVisibleIdx,
        hasOnUpdate: !!onUpdate,
      });

      // Helper to skip weekends - move to nearest weekday
      const skipWeekend = (date: Date, direction: 'forward' | 'backward'): Date => {
        let result = new Date(date);
        const day = result.getDay();
        if (day === 0) { // Sunday
          result = addDays(result, direction === 'forward' ? 1 : -2);
        } else if (day === 6) { // Saturday
          result = addDays(result, direction === 'forward' ? 2 : -1);
        }
        return result;
      };

      // Apply the resize
      if (onUpdate && deltaColumns !== 0) {
        hasResizedRef.current = true;
        console.log('[AssignmentBlock Resize] Calling onUpdate:', {
          assignmentId: assignment.id,
          deltaColumns,
          edge,
        });
        if (isWeekView) {
          // In week view, each column represents 1 week (7 days)
          const daysToMove = deltaColumns * 7;

          if (edge === 'left') {
            let newStartDate = addDays(startDate, daysToMove);
            // Prevent resizing into time-off (check if new range overlaps with any time-off)
            if (hasTimeOffInRangeRef.current(newStartDate, endDate)) {
              setIsResizing(null);
              setTempOffset(0);
              offsetRef.current = 0;
              return; // Cancel the resize
            }
            if (newStartDate <= endDate) {
              onUpdate(assignment.id, { startDate: newStartDate });
              // Clear state - optimistic update will position the block correctly
              setIsResizing(null);
              setTempOffset(0);
              offsetRef.current = 0;
              return;
            }
          } else {
            let newEndDate = addDays(endDate, daysToMove);
            // Prevent resizing into time-off (check if new range overlaps with any time-off)
            if (hasTimeOffInRangeRef.current(startDate, newEndDate)) {
              setIsResizing(null);
              setTempOffset(0);
              offsetRef.current = 0;
              return; // Cancel the resize
            }
            if (newEndDate >= startDate) {
              onUpdate(assignment.id, { endDate: newEndDate });
              // Clear state - optimistic update will position the block correctly
              setIsResizing(null);
              setTempOffset(0);
              offsetRef.current = 0;
              return;
            }
          }
        } else {
          // In day view, use visible days array
          if (edge === 'left') {
            // For left edge: find new start date from days array
            const currentIdx = startVisibleIdx >= 0 ? startVisibleIdx : 0;
            const newIdx = Math.max(0, Math.min(days.length - 1, currentIdx + deltaColumns));
            const newStartDate = days[newIdx];

            // Don't skip weekend - user selected this specific column

            // Prevent resizing into time-off (check if new range overlaps with any time-off)
            if (newStartDate && hasTimeOffInRangeRef.current(newStartDate, endDate)) {
              setIsResizing(null);
              setTempOffset(0);
              offsetRef.current = 0;
              return; // Cancel the resize
            }

            if (newStartDate && newStartDate <= endDate) {
              onUpdate(assignment.id, { startDate: newStartDate });
              // Clear state - optimistic update will position the block correctly
              setIsResizing(null);
              setTempOffset(0);
              offsetRef.current = 0;
              return;
            }
          } else {
            // For right edge: find new end date from days array
            const currentIdx = endVisibleIdx >= 0 ? endVisibleIdx : days.length - 1;
            const newIdx = Math.max(0, Math.min(days.length - 1, currentIdx + deltaColumns));
            const newEndDate = days[newIdx];

            // Don't skip weekend - user selected this specific column

            // Prevent resizing into time-off (check if new range overlaps with any time-off)
            if (newEndDate && hasTimeOffInRangeRef.current(startDate, newEndDate)) {
              setIsResizing(null);
              setTempOffset(0);
              offsetRef.current = 0;
              return; // Cancel the resize
            }

            if (newEndDate && newEndDate >= startDate) {
              onUpdate(assignment.id, { endDate: newEndDate });
              // Clear state - optimistic update will position the block correctly
              setIsResizing(null);
              setTempOffset(0);
              offsetRef.current = 0;
              return;
            }
          }
        }
      }

      setIsResizing(null);
      setTempOffset(0);
      offsetRef.current = 0;
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  }, [cellWidth, onUpdate, assignment.id, startDate, endDate, isWeekView, days, findVisibleIndex, findCorrectVisibleIndex]);

  // Edit dialog handlers
  const handleSave = useCallback((updates: Partial<Assignment>) => {
    if (onUpdate) {
      onUpdate(assignment.id, updates);
    }
    setIsEditDialogOpen(false);
  }, [assignment.id, onUpdate]);

  const handleDelete = useCallback(() => {
    if (onDelete) {
      onDelete(assignment.id);
    }
    setIsEditDialogOpen(false);
  }, [assignment.id, onDelete]);

  // Click handler - opens dialog if no drag/resize occurred
  const handleBlockClick = useCallback((e: React.MouseEvent | React.PointerEvent) => {
    // Only open dialog if we didn't drag or resize
    if (!hasDraggedRef.current && !hasResizedRef.current) {
      setIsEditDialogOpen(true);
    }
    // Reset for next interaction
    hasDraggedRef.current = false;
    hasResizedRef.current = false;
  }, []);

  // Drag to move handlers
  const handleDragStart = useCallback((e: React.PointerEvent) => {
    // Don't start drag if clicking on resize handles
    const target = e.target as HTMLElement;
    if (target.closest('[data-resize-handle]')) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    // Capture pointer
    try {
      target.setPointerCapture(e.pointerId);
    } catch (err) {
      console.warn('setPointerCapture failed:', err);
    }

    // Reset drag tracking
    hasDraggedRef.current = false;
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };

    setIsDragging(true);
    setDragOffset(0);

    const startX = e.clientX;

    // Find current visible indices
    const startVisibleIdx = findVisibleIndex(startDate);
    const endVisibleIdx = findCorrectVisibleIndex(endDate);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaDays = Math.round(deltaX / cellWidth);

      // Mark as dragged if there's meaningful movement
      if (Math.abs(deltaDays) >= 1) {
        hasDraggedRef.current = true;
      }

      // Only update if value changed to reduce re-renders
      if (offsetRef.current !== deltaDays) {
        offsetRef.current = deltaDays;
        // Use RAF for smooth 60fps updates
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          setDragOffset(deltaDays);
        });
      }
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      target.releasePointerCapture(upEvent.pointerId);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);

      // Check if it was a drag (moved at least one column)
      const deltaX = upEvent.clientX - startX;
      const deltaColumns = Math.round(deltaX / cellWidth);

      // Apply the move if we dragged at least one column
      if (deltaColumns !== 0 && onUpdate) {
        if (isWeekView) {
          // In week view, each column represents 1 week (7 days)
          // Move by the number of weeks
          const daysToMove = deltaColumns * 7;
          const newStartDate = addDays(startDate, daysToMove);
          const newEndDate = addDays(endDate, daysToMove);

          // Prevent moving into time-off (check if new range overlaps with any time-off)
          if (hasTimeOffInRangeRef.current(newStartDate, newEndDate)) {
            setIsDragging(false);
            setDragOffset(0);
            hasDraggedRef.current = false;
            return; // Cancel the move
          }

          onUpdate(assignment.id, { startDate: newStartDate, endDate: newEndDate });
          // Clear state - optimistic update will position the block correctly
          setIsDragging(false);
          setDragOffset(0);
          hasDraggedRef.current = false;
          return;
        } else {
          // In day view, use the visible days array

          // Handle partial visibility - calculate indices with fallbacks
          let newStartIdx: number;
          let newEndIdx: number;

          if (startVisibleIdx >= 0) {
            // Start is visible, calculate from index
            newStartIdx = Math.max(0, Math.min(days.length - 1, startVisibleIdx + deltaColumns));
          } else {
            // Start is not visible (before range or on hidden weekend)
            // Calculate from actual date
            const daysToMove = deltaColumns; // In day view, 1 column = 1 visible day
            const newStartDate = addDays(startDate, daysToMove);
            newStartIdx = findCorrectVisibleIndex(newStartDate);

            // If still not found, clip to timeline bounds
            if (newStartIdx < 0) {
              newStartIdx = newStartDate < days[0] ? 0 : days.length - 1;
            }
          }

          if (endVisibleIdx >= 0) {
            // End is visible, calculate from index
            newEndIdx = Math.max(0, Math.min(days.length - 1, endVisibleIdx + deltaColumns));
          } else {
            // End is not visible (after range or on hidden weekend)
            // Calculate from actual date
            const daysToMove = deltaColumns;
            const newEndDate = addDays(endDate, daysToMove);
            newEndIdx = findCorrectVisibleIndex(newEndDate);

            // If still not found, clip to timeline bounds
            if (newEndIdx < 0) {
              newEndIdx = newEndDate < days[0] ? 0 : days.length - 1;
            }
          }

          // Add null checks before using dates
          let newStartDate = days[newStartIdx];
          let newEndDate = days[newEndIdx];

          // Validate before updating
          if (!newStartDate || !newEndDate) {
            setIsDragging(false);
            setDragOffset(0);
            hasDraggedRef.current = false;
            return; // Cancel if dates are invalid
          }

          // Don't skip weekends - user selected specific columns

          // Prevent moving into time-off
          if (hasTimeOffInRangeRef.current(newStartDate, newEndDate)) {
            setIsDragging(false);
            setDragOffset(0);
            hasDraggedRef.current = false;
            return; // Cancel the move
          }

          onUpdate(assignment.id, { startDate: newStartDate, endDate: newEndDate });
          // Clear state - optimistic update will position the block correctly
          setIsDragging(false);
          setDragOffset(0);
          hasDraggedRef.current = false;
          return;
        }
      }

      // Only clear immediately if validation failed or no update
      setIsDragging(false);
      setDragOffset(0);
      hasDraggedRef.current = false;
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  }, [cellWidth, onUpdate, assignment.id, startDate, endDate, days, findVisibleIndex, findCorrectVisibleIndex, isWeekView]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            ref={blockRef}
            className={cn(
              "absolute rounded-md shadow-sm border text-xs text-white overflow-hidden flex items-center justify-between group",
              // Only apply transitions when NOT actively resizing or dragging to prevent bounce
              !isResizing && !isDragging && "transition-all duration-100 ease-out",
              isTimeOff && "bg-gray-500 opacity-80",
              isResizing && "cursor-col-resize ring-2 ring-blue-400",
              isDragging ? "cursor-grabbing opacity-70 ring-2 ring-blue-400 scale-[1.01]" : "cursor-grab",
              isDeleting && "opacity-50 pointer-events-none animate-pulse",
              // Show subtle processing state when API call is in flight
              isUpdating && !isResizing && !isDragging && "opacity-80 ring-1 ring-blue-300"
            )}
            style={{
              left: LEFT_OFFSET,
              width: WIDTH,
              backgroundColor: bgColor,
              top: 4,
              height: resourceRowHeight - 8,
              zIndex: isResizing || isDragging ? 40 : 10,
            }}
            onPointerDown={handleDragStart}
            onClick={handleBlockClick}
            data-testid="assignment-block"
            data-assignment-id={assignment.id}
          >
            {/* Left resize handle */}
            <div
              data-resize-handle="left"
              data-testid="assignment-resize-left"
              className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-white/40 transition-all duration-150 z-40 hover:w-3"
              onPointerDown={(e) => {
                e.stopPropagation();
                handleResizeStart('left', e);
              }}
            />

            {/* Content */}
            <div className="flex-1 px-2 py-1 min-w-0 pointer-events-none">
              <div className="font-bold truncate">
                {isDeleting ? "Deleting..." : displayName}
              </div>
              <div className="truncate opacity-90">{hoursPerDay}h/day</div>
            </div>

            {/* Right resize handle */}
            <div
              data-resize-handle="right"
              data-testid="assignment-resize-right"
              className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-white/40 transition-all duration-150 z-40 hover:w-3"
              onPointerDown={(e) => {
                e.stopPropagation();
                handleResizeStart('right', e);
              }}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent className="bg-slate-800 text-white border-slate-700 p-0 overflow-hidden shadow-xl max-w-xs">
          <div className="p-3">
            <div className="font-semibold mb-1 text-sm">
              Dates: <span className="font-normal text-slate-300">{formattedStartDate} - {formattedEndDate} ({durationDays} days)</span>
            </div>
            <div className="font-semibold mb-1 text-sm">
              Total Effort: <span className="font-normal text-slate-300">{totalHours}h @ {hoursPerDay}h/day</span>
            </div>
            {assignment.category && (
              <div className="font-semibold text-sm">
                Phase: <span className="font-normal text-slate-300">{assignment.category}</span>
              </div>
            )}
            {assignment.note && (
              <div className="mt-2 text-xs text-slate-400 italic border-t border-slate-700 pt-2 line-clamp-3 overflow-hidden">
                "{assignment.note}"
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>

      <EditAssignmentDialog
        key={`${assignment.id}-${isEditDialogOpen ? "open" : "closed"}-${assignment.updatedAt}`}
        assignment={assignment}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSave={handleSave}
        onDelete={handleDelete}
        isDeleting={isDeleting}
      />
    </TooltipProvider>
  );
};
