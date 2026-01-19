"use client";

import React, { useState, useRef, useCallback } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";

interface DraggableTimelineCellProps {
  day: Date;
  projectId: string;
  projectColor: string;
  onDragComplete: (startDay: Date, endDay: Date, position: { x: number; y: number }) => void;
  days: Date[];
  cellWidth?: number;
  cellHeight?: number;
}

export const DraggableTimelineCell: React.FC<DraggableTimelineCellProps> = ({
  day,
  projectId,
  projectColor,
  onDragComplete,
  days,
  cellWidth = 100,
  cellHeight = 60,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const cellRef = useRef<HTMLDivElement>(null);
  const dragStartIndex = useRef<number | null>(null);
  const [dragEndIndex, setDragEndIndex] = useState<number | null>(null);

  const dayIndex = days.findIndex((d) => d.toISOString() === day.toISOString());

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
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
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [dayIndex, days, onDragComplete, dragEndIndex, cellWidth]
  );

  // Calculate if this cell is in the drag range
  const isInDragRange = useCallback(() => {
    if (!isDragging || dragStartIndex.current === null || dragEndIndex === null) return false;
    const start = Math.min(dragStartIndex.current, dragEndIndex);
    const end = Math.max(dragStartIndex.current, dragEndIndex);
    return dayIndex >= start && dayIndex <= end;
  }, [isDragging, dayIndex, dragEndIndex]);

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

