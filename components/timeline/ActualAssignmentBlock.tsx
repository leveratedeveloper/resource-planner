"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import { differenceInDays, startOfDay, format, addDays, isWithinInterval, startOfWeek } from "date-fns";
import { cn, toLocalDateString } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { EditActualAssignmentDialog } from "./EditActualAssignmentDialog";
import { getAssignmentBlockPosition, getAssignmentVisibleIndex } from "@/lib/timeline/assignment-positioning";

interface ActualAssignmentBlockProps {
  assignment: ActualAssignment;
  project?: ProjectOption;
  days: Date[];
  resourceRowHeight: number;
  cellWidth?: number;
  isWeekView?: boolean;
  isMonthRangeView?: boolean;
  onUpdate?: (uuid: string, updates: Partial<ActualAssignment>) => void;
  onDelete?: (uuid: string) => void;
  timeOffAssignments?: ActualAssignment[];
  isDeleting?: boolean;
  isUpdating?: boolean;
  disabled?: boolean;
  plannedHoursLimit?: number;
  currentActualHours?: number;
}

export const ActualAssignmentBlock: React.FC<ActualAssignmentBlockProps> = ({
  assignment,
  project,
  days,
  resourceRowHeight,
  cellWidth = 100,
  isWeekView = false,
  isMonthRangeView = false,
  onUpdate,
  onDelete,
  timeOffAssignments = [],
  isDeleting = false,
  isUpdating = false,
  disabled = false,
  plannedHoursLimit,
  currentActualHours,
}) => {
  const blockRef = useRef<HTMLDivElement>(null);

  // Resize state
  const [isResizing, setIsResizing] = useState<'left' | 'right' | null>(null);
  const [tempOffset, setTempOffset] = useState(0);

  // Weekend confirmation state - DITAMBAHKAN 'drag'
  const [showWeekendConfirm, setShowWeekendConfirm] = useState(false);
  const [pendingResize, setPendingResize] = useState<{
    edge: 'left' | 'right' | 'drag';
    newStartDate?: Date;
    newEndDate?: Date;
  } | null>(null);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);

  // Edit dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Track drag vs click
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

  const startDate = startOfDay(new Date(assignment.startDate));
  const endDate = startOfDay(new Date(assignment.endDate));
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

  const isWeekendDate = useCallback((date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  }, []);

  const findVisibleIndex = useCallback((date: Date) => {
    return getAssignmentVisibleIndex({
      date,
      days,
      isWeekView,
      isMonthRangeView,
    });
  }, [days, isMonthRangeView, isWeekView]);

  const findCorrectVisibleIndex = useCallback((date: Date) => {
    return getAssignmentVisibleIndex({
      date,
      days,
      isWeekView,
      isMonthRangeView,
    });
  }, [days, isMonthRangeView, isWeekView]);

  const hasTimeOffInRangeRef = useRef(hasTimeOffInRange);
  hasTimeOffInRangeRef.current = hasTimeOffInRange;

  const durationDays = differenceInDays(startDate, endDate) + 1;
  const blockPosition = getAssignmentBlockPosition({
    startDate,
    endDate,
    days,
    isWeekView,
    isMonthRangeView,
  });
  const startVisibleIdx = blockPosition?.startVisibleIdx ?? 0;
  const endVisibleIdx = blockPosition?.endVisibleIdx ?? 0;

  let displayOffset = startVisibleIdx >= 0 ? startVisibleIdx : 0;
  let displayDuration = endVisibleIdx >= 0 && startVisibleIdx >= 0
    ? (endVisibleIdx - startVisibleIdx + 1)
    : 1;

  if (isResizing === 'left') {
    displayOffset = displayOffset + tempOffset;
    displayDuration = displayDuration - tempOffset;
  } else if (isResizing === 'right') {
    displayDuration = displayDuration + tempOffset;
  } else if (isDragging) {
    displayOffset = displayOffset + dragOffset;
  }

  displayDuration = Math.max(1, displayDuration);

  const cellPercentage = 100 / Math.max(days.length, 1);
  const LEFT_OFFSET = `${displayOffset * cellPercentage}%`;
  const WIDTH = `${displayDuration * cellPercentage}%`;

  const isTimeOff = assignment.isTimeOff;
  const bgColor = isTimeOff ? "#6b7280" : "#16a34a";
  const displayName = isTimeOff ? "Time Off" : (project?.name || "Unknown Project");

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

  // Resize handlers
  const handleResizeStart = useCallback((edge: 'left' | 'right', e: React.PointerEvent) => {
    if (disabled) return;

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

            if (newStartDate && hasTimeOffInRangeRef.current(newStartDate, endDate)) {
              setIsResizing(null);
              setTempOffset(0);
              return;
            }

            if (newStartDate && newStartDate <= endDate) {
              if (!isWeekView && isWeekendDate(newStartDate)) {
                setPendingResize({ edge, newStartDate });
                setIsResizing(null);
                setTempOffset(0);
                setTimeout(() => setShowWeekendConfirm(true), 50); // Timeout agar tidak ketutup popovernya
                return;
              }

              onUpdate(assignment.uuid, { startDate: toLocalDateString(newStartDate) });
              setIsResizing(null);
              setTempOffset(0);
              return;
            }
          } else {
            const currentIdx = endVisibleIdx >= 0 ? endVisibleIdx : days.length - 1;
            const newIdx = Math.max(0, Math.min(days.length - 1, currentIdx + deltaColumns));
            const newEndDate = days[newIdx];

            if (newEndDate && hasTimeOffInRangeRef.current(startDate, newEndDate)) {
              setIsResizing(null);
              setTempOffset(0);
              return;
            }

            if (newEndDate && newEndDate >= startDate) {
              if (!isWeekView && isWeekendDate(newEndDate)) {
                setPendingResize({ edge, newEndDate });
                setIsResizing(null);
                setTempOffset(0);
                setTimeout(() => setShowWeekendConfirm(true), 50); // Timeout agar tidak ketutup popovernya
                return;
              }

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
  }, [disabled, cellWidth, onUpdate, assignment.uuid, startDate, endDate, days, findVisibleIndex, findCorrectVisibleIndex, isWeekView, isWeekendDate]);

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

  // Weekend confirmation handlers - DITAMBAHKAN 'drag'
  const handleWeekendConfirm = useCallback(() => {
    if (!pendingResize || !onUpdate) return;

    const { edge, newStartDate, newEndDate } = pendingResize;

    if (edge === 'left' && newStartDate) {
      onUpdate(assignment.uuid, { startDate: toLocalDateString(newStartDate) });
    } else if (edge === 'right' && newEndDate) {
      onUpdate(assignment.uuid, { endDate: toLocalDateString(newEndDate) });
    } else if (edge === 'drag' && newStartDate && newEndDate) {
      onUpdate(assignment.uuid, { startDate: toLocalDateString(newStartDate), endDate: toLocalDateString(newEndDate) });
    }

    setShowWeekendConfirm(false);
    setPendingResize(null);
  }, [pendingResize, onUpdate, assignment.uuid]);

  const handleWeekendCancel = useCallback(() => {
    setShowWeekendConfirm(false);
    setPendingResize(null);
  }, []);

  const handleBlockClick = useCallback((e: React.MouseEvent | React.PointerEvent) => {
    if (disabled) return;

    if (!hasDraggedRef.current && !hasResizedRef.current) {
      setIsEditDialogOpen(true);
    }
    hasDraggedRef.current = false;
    hasResizedRef.current = false;
  }, [disabled]);

  // Drag handlers
  const handleDragStart = useCallback((e: React.PointerEvent) => {
    if (disabled) return;

    const target = e.target as HTMLElement;
    if (target.closest('[data-resize-handle]')) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    try {
      target.setPointerCapture(e.pointerId);
    } catch (err) {
      console.warn('setPointerCapture failed:', err);
    }

    hasDraggedRef.current = false;
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };

    setIsDragging(true);
    setDragOffset(0);

    const startX = e.clientX;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaDays = Math.round(deltaX / cellWidth);

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

      const deltaX = upEvent.clientX - startX;
      const deltaColumns = Math.round(deltaX / cellWidth);

      if (deltaColumns !== 0 && onUpdate) {
        if (isWeekView) {
          const daysToMove = deltaColumns * 7;
          const newStartDate = addDays(startDate, daysToMove);
          const newEndDate = addDays(endDate, daysToMove);

          if (hasTimeOffInRangeRef.current(newStartDate, newEndDate)) {
            setIsDragging(false);
            setDragOffset(0);
            return;
          }

          onUpdate(assignment.uuid, { startDate: toLocalDateString(newStartDate), endDate: toLocalDateString(newEndDate) });
          setIsDragging(false);
          setDragOffset(0);
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
            return;
          }

          if (hasTimeOffInRangeRef.current(newStartDate, newEndDate)) {
            setIsDragging(false);
            setDragOffset(0);
            return;
          }

          // CEK WEEKEND SAAT DRAG
          if (!isWeekView && (isWeekendDate(newStartDate) || isWeekendDate(newEndDate))) {
            setPendingResize({ edge: 'drag', newStartDate, newEndDate });
            setIsDragging(false);
            setDragOffset(0);

            setTimeout(() => {
              setShowWeekendConfirm(true);
            }, 50);
            return;
          }

          onUpdate(assignment.uuid, { startDate: toLocalDateString(newStartDate), endDate: toLocalDateString(newEndDate) });
          setIsDragging(false);
          setDragOffset(0);
          return;
        }
      }

      setIsDragging(false);
      setDragOffset(0);

      // Reset ref supaya dialog tidak kebuka
      setTimeout(() => {
        hasDraggedRef.current = false;
        hasResizedRef.current = false;
      }, 150);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  }, [disabled, cellWidth, onUpdate, assignment.uuid, startDate, endDate, days, findVisibleIndex, findCorrectVisibleIndex, isWeekView, isWeekendDate]);

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              ref={blockRef}
              className={cn(
                "absolute rounded-md shadow-sm border text-xs text-white overflow-hidden flex items-center justify-between group",
                !isResizing && !isDragging && "transition-all duration-100 ease-out",
                isTimeOff && "bg-gray-500 opacity-80",
                isResizing && "cursor-col-resize ring-2 ring-green-400",
                isDragging ? "cursor-grabbing opacity-70 ring-2 ring-green-400 scale-[1.01]" : "cursor-grab",
                isDeleting && "opacity-50 pointer-events-none animate-pulse",
                isUpdating && !isResizing && !isDragging && "opacity-80 ring-1 ring-green-300",
                disabled && "pointer-events-none cursor-not-allowed opacity-90"
              )}
              style={{
                left: LEFT_OFFSET,
                width: WIDTH,
                backgroundColor: bgColor,
                top: -4,
                height: resourceRowHeight - 4,
                zIndex: isResizing || isDragging ? 40 : 10,
              }}
              onPointerDown={disabled ? undefined : handleDragStart}
              onClick={disabled ? undefined : handleBlockClick}
              data-testid="actual-assignment-block"
              data-assignment-uuid={assignment.uuid}
            >
              {/* Left resize handle - hide when disabled */}
              {!disabled && (
                <div
                  data-resize-handle="left"
                  className="absolute left-0 top-0 bottom-0 w-4 cursor-ew-resize opacity-100 bg-white/20 hover:bg-white/40 transition-all duration-150 z-40"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    handleResizeStart('left', e);
                  }}
                />
              )}

              {/* Content */}
              <div className="flex-1 px-2 py-1 min-w-0 pointer-events-none">
                <div className="font-bold truncate">
                  {isDeleting ? "Deleting..." : displayName}
                </div>
                <div className="truncate opacity-90">{hoursPerDay}h/day</div>
              </div>

              {/* Right resize handle - hide when disabled */}
              {!disabled && (
                <div
                  data-resize-handle="right"
                  className="absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize opacity-100 bg-white/20 hover:bg-white/40 transition-all duration-150 z-40"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    handleResizeStart('right', e);
                  }}
                />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent className="bg-slate-800 text-white border-slate-700 p-0 overflow-hidden shadow-xl max-w-xs">
            {disabled ? (
              <div className="p-3">
                <p className="font-semibold text-sm text-amber-400">You can only modify your own assignments</p>
              </div>
            ) : (
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
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* PINDAHKAN DIALOG KE SINI, DI LUAR TOOLTIP PROVIDER */}
      {!disabled && (
        <EditActualAssignmentDialog
          key={`${assignment.uuid}-${isEditDialogOpen ? "open" : "closed"}-${assignment.updatedAt}`}
          assignment={assignment}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onSave={handleSave}
          onDelete={handleDelete}
          isDeleting={isDeleting}
          plannedHoursLimit={plannedHoursLimit}
          currentActualHours={currentActualHours}
        />
      )}

      {/* Weekend confirmation popover */}
      {showWeekendConfirm && blockRef.current && (
        <Popover open={showWeekendConfirm} onOpenChange={setShowWeekendConfirm}>
          <PopoverAnchor
            virtualRef={{
              current: {
                getBoundingClientRect: () => blockRef.current!.getBoundingClientRect(),
              }
            }}
          />
          <PopoverContent side="bottom" align="center" className="w-64 p-4 z-[100]">
            <div className="text-center">
              <p className="text-sm mb-4">Schedule on a non-working day?</p>
              <div className="flex justify-center gap-3">
                <Button variant="ghost" size="sm" onClick={handleWeekendCancel}>
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleWeekendConfirm}
                  data-testid="weekend-resize-confirm"
                >
                  Schedule
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </>
  );
};
