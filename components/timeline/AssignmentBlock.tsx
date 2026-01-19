"use client";

import React, { useState, useRef, useCallback } from "react";
import { Assignment } from "@/types";
import { differenceInDays, startOfDay, format, addDays } from "date-fns";
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
  onUpdate?: (id: string, updates: { startDate?: Date; endDate?: Date }) => void;
}

export const AssignmentBlock: React.FC<AssignmentBlockProps> = ({
  assignment,
  days,
  resourceRowHeight,
  cellWidth = 100,
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

  const offsetDays = differenceInDays(startDate, timelineStart);
  const durationDays = differenceInDays(endDate, startDate) + 1;

  // Apply temp offset during resize or drag
  let displayOffset = offsetDays;
  let displayDuration = durationDays;

  if (isResizing === 'left') {
    displayOffset = offsetDays + tempOffset;
    displayDuration = durationDays - tempOffset;
  } else if (isResizing === 'right') {
    displayDuration = durationDays + tempOffset;
  } else if (isDragging) {
    displayOffset = offsetDays + dragOffset;
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
    const endVisibleIdx = findVisibleIndex(endDate);
    
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
      
      // Apply the resize using visible days array
      if (onUpdate && deltaColumns !== 0) {
        if (edge === 'left') {
          // For left edge: find new start date from days array
          const currentIdx = startVisibleIdx >= 0 ? startVisibleIdx : 0;
          const newIdx = Math.max(0, Math.min(days.length - 1, currentIdx + deltaColumns));
          let newStartDate = days[newIdx];
          
          // Skip weekend if needed
          if (newStartDate) {
            newStartDate = skipWeekend(newStartDate, 'forward');
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
          
          if (newEndDate && newEndDate > startDate) {
            onUpdate(assignment.id, { endDate: newEndDate });
          }
        }
      }
      
      setIsResizing(null);
      setTempOffset(0);
      offsetRef.current = 0;
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [cellWidth, onUpdate, assignment.id, startDate, endDate, tempOffset]);

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

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaDays = Math.round(deltaX / cellWidth);
      setDragOffset(deltaDays);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      const deltaX = upEvent.clientX - startX;
      const deltaDays = Math.round(deltaX / cellWidth);

      setIsDragging(false);
      setDragOffset(0);

      // Apply the move
      if (deltaDays !== 0 && onUpdate) {
        const newStartDate = addDays(startDate, deltaDays);
        const newEndDate = addDays(endDate, deltaDays);
        onUpdate(assignment.id, { startDate: newStartDate, endDate: newEndDate });
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [cellWidth, onUpdate, assignment.id, startDate, endDate]);

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
