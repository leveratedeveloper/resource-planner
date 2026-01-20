"use client";

import React, { useState, useRef, useCallback } from "react";
import { Assignment } from "@/types";
import { differenceInDays, startOfDay, format, addDays, startOfWeek, endOfWeek, differenceInWeeks, isBefore } from "date-fns";
import { useApp } from "@/context/AppContext";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AssignmentBlockProps {
  assignment: Assignment;
  days: Date[];
  resourceRowHeight: number;
  cellWidth?: number;
  isWeekView?: boolean; // true for quarter/halfYear/year views where each cell = 1 week
  onUpdate?: (id: string, updates: { startDate?: Date; endDate?: Date }) => void;
}

export const AssignmentBlock: React.FC<AssignmentBlockProps> = ({
  assignment,
  days,
  resourceRowHeight,
  cellWidth = 100,
  isWeekView = false,
  onUpdate,
}) => {
  const { projects } = useApp();
  const project = projects.find((p) => p.id === assignment.projectId);
  const blockRef = useRef<HTMLDivElement>(null);

  // Resize state
  const [isResizing, setIsResizing] = useState<'left' | 'right' | null>(null);
  const [tempOffset, setTempOffset] = useState(0); // Days to adjust

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0); // Days to move

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

  if (isWeekView) {
    // In week view, each cell represents a week (Monday)
    // Find which week column the start/end dates fall into
    const assignmentStartWeek = startOfWeek(startDate, { weekStartsOn: 1 });
    const assignmentEndWeek = startOfWeek(endDate, { weekStartsOn: 1 });

    // Find the indices in the days array (which contains Mondays)
    startVisibleIdx = days.findIndex(d => startOfDay(d).getTime() === assignmentStartWeek.getTime());
    endVisibleIdx = days.findIndex(d => startOfDay(d).getTime() === assignmentEndWeek.getTime());

    // If not found, find the closest week before/after
    if (startVisibleIdx === -1) {
      const assignmentStartWeekTime = assignmentStartWeek.getTime();
      for (let i = 0; i < days.length; i++) {
        if (startOfDay(days[i]).getTime() >= assignmentStartWeekTime) {
          startVisibleIdx = i;
          break;
        }
      }
      if (startVisibleIdx === -1) startVisibleIdx = 0;
    }

    if (endVisibleIdx === -1) {
      const assignmentEndWeekTime = assignmentEndWeek.getTime();
      for (let i = days.length - 1; i >= 0; i--) {
        if (startOfDay(days[i]).getTime() <= assignmentEndWeekTime) {
          endVisibleIdx = i;
          break;
        }
      }
      if (endVisibleIdx === -1) endVisibleIdx = days.length - 1;
    }

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

    // Find correct end index even if it falls on a hidden weekend
    endVisibleIdx = days.findIndex(d => startOfDay(d).getTime() === endDate.getTime());
    if (endVisibleIdx === -1 && startVisibleIdx >= 0) {
      const endDateTime = endDate.getTime();
      for (let i = days.length - 1; i >= 0; i--) {
        if (startOfDay(days[i]).getTime() <= endDateTime) {
          endVisibleIdx = i;
          break;
        }
      }
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
  
  const totalHours = workingDays * assignment.hoursPerDay;
  const formattedStartDate = format(startDate, "dd MMM");
  const formattedEndDate = format(endDate, "dd MMM");

  // Use ref to avoid stale closure in event handlers
  const offsetRef = useRef(0);

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
      offsetRef.current = deltaColumns;
      setTempOffset(deltaColumns);
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
            if (newStartDate < endDate) {
              onUpdate(assignment.id, { startDate: newStartDate });
            }
          } else {
            let newEndDate = addDays(endDate, daysToMove);
            // Prevent resizing end date into the past
            if (isBefore(newEndDate, today)) {
              newEndDate = today;
            }
            if (newEndDate > startDate) {
              onUpdate(assignment.id, { endDate: newEndDate });
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

            if (newStartDate && newStartDate < endDate) {
              onUpdate(assignment.id, { startDate: newStartDate });
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

            if (newEndDate && newEndDate > startDate) {
              onUpdate(assignment.id, { endDate: newEndDate });
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
  }, [cellWidth, onUpdate, assignment.id, startDate, endDate, tempOffset, isWeekView, days, findVisibleIndex, findCorrectVisibleIndex, today]);

  // Drag to move handlers
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    // Don't start drag if clicking on resize handles
    const target = e.target as HTMLElement;
    if (target.closest('[data-resize-handle]')) {
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
      setDragOffset(deltaDays);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      const deltaX = upEvent.clientX - startX;
      const deltaColumns = Math.round(deltaX / cellWidth);

      setIsDragging(false);
      setDragOffset(0);

      // Apply the move
      if (deltaColumns !== 0 && onUpdate && startVisibleIdx >= 0 && endVisibleIdx >= 0) {
        if (isWeekView) {
          // In week view, each column represents 1 week (7 days)
          // Move by the number of weeks
          const daysToMove = deltaColumns * 7;
          const newStartDate = addDays(startDate, daysToMove);
          const newEndDate = addDays(endDate, daysToMove);
          
          // Prevent moving start date into the past
          if (isBefore(newStartDate, today)) {
            return; // Cancel the move
          }
          
          onUpdate(assignment.id, { startDate: newStartDate, endDate: newEndDate });
        } else {
          // In day view, use the visible days array
          const newStartIdx = Math.max(0, Math.min(days.length - 1, startVisibleIdx + deltaColumns));
          const newEndIdx = Math.max(0, Math.min(days.length - 1, endVisibleIdx + deltaColumns));

          const newStartDate = days[newStartIdx];
          const newEndDate = days[newEndIdx];

          // Prevent moving start date into the past
          if (newStartDate && isBefore(newStartDate, today)) {
            return; // Cancel the move
          }

          if (newStartDate && newEndDate) {
            onUpdate(assignment.id, { startDate: newStartDate, endDate: newEndDate });
          }
        }
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [cellWidth, onUpdate, assignment.id, startDate, endDate, days, findVisibleIndex, findCorrectVisibleIndex, isWeekView, today]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            ref={blockRef}
            className={cn(
              "absolute rounded-md shadow-sm border text-xs text-white overflow-hidden flex items-center justify-between group transition-all",
              isTimeOff && "bg-gray-500 opacity-80",
              isResizing && "cursor-col-resize ring-2 ring-blue-400",
              isDragging ? "cursor-grabbing opacity-60 ring-2 ring-blue-400" : "cursor-grab"
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
              className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-white/30 transition-opacity z-10"
              onMouseDown={(e) => handleResizeStart('left', e)}
            />
            
            {/* Content */}
            <div className="flex-1 px-2 py-1 min-w-0">
              <div className="font-bold truncate">{displayName}</div>
              <div className="truncate opacity-90">{assignment.hoursPerDay}h/day</div>
            </div>
            
            {/* Right resize handle */}
            <div
              data-resize-handle="right"
              className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-white/30 transition-opacity z-10"
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
              Total Effort: <span className="font-normal text-slate-300">{totalHours}h @ {assignment.hoursPerDay}h/day</span>
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
    </TooltipProvider>
  );
};
