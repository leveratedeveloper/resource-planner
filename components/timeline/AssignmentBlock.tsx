"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import { differenceInDays, startOfDay, format, addDays, startOfWeek, endOfWeek, differenceInWeeks, isBefore, isWithinInterval } from "date-fns";
import { cn } from "@/lib/utils";
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
import { EditAssignmentDialog } from "./EditAssignmentDialog";
import { getAssignmentBlockPosition, getAssignmentVisibleIndex } from "@/lib/timeline/assignment-positioning";
import {
  calculateAssignmentDisplayTotalHours,
  formatAssignmentDisplayHours,
} from "@/lib/timeline/assignment-display-hours";

interface AssignmentBlockProps {
  assignment: Assignment;
  project?: ProjectOption;  // Passed from parent for O(1) lookup
  days: Date[];
  resourceRowHeight: number;
  cellWidth?: number;
  isWeekView?: boolean; // true for quarter/halfYear/year views where each cell = 1 week
  isMonthRangeView?: boolean; // true when each cell represents a month
  onUpdate?: (id: string, updates: unknown) => void;
  onDelete?: (id: string) => void;
  timeOffAssignments?: Assignment[]; // Time-off assignments for this resource
  isDeleting?: boolean; // Show deleting state
  isUpdating?: boolean; // Show updating state (during drag/resize)
  showProjectName?: boolean; // Show project name in block (default: true, set false when already shown in row header)
  disabled?: boolean; // Disable all interactive features (click, resize, drag)
  isHighlighted?: boolean; // Emphasize blocks matching the active project or brand filter
  resizable?: boolean; // Allow resize handles and resize pointer behavior
}

export const AssignmentBlock: React.FC<AssignmentBlockProps> = ({
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
  isHighlighted = false,
  resizable = true,
}) => {
  const blockRef = useRef<HTMLDivElement>(null);

  const [isResizing, setIsResizing] = useState<'left' | 'right' | null>(null);
  const [tempOffset, setTempOffset] = useState(0);

  // Weekend confirmation state
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
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);

  const hasDraggedRef = useRef(false);
  const hasResizedRef = useRef(false);
  const mouseDownPosRef = useRef({ x: 0, y: 0 });

  const [isProcessing, setIsProcessing] = useState(false);

  const offsetRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

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
  const hasTimeOffOnDateRef = useRef(hasTimeOffOnDate);

  useEffect(() => {
    hasTimeOffInRangeRef.current = hasTimeOffInRange;
  }, [hasTimeOffInRange]);

  useEffect(() => {
    hasTimeOffOnDateRef.current = hasTimeOffOnDate;
  }, [hasTimeOffOnDate]);

  // Date calculations
  const startDate = startOfDay(new Date(assignment.startDate));
  const endDate = startOfDay(new Date(assignment.endDate));
  const timelineStart = startOfDay(days[0] ?? startDate);
  const timelineEnd = startOfDay(days[days.length - 1] ?? endDate);
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
  const bgColor = isTimeOff ? "#6b7280" : "#2563eb";
  const displayName = isTimeOff ? "Time Off" : (project?.name || "Unknown Project");

  const hoursPerDay = Number.parseFloat(assignment.hoursPerDay);
  const displayRange = { startDate: days[0] ?? startDate, endDate: days[days.length - 1] ?? endDate };
  const displayTotalHours = calculateAssignmentDisplayTotalHours(assignment, displayRange);
  const displayTotalHoursLabel = formatAssignmentDisplayHours(displayTotalHours);
  const formattedStartDate = format(startDate, "dd MMM");
  const formattedEndDate = format(endDate, "dd MMM");

  // Resize handlers
  const handleResizeStart = useCallback((edge: 'left' | 'right', e: React.PointerEvent) => {
    if (disabled) return; // Prevent resize when disabled
    if (!resizable) return;
    e.preventDefault();
    e.stopPropagation();
    setIsTooltipOpen(false);

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
    const startVisibleIdx = findVisibleIndex(startDate);
    const endVisibleIdx = findCorrectVisibleIndex(endDate);

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
            const newStartDate = addDays(startDate, daysToMove);
            if (hasTimeOffInRangeRef.current(newStartDate, endDate)) {
              setIsResizing(null);
              setTempOffset(0);
              return;
            }
            if (newStartDate <= endDate) {
              onUpdate(assignment.id, { startDate: newStartDate });
              setIsResizing(null);
              setTempOffset(0);
              return;
            }
          } else {
            const newEndDate = addDays(endDate, daysToMove);
            if (hasTimeOffInRangeRef.current(startDate, newEndDate)) {
              setIsResizing(null);
              setTempOffset(0);
              return;
            }
            if (newEndDate >= startDate) {
              onUpdate(assignment.id, { endDate: newEndDate });
              setIsResizing(null);
              setTempOffset(0);
              return;
            }
          }
        } else {
          // In day view
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

                // Tambahkan timeout agar tidak dicancel oleh native DOM click
                setTimeout(() => setShowWeekendConfirm(true), 50);
                return;
              }

              onUpdate(assignment.id, { startDate: newStartDate });
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

                // Tambahkan timeout agar tidak dicancel oleh native DOM click
                setTimeout(() => setShowWeekendConfirm(true), 50);
                return;
              }

              onUpdate(assignment.id, { endDate: newEndDate });
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
  }, [cellWidth, onUpdate, assignment.id, startDate, endDate, isWeekView, days, findVisibleIndex, findCorrectVisibleIndex, isWeekendDate, disabled, resizable]);

  // Edit dialog handlers
  const handleSave = useCallback((updates: Partial<Assignment>) => {
    if (onUpdate) onUpdate(assignment.id, updates);
    setIsEditDialogOpen(false);
  }, [assignment.id, onUpdate]);

  const handleDelete = useCallback(() => {
    if (onDelete) onDelete(assignment.id);
    setIsEditDialogOpen(false);
  }, [assignment.id, onDelete]);

  // Weekend confirmation handlers
  const handleWeekendConfirm = useCallback(() => {
    if (!pendingResize || !onUpdate) return;
    const { edge, newStartDate, newEndDate } = pendingResize;

    if (edge === 'left' && newStartDate) {
      onUpdate(assignment.id, { startDate: newStartDate });
    } else if (edge === 'right' && newEndDate) {
      onUpdate(assignment.id, { endDate: newEndDate });
    } else if (edge === 'drag' && newStartDate && newEndDate) {
      onUpdate(assignment.id, { startDate: newStartDate, endDate: newEndDate });
    }

    setShowWeekendConfirm(false);
    setPendingResize(null);
  }, [pendingResize, onUpdate, assignment.id]);

  const handleWeekendCancel = useCallback(() => {
    setShowWeekendConfirm(false);
    setPendingResize(null);
  }, []);

  // Click handler
  const handleBlockClick = useCallback((e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    if (disabled) return; // Prevent click when disabled
    setIsTooltipOpen(false);
    if (!hasDraggedRef.current && !hasResizedRef.current) {
      setIsEditDialogOpen(true);
    }
    // Setel ulang setelah dicek, agar popover tidak tertutup atau bentrok
    hasDraggedRef.current = false;
    hasResizedRef.current = false;
  }, [disabled]);

  // Drag to move handlers
  const handleDragStart = useCallback((e: React.PointerEvent) => {
    if (disabled) return; // Prevent drag when disabled
    const target = e.target as HTMLElement;
    if (target.closest('[data-resize-handle]')) return;

    e.preventDefault();
    e.stopPropagation();
    setIsTooltipOpen(false);

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
    const startVisibleIdx = findVisibleIndex(startDate);
    const endVisibleIdx = findCorrectVisibleIndex(endDate);

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

          onUpdate(assignment.id, { startDate: newStartDate, endDate: newEndDate });
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

          const newStartDate = days[newStartIdx];
          const newEndDate = days[newEndIdx];

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

            // Timeout penting di sini agar Popover tidak kena event auto-close browser!
            setTimeout(() => {
              setShowWeekendConfirm(true);
            }, 50);
            return;
          }

          onUpdate(assignment.id, { startDate: newStartDate, endDate: newEndDate });
          setIsDragging(false);
          setDragOffset(0);
          return;
        }
      }

      setIsDragging(false);
      setDragOffset(0);

      // Fallback reset hasDraggedRef kalau seandainya onClick tidak kepanggil
      setTimeout(() => {
        hasDraggedRef.current = false;
        hasResizedRef.current = false;
      }, 150);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  }, [cellWidth, onUpdate, assignment.id, startDate, endDate, days, findVisibleIndex, findCorrectVisibleIndex, isWeekView, isWeekendDate, disabled]);

  // Check if assignment overlaps with visible timeline range
  // If no overlap, don't render the block (prevents blocks appearing in wrong columns)
  if (startDate > timelineEnd || endDate < timelineStart) {
    return null;
  }

  return (
    <>
      <TooltipProvider>
        <Tooltip open={isEditDialogOpen || showWeekendConfirm ? false : isTooltipOpen} onOpenChange={setIsTooltipOpen}>
          <TooltipTrigger asChild>
            <div
              ref={blockRef}
              className={cn(
                "absolute rounded-md shadow-sm border text-xs text-white overflow-hidden flex items-center justify-between group",
                !isResizing && !isDragging && "transition-all duration-100 ease-out",
                isTimeOff && "bg-gray-500 opacity-80",
                isResizing && "cursor-col-resize ring-2 ring-blue-400",
                isDragging ? "cursor-grabbing opacity-70 ring-2 ring-blue-400 scale-[1.01]" : "cursor-grab",
                isDeleting && "opacity-50 pointer-events-none animate-pulse",
                isUpdating && !isResizing && !isDragging && "opacity-80 ring-1 ring-blue-300",
                isHighlighted && "ring-2 ring-amber-400 border-amber-200 shadow-md",
                disabled && "pointer-events-none cursor-not-allowed"
              )}
              style={{
                left: LEFT_OFFSET,
                width: WIDTH,
                backgroundColor: bgColor,
                top: 4,
                height: resourceRowHeight - 4,
                zIndex: isResizing || isDragging ? 40 : isHighlighted ? 20 : 10,
              }}
              onPointerDown={disabled ? undefined : handleDragStart}
              onClick={disabled ? undefined : handleBlockClick}
              data-testid="assignment-block"
              data-assignment-id={assignment.id}
            >
              {/* Left resize handle */}
              {!disabled && resizable && (
                <div
                  data-resize-handle="left"
                  data-testid="assignment-resize-left"
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
                <div className="truncate opacity-90">{displayTotalHoursLabel}</div>
              </div>

              {/* Right resize handle */}
              {!disabled && resizable && (
                <div
                  data-resize-handle="right"
                  data-testid="assignment-resize-right"
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
              <p>Plan mode - Full access only</p>
            ) : (
              <div className="p-3">
                <div className="font-semibold mb-1 text-sm">
                  Dates: <span className="font-normal text-slate-300">{formattedStartDate} - {formattedEndDate} ({durationDays} days)</span>
                </div>
                <div className="font-semibold mb-1 text-sm">
                  Total Effort: <span className="font-normal text-slate-300">{displayTotalHoursLabel} total @ {hoursPerDay}h/day</span>
                </div>
                {assignment.category && (
                  <div className="font-semibold text-sm">
                    Phase: <span className="font-normal text-slate-300">{assignment.category}</span>
                  </div>
                )}
                {assignment.note && (
                  <div className="mt-2 text-xs text-slate-400 italic border-t border-slate-700 pt-2 line-clamp-3 overflow-hidden">
                    &quot;{assignment.note}&quot;
                  </div>
                )}
              </div>
            )}
          </TooltipContent>
        </Tooltip>

        {!disabled && (
          <EditAssignmentDialog
            key={`${assignment.id}-${isEditDialogOpen ? "open" : "closed"}-${assignment.updatedAt}`}
            assignment={assignment}
            open={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            onSave={handleSave}
            onDelete={handleDelete}
            isDeleting={isDeleting}
          />
        )}
      </TooltipProvider>

      {/* Weekend confirmation popover */}
      {showWeekendConfirm && (
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
