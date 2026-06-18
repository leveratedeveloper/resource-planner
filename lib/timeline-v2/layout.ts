// Pixel mirror of the CSS dimension tokens in app/globals.css (@theme
// --spacing-timeline-*). Only the virtualizer estimates and the resource-column
// resize clamp may consume these numbers; components style themselves with the
// generated utilities (h-timeline-row, h-timeline-lane, ...). The drift guard
// lives in tests/whitebox/timeline-dimension-tokens.test.ts.
export const TIMELINE_DIMENSIONS = {
  row: 48,
  lane: 32,
  header: 48,
  resourceCol: { default: 256, min: 224, max: 416 },
} as const;

export function clampTimelineResourceColumnWidth(width: number): number {
  return Math.min(
    TIMELINE_DIMENSIONS.resourceCol.max,
    Math.max(TIMELINE_DIMENSIONS.resourceCol.min, width)
  );
}

export function getTimelineVisibleWidth(rootWidth: number, resourceColumnWidth: number): number {
  return Math.max(rootWidth - resourceColumnWidth, 100);
}

export function getTimelineRangePosition({
  startIndex,
  endIndex,
  columnCount,
}: {
  startIndex: number;
  endIndex: number;
  columnCount: number;
}) {
  const safeColumnCount = Math.max(columnCount, 1);
  const normalizedStart = Math.max(0, Math.min(safeColumnCount - 1, startIndex));
  const normalizedEnd = Math.max(normalizedStart, Math.min(safeColumnCount - 1, endIndex));
  const cellPct = 100 / safeColumnCount;

  return {
    leftPct: normalizedStart * cellPct,
    widthPct: (normalizedEnd - normalizedStart + 1) * cellPct,
  };
}

export function getTimelineEstimatedRowHeight({
  isExpanded,
  laneCount,
  canEditAssignments = false,
}: {
  isExpanded: boolean;
  laneCount: number;
  canEditAssignments?: boolean;
}): number {
  if (!isExpanded) return TIMELINE_DIMENSIONS.row;
  // Expanded content = one lane per project + (when editable) the
  // "+ Add project" row, which renders below the lanes (ResourceRow). Reserve at
  // least one lane so an empty expanded row is never zero-height (legacy floor).
  const lanesHeight = laneCount * TIMELINE_DIMENSIONS.lane;
  const addProjectRowHeight = canEditAssignments ? TIMELINE_DIMENSIONS.lane : 0;
  return (
    TIMELINE_DIMENSIONS.row +
    Math.max(lanesHeight + addProjectRowHeight, TIMELINE_DIMENSIONS.lane)
  );
}
