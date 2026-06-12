"use client";

import React from "react";
import type { VirtualItem, Virtualizer } from "@tanstack/react-virtual";
import { ResourceRowV2 } from "@/components/timeline-v2/ResourceRowV2";
import type { EmployeeRowModel } from "@/lib/timeline-v2/row-model";
import type { TimelineV2Column, TimelineV2ViewMode } from "@/lib/timeline-v2/types";
import { TimelineLoadingMoreV2 } from "@/components/timeline-v2/TimelineLoadingStatesV2";

type TimelineBodyV2Props = {
  bodyScrollRef: React.RefObject<HTMLDivElement | null>;
  onBodyScroll: () => void;
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  virtualRows: VirtualItem[];
  visibleIds: string[];
  rowModels: Map<string, EmployeeRowModel>;
  columns: TimelineV2Column[];
  cellWidth: number;
  resourceColumnWidth: number;
  viewMode: TimelineV2ViewMode;
  showTimelineLoading: boolean;
  showExpandedLoading: boolean;
  canEditAssignments: boolean;
  brandId: string | null;
  projectId: string | null;
  onUpdatePlanned: (id: string, updates: unknown) => void;
  onDeletePlanned: (id: string) => void;
  onOpenPlannedCreate: (args: { resourceId: string; projectId: string; startDate: Date; endDate: Date }) => void;
  onOpenMonthlyAllocation: (args: {
    resourceId: string;
    monthStart: Date;
    monthEnd: Date;
    project: EmployeeRowModel["projectLanes"][number]["project"];
    resourceAssignments: EmployeeRowModel["assignments"];
    clickedAssignment?: EmployeeRowModel["assignments"][number];
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
  visibleIds,
  rowModels,
  columns,
  cellWidth,
  resourceColumnWidth,
  viewMode,
  showTimelineLoading,
  showExpandedLoading,
  canEditAssignments,
  brandId,
  projectId,
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
            const rowId = visibleIds[virtualRow.index];
            const row = rowId ? rowModels.get(rowId) : undefined;
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
                  brandId={brandId}
                  projectId={projectId}
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
