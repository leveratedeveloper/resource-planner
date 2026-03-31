"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import type { Project } from "@/lib/query/hooks/useProjects";
import { differenceInDays, startOfDay, format, addDays, isWithinInterval, startOfWeek } from "date-fns";
import { cn, toLocalDateString } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EditActualAssignmentDialog } from "./EditActualAssignmentDialog";

interface ActualAssignmentBlockProps {
  assignment: ActualAssignment;
  project?: Project;
  days: Date[];
  resourceRowHeight: number;
  cellWidth?: number;
  isWeekView?: boolean;
  onUpdate?: (uuid: string, updates: Partial<ActualAssignment>) => void;
  onDelete?: (uuid: string) => void;
  timeOffAssignments?: ActualAssignment[];
  isDeleting?: boolean;
  isUpdating?: boolean;
}

export const ActualAssignmentBlock: React.FC<ActualAssignmentBlockProps> = ({
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

  // Resize state
  const [isResizing, setIsResizing] = useState<'left' | 'right' | null>(null);
  const [tempOffset, setTempOffset] = useState(0);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);

  // Edit dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Track drag vs click - only set to true after significant movement
  const hasDraggedRef = useRef(false);
  const hasResizedRef = useRef(false);
  const mouseDownPosRef = useRef({ x: 0, y: 0 });

  // Use ref to avoid stale closure in event handlers
  const offsetRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // Calculate Position and Width - sama seperti AssignmentBlock
  const startDate = startOfDay(new Date(assignment.startDate));
  const endDate = startOfDay(new Date(assignment.endDate));
  const timelineStart = startOfDay(days[0]);
  const timelineEnd = startOfDay(days[days.length - 1]);

  // Define callbacks
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
      if (a.uuid === assignment.uuid) return false;
      const timeOffStart = startOfDay(new Date(a.startDate));
      const timeOffEnd = startOfDay(new Date(a.endDate));
      const checkStart = startOfDay(rangeStart);
      const checkEnd = startOfDay(rangeEnd);
      return checkStart <= timeOffEnd && checkEnd >= timeOffStart;
    });
  }, [timeOffAssignments, assignment.uuid]);

  const findVisibleIndex = useCallback((date: Date) => {
    const dateMs = startOfDay(date).getTime();
    return days.findIndex(d => startOfDay(d).getTime() === dateMs);
  }, [days]);

  const findCorrectVisibleIndex = useCallback((date: Date) => {
    if (isWeekView) {
      const dateWeek = startOfWeek(date, { weekStartsOn: 1 });
      const exactIdx = days.findIndex(d => startOfDay(d).getTime() === dateWeek.getTime());
      if (exactIdx >= 0) return exactIdx;
      for (let i = days.length - 1; i >= 0; i--) {
        if (startOfDay(days[i]).getTime() <= dateWeek.getTime()) {
          return i;
        }
      }
      return -1;
    } else {
      const exactIdx = findVisibleIndex(date);
      if (exactIdx >= 0) return exactIdx;
      for (let i = days.length - 1; i >= 0; i--) {
        if (startOfDay(days[i]).getTime() <= date.getTime()) {
          return i;
        }
      }
      return -1;
    }
  }, [days, findVisibleIndex, isWeekView]);

  // Use refs for callbacks
  const hasTimeOffInRangeRef = useRef(hasTimeOffInRange);
  hasTimeOffInRangeRef.current = hasTimeOffInRange;

  let startVisibleIdx: number;
  let endVisibleIdx: number;
  let visibleDuration: number;

  // Calculate duration for tooltip display (always needed)
  const durationDays = differenceInDays(startDate, endDate) + 1;

  if (isWeekView) {
    const assignmentStartWeek = startOfWeek(startDate, { weekStartsOn: 1 });
    const assignmentEndWeek = startOfWeek(endDate, { weekStartsOn: 1 });

    startVisibleIdx = days.findIndex(d => startOfDay(d).getTime() === assignmentStartWeek.getTime());
    endVisibleIdx = days.findIndex(d => startOfDay(d).getTime() === assignmentEndWeek.getTime());

    if (startVisibleIdx === -1) {
      const assignmentStartWeekTime = assignmentStartWeek.getTime();
      if (assignmentStartWeekTime < timelineStart.getTime()) {
        startVisibleIdx = 0;
      } else {
        for (let i = 0; i < days.length; i++) {
          if (startOfDay(days[i]).getTime() >= assignmentStartWeekTime) {
            startVisibleIdx = i;
            break;
          }
        }
        if (startVisibleIdx === -1) startVisibleIdx = 0;
      }
    }

    if (endVisibleIdx === -1) {
      const assignmentEndWeekTime = assignmentEndWeek.getTime();
      if (assignmentEndWeekTime > timelineEnd.getTime()) {
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

    startVisibleIdx = Math.max(0, Math.min(days.length - 1, startVisibleIdx));
    endVisibleIdx = Math.max(0, Math.min(days.length - 1, endVisibleIdx));

    visibleDuration = endVisibleIdx - startVisibleIdx + 1;
  } else {
    // Day view - find exact match in days array
    // First try exact match using timestamps (fastest)
    startVisibleIdx = days.findIndex(d => startOfDay(d).getTime() === startDate.getTime());
    endVisibleIdx = days.findIndex(d => startOfDay(d).getTime() === endDate.getTime());

    // If not found, use local date string comparison (timezone-safe)
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

    // Last resort: clamp to valid range if still not found
    if (startVisibleIdx === -1) {
      startVisibleIdx = 0;
    }
    if (endVisibleIdx === -1) {
      endVisibleIdx = days.length - 1;
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

  displayDuration = Math.max(1, displayDuration);

  const cellPercentage = 100 / days.length;
  const LEFT_OFFSET = `${displayOffset * cellPercentage}%`;
  const WIDTH = `${displayDuration * cellPercentage}%`;

  // Styling
  const isTimeOff = assignment.isTimeOff;
  const bgColor = isTimeOff ? "#6b7280" : "#16a34a";
  const displayName = isTimeOff ? "Time Off" : (project?.name || "Unknown Project");

  // Calculate working days for effort
  let workingDays = 0;
  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const day = currentDate.getDay();
    if (day !== 0 && day !== 6) workingDays++;
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const hoursPerDay = assignment.hoursPerDay;
  const totalHours = workingDays * hoursPerDay;
  const formattedStartDate = format(startDate, "dd MMM");
  const formattedEndDate = format(endDate, "dd MMM");

  // Resize handlers - sama seperti AssignmentBlock
  const handleResizeStart = useCallback((edge: 'left' | 'right', e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const target = e.target as HTMLElement;
    try {
      target.setPointerCapture(e.pointerId);
    } catch (err) {
      console.warn('setPointerCapture failed:', err);
    }

    setIsResizing(edge);
    setTempOffset(0);
    offsetRef.current = 0;

    const startX = e.clientX;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaColumns = Math.round(deltaX / cellWidth);

      if (offsetRef.current !== deltaColumns) {
        offsetRef.current = deltaColumns;
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

      const skipWeekend = (date: Date, direction: 'forward' | 'backward'): Date => {
        let result = new Date(date);
        const day = result.getDay();
        if (day === 0) {
          result = addDays(result, direction === 'forward' ? 1 : -2);
        } else if (day === 6) {
          result = addDays(result, direction === 'forward' ? 2 : -1);
        }
        return result;
      };

      if (onUpdate && deltaColumns !== 0) {
        hasResizedRef.current = true;
        if (isWeekView) {
          const daysToMove = deltaColumns * 7;

          if (edge === 'left') {
            let newStartDate = addDays(startDate, daysToMove);
            if (hasTimeOffInRangeRef.current(newStartDate, endDate)) {
              setIsResizing(null);
              setTempOffset(0);
              return;
            }
            if (newStartDate <= endDate) {
              onUpdate(assignment.uuid, { startDate: toLocalDateString(newStartDate) });
              setIsResizing(null);
              setTempOffset(0);
              return;
            }
          } else {
            let newEndDate = addDays(endDate, daysToMove);
            if (hasTimeOffInRangeRef.current(startDate, newEndDate)) {
              setIsResizing(null);
              setTempOffset(0);
              return;
            }
            if (newEndDate >= startDate) {
              onUpdate(assignment.uuid, { endDate: toLocalDateString(newEndDate) });
              setIsResizing(null);
              setTempOffset(0);
              return;
            }
          }
        } else {
          if (edge === 'left') {
            const currentIdx = startVisibleIdx >= 0 ? startVisibleIdx : 0;
            const newIdx = Math.max(0, Math.min(days.length - 1, currentIdx + deltaColumns));
            const newStartDate = days[newIdx];

            // Don't skip weekend - user selected this specific column

            if (newStartDate && hasTimeOffInRangeRef.current(newStartDate, endDate)) {
              setIsResizing(null);
              setTempOffset(0);
              return;
            }

            if (newStartDate && newStartDate <= endDate) {
              onUpdate(assignment.uuid, { startDate: toLocalDateString(newStartDate) });
              setIsResizing(null);
              setTempOffset(0);
              return;
            }
          } else {
            const currentIdx = endVisibleIdx >= 0 ? endVisibleIdx : days.length - 1;
            const newIdx = Math.max(0, Math.min(days.length - 1, currentIdx + deltaColumns));
            const newEndDate = days[newIdx];

            // Don't skip weekend - user selected this specific column

            if (newEndDate && hasTimeOffInRangeRef.current(startDate, newEndDate)) {
              setIsResizing(null);
              setTempOffset(0);
              return;
            }

            if (newEndDate && newEndDate >= startDate) {
              onUpdate(assignment.uuid, { endDate: toLocalDateString(newEndDate) });
              setIsResizing(null);
              setTempOffset(0);
              return;
            }
          }
        }
      }

      setIsResizing(null);
      setTempOffset(0);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  }, [cellWidth, onUpdate, assignment.uuid, startDate, endDate, days, findVisibleIndex, findCorrectVisibleIndex, isWeekView]);

  // Edit handlers
  const handleSave = useCallback((updates: Partial<ActualAssignment>) => {
    if (onUpdate) {
      onUpdate(assignment.uuid, updates);
    }
    setIsEditDialogOpen(false);
  }, [assignment.uuid, onUpdate]);

  const handleDelete = useCallback(() => {
    if (onDelete) {
      onDelete(assignment.uuid);
    }
    setIsEditDialogOpen(false);
  }, [assignment.uuid, onDelete]);

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

  // Drag handlers
  const handleDragStart = useCallback((e: React.PointerEvent) => {
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

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaDays = Math.round(deltaX / cellWidth);

      // Mark as dragged if there's meaningful movement
      if (Math.abs(deltaDays) >= 1) {
        hasDraggedRef.current = true;
      }

      if (offsetRef.current !== deltaDays) {
        offsetRef.current = deltaDays;
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
          const daysToMove = deltaColumns * 7;
          const newStartDate = addDays(startDate, daysToMove);
          const newEndDate = addDays(endDate, daysToMove);

          if (hasTimeOffInRangeRef.current(newStartDate, newEndDate)) {
            setIsDragging(false);
            setDragOffset(0);
            hasDraggedRef.current = false;
            return;
          }

          onUpdate(assignment.uuid, { startDate: toLocalDateString(newStartDate), endDate: toLocalDateString(newEndDate) });
          setIsDragging(false);
          setDragOffset(0);
          hasDraggedRef.current = false;
          return;
        } else {
          let newStartIdx: number;
          let newEndIdx: number;

          if (startVisibleIdx >= 0) {
            newStartIdx = Math.max(0, Math.min(days.length - 1, startVisibleIdx + deltaColumns));
          } else {
            const daysToMove = deltaColumns;
            const newStartDate = addDays(startDate, daysToMove);
            newStartIdx = findCorrectVisibleIndex(newStartDate);

            if (newStartIdx < 0) {
              newStartIdx = newStartDate < days[0] ? 0 : days.length - 1;
            }
          }

          if (endVisibleIdx >= 0) {
            newEndIdx = Math.max(0, Math.min(days.length - 1, endVisibleIdx + deltaColumns));
          } else {
            const daysToMove = deltaColumns;
            const newEndDate = addDays(endDate, daysToMove);
            newEndIdx = findCorrectVisibleIndex(newEndDate);

            if (newEndIdx < 0) {
              newEndIdx = newEndDate < days[0] ? 0 : days.length - 1;
            }
          }

          let newStartDate = days[newStartIdx];
          let newEndDate = days[newEndIdx];

          if (!newStartDate || !newEndDate) {
            setIsDragging(false);
            setDragOffset(0);
            hasDraggedRef.current = false;
            return;
          }

          const dayOfWeek = newStartDate.getDay();
          if (dayOfWeek === 0) {
            newStartDate = addDays(newStartDate, 1);
          } else if (dayOfWeek === 6) {
            newStartDate = addDays(newStartDate, 2);
          }

          const endDayOfWeek = newEndDate.getDay();
          if (endDayOfWeek === 0) {
            newEndDate = addDays(newEndDate, 1);
          } else if (endDayOfWeek === 6) {
            newEndDate = addDays(newEndDate, 2);
          }

          if (hasTimeOffInRangeRef.current(newStartDate, newEndDate)) {
            setIsDragging(false);
            setDragOffset(0);
            hasDraggedRef.current = false;
            return;
          }

          onUpdate(assignment.uuid, { startDate: toLocalDateString(newStartDate), endDate: toLocalDateString(newEndDate) });
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
  }, [cellWidth, onUpdate, assignment.uuid, startDate, endDate, days, findVisibleIndex, findCorrectVisibleIndex, isWeekView]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            ref={blockRef}
            className={cn(
              "absolute rounded-md shadow-sm border text-xs text-white overflow-hidden flex items-center justify-between group",
              !isResizing && !isDragging && "transition-all duration-100 ease-out",
              isTimeOff && "bg-gray-500 opacity-80",
              isResizing && "cursor-col-resize ring-2 ring-green-400", // Ubah emerald ke green agar senada
              isDragging ? "cursor-grabbing opacity-70 ring-2 ring-green-400 scale-[1.01]" : "cursor-grab",
              isDeleting && "opacity-50 pointer-events-none animate-pulse",
              isUpdating && !isResizing && !isDragging && "opacity-80 ring-1 ring-green-300"
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
            data-testid="actual-assignment-block"
            data-assignment-uuid={assignment.uuid}
          >
            {/* Left resize handle */}
            <div
              data-resize-handle="left"
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

      <EditActualAssignmentDialog
        key={`${assignment.uuid}-${isEditDialogOpen ? "open" : "closed"}-${assignment.updatedAt}`}
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
