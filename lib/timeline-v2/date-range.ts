import {
  addDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfMonth,
  format,
  getMonth,
  getYear,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { toLocalDateString } from "@/lib/utils";
import type {
  TimelineV2Column,
  TimelineV2ColumnSet,
  TimelineV2Resolution,
  TimelineV2ViewMode,
} from "@/lib/timeline-v2/types";

function getAllColumns(anchorDate: Date, viewMode: TimelineV2ViewMode): Date[] {
  switch (viewMode) {
    case "week": {
      const start = startOfWeek(anchorDate, { weekStartsOn: 1 });
      return eachDayOfInterval({ start, end: addDays(start, 6) });
    }
    case "month": {
      const start = startOfMonth(anchorDate);
      return eachDayOfInterval({
        start,
        end: endOfMonth(start),
      });
    }
    case "quarter": {
      const currentMonth = anchorDate.getMonth();
      const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
      const start = new Date(anchorDate.getFullYear(), quarterStartMonth, 1);
      const end = new Date(anchorDate.getFullYear(), quarterStartMonth + 2, 1);
      return eachMonthOfInterval({ start, end });
    }
    case "halfYear": {
      const currentMonth = anchorDate.getMonth();
      const halfYearStartMonth = currentMonth < 6 ? 0 : 6;
      const start = new Date(anchorDate.getFullYear(), halfYearStartMonth, 1);
      const end = new Date(anchorDate.getFullYear(), halfYearStartMonth + 5, 1);
      return eachMonthOfInterval({ start, end });
    }
    case "year":
      return eachMonthOfInterval({
        start: new Date(anchorDate.getFullYear(), 0, 1),
        end: new Date(anchorDate.getFullYear(), 11, 1),
      });
  }
}

export function getTimelineV2Resolution(viewMode: TimelineV2ViewMode): TimelineV2Resolution {
  return viewMode === "week" || viewMode === "month" ? "day" : "month";
}

export function getTimelineV2Columns({
  anchorDate,
  viewMode,
  showWeekends,
}: {
  anchorDate: Date;
  viewMode: TimelineV2ViewMode;
  showWeekends: boolean;
}): TimelineV2ColumnSet {
  const resolution = getTimelineV2Resolution(viewMode);
  const allColumns = getAllColumns(anchorDate, viewMode);
  const visibleDates = resolution === "month" || showWeekends
    ? allColumns
    : allColumns.filter((date) => date.getDay() !== 0 && date.getDay() !== 6);
  const today = new Date();
  const rangeStart = allColumns[0];
  const rangeEnd = allColumns[allColumns.length - 1];

  const columns: TimelineV2Column[] = visibleDates.map((date) => ({
    id: toLocalDateString(date),
    date,
    label: resolution === "month" ? format(date, "MMMM") : format(date, "EEE"),
    subLabel: resolution === "month" ? null : format(date, "d"),
    kind: resolution,
    isWeekend: date.getDay() === 0 || date.getDay() === 6,
    isToday: isToday(date),
    isCurrentMonth: getMonth(date) === getMonth(today) && getYear(date) === getYear(today),
  }));

  return {
    viewMode,
    resolution,
    startDate: toLocalDateString(rangeStart),
    endDate:
      resolution === "month"
        ? toLocalDateString(endOfMonth(rangeEnd))
        : toLocalDateString(rangeEnd),
    columns,
  };
}
