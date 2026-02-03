"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import { differenceInDays, startOfDay, format, addDays, startOfWeek, endOfWeek, differenceInWeeks, isBefore, isWithinInterval } from "date-fns";
import { useProjects } from "@/lib/query/hooks/useProjects";
import { cn } from "@/lib/utils";
import { MoreVertical } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EditAssignmentDialog } from "./EditAssignmentDialog";

interface AssignmentBlockProps {
  assignment: Assignment;
  days: Date[];
  resourceRowHeight: number;
  cellWidth?: number;
  isWeekView?: boolean; // true for quarter/halfYear/year views where each cell = 1 week
  onUpdate?: (id: string, updates: any) => void;
  onDelete?: (id: string) => void;
  timeOffAssignments?: Assignment[]; // Time-off assignments for this resource
  isDeleting?: boolean; // Show deleting state
  isUpdating?: boolean; // Show updating state (during drag/resize)
}

export const AssignmentBlock: React.FC<AssignmentBlockProps> = ({
  assignment,
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
  const { data: projects = [] } = useProjects();
  const project = projects.find((p) => p.id === assignment.projectId);
  const blockRef = useRef<HTMLDivElement>(null);

  // Resize state
  const [isResizing, setIsResizing] = useState<'left' | 'right' | null>(null);
  const [tempOffset, setTempOffset] = useState(0); // Days to adjust

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0); // Days to move

  // Edit dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Processing state for showing loading indicator after operation
  const [isProcessing, setIsProcessing] = useState(false);

  // Use ref to avoid stale closure in event handlers
  const offsetRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  // Calculate Position and Width
  const startDate = startOfDay(new Date(assignment.startDate));
  const endDate = startOfDay(new Date(assignment.endDate));
  const timelineStart = startOfDay(days[0]);
  const today = startOfDay(new Date());

  let offsetDays: number;
  let durationDays: number;
  let startVisibleIdx: number;
  let endVisibleIdx: number;
  let visibleDuration: number;
  let useVisibleIndices: boolean;

  // Get the timeline end date for clipping
  const timelineEnd = startOfDay(days[days.length - 1]);

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
    useVisibleIndices = true;
    offsetDays = startVisibleIdx;
    durationDays = visibleDuration;
  } else {
    // Day view - original logic
    offsetDays = differenceInDays(startDate, timelineStart);
    durationDays = differenceInDays(endDate, startDate) + 1;

    // Find positions in visible days array - inline calculation
    startVisibleIdx = days.findIndex(d => startOfDay(d).getTime() === startDate.getTime());

    // If start is before visible range, clip to start
    if (startVisibleIdx === -1 && startDate < timelineStart) {
      startVisibleIdx = 0;
    }

    // Find correct end index even if it falls on a hidden weekend or beyond visible range
    endVisibleIdx = days.findIndex(d => startOfDay(d).getTime() === endDate.getTime());
    
    // If end is after visible range, clip to end
    if (endVisibleIdx === -1) {
      if (endDate > timelineEnd) {
        endVisibleIdx = days.length - 1;
      } else if (startVisibleIdx >= 0) {
        const endDateTime = endDate.getTime();
        for (let i = days.length - 1; i >= 0; i--) {
          if (startOfDay(days[i]).getTime() <= endDateTime) {
            endVisibleIdx = i;
            break;
          }
        }
      }
    }

    // Clamp indices to valid range
    if (startVisibleIdx >= 0) {
      startVisibleIdx = Math.max(0, Math.min(days.length - 1, startVisibleIdx));
    }
    if (endVisibleIdx >= 0) {
      endVisibleIdx = Math.max(0, Math.min(days.length - 1, endVisibleIdx));
    }

    // Calculate duration in visible days (how many columns it spans)
    visibleDuration = startVisibleIdx >= 0 && endVisibleIdx >= 0
      ? endVisibleIdx - startVisibleIdx + 1
      : durationDays;

    // Determine if we should use visible column indices (when weekends are hidden)
    useVisibleIndices = startVisibleIdx >= 0;
  }

  // Apply temp offset during resize or drag
  let displayOffset = useVisibleIndices ? startVisibleIdx : offsetDays;
  let displayDuration = useVisibleIndices ? visibleDuration : durationDays;

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

  const LEFT_OFFSET = displayOffset * cellWidth;
  const WIDTH = displayDuration * cellWidth;

  // If outside of view, hide
  if (offsetDays < 0 && offsetDays + durationDays < 0) return null;

  // Time Off styling
  const isTimeOff = assignment.isTimeOff;
  const bgColor = isTimeOff ? "#6b7280" : (project?.color || "#ccc");
  const displayName = isTimeOff ? "Time Off" : (project?.name || "Unknown");

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

  // Check if a specific date has time-off
  const hasTimeOffOnDate = useCallback((date: Date) => {
    return timeOffAssignments.some(a => 
      isWithinInterval(startOfDay(date), {
        start: startOfDay(new Date(a.startDate)),
        end: startOfDay(new Date(a.endDate))
      })
    );
  }, [timeOffAssignments]);

  // Check if any date in a range has time-off (for detecting overlap)
  const hasTimeOffInRange = useCallback((rangeStart: Date, rangeEnd: Date) => {
    // Check if any time-off assignment overlaps with the given range
    // Exclude the current assignment if it's a time-off assignment being resized
    return timeOffAssignments.some(a => {
      // Skip checking against the current assignment itself
      if (a.id === assignment.id) return false;

      const timeOffStart = startOfDay(new Date(a.startDate));
      const timeOffEnd = startOfDay(new Date(a.endDate));
      const checkStart = startOfDay(rangeStart);
      const checkEnd = startOfDay(rangeEnd);

      // Two ranges overlap if one starts before the other ends AND ends after the other starts
      return checkStart <= timeOffEnd && checkEnd >= timeOffStart;
    });
  }, [timeOffAssignments, assignment.id]);

  // Use ref to avoid stale closure for hasTimeOffInRange in nested handlers
  const hasTimeOffInRangeRef = useRef(hasTimeOffInRange);
  hasTimeOffInRangeRef.current = hasTimeOffInRange;

  // Use ref to avoid stale closure for hasTimeOffOnDate in nested handlers
  const hasTimeOffOnDateRef = useRef(hasTimeOffOnDate);
  hasTimeOffOnDateRef.current = hasTimeOffOnDate;

  // Find the visible column index for a date (returns -1 if not visible)
  const findVisibleIndex = useCallback((date: Date) => {
    const dateMs = startOfDay(date).getTime();
    return days.findIndex(d => startOfDay(d).getTime() === dateMs);
  }, [days]);

  // Find the correct visible index for a date, even if it falls on a hidden weekend or in week view
  const findCorrectVisibleIndex = useCallback((date: Date) => {
    if (isWeekView) {
      // In week view, find which week this date belongs to
      const dateWeek = startOfWeek(date, { weekStartsOn: 1 });
      const exactIdx = days.findIndex(d => startOfDay(d).getTime() === dateWeek.getTime());
      if (exactIdx >= 0) return exactIdx;

      // If not found, find the closest week before this date
      const dateWeekTime = dateWeek.getTime();
      for (let i = days.length - 1; i >= 0; i--) {
        if (startOfDay(days[i]).getTime() <= dateWeekTime) {
          return i;
        }
      }
      return -1;
    } else {
      // Day view - original logic
      const exactIdx = findVisibleIndex(date);
      if (exactIdx >= 0) return exactIdx;

      // If not found (e.g., weekend when weekends are hidden),
      // find the last visible day that's before or equal to this date
      const dateTime = startOfDay(date).getTime();
      for (let i = days.length - 1; i >= 0; i--) {
        if (startOfDay(days[i]).getTime() <= dateTime) {
          return i;
        }
      }
      return -1;
    }
  }, [days, findVisibleIndex, isWeekView]);

  // Resize handlers
  const handleResizeStart = useCallback((edge: 'left' | 'right', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsResizing(edge);
    setTempOffset(0);
    offsetRef.current = 0;
    
    const startX = e.clientX;

    // Find current visible indices
    const startVisibleIdx = findVisibleIndex(startDate);
    const endVisibleIdx = findCorrectVisibleIndex(endDate);

    const handleMouseMove = (moveEvent: MouseEvent) => {
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
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      const deltaColumns = offsetRef.current;
      
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
        if (isWeekView) {
          // In week view, each column represents 1 week (7 days)
          const daysToMove = deltaColumns * 7;

          if (edge === 'left') {
            let newStartDate = addDays(startDate, daysToMove);
            // Prevent resizing start date into the past
            if (isBefore(newStartDate, today)) {
              newStartDate = today;
            }
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
            // Prevent resizing end date into the past
            if (isBefore(newEndDate, today)) {
              newEndDate = today;
            }
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
            let newStartDate = days[newIdx];

            // Skip weekend if needed
            if (newStartDate) {
              newStartDate = skipWeekend(newStartDate, 'forward');
            }

            // Prevent resizing start date into the past
            if (newStartDate && isBefore(newStartDate, today)) {
              newStartDate = today;
            }

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
            let newEndDate = days[newIdx];

            // Skip weekend if needed
            if (newEndDate) {
              newEndDate = skipWeekend(newEndDate, 'backward');
            }

            // Prevent resizing end date into the past
            if (newEndDate && isBefore(newEndDate, today)) {
              newEndDate = today;
            }

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
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [cellWidth, onUpdate, assignment.id, startDate, endDate, tempOffset, isWeekView, days, findVisibleIndex, findCorrectVisibleIndex, today, hasTimeOffOnDate]);

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

  // Drag to move handlers
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    // Don't start drag if clicking on resize handles or edit menu
    const target = e.target as HTMLElement;
    if (target.closest('[data-resize-handle]') || target.closest('[data-edit-menu]')) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    setDragOffset(0);

    const startX = e.clientX;

    // Find current visible indices
    const startVisibleIdx = findVisibleIndex(startDate);
    const endVisibleIdx = findCorrectVisibleIndex(endDate);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaDays = Math.round(deltaX / cellWidth);
      
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

    const handleMouseUp = (upEvent: MouseEvent) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      const deltaX = upEvent.clientX - startX;
      const deltaColumns = Math.round(deltaX / cellWidth);

      // Apply the move
      if (deltaColumns !== 0 && onUpdate) {
        if (isWeekView) {
          // In week view, each column represents 1 week (7 days)
          // Move by the number of weeks
          const daysToMove = deltaColumns * 7;
          const newStartDate = addDays(startDate, daysToMove);
          const newEndDate = addDays(endDate, daysToMove);
          
          // Prevent moving start date into the past
          if (isBefore(newStartDate, today)) {
            setIsDragging(false);
            setDragOffset(0);
            return; // Cancel the move
          }
          
          // Prevent moving into time-off (check if new range overlaps with any time-off)
          if (hasTimeOffInRangeRef.current(newStartDate, newEndDate)) {
            setIsDragging(false);
            setDragOffset(0);
            return; // Cancel the move
          }
          
          onUpdate(assignment.id, { startDate: newStartDate, endDate: newEndDate });
          // Clear state - optimistic update will position the block correctly
          setIsDragging(false);
          setDragOffset(0);
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
          const newStartDate = days[newStartIdx];
          const newEndDate = days[newEndIdx];

          // Validate before updating
          if (!newStartDate || !newEndDate) {
            setIsDragging(false);
            setDragOffset(0);
            return; // Cancel if dates are invalid
          }

          // Prevent moving start date into the past
          if (isBefore(newStartDate, today)) {
            setIsDragging(false);
            setDragOffset(0);
            return; // Cancel the move
          }

          // Prevent moving into time-off
          if (hasTimeOffInRangeRef.current(newStartDate, newEndDate)) {
            setIsDragging(false);
            setDragOffset(0);
            return; // Cancel the move
          }

          onUpdate(assignment.id, { startDate: newStartDate, endDate: newEndDate });
          // Clear state - optimistic update will position the block correctly
          setIsDragging(false);
          setDragOffset(0);
          return;
        }
      }

      // Only clear immediately if validation failed or no update
      setIsDragging(false);
      setDragOffset(0);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [cellWidth, onUpdate, assignment.id, startDate, endDate, days, findVisibleIndex, findCorrectVisibleIndex, isWeekView, today, hasTimeOffOnDate]);

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
            }}
            onMouseDown={handleDragStart}
          >
            {/* Left resize handle */}
            <div
              data-resize-handle="left"
              className="absolute left-0 top-0 bottom-0 w-4 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-white/30 transition-opacity z-30"
              onMouseDown={(e) => handleResizeStart('left', e)}
            />

            {/* Edit menu button */}
            <button
              data-edit-menu="true"
              className="absolute right-3 top-1 w-5 h-5 rounded opacity-0 group-hover:opacity-100 hover:bg-white/30 transition-opacity z-20 flex items-center justify-center"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsEditDialogOpen(true);
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-3 w-3" />
            </button>

            {/* Content */}
            <div className="flex-1 px-2 py-1 min-w-0">
              <div className="font-bold truncate">
                {isDeleting ? "Deleting..." : displayName}
              </div>
              <div className="truncate opacity-90">{hoursPerDay}h/day</div>
            </div>

            {/* Right resize handle */}
            <div
              data-resize-handle="right"
              className="absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-white/30 transition-opacity z-30"
              onMouseDown={(e) => handleResizeStart('right', e)}
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
              <div className="mt-2 text-xs text-slate-400 italic border-t border-slate-700 pt-2">
                "{assignment.note}"
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>

      <EditAssignmentDialog
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
