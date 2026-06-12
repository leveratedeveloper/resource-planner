"use client";

import { useRef, useState } from "react";
import { getResizePreview, type DragRange } from "@/lib/timeline-v2/drag-model";
import { getTimelineV2AssignmentPosition } from "@/lib/timeline-v2/assignment-positioning";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { TimelineV2Column } from "@/lib/timeline-v2/types";

export type BarDragEdge = "start" | "end" | "move";

type DragSession = {
  edge: BarDragEdge;
  startClientX: number;
  columnWidth: number;
  startIndex: number;
  endIndex: number;
  moved: boolean;
};

export type BarDragCommit = {
  edge: BarDragEdge;
  deltaColumns: number;
  range: DragRange;
};

// Pointer-capture move + edge-resize for assignment bars. The preview is a
// snapped column range (only the dragged bar re-renders); release reports the
// final edge/delta/range and the caller derives calendar dates per assignment.
export function useBarDrag({
  enabled,
  assignment,
  columns,
  onCommit,
}: {
  enabled: boolean;
  assignment: Pick<Assignment, "startDate" | "endDate">;
  columns: TimelineV2Column[];
  onCommit: (commit: BarDragCommit) => void;
}) {
  const [previewRange, setPreviewRange] = useState<DragRange | null>(null);
  const sessionRef = useRef<DragSession | null>(null);
  // Lets the bar's onClick distinguish a completed drag from a plain click.
  const didDragRef = useRef(false);

  const begin = (edge: BarDragEdge) => (event: React.PointerEvent<HTMLElement>) => {
    if (!enabled || event.button !== 0 || columns.length === 0) return;
    const position = getTimelineV2AssignmentPosition({
      startDate: assignment.startDate,
      endDate: assignment.endDate,
      columns,
      resolution: "day",
    });
    if (!position) return;

    // The bar's offset parent is the lane canvas — measure it, never trust a constant.
    const canvas = (event.currentTarget.closest("[data-assignment-id]")?.parentElement ??
      event.currentTarget.parentElement) as HTMLElement | null;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    didDragRef.current = false;
    sessionRef.current = {
      edge,
      startClientX: event.clientX,
      columnWidth: rect.width / Math.max(columns.length, 1),
      startIndex: position.startIndex,
      endIndex: position.endIndex,
      moved: false,
    };
  };

  const handlers = {
    onBarPointerDown: begin("move"),
    onStartHandlePointerDown: begin("start"),
    onEndHandlePointerDown: begin("end"),
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
      const session = sessionRef.current;
      if (!session) return;
      const deltaColumns = Math.round((event.clientX - session.startClientX) / session.columnWidth);
      if (deltaColumns !== 0) {
        session.moved = true;
        didDragRef.current = true;
      }
      setPreviewRange(
        getResizePreview({
          edge: session.edge,
          deltaColumns,
          startIndex: session.startIndex,
          endIndex: session.endIndex,
          columnCount: columns.length,
        })
      );
    },
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => {
      const session = sessionRef.current;
      sessionRef.current = null;
      setPreviewRange(null);
      if (!session || !session.moved) return;

      const deltaColumns = Math.round((event.clientX - session.startClientX) / session.columnWidth);
      if (deltaColumns === 0) return;

      onCommit({
        edge: session.edge,
        deltaColumns,
        range: getResizePreview({
          edge: session.edge,
          deltaColumns,
          startIndex: session.startIndex,
          endIndex: session.endIndex,
          columnCount: columns.length,
        }),
      });
    },
    onPointerCancel: () => {
      sessionRef.current = null;
      setPreviewRange(null);
    },
  };

  return { previewRange, isDragging: previewRange !== null, didDragRef, handlers };
}
