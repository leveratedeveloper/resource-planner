"use client";

import React from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { TimelineV2Column } from "@/lib/timeline-v2/types";

type TimelineHeaderV2Props = {
  columns: TimelineV2Column[];
  cellWidth: number;
  resourceColumnWidth: number;
  headerScrollRef: React.RefObject<HTMLDivElement | null>;
  onHeaderScroll: () => void;
  onResourceColumnResizeStart: (event: React.PointerEvent<HTMLDivElement>) => void;
};

export function TimelineHeaderV2({
  columns,
  cellWidth,
  resourceColumnWidth,
  headerScrollRef,
  onHeaderScroll,
  onResourceColumnResizeStart,
}: TimelineHeaderV2Props) {
  return (
    <div className="sticky top-0 z-10 flex border-b bg-muted/40">
      <div
        className="relative shrink-0 border-r bg-background p-4 font-semibold"
        style={{ width: resourceColumnWidth }}
      >
        Resources
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize resources column"
          className="absolute right-0 top-0 h-full w-2 translate-x-1 cursor-col-resize touch-none"
          onPointerDown={onResourceColumnResizeStart}
        >
          <div className="mx-auto h-full w-px bg-border transition-colors hover:bg-primary/60" />
        </div>
      </div>
      <div
        ref={headerScrollRef}
        onScroll={onHeaderScroll}
        className="flex-1 overflow-x-auto scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        tabIndex={0}
        aria-label="Timeline day headers"
      >
        <div className="flex relative" style={{ width: `${columns.length * cellWidth}px` }}>
          {columns.map((column) => (
            <div
              key={column.id}
              className={cn(
                "relative shrink-0 border-r text-center text-sm",
                column.kind === "month" ? "p-4" : "p-2",
                column.isWeekend && column.kind === "day" ? "bg-muted/50" : "bg-background",
                column.isToday && "border-b-2 border-b-primary bg-muted/30",
                column.isCurrentMonth && column.kind === "month" && "border-b-2 border-b-primary bg-muted/30"
              )}
              style={{ width: `${cellWidth}px` }}
              data-testid="timeline-v2-day-cell"
              data-date={format(column.date, "yyyy-MM-dd")}
              data-weekend={String(column.isWeekend)}
              data-today={String(column.isToday)}
            >
              {column.kind === "month" ? (
                <div className="flex flex-col justify-center">
                  <div className="font-semibold">{column.label}</div>
                </div>
              ) : (
                <div className="flex flex-col">
                  <div className="font-semibold">{column.label}</div>
                  <div className="text-muted-foreground">{column.subLabel}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
