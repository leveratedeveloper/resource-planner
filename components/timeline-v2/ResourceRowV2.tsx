"use client";

import React, { useMemo } from "react";
import { Icon } from "@iconify/react";
import { endOfMonth, startOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { AssignmentBlockV2 } from "@/components/timeline-v2/AssignmentBlockV2";
import { AllocationCellV2 } from "@/components/timeline-v2/AllocationCellV2";
import { ResourceIdentityCellV2 } from "@/components/timeline-v2/ResourceIdentityCellV2";
import { TimelineExpandedSkeletonV2, TimelineRowLoadingCellsV2 } from "@/components/timeline-v2/TimelineLoadingStatesV2";
import { DraggableTimelineCell } from "@/components/timeline/DraggableTimelineCell";
import type { TimelineV2Column, TimelineV2ResourceRow, TimelineV2ViewMode } from "@/lib/timeline-v2/types";

const RESOURCE_SUMMARY_ROW_HEIGHT = 48;
const TIME_OFF_ROW_HEIGHT = 32;
const CAMPAIGN_ROW_HEIGHT = 34;

type ResourceRowV2Props = {
  row: TimelineV2ResourceRow;
  columns: TimelineV2Column[];
  resourceColumnWidth: number;
  cellWidth: number;
  viewMode: TimelineV2ViewMode;
  showTimelineLoading: boolean;
  showExpandedLoading: boolean;
  canEditAssignments: boolean;
  onToggleExpanded: (resourceId: string) => void;
  onUpdatePlanned: (id: string, updates: unknown) => void;
  onDeletePlanned: (id: string) => void;
  onOpenPlannedCreate: (args: { resourceId: string; projectId: string; startDate: Date; endDate: Date }) => void;
  onOpenTimeOffCreate: (args: { resourceId: string; startDate: Date; endDate: Date }) => void;
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
};

function isMonthRangeView(viewMode: TimelineV2ViewMode) {
  return viewMode === "quarter" || viewMode === "halfYear" || viewMode === "year";
}

function isWeekView(viewMode: TimelineV2ViewMode) {
  return viewMode === "week";
}

function countWeekdays(start: Date, end: Date) {
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count += 1;
    current.setDate(current.getDate() + 1);
  }
  return Math.max(1, count);
}

function calculateMonthlyHours(assignments: TimelineV2ResourceRow["assignments"], monthStart: Date, monthEnd: Date) {
  return assignments.reduce((sum, assignment) => {
    if (assignment.isTimeOff) return sum;
    const assignStart = new Date(assignment.startDate);
    const assignEnd = new Date(assignment.endDate);
    const overlapStart = assignStart > monthStart ? assignStart : monthStart;
    const overlapEnd = assignEnd < monthEnd ? assignEnd : monthEnd;
    if (overlapStart > overlapEnd) return sum;
    return sum + Number.parseFloat(assignment.hoursPerDay || "0") * countWeekdays(overlapStart, overlapEnd);
  }, 0);
}

export const ResourceRowV2 = React.memo(function ResourceRowV2({
  row,
  columns,
  resourceColumnWidth,
  cellWidth,
  viewMode,
  showTimelineLoading,
  showExpandedLoading,
  canEditAssignments,
  onToggleExpanded,
  onUpdatePlanned,
  onDeletePlanned,
  onOpenPlannedCreate,
  onOpenTimeOffCreate,
  onOpenMonthlyAllocation,
}: ResourceRowV2Props) {
  const isExpanded = row.isExpanded;
  const weekView = isWeekView(viewMode);
  const monthRangeView = isMonthRangeView(viewMode);
  const projectDays = useMemo(() => columns.map((item) => item.date), [columns]);

  return (
    <div className="relative z-0 border-b" data-testid="resource-row-v2" data-resource-id={row.resource.id}>
      <div className="flex hover:bg-accent/5 transition-colors group" style={{ height: RESOURCE_SUMMARY_ROW_HEIGHT }}>
        <ResourceIdentityCellV2
          name={row.resource.name}
          role={row.resource.role}
          department={row.resource.department}
          resourceColumnWidth={resourceColumnWidth}
          height={RESOURCE_SUMMARY_ROW_HEIGHT}
          expanded={isExpanded}
          onToggleExpanded={() => onToggleExpanded(row.resource.id)}
        />
        {showTimelineLoading ? (
          <TimelineRowLoadingCellsV2 width={columns.length * cellWidth} height={RESOURCE_SUMMARY_ROW_HEIGHT} dayCount={columns.length} />
        ) : (
          <div className="flex relative" style={{ width: `${columns.length * cellWidth}px`, height: RESOURCE_SUMMARY_ROW_HEIGHT }}>
            {columns.map((column) => (
              <AllocationCellV2
                key={column.id}
                day={column.date}
                resource={row.resource}
                assignments={row.assignments}
                actualAssignments={row.actualAssignments}
                cellWidth={cellWidth}
                height={RESOURCE_SUMMARY_ROW_HEIGHT}
                isWeekView={weekView}
                isMonthRangeView={monthRangeView}
              />
            ))}
          </div>
        )}
      </div>

      {isExpanded ? (
        <div>
          <div className="flex bg-gray-50/50" style={{ height: TIME_OFF_ROW_HEIGHT }} data-testid="resource-row-v2-timeoff-row">
            <div className="sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r bg-gray-50/50 pl-12" style={{ width: resourceColumnWidth, height: TIME_OFF_ROW_HEIGHT }}>
              <Icon icon="lucide:calendar-off" className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600">Time Off</span>
            </div>
            {showTimelineLoading ? (
              <TimelineRowLoadingCellsV2 width={columns.length * cellWidth} height={TIME_OFF_ROW_HEIGHT} dayCount={columns.length} />
            ) : (
              <div className="relative flex" style={{ width: `${columns.length * cellWidth}px`, height: TIME_OFF_ROW_HEIGHT }}>
                {!monthRangeView ? (
                  columns.map((column) => (
                    <DraggableTimelineCell
                      key={column.id}
                      day={column.date}
                      projectId=""
                      projectColor="#6b7280"
                      days={columns.map((item) => item.date)}
                      cellWidth={cellWidth}
                      cellHeight={TIME_OFF_ROW_HEIGHT}
                      isTimeOffMode
                      disabled={!canEditAssignments}
                      onDragComplete={(startDay, endDay) => {
                        if (!canEditAssignments) return;
                        onOpenTimeOffCreate({ resourceId: row.resource.id, startDate: startDay, endDate: endDay });
                      }}
                      onMouseDown={(dayIndex) => {
                        if (!canEditAssignments) return;
                        const date = columns[Math.max(0, Math.min(dayIndex, columns.length - 1))].date;
                        onOpenTimeOffCreate({
                          resourceId: row.resource.id,
                          startDate: date,
                          endDate: date,
                        });
                      }}
                      rowType="plan"
                    />
                  ))
                ) : null}
                {row.timeOffAssignments.map((assignment) => (
                  <AssignmentBlockV2
                    key={assignment.id}
                    kind="timeOff"
                    assignment={assignment}
                    project={undefined}
                    days={columns.map((item) => item.date)}
                    resourceRowHeight={TIME_OFF_ROW_HEIGHT}
                    cellWidth={cellWidth}
                    isWeekView={weekView}
                    isMonthRangeView={monthRangeView}
                    onUpdate={onUpdatePlanned}
                    onDelete={onDeletePlanned}
                    disabled={!canEditAssignments}
                    isUpdating={false}
                    isDeleting={false}
                    timeOffAssignments={row.timeOffAssignments}
                  />
                ))}
              </div>
            )}
          </div>

            {showExpandedLoading ? (
            <TimelineExpandedSkeletonV2 width={resourceColumnWidth} />
          ) : (
            row.campaignGroups.map((group) => {
              const campaign = group.row.project;
              const brand = group.row.brand;
              const monthClickHandler = (event: React.MouseEvent<HTMLDivElement>) => {
                if (!monthRangeView || !canEditAssignments) return;
                const containerRect = event.currentTarget.getBoundingClientRect();
                const x = event.clientX - containerRect.left;
                const index = Math.max(0, Math.min(columns.length - 1, Math.floor(x / cellWidth)));
                const clickedMonth = columns[index]?.date ?? columns[0]?.date;
                const monthStart = startOfMonth(clickedMonth);
                const monthEnd = endOfMonth(monthStart);
                const projectAssignments = row.assignments.filter((assignment) => assignment.projectId === campaign.id);
                const monthlyTotalHours = calculateMonthlyHours(projectAssignments, monthStart, monthEnd);
                const adjustmentTotalHours = calculateMonthlyHours(
                  projectAssignments.filter((assignment) => assignment.isAdjustment),
                  monthStart,
                  monthEnd
                );
                onOpenMonthlyAllocation({
                  resourceId: row.resource.id,
                  monthStart,
                  monthEnd,
                  project: campaign,
                  resourceAssignments: row.assignments,
                  clickedAssignment: group.row.planAssignments[0],
                  monthlyTotalHours,
                  planTotalHours: monthlyTotalHours - adjustmentTotalHours,
                  adjustmentTotalHours,
                });
              };

              return (
                <div
                  key={group.id}
                  className={cn("flex border-b bg-blue-50/10", group.isHighlighted && "bg-amber-50/70")}
                  style={{ height: CAMPAIGN_ROW_HEIGHT }}
                  data-testid="resource-row-v2-campaign-row"
                  onClick={monthRangeView ? monthClickHandler : undefined}
                >
                  <div
                    className={cn(
                      "sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r bg-background pl-12 pr-3",
                      group.isHighlighted && "bg-amber-50/90"
                    )}
                    style={{ width: resourceColumnWidth, height: CAMPAIGN_ROW_HEIGHT }}
                    data-testid="resource-row-v2-campaign-label"
                    onClick={(event) => event.stopPropagation()}
                    title={brand?.name || group.brandName ? `${campaign.name} · ${brand?.name || group.brandName}` : campaign.name}
                  >
                    <Icon icon="lucide:package" className={cn("h-3.5 w-3.5 shrink-0", group.isHighlighted ? "text-amber-600" : "text-blue-600")} />
                    <div className="min-w-0">
                      <div className={cn("truncate text-xs font-bold uppercase tracking-wider", group.isHighlighted ? "text-amber-800" : "text-blue-800")}>{campaign.name}</div>
                      {brand?.name || group.brandName ? (
                        <div className="truncate text-[10px] text-muted-foreground">{brand?.name || group.brandName}</div>
                      ) : null}
                    </div>
                  </div>

                  <div className="relative flex" style={{ width: `${columns.length * cellWidth}px`, height: CAMPAIGN_ROW_HEIGHT }}>
                    {!monthRangeView ? columns.map((column) => (
                      <DraggableTimelineCell
                        key={`${group.id}-${column.id}-plan-cell`}
                        day={column.date}
                        projectId={campaign.id}
                        projectColor={campaign.color}
                        days={projectDays}
                        cellWidth={cellWidth}
                        cellHeight={CAMPAIGN_ROW_HEIGHT}
                        timeOffAssignments={row.timeOffAssignments}
                        disabled={!canEditAssignments}
                        isDragging={false}
                        isInDragRange={false}
                        onDragComplete={(startDay, endDay) => {
                          if (!canEditAssignments) return;
                          onOpenPlannedCreate({
                            resourceId: row.resource.id,
                            projectId: campaign.id,
                            startDate: startDay,
                            endDate: endDay,
                          });
                        }}
                        onMouseDown={(dayIndex) => {
                          if (!canEditAssignments) return;
                          const date = columns[Math.max(0, Math.min(dayIndex, columns.length - 1))].date;
                          onOpenPlannedCreate({
                            resourceId: row.resource.id,
                            projectId: campaign.id,
                            startDate: date,
                            endDate: date,
                          });
                        }}
                        rowType="plan"
                      />
                    )) : null}
                    {group.row.planAssignments.map((assignment) => (
                      <AssignmentBlockV2
                        key={assignment.id}
                        kind="plan"
                        assignment={assignment}
                        project={campaign}
                        days={projectDays}
                        resourceRowHeight={CAMPAIGN_ROW_HEIGHT}
                        cellWidth={cellWidth}
                        isWeekView={weekView}
                        isMonthRangeView={monthRangeView}
                        onUpdate={onUpdatePlanned}
                        onDelete={onDeletePlanned}
                        disabled={!canEditAssignments}
                        isHighlighted={group.isHighlighted}
                        isUpdating={false}
                        isDeleting={false}
                        timeOffAssignments={row.timeOffAssignments}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
});
