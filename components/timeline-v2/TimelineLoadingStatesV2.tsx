"use client";

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function TimelineInitialSkeletonV2() {
  return (
    <div className="space-y-0">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex border-b">
          <div className="sticky left-0 z-20 flex shrink-0 items-center gap-3 border-r bg-background p-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <div className="flex-1 px-2 py-4">
            <Skeleton className="h-full w-full opacity-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TimelineEmptyStateV2() {
  return <div className="p-8 text-center text-muted-foreground">No results found</div>;
}

export function TimelineLoadingMoreV2() {
  return <div className="border-b bg-background p-4 text-sm text-muted-foreground">Loading more employees...</div>;
}

export function TimelineRowLoadingCellsV2({ width, height, dayCount }: { width: number; height: number; dayCount: number }) {
  return (
    <div className="flex relative" style={{ width, height }} data-testid="timeline-v2-loading-cells">
      {Array.from({ length: dayCount }).map((_, index) => (
        <div key={index} className="shrink-0 border-r bg-muted/20 p-2" style={{ width: width / Math.max(dayCount, 1), height }}>
          <Skeleton className="h-full w-full opacity-40" />
        </div>
      ))}
    </div>
  );
}

export function TimelineExpandedSkeletonV2({ width }: { width: number }) {
  return (
    <div data-testid="timeline-v2-expanded-loading">
      {[1, 2].map((index) => (
        <React.Fragment key={index}>
          <div className="flex border-b bg-muted/30" style={{ height: 28 }}>
            <div className="sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r bg-muted/30 px-4 pl-12" style={{ width, height: 28 }}>
              <Skeleton className="h-3.5 w-3.5 rounded" />
              <Skeleton className="h-3 w-32" />
            </div>
            <div className="flex-1">
              <Skeleton className="h-full w-full opacity-20" />
            </div>
          </div>
          <div className="flex border-b" style={{ height: 34 }}>
            <div className="sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r bg-background px-4 py-1.5 pl-16" style={{ width, height: 34 }}>
              <Skeleton className="h-3 w-3 rounded" />
              <div className="flex flex-col gap-1">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-2.5 w-20" />
              </div>
            </div>
            <div className="flex-1">
              <Skeleton className="h-full w-full opacity-20" />
            </div>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}
