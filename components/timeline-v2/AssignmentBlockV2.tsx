"use client";

import React from "react";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import { AssignmentBlock } from "@/components/timeline/AssignmentBlock";
import { ActualAssignmentBlock } from "@/components/timeline/ActualAssignmentBlock";

type BaseProps = {
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

type PlanProps = BaseProps & {
  kind: "plan";
  assignment: Assignment;
  project?: ProjectOption;
};

type ActualProps = BaseProps & {
  kind: "actual";
  assignment: ActualAssignment;
  project?: ProjectOption;
  plannedHoursLimit?: number;
  currentActualHours?: number;
};

export type AssignmentBlockV2Props = PlanProps | ActualProps;

export function AssignmentBlockV2(props: AssignmentBlockV2Props) {
  if (props.kind === "actual") {
    const {
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
      plannedHoursLimit,
      currentActualHours,
    } = props;

    return (
      <ActualAssignmentBlock
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
        plannedHoursLimit={plannedHoursLimit}
        currentActualHours={currentActualHours}
      />
    );
  }

  const {
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
  } = props;

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
