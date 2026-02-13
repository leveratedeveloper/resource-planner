"use client";

import React, { useState, useRef, useCallback } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import { format, startOfDay, isBefore, isWithinInterval } from "date-fns";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

interface DraggableTimelineCellProps {
  day: Date;
  projectId: string;
  projectColor: string;
  onDragComplete: (startDay: Date, endDay: Date, position: { x: number; y: number }) => void;
  days: Date[];
  cellWidth?: number;
  cellHeight?: number;
  timeOffAssignments?: Assignment[]; // Time-off assignments for this resource
  isTimeOffMode?: boolean; // True when used for adding time-off (skip time-off blocking)
  disabled?: boolean; // Disable dragging (e.g., while creating/deleting)
}

export const DraggableTimelineCell: React.FC<DraggableTimelineCellProps> = ({
  day,
  projectId,
  projectColor,
  onDragComplete,
  days,
  cellWidth = 100,
  cellHeight = 60,
  timeOffAssignments = [],
  isTimeOffMode = false,
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showWeekendConfirm, setShowWeekendConfirm] = useState(false);
  const cellRef = useRef<HTMLDivElement>(null);
  const dragStartIndex = useRef<number | null>(null);
  const [dragEndIndex, setDragEndIndex] = useState<number | null>(null);

  const dayIndex = days.findIndex((d) => d.toISOString() === day.toISOString());
  const dateKey = format(day, "yyyy-MM-dd");
  
  // Check if this is a weekend day
  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
  
  // Check if this is a past date
  const today = startOfDay(new Date());
  const isPastDate = isBefore(startOfDay(day), today);
  
  // Check if this day has time-off (100% allocation)
  // Only check when NOT in time-off mode (time-off mode allows adding on any day)
  const hasTimeOff = !isTimeOffMode && timeOffAssignments.some(a => 
    isWithinInterval(startOfDay(day), {
      start: startOfDay(new Date(a.startDate)),
      end: startOfDay(new Date(a.endDate))
    })
  );
  
  // Day is blocked if past, or has time-off (when not in time-off mode)
  const isBlocked = isPastDate || hasTimeOff;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Prevent dragging when disabled (e.g., during create/delete operations)
      if (disabled) {
        return;
      }

      // Prevent scheduling on blocked dates (past or time-off)
      if (isBlocked) {
        return;
      }
      
      // If weekend and we haven't confirmed yet, don't start drag
      if (isWeekend && !showWeekendConfirm) {
        return;
      }
      
      e.preventDefault();
      setIsDragging(true);
      dragStartIndex.current = dayIndex;
      setDragEndIndex(dayIndex);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const container = cellRef.current?.parentElement;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const x = moveEvent.clientX - rect.left;
        const newIndex = Math.max(0, Math.min(days.length - 1, Math.floor(x / cellWidth)));
        setDragEndIndex(newIndex);
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);

        if (dragStartIndex.current !== null) {
          const start = Math.min(dragStartIndex.current, dragEndIndex ?? dragStartIndex.current);
          const end = Math.max(dragStartIndex.current, dragEndIndex ?? dragStartIndex.current);

          onDragComplete(days[start], days[end], {
            x: upEvent.clientX,
            y: upEvent.clientY,
          });
        }

        setIsDragging(false);
        setDragEndIndex(null);
        dragStartIndex.current = null;
        setShowWeekendConfirm(false);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [dayIndex, days, onDragComplete, dragEndIndex, cellWidth, isWeekend, showWeekendConfirm, isBlocked, disabled]
  );

  // Handle weekend confirmation
  const handleWeekendConfirm = useCallback(() => {
    setShowWeekendConfirm(false);
    // Open the popover directly for single-day weekend assignment
    if (cellRef.current) {
      const rect = cellRef.current.getBoundingClientRect();
      onDragComplete(day, day, {
        x: rect.left + rect.width / 2,
        y: rect.bottom,
      });
    }
  }, [day, onDragComplete]);

  // Calculate if this cell is in the drag range
  const isInDragRange = useCallback(() => {
    if (!isDragging || dragStartIndex.current === null || dragEndIndex === null) return false;
    const start = Math.min(dragStartIndex.current, dragEndIndex);
    const end = Math.max(dragStartIndex.current, dragEndIndex);
    return dayIndex >= start && dayIndex <= end;
  }, [isDragging, dayIndex, dragEndIndex]);

  // Get the appropriate tooltip message for blocked days
  const getBlockedMessage = () => {
    if (isPastDate) return "Cannot schedule on past dates";
    if (hasTimeOff) return "Cannot schedule - Time Off";
    return "";
  };

  // Weekend cell with tooltip and confirmation
  if (isWeekend) {
    return (
      <div
        ref={cellRef}
        className={cn(
          "shrink-0 border-r border-dashed relative group",
          isBlocked && "cursor-not-allowed",
          isInDragRange() && "bg-primary/20"
        )}
        style={{ width: cellWidth, height: cellHeight }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        data-testid={isTimeOffMode ? "timeline-timeoff-cell" : "timeline-project-cell"}
        data-date={dateKey}
        data-project-id={projectId}
        data-cell-state="weekend"
      >
        {/* Show lock icon for blocked weekend dates (past or time-off) */}
        {isHovered && !isDragging && isBlocked && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center bg-gray-300 shadow-sm">
                    <Icon icon="lucide:lock" className="h-3 w-3 text-gray-600" />
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent 
                side="top" 
                className="bg-slate-700 text-white border-slate-600"
              >
                {getBlockedMessage()}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {/* Weekend add button with tooltip and confirmation - only for non-blocked dates */}
        {isHovered && !isDragging && !isBlocked && (
          <Popover open={showWeekendConfirm} onOpenChange={setShowWeekendConfirm}>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white shadow-sm cursor-pointer hover:scale-110 transition-transform"
                        style={{ backgroundColor: projectColor }}
                      >
                        <Icon icon="lucide:plus" className="h-3 w-3" />
                      </div>
                    </div>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent 
                  side="top" 
                  className="bg-slate-700 text-white border-slate-600"
                >
                  Schedule on a non-working day
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <PopoverContent 
              side="bottom" 
              align="center"
              className="w-64 p-4"
            >
              <div className="text-center">
                <p className="text-sm mb-4">Schedule on a non-working day?</p>
                <div className="flex justify-center gap-3">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setShowWeekendConfirm(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleWeekendConfirm}
                    data-testid="weekend-schedule-confirm"
                  >
                    Schedule
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    );
  }

  // Blocked date cell (past or time-off) - disabled state with lock icon
  if (isBlocked) {
    return (
      <div
        ref={cellRef}
        className={cn(
          "shrink-0 border-r border-dashed relative group cursor-not-allowed",
          isInDragRange() && "bg-primary/20"
        )}
        style={{ width: cellWidth, height: cellHeight }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        data-testid={isTimeOffMode ? "timeline-timeoff-cell" : "timeline-project-cell"}
        data-date={dateKey}
        data-project-id={projectId}
        data-cell-state="blocked"
      >
        {/* Lock icon with tooltip - shown on hover */}
        {isHovered && !isDragging && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center bg-gray-300 shadow-sm">
                    <Icon icon="lucide:lock" className="h-3 w-3 text-gray-600" />
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent 
                side="top" 
                className="bg-slate-700 text-white border-slate-600"
              >
                {getBlockedMessage()}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    );
  }

  // Normal weekday cell
  return (
    <div
      ref={cellRef}
      className={cn(
        "shrink-0 border-r border-dashed relative group cursor-cell",
        isInDragRange() && "bg-primary/20"
      )}
      style={{ width: cellWidth, height: cellHeight }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={handleMouseDown}
      data-testid={isTimeOffMode ? "timeline-timeoff-cell" : "timeline-project-cell"}
      data-date={dateKey}
      data-project-id={projectId}
      data-cell-state="weekday"
    >
      {/* Add button - shown on hover */}
      {isHovered && !isDragging && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-white shadow-sm cursor-pointer hover:scale-110 transition-transform"
            style={{ backgroundColor: projectColor }}
          >
            <Icon icon="lucide:plus" className="h-3 w-3" />
          </div>
        </div>
      )}

      {/* Drag preview */}
      {isInDragRange() && isDragging && dragStartIndex.current === dayIndex && (
        <div
          className="absolute top-2 left-0 h-[calc(100%-16px)] rounded-md opacity-80 flex items-center justify-center text-white text-xs font-medium pointer-events-none"
          style={{
            backgroundColor: projectColor,
            width: `${((Math.abs((dragEndIndex ?? dayIndex) - dayIndex) + 1) * cellWidth)}px`,
            zIndex: 10,
          }}
        >
          {Math.abs((dragEndIndex ?? dayIndex) - dayIndex) + 1} days
        </div>
      )}
    </div>
  );
};
