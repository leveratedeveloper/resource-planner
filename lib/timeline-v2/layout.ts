export const TIMELINE_V2_DEFAULT_RESOURCE_COLUMN_WIDTH = 250;
export const TIMELINE_V2_MIN_RESOURCE_COLUMN_WIDTH = 220;
export const TIMELINE_V2_MAX_RESOURCE_COLUMN_WIDTH = 420;
export const TIMELINE_V2_ROW_ESTIMATE = 56;

export function clampTimelineV2ResourceColumnWidth(width: number): number {
  return Math.min(
    TIMELINE_V2_MAX_RESOURCE_COLUMN_WIDTH,
    Math.max(TIMELINE_V2_MIN_RESOURCE_COLUMN_WIDTH, width)
  );
}

export function getTimelineV2Layout({
  availableWidth,
  columnCount,
}: {
  availableWidth: number;
  columnCount: number;
}) {
  const safeColumnCount = Math.max(columnCount, 1);
  const timelineWidth = Math.max(availableWidth, 100);

  return {
    columnWidth: timelineWidth / safeColumnCount,
    timelineWidth,
  };
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
