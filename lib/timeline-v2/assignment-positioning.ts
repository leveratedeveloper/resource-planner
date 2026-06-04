import { endOfMonth, startOfDay, startOfMonth } from "date-fns";
import { getTimelineV2RangePosition } from "@/lib/timeline-v2/layout";
import type { TimelineV2Column, TimelineV2Resolution } from "@/lib/timeline-v2/types";

export type TimelineV2AssignmentPosition = {
  startIndex: number;
  endIndex: number;
  leftPct: number;
  widthPct: number;
};

function parseLocalDate(value: string): Date {
  return startOfDay(new Date(`${value}T00:00:00`));
}

function getColumnRange(column: TimelineV2Column, resolution: TimelineV2Resolution) {
  const start = resolution === "month" ? startOfMonth(column.date) : startOfDay(column.date);
  const end = resolution === "month" ? endOfMonth(column.date) : startOfDay(column.date);
  return { start, end };
}

export function getTimelineV2AssignmentPosition({
  startDate,
  endDate,
  columns,
  resolution,
}: {
  startDate: string;
  endDate: string;
  columns: TimelineV2Column[];
  resolution: TimelineV2Resolution;
}): TimelineV2AssignmentPosition | null {
  if (columns.length === 0) return null;

  const assignmentStart = parseLocalDate(startDate);
  const assignmentEnd = parseLocalDate(endDate);
  let startIndex = -1;
  let endIndex = -1;

  columns.forEach((column, index) => {
    const range = getColumnRange(column, resolution);
    if (assignmentEnd < range.start || assignmentStart > range.end) return;
    if (startIndex === -1) startIndex = index;
    endIndex = index;
  });

  if (startIndex === -1 || endIndex === -1) return null;

  return {
    startIndex,
    endIndex,
    ...getTimelineV2RangePosition({
      startIndex,
      endIndex,
      columnCount: columns.length,
    }),
  };
}
