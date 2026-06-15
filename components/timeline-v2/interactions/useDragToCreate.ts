"use client";

import { useRef, useState } from "react";
import {
  getColumnIndexFromPointer,
  getDragRange,
  rangeToDates,
  type DragRange,
} from "@/lib/timeline-v2/drag-model";
import type { TimelineColumn } from "@/lib/timeline-v2/types";

// One pointer-handler set per lane canvas (replaces the per-cell listeners of
// the legacy DraggableTimelineCell fleet). Down anchors a column, move extends
// the snapped preview range, up commits: a plain click yields a single day.
export function useDragToCreate({
  enabled,
  columns,
  onCreate,
}: {
  enabled: boolean;
  columns: TimelineColumn[];
  onCreate: (range: { startDate: Date; endDate: Date }) => void;
}) {
  const [preview, setPreview] = useState<DragRange | null>(null);
  const sessionRef = useRef<{ anchor: number; range: DragRange } | null>(null);

  const indexFromEvent = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return getColumnIndexFromPointer({
      clientX: event.clientX,
      canvasLeft: rect.left,
      canvasWidth: rect.width,
      columnCount: columns.length,
    });
  };

  const endSession = () => {
    sessionRef.current = null;
    setPreview(null);
  };

  const handlers = {
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
      if (!enabled || event.button !== 0 || columns.length === 0) return;
      // Bars own their gestures (click-to-edit, drag-to-move).
      if ((event.target as HTMLElement).closest("[data-assignment-id]")) return;
      const anchor = indexFromEvent(event);
      const range = getDragRange(anchor, anchor);
      sessionRef.current = { anchor, range };
      setPreview(range);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
      const session = sessionRef.current;
      if (!session) return;
      const range = getDragRange(session.anchor, indexFromEvent(event));
      session.range = range;
      setPreview(range);
    },
    onPointerUp: () => {
      const session = sessionRef.current;
      if (!session) return;
      const range = session.range;
      endSession();
      onCreate(rangeToDates(range, columns));
    },
    onPointerCancel: endSession,
  };

  return { preview, handlers };
}
