"use client";

import React, { useMemo } from "react";
import { CapacityStrip } from "@/components/timeline-v2/CapacityStrip";
import { ProjectLane } from "@/components/timeline-v2/ProjectLane";
import { ResourceIdentityCell } from "@/components/timeline-v2/ResourceIdentityCell";
import { TimelineExpandedSkeleton, TimelineRowLoadingCells } from "@/components/timeline-v2/LoadingStates";
import { useIsRowExpanded, useTimelineExpansionStore } from "@/lib/timeline-v2/expansion-store";
import { orderProjectLanes } from "@/lib/timeline-v2/lane-order";
import type { EmployeeRowModel, ProjectLaneModel } from "@/lib/timeline-v2/row-model";
import type { TimelineV2Column, TimelineV2ViewMode } from "@/lib/timeline-v2/types";

type ResourceRowProps = {
  row: EmployeeRowModel;
  columns: TimelineV2Column[];
  // Interim px width for the legacy drag-create cells; dies with them in Phase 5.
  cellWidth: number;
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
    project: ProjectLaneModel["project"];
    resourceAssignments: EmployeeRowModel["assignments"];
    clickedAssignment?: EmployeeRowModel["assignments"][number];
    monthlyTotalHours?: number;
    planTotalHours?: number;
    adjustmentTotalHours?: number;
  }) => void;
};

export const ResourceRow = React.memo(function ResourceRow({
  row,
  columns,
  cellWidth,
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
}: ResourceRowProps) {
  const isExpanded = useIsRowExpanded(row.id);
  const toggleExpanded = useTimelineExpansionStore((state) => state.toggle);
  const projectDays = useMemo(() => columns.map((item) => item.date), [columns]);

  // Lane sorting + highlight flags are filter-dependent and cheap, so they are
  // derived per row — only when the row is actually expanded.
  const orderedLanes = useMemo(
    () =>
      isExpanded
        ? orderProjectLanes({
            lanes: row.projectLanes,
            resourceAssignments: row.assignments,
            brandId,
            projectId,
            days: projectDays,
          })
        : [],
    [brandId, isExpanded, projectDays, projectId, row.assignments, row.projectLanes]
  );

  return (
    <div className="relative z-0 border-b" data-testid="resource-row-v2" data-resource-id={row.resource.id}>
      <div className="flex h-timeline-row hover:bg-accent/5 transition-colors group">
        <ResourceIdentityCell
          name={row.resource.name}
          role={row.resource.role}
          department={row.resource.department}
          expanded={isExpanded}
          onToggleExpanded={() => toggleExpanded(row.id)}
        />
        {showTimelineLoading ? (
          <TimelineRowLoadingCells dayCount={columns.length} />
        ) : (
          <CapacityStrip cells={row.allocationCells} />
        )}
      </div>

      {isExpanded ? (
        <div>
          {showExpandedLoading ? (
            <TimelineExpandedSkeleton />
          ) : (
            orderedLanes.map((lane) => (
              <ProjectLane
                key={lane.projectId}
                lane={lane}
                resourceId={row.resource.id}
                resourceAssignments={row.assignments}
                columns={columns}
                cellWidth={cellWidth}
                viewMode={viewMode}
                canEditAssignments={canEditAssignments}
                onUpdatePlanned={onUpdatePlanned}
                onDeletePlanned={onDeletePlanned}
                onOpenPlannedCreate={onOpenPlannedCreate}
                onOpenMonthlyAllocation={onOpenMonthlyAllocation}
              />
            ))
          )}
        </div>
      ) : null}
    </div>
  );
});
