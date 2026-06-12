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

// Legacy aliases — removed in the final rename sweep.
export const TIMELINE_V2_DEFAULT_RESOURCE_COLUMN_WIDTH = TIMELINE_DIMENSIONS.resourceCol.default;
export const TIMELINE_V2_MIN_RESOURCE_COLUMN_WIDTH = TIMELINE_DIMENSIONS.resourceCol.min;
export const TIMELINE_V2_MAX_RESOURCE_COLUMN_WIDTH = TIMELINE_DIMENSIONS.resourceCol.max;
export const TIMELINE_V2_ROW_ESTIMATE = TIMELINE_DIMENSIONS.row;
export const TIMELINE_V2_COLLAPSED_ROW_HEIGHT = TIMELINE_DIMENSIONS.row;
export const TIMELINE_V2_CAMPAIGN_ROW_HEIGHT = TIMELINE_DIMENSIONS.lane;

export function clampTimelineV2ResourceColumnWidth(width: number): number {
  return Math.min(
    TIMELINE_DIMENSIONS.resourceCol.max,
    Math.max(TIMELINE_DIMENSIONS.resourceCol.min, width)
  );
}

export function getTimelineV2VisibleWidth(rootWidth: number, resourceColumnWidth: number): number {
  return Math.max(rootWidth - resourceColumnWidth, 100);
}

export function getTimelineV2CellWidth(availableWidth: number, columnCount: number): number {
  const safeColumnCount = Math.max(columnCount, 1);
  return availableWidth / safeColumnCount;
}

export function getTimelineV2RangePosition({
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
}: {
  isExpanded: boolean;
  laneCount: number;
}): number {
  if (!isExpanded) return TIMELINE_DIMENSIONS.row;
  return TIMELINE_DIMENSIONS.row + Math.max(laneCount, 1) * TIMELINE_DIMENSIONS.lane;
}
