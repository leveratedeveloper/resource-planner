"use client";

import React from "react";
import type { VirtualItem, Virtualizer } from "@tanstack/react-virtual";
import { ResourceRowV2 } from "@/components/timeline-v2/ResourceRowV2";
import type { TimelineV2Column, TimelineV2ResourceRow, TimelineV2ViewMode } from "@/lib/timeline-v2/types";
import { TimelineLoadingMoreV2 } from "@/components/timeline-v2/TimelineLoadingStatesV2";

type TimelineBodyV2Props = {
  bodyScrollRef: React.RefObject<HTMLDivElement | null>;
  onBodyScroll: () => void;
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  virtualRows: VirtualItem[];
  rows: TimelineV2ResourceRow[];
  columns: TimelineV2Column[];
  cellWidth: number;
  resourceColumnWidth: number;
  viewMode: TimelineV2ViewMode;
  showTimelineLoading: boolean;
  showExpandedLoading: boolean;
  canEditAssignments: boolean;
  onToggleExpanded: (resourceId: string) => void;
  onUpdatePlanned: (id: string, updates: unknown) => void;
  onDeletePlanned: (id: string) => void;
  onOpenPlannedCreate: (args: { resourceId: string; projectId: string; startDate: Date; endDate: Date }) => void;
  onOpenMonthlyAllocation: (args: {
    resourceId: string;
    monthStart: Date;
    monthEnd: Date;
    project: TimelineV2ResourceRow["campaignGroups"][number]["row"]["project"];
    resourceAssignments: TimelineV2ResourceRow["assignments"];
    clickedAssignment?: TimelineV2ResourceRow["assignments"][number];
    monthlyTotalHours?: number;
    planTotalHours?: number;
    adjustmentTotalHours?: number;
  }) => void;
  isFetchingNextEmployeePage?: boolean;
};

export function TimelineBodyV2({
  bodyScrollRef,
  onBodyScroll,
  rowVirtualizer,
  virtualRows,
  rows,
  columns,
  cellWidth,
  resourceColumnWidth,
  viewMode,
  showTimelineLoading,
  showExpandedLoading,
  canEditAssignments,
  onToggleExpanded,
  onUpdatePlanned,
  onDeletePlanned,
  onOpenPlannedCreate,
  onOpenMonthlyAllocation,
  isFetchingNextEmployeePage,
}: TimelineBodyV2Props) {
  return (
    <div ref={bodyScrollRef} onScroll={onBodyScroll} className="flex-1 overflow-auto">
      <div className="flex w-full flex-col">
        <div className="relative w-full" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
          {virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index];
            if (!row) return null;

            return (
              <div
                key={`${row.id}:${virtualRow.index}`}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                className="absolute left-0 top-0 w-full"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                <ResourceRowV2
                  row={row}
                  columns={columns}
                  resourceColumnWidth={resourceColumnWidth}
                  cellWidth={cellWidth}
                  viewMode={viewMode}
                  showTimelineLoading={showTimelineLoading}
                  showExpandedLoading={showExpandedLoading}
                  canEditAssignments={canEditAssignments}
                  onToggleExpanded={onToggleExpanded}
                  onUpdatePlanned={onUpdatePlanned}
                  onDeletePlanned={onDeletePlanned}
                  onOpenPlannedCreate={onOpenPlannedCreate}
                  onOpenMonthlyAllocation={onOpenMonthlyAllocation}
                />
              </div>
            );
          })}
          {isFetchingNextEmployeePage ? <TimelineLoadingMoreV2 /> : null}
        </div>
      </div>
    </div>
  );
}
