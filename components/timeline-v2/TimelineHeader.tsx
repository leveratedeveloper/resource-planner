"use client";

import React, { useCallback } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useTimelineViewStore } from "@/lib/timeline-v2/view-store";
import type { TimelineColumn } from "@/lib/timeline-v2/types";

type TimelineHeaderProps = {
  columns: TimelineColumn[];
};

// Sticky date strip inside the single scroll container — it shares the
// timeline-grid template with every row, so alignment holds by construction.
export const TimelineHeader = React.memo(function TimelineHeader({ columns }: TimelineHeaderProps) {
  const setResourceColumnWidth = useTimelineViewStore((state) => state.setResourceColumnWidth);

  const handleResizeStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      const startX = event.clientX;
      const startWidth = useTimelineViewStore.getState().resourceColumnWidth;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        setResourceColumnWidth(startWidth + moveEvent.clientX - startX);
      };

      const handlePointerUp = () => {
        document.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerup", handlePointerUp);
      };

      document.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("pointerup", handlePointerUp);
    },
    [setResourceColumnWidth]
  );

  return (
    <div className="sticky top-0 z-30 flex h-timeline-header border-b bg-muted/40">
      <div
        className="relative flex h-full w-[var(--timeline-resource-col)] shrink-0 items-center border-r bg-background px-4 font-semibold"
      >
        Resources
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize resources column"
          className="absolute right-0 top-0 h-full w-2 translate-x-1 cursor-col-resize touch-none"
          onPointerDown={handleResizeStart}
        >
          <div className="mx-auto h-full w-px bg-border transition-colors hover:bg-primary/60" />
        </div>
      </div>
      <div className="timeline-grid flex-1" aria-label="Timeline day headers">
        {columns.map((column) => (
          <div
            key={column.id}
            className={cn(
              "flex h-full flex-col items-center justify-center overflow-hidden border-r text-center text-xs",
              column.isWeekend && column.kind === "day" ? "bg-muted/50" : "bg-background",
              column.isToday && "border-b-2 border-b-primary bg-muted/30",
              column.isCurrentMonth && column.kind === "month" && "border-b-2 border-b-primary bg-muted/30"
            )}
            data-testid="timeline-v2-day-cell"
            data-date={format(column.date, "yyyy-MM-dd")}
            data-weekend={String(column.isWeekend)}
            data-today={String(column.isToday)}
          >
            {column.kind === "month" ? (
              <div className="text-sm font-semibold">{column.label}</div>
            ) : (
              <>
                <div className="font-semibold">{column.label}</div>
                <div className="text-muted-foreground">{column.subLabel}</div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});
