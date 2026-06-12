"use client";

import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import {
  calculateAssignmentDisplayTotalHours,
  formatAssignmentDisplayHours,
} from "@/lib/timeline/assignment-display-hours";
import { getTimelineV2AssignmentPosition } from "@/lib/timeline-v2/assignment-positioning";
import type { TimelineV2Column, TimelineV2Resolution } from "@/lib/timeline-v2/types";

// Loaded on demand — the edit dialog is not needed for first paint.
const EditAssignmentDialog = dynamic(
  () => import("@/components/timeline/EditAssignmentDialog").then((mod) => mod.EditAssignmentDialog),
  { ssr: false }
);

type AssignmentBarProps = {
  assignment: Assignment;
  project: ProjectOption;
  columns: TimelineV2Column[];
  resolution: TimelineV2Resolution;
  // Day-resolution bars open the edit dialog themselves; month-resolution bars
  // are display-only and let clicks bubble to the lane's month handler.
  interactive: boolean;
  isHighlighted: boolean;
  disabled: boolean;
  onUpdate: (id: string, updates: unknown) => void;
  onDelete: (id: string) => void;
};

export const AssignmentBar = React.memo(function AssignmentBar({
  assignment,
  project,
  columns,
  resolution,
  interactive,
  isHighlighted,
  disabled,
  onUpdate,
  onDelete,
}: AssignmentBarProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const position = useMemo(
    () =>
      getTimelineV2AssignmentPosition({
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

  const canEdit = interactive && !disabled;

  return (
    <>
      <div
        className={cn(
          "absolute inset-y-0.5 flex items-center overflow-hidden rounded-md border border-black/10 text-xs text-white shadow-sm",
          canEdit && "cursor-pointer",
          isHighlighted && "ring-2 ring-amber-400 border-amber-200 shadow-md",
          disabled && "pointer-events-none"
        )}
        style={{
          left: `${position.leftPct}%`,
          width: `${position.widthPct}%`,
          backgroundColor: project.color || "#64748b",
          zIndex: isHighlighted ? 20 : 10,
        }}
        onClick={
          canEdit
            ? (event) => {
                event.stopPropagation();
                setIsEditDialogOpen(true);
              }
            : undefined
        }
        title={`${project.name} · ${displayTotalHoursLabel}`}
        data-testid="assignment-bar"
        data-assignment-id={assignment.id}
      >
        <div className="min-w-0 flex-1 truncate px-2">
          <span className="font-bold">{project.name}</span>{" "}
          <span className="opacity-90">{displayTotalHoursLabel}</span>
        </div>
      </div>

      {canEdit && isEditDialogOpen && (
        <EditAssignmentDialog
          key={`${assignment.id}-${assignment.updatedAt}`}
          assignment={assignment}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onSave={(updates) => {
            onUpdate(assignment.id, updates);
            setIsEditDialogOpen(false);
          }}
          onDelete={() => {
            onDelete(assignment.id);
            setIsEditDialogOpen(false);
          }}
          isDeleting={false}
        />
      )}
    </>
  );
});
