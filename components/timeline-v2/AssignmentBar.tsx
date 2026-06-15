"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useUpdateAssignment, type Assignment } from "@/lib/query/hooks/useAssignments";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import {
  calculateAssignmentDisplayTotalHours,
  formatAssignmentDisplayHours,
} from "@/lib/timeline-v2/assignment-display-hours";
import { getTimelineAssignmentPosition } from "@/lib/timeline-v2/assignment-positioning";
import { getTimelineRangePosition } from "@/lib/timeline-v2/layout";
import { moveDatesPreservingSpan, rangeToDates } from "@/lib/timeline-v2/drag-model";
import { useAssignmentEditorStore } from "@/lib/timeline-v2/editor-store";
import { useBarDrag } from "@/components/timeline-v2/interactions/useBarDrag";
import { toLocalDateString } from "@/lib/utils";
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
  // Day-resolution bars are editable in place (click-to-edit, drag-to-move,
  // edge-resize); month-resolution bars are display-only and let clicks bubble
  // to the lane's month handler.
  interactive: boolean;
  // Every assignment the rendered segment merges. A MOVE shifts each member by
  // the dragged column delta (month-distributed bars are many one-day rows);
  // RESIZE rewrites one row's dates so it stays single-member only.
  memberAssignments: Assignment[];
  // False when some members extend outside the visible range — shifting only
  // the visible slice would tear a distribution apart.
  draggable: boolean;
  isHighlighted: boolean;
  disabled: boolean;
};

export const AssignmentBar = React.memo(function AssignmentBar({
  assignment,
  project,
  columns,
  resolution,
  interactive,
  memberAssignments,
  draggable,
  isHighlighted,
  disabled,
}: AssignmentBarProps) {
  const openEditor = useAssignmentEditorStore((state) => state.open);
  const updateAssignment = useUpdateAssignment();
  const canEdit = interactive && !disabled;
  const canDrag = canEdit && draggable;
  const canResize = canDrag && memberAssignments.length === 1;

  const { previewRange, isDragging, didDragRef, handlers } = useBarDrag({
    enabled: canDrag,
    assignment,
    columns,
    onCommit: ({ edge, range }) => {
      if (edge === "move") {
        // Commit the PREVIEW's wall-clamped shift, not the raw pointer delta —
        // per-member clamping would compress rows unevenly at the visible
        // edges and desync the save from what the user saw.
        const segmentPosition = getTimelineAssignmentPosition({
          startDate: assignment.startDate,
          endDate: assignment.endDate,
          columns,
          resolution: "day",
        });
        if (!segmentPosition) return;
        const effectiveDelta = range.startIndex - segmentPosition.startIndex;
        if (effectiveDelta === 0) return;

        // Shift every member of the segment by the same column delta; each row
        // keeps its own span. Optimistic patches make this instant; the final
        // invalidation settles server truth.
        for (const member of memberAssignments) {
          const dates = moveDatesPreservingSpan({
            deltaColumns: effectiveDelta,
            startDate: member.startDate,
            endDate: member.endDate,
            columns,
          });
          if (!dates) continue;
          updateAssignment.mutate({
            id: member.id,
            startDate: toLocalDateString(dates.startDate),
            endDate: toLocalDateString(dates.endDate),
          } as never);
        }
        return;
      }

      const dates = rangeToDates(range, columns);
      updateAssignment.mutate({
        id: assignment.id,
        startDate: toLocalDateString(dates.startDate),
        endDate: toLocalDateString(dates.endDate),
      } as never);
    },
  });

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

  // While dragging, the bar renders at the snapped preview range.
  const renderedPosition = previewRange
    ? getTimelineRangePosition({ ...previewRange, columnCount: columns.length })
    : position;
  const textClass = getReadableTextClass(project.color || "#64748b");

  const openEdit = () => openEditor({ mode: "edit", assignment, project });

  return (
    <div
      className={cn(
        "absolute inset-y-0.5 flex items-center overflow-hidden rounded-md border border-black/10 text-xs shadow-sm",
        textClass,
        canEdit && "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        canDrag && (isDragging ? "cursor-grabbing opacity-80 ring-2 ring-blue-400" : "cursor-grab"),
        canEdit && !canDrag && "cursor-pointer",
        isHighlighted && "ring-2 ring-amber-400 border-amber-200 shadow-md",
        disabled && "pointer-events-none"
      )}
      role={canEdit ? "button" : undefined}
      tabIndex={canEdit ? 0 : undefined}
      aria-label={canEdit ? `Edit ${project.name} assignment` : undefined}
      onKeyDown={
        canEdit
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openEdit();
              }
            }
          : undefined
      }
      style={{
        left: `${renderedPosition.leftPct}%`,
        width: `${renderedPosition.widthPct}%`,
        backgroundColor: project.color || "#64748b",
        zIndex: isDragging ? 40 : isHighlighted ? 20 : 10,
      }}
      onPointerDown={canDrag ? handlers.onBarPointerDown : undefined}
      onPointerMove={canDrag ? handlers.onPointerMove : undefined}
      onPointerUp={canDrag ? handlers.onPointerUp : undefined}
      onPointerCancel={canDrag ? handlers.onPointerCancel : undefined}
      onClick={
        canEdit
          ? (event) => {
              event.stopPropagation();
              if (didDragRef.current) {
                didDragRef.current = false;
                return;
              }
              openEdit();
            }
          : undefined
      }
      title={`${project.name} · ${displayTotalHoursLabel}`}
      data-testid="assignment-bar"
      data-assignment-id={assignment.id}
    >
      {canResize ? (
        <div
          data-bar-handle="start"
          className="absolute bottom-0 left-0 top-0 z-10 w-2 cursor-ew-resize bg-white/20 hover:bg-white/40"
          onPointerDown={handlers.onStartHandlePointerDown}
        />
      ) : null}
      <div className="pointer-events-none min-w-0 flex-1 truncate px-2">
        <span className="font-bold">{project.name}</span>{" "}
        <span className="opacity-90">{displayTotalHoursLabel}</span>
      </div>
      {canResize ? (
        <div
          data-bar-handle="end"
          className="absolute bottom-0 right-0 top-0 z-10 w-2 cursor-ew-resize bg-white/20 hover:bg-white/40"
          onPointerDown={handlers.onEndHandlePointerDown}
        />
      ) : null}
    </div>
  );
});
