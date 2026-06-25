"use client";

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function TimelineInitialSkeleton() {
  return (
    <div className="space-y-0">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex h-timeline-row border-b">
          <div className="sticky left-0 z-20 flex w-[var(--timeline-resource-col)] shrink-0 items-center gap-3 border-r bg-background p-2">
          <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <div className="flex-1 px-2 py-3">
            <Skeleton className="h-full w-full opacity-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TimelineEmptyState() {
  return <div className="p-8 text-center text-muted-foreground">No results found</div>;
}

export function TimelineRowLoadingCells({ dayCount }: { dayCount: number }) {
  return (
    <div className="timeline-grid h-timeline-row flex-1" data-testid="timeline-v2-loading-cells">
      {Array.from({ length: dayCount }).map((_, index) => (
        <div key={index} className="border-r bg-muted/20 p-2">
          <Skeleton className="h-full w-full opacity-40" />
        </div>
      ))}
    </div>
  );
}

export function TimelineExpandedSkeleton() {
  return (
    <div data-testid="timeline-v2-expanded-loading">
      {[1, 2].map((index) => (
        <div key={index} className="flex h-timeline-lane border-b">
          <div className="sticky left-0 z-20 flex h-full w-[var(--timeline-resource-col)] shrink-0 items-center gap-2 border-r bg-background pl-12 pr-3">
            <Skeleton className="h-3 w-3 rounded" />
            <Skeleton className="h-3 w-28" />
          </div>
          <div className="flex-1">
            <Skeleton className="h-full w-full opacity-20" />
          </div>
        </div>
      ))}
    </div>
  );
}
