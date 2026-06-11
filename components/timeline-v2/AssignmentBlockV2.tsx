"use client";

import React from "react";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import { AssignmentBlock } from "@/components/timeline/AssignmentBlock";

export type AssignmentBlockV2Props = {
  assignment: Assignment;
  project?: ProjectOption;
  days: Date[];
  resourceRowHeight: number;
  cellWidth?: number;
  isWeekView?: boolean;
  isMonthRangeView?: boolean;
  disabled?: boolean;
  isHighlighted?: boolean;
  isDeleting?: boolean;
  isUpdating?: boolean;
  resizable?: boolean;
  onUpdate?: (id: string, updates: unknown) => void;
  onDelete?: (id: string) => void;
};

export function AssignmentBlockV2({
  assignment,
  project,
  days,
  resourceRowHeight,
  cellWidth,
  isWeekView,
  isMonthRangeView,
  onUpdate,
  onDelete,
  isDeleting = false,
  isUpdating = false,
  disabled = false,
  isHighlighted = false,
  resizable = false,
}: AssignmentBlockV2Props) {
  return (
    <AssignmentBlock
      assignment={assignment}
      project={project}
      days={days}
      resourceRowHeight={resourceRowHeight}
      cellWidth={cellWidth}
      isWeekView={isWeekView}
      isMonthRangeView={isMonthRangeView}
      onUpdate={onUpdate as never}
      onDelete={onDelete}
      isDeleting={isDeleting}
      isUpdating={isUpdating}
      disabled={disabled}
      isHighlighted={isHighlighted}
      resizable={resizable}
    />
  );
}
