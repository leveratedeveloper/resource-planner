export const TIMELINE_V2_DEFAULT_RESOURCE_COLUMN_WIDTH = 250;
export const TIMELINE_V2_MIN_RESOURCE_COLUMN_WIDTH = 220;
export const TIMELINE_V2_MAX_RESOURCE_COLUMN_WIDTH = 420;
export const TIMELINE_V2_ROW_ESTIMATE = 56;
export const TIMELINE_V2_COLLAPSED_ROW_HEIGHT = 48;
export const TIMELINE_V2_TIME_OFF_ROW_HEIGHT = 32;
export const TIMELINE_V2_CAMPAIGN_ROW_HEIGHT = 34;

export function clampTimelineV2ResourceColumnWidth(width: number): number {
  return Math.min(
    TIMELINE_V2_MAX_RESOURCE_COLUMN_WIDTH,
    Math.max(TIMELINE_V2_MIN_RESOURCE_COLUMN_WIDTH, width)
  );
}

export function getTimelineV2VisibleWidth(rootWidth: number, resourceColumnWidth: number): number {
  return Math.max(rootWidth - resourceColumnWidth, 100);
}

export function getTimelineV2CellWidth(availableWidth: number, columnCount: number): number {
  const safeColumnCount = Math.max(columnCount, 1);
  return availableWidth / safeColumnCount;
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
    columnWidth: getTimelineV2CellWidth(timelineWidth, safeColumnCount),
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

export function getTimelineV2TodayScrollLeft({
  todayIndex,
  cellWidth,
  viewportWidth,
}: {
  todayIndex: number;
  cellWidth: number;
  viewportWidth: number;
}) {
  return Math.max(0, todayIndex * cellWidth - viewportWidth / 2 + cellWidth / 2);
}

export function getTimelineV2EstimatedRowHeight(row?: {
  isExpanded: boolean;
  campaignGroups: Array<unknown>;
}): number {
  if (!row) return TIMELINE_V2_ROW_ESTIMATE;
  if (!row.isExpanded) return TIMELINE_V2_COLLAPSED_ROW_HEIGHT;
  return TIMELINE_V2_COLLAPSED_ROW_HEIGHT + TIMELINE_V2_TIME_OFF_ROW_HEIGHT + Math.max(row.campaignGroups.length, 1) * TIMELINE_V2_CAMPAIGN_ROW_HEIGHT;
}
