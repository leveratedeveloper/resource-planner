"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import {
  calculateAssignmentDisplayTotalHours,
  formatAssignmentDisplayHours,
} from "@/lib/timeline-v2/assignment-display-hours";
import { getTimelineAssignmentPosition } from "@/lib/timeline-v2/assignment-positioning";
import type { TimelineColumn, TimelineResolution } from "@/lib/timeline-v2/types";

// Relative luminance of the project color decides label color — white text on
// light brand colors fails contrast.
function getReadableTextClass(hexColor: string): string {
  const hex = hexColor.replace("#", "");
  if (hex.length < 6) return "text-white";
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.6 ? "text-slate-900" : "text-white";
}

type AssignmentBarProps = {
  assignment: Assignment;
  project: ProjectOption;
  columns: TimelineColumn[];
  resolution: TimelineResolution;
  // Retained for API compatibility with ProjectLane; inline editing is
  // temporarily disabled during the monthly-allocation migration, so bars are
  // render-only (no drag/resize/click-to-edit).
  interactive: boolean;
  memberAssignments: Assignment[];
  draggable: boolean;
  isHighlighted: boolean;
  disabled: boolean;
};

export const AssignmentBar = React.memo(function AssignmentBar({
  assignment,
  project,
  columns,
  resolution,
  isHighlighted,
}: AssignmentBarProps) {
  const position = useMemo(
    () =>
      getTimelineAssignmentPosition({
        startDate: assignment.startDate,
        endDate: assignment.endDate,
        columns,
        resolution,
      }),
    [assignment.endDate, assignment.startDate, columns, resolution]
  );

  const displayTotalHoursLabel = useMemo(() => {
    if (columns.length === 0) return "";
    const displayRange = {
      startDate: columns[0].date,
      endDate: columns[columns.length - 1].date,
    };
    return formatAssignmentDisplayHours(calculateAssignmentDisplayTotalHours(assignment, displayRange));
  }, [assignment, columns]);

  if (!position) return null;

  const textClass = getReadableTextClass(project.color || "#64748b");

  return (
    <div
      className={cn(
        "absolute inset-y-0.5 flex items-center overflow-hidden rounded-md border border-black/10 text-xs shadow-sm",
        textClass,
        isHighlighted && "ring-2 ring-amber-400 border-amber-200 shadow-md"
      )}
      style={{
        left: `${position.leftPct}%`,
        width: `${position.widthPct}%`,
        backgroundColor: project.color || "#64748b",
        zIndex: isHighlighted ? 20 : 10,
      }}
      title={`${project.name} · ${displayTotalHoursLabel}`}
      data-testid="assignment-bar"
      data-assignment-id={assignment.id}
    >
      <div className="pointer-events-none min-w-0 flex-1 truncate px-2">
        <span className="font-bold">{project.name}</span>{" "}
        <span className="opacity-90">{displayTotalHoursLabel}</span>
      </div>
    </div>
  );
});
