import type { TimelineColumn } from "@/lib/timeline-v2/types";
import { toLocalDateString } from "@/lib/utils";

export type DragRange = { startIndex: number; endIndex: number };

export function getColumnIndexFromPointer({
  clientX,
  canvasLeft,
  canvasWidth,
  columnCount,
}: {
  clientX: number;
  canvasLeft: number;
  canvasWidth: number;
  columnCount: number;
}): number {
  const columnWidth = canvasWidth / columnCount;
  const rawIndex = Math.floor((clientX - canvasLeft) / columnWidth);
  return Math.max(0, Math.min(columnCount - 1, rawIndex));
}

export function getDragRange(anchorIndex: number, currentIndex: number): DragRange {
  return {
    startIndex: Math.min(anchorIndex, currentIndex),
    endIndex: Math.max(anchorIndex, currentIndex),
  };
}

export function getResizePreview({
  edge,
  deltaColumns,
  startIndex,
  endIndex,
  columnCount,
}: {
  edge: "start" | "end" | "move";
  deltaColumns: number;
  startIndex: number;
  endIndex: number;
  columnCount: number;
}): DragRange {
  if (edge === "start") {
    return {
      startIndex: Math.max(0, Math.min(endIndex, startIndex + deltaColumns)),
      endIndex,
    };
  }

  if (edge === "end") {
    return {
      startIndex,
      endIndex: Math.max(startIndex, Math.min(columnCount - 1, endIndex + deltaColumns)),
    };
  }

  // "move": clamp the delta itself so the span survives both walls intact.
  const clampedDelta = Math.max(
    -startIndex,
    Math.min(columnCount - 1 - endIndex, deltaColumns)
  );
  return {
    startIndex: startIndex + clampedDelta,
    endIndex: endIndex + clampedDelta,
  };
}

export function rangeToDates(
  range: DragRange,
  columns: TimelineColumn[]
): { startDate: Date; endDate: Date } {
  return {
    startDate: columns[range.startIndex].date,
    endDate: columns[range.endIndex].date,
  };
}

// Mirrors legacy findVisibleIndex (lib/timeline/assignment-positioning.ts
// findVisibleDayIndex): exact match first; if the date has no visible column
// (e.g. a hidden weekend day), fall back to the LAST visible column whose date
// is <= the target (floor). Returns -1 when the date precedes every column.
// yyyy-MM-dd keys compare lexicographically, so plain string comparison works.
function findVisibleIndex(dateKey: string, columnKeys: string[]): number {
  const exactIndex = columnKeys.indexOf(dateKey);
  if (exactIndex >= 0) return exactIndex;
  for (let i = columnKeys.length - 1; i >= 0; i--) {
    if (columnKeys[i] <= dateKey) return i;
  }
  return -1;
}

// Legacy bar-move rule (components/timeline/AssignmentBlock.tsx handleDragStart,
// day view): both edges shift by deltaColumns along the VISIBLE columns and the
// new calendar dates are read back from the landing columns. The invariant is
// the VISIBLE span, not the calendar duration — with weekends hidden, a Thu-Fri
// bar moved +1 lands on Fri..Mon (2 visible columns, 4 calendar days).
export function moveDatesPreservingSpan({
  deltaColumns,
  startDate,
  endDate,
  columns,
}: {
  deltaColumns: number;
  startDate: string; // yyyy-MM-dd
  endDate: string; // yyyy-MM-dd
  columns: TimelineColumn[];
}): { startDate: Date; endDate: Date } | null {
  if (columns.length === 0) return null;

  const columnKeys = columns.map((column) => toLocalDateString(column.date));

  // Legacy AssignmentBlock skips rendering (and therefore dragging) when the
  // assignment does not overlap the visible range at all.
  if (startDate > columnKeys[columnKeys.length - 1] || endDate < columnKeys[0]) {
    return null;
  }

  // A start before the range clamps to the first column; an end after the
  // range floors to the last column — same as getAssignmentBlockPosition.
  const startIndex = Math.max(0, findVisibleIndex(startDate, columnKeys));
  const endIndex = findVisibleIndex(endDate, columnKeys);

  const clampedDelta = Math.max(
    -startIndex,
    Math.min(columns.length - 1 - endIndex, deltaColumns)
  );

  return {
    startDate: columns[startIndex + clampedDelta].date,
    endDate: columns[endIndex + clampedDelta].date,
  };
}
