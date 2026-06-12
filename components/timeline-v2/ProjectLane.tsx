"use client";

import React from "react";
import { Icon } from "@iconify/react";
import { endOfMonth, startOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { AssignmentBar } from "@/components/timeline-v2/AssignmentBar";
import { DraggableTimelineCell } from "@/components/timeline/DraggableTimelineCell";
import { calculateAssignmentDisplayTotalHours } from "@/lib/timeline/assignment-display-hours";
import { TIMELINE_DIMENSIONS } from "@/lib/timeline-v2/layout";
import type { OrderedProjectLane } from "@/lib/timeline-v2/lane-order";
import type { EmployeeRowModel, ProjectLaneModel } from "@/lib/timeline-v2/row-model";
import type { TimelineV2Column, TimelineV2ViewMode } from "@/lib/timeline-v2/types";

function buildSegmentAssignment(
  segment: ProjectLaneModel["planDisplaySegments"][number]
) {
  return {
    ...segment.sourceAssignment,
    startDate: segment.startDate,
    endDate: segment.endDate,
  };
}

function calculateMonthlyHours(assignments: EmployeeRowModel["assignments"], monthStart: Date, monthEnd: Date) {
  return assignments.reduce((sum, assignment) => {
    if (assignment.isTimeOff) return sum;
    const range = { startDate: monthStart, endDate: monthEnd };
    return sum + calculateAssignmentDisplayTotalHours(assignment, range);
  }, 0);
}

type ProjectLaneProps = {
  lane: OrderedProjectLane<ProjectLaneModel>;
  resourceId: string;
  resourceAssignments: EmployeeRowModel["assignments"];
  columns: TimelineV2Column[];
  // Interim px width for the legacy drag-create cells; dies with them in Phase 5.
  cellWidth: number;
  viewMode: TimelineV2ViewMode;
  canEditAssignments: boolean;
  onUpdatePlanned: (id: string, updates: unknown) => void;
  onDeletePlanned: (id: string) => void;
  onOpenPlannedCreate: (args: { resourceId: string; projectId: string; startDate: Date; endDate: Date }) => void;
  onOpenMonthlyAllocation: (args: {
    resourceId: string;
    monthStart: Date;
    monthEnd: Date;
    project: ProjectLaneModel["project"];
    resourceAssignments: EmployeeRowModel["assignments"];
    clickedAssignment?: EmployeeRowModel["assignments"][number];
    monthlyTotalHours?: number;
    planTotalHours?: number;
    adjustmentTotalHours?: number;
  }) => void;
};

export const ProjectLane = React.memo(function ProjectLane({
  lane,
  resourceId,
  resourceAssignments,
  columns,
  cellWidth,
  viewMode,
  canEditAssignments,
  onUpdatePlanned,
  onDeletePlanned,
  onOpenPlannedCreate,
  onOpenMonthlyAllocation,
}: ProjectLaneProps) {
  const campaign = lane.project;
  const brand = lane.brand;
  const monthRangeView = viewMode === "quarter" || viewMode === "halfYear" || viewMode === "year";
  const projectDays = columns.map((item) => item.date);

  const monthClickHandler = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!monthRangeView || !canEditAssignments) return;
    // Pointer math measures the lane rect (DESIGN.md §2.1) instead of consuming
    // a pixel constant.
    const containerRect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - containerRect.left;
    const columnWidth = containerRect.width / Math.max(columns.length, 1);
    const index = Math.max(0, Math.min(columns.length - 1, Math.floor(x / columnWidth)));
    const clickedMonth = columns[index]?.date ?? columns[0]?.date;
    const monthStart = startOfMonth(clickedMonth);
    const monthEnd = endOfMonth(monthStart);
    const projectAssignments = resourceAssignments.filter((assignment) => assignment.projectId === campaign.id);
    const monthlyTotalHours = calculateMonthlyHours(projectAssignments, monthStart, monthEnd);
    const adjustmentTotalHours = calculateMonthlyHours(
      projectAssignments.filter((assignment) => assignment.isAdjustment),
      monthStart,
      monthEnd
    );
    onOpenMonthlyAllocation({
      resourceId,
      monthStart,
      monthEnd,
      project: campaign,
      resourceAssignments,
      clickedAssignment: lane.planAssignments[0],
      monthlyTotalHours,
      planTotalHours: monthlyTotalHours - adjustmentTotalHours,
      adjustmentTotalHours,
    });
  };

  return (
    <div
      className={cn("flex h-timeline-lane border-b bg-blue-50/10", lane.isHighlighted && "bg-amber-50/70")}
      data-testid="resource-row-v2-campaign-row"
    >
      <div
        className={cn(
          "sticky left-0 z-20 flex h-full w-[var(--timeline-resource-col)] shrink-0 items-center gap-2 border-r bg-background pl-12 pr-3",
          lane.isHighlighted && "bg-amber-50/90"
        )}
        data-testid="resource-row-v2-campaign-label"
        onClick={(event) => event.stopPropagation()}
        title={brand?.name ? `${campaign.name} · ${brand.name}` : campaign.name}
      >
        <Icon icon="lucide:package" className={cn("h-3.5 w-3.5 shrink-0", lane.isHighlighted ? "text-amber-600" : "text-blue-600")} />
        <div className="min-w-0">
          <div className={cn("truncate text-xs font-bold uppercase tracking-wider", lane.isHighlighted ? "text-amber-800" : "text-blue-800")}>{campaign.name}</div>
          {brand?.name ? (
            <div className="truncate text-[10px] text-muted-foreground">{brand.name}</div>
          ) : null}
        </div>
      </div>

      {/* Click handler lives on the canvas (not the row) so the rect math sees
          only the column area — the resource label must not shift the index. */}
      <div className="relative h-full flex-1" onClick={monthRangeView ? monthClickHandler : undefined}>
        {!monthRangeView ? (
          <div className="flex h-full">
            {columns.map((column, dayIndex) => (
              <DraggableTimelineCell
                key={`${lane.projectId}-${column.id}-plan-cell`}
                day={column.date}
                projectId={campaign.id}
                projectColor={campaign.color}
                days={projectDays}
                cellWidth={cellWidth}
                cellHeight={TIMELINE_DIMENSIONS.lane}
                disabled={!canEditAssignments}
                isDragging={false}
                isInDragRange={false}
                onDragComplete={(startDay, endDay) => {
                  if (!canEditAssignments) return;
                  onOpenPlannedCreate({
                    resourceId,
                    projectId: campaign.id,
                    startDate: startDay,
                    endDate: endDay,
                  });
                }}
                onMouseDown={() => {
                  if (!canEditAssignments) return;
                  const date = columns[Math.max(0, Math.min(dayIndex, columns.length - 1))].date;
                  onOpenPlannedCreate({
                    resourceId,
                    projectId: campaign.id,
                    startDate: date,
                    endDate: date,
                  });
                }}
              />
            ))}
          </div>
        ) : null}
        {lane.planDisplaySegments.map((segment) => (
          <AssignmentBar
            key={segment.id}
            assignment={buildSegmentAssignment(segment)}
            project={campaign}
            columns={columns}
            resolution={monthRangeView ? "month" : "day"}
            interactive={!monthRangeView}
            isHighlighted={lane.isHighlighted}
            disabled={!canEditAssignments}
            onUpdate={onUpdatePlanned}
            onDelete={onDeletePlanned}
          />
        ))}
      </div>
    </div>
  );
});
