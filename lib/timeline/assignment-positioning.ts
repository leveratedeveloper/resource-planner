import { startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { toLocalDateString } from "@/lib/utils";

export type AssignmentBlockPosition = {
  startVisibleIdx: number;
  endVisibleIdx: number;
  visibleDuration: number;
};

export type AssignmentBlockPositionInput = {
  startDate: Date;
  endDate: Date;
  days: Date[];
  isWeekView: boolean;
  isMonthRangeView: boolean;
};

function findVisibleDayIndex(date: Date, days: Date[]) {
  const exactDate = startOfDay(date).getTime();
  const exactIdx = days.findIndex((day) => startOfDay(day).getTime() === exactDate);
  if (exactIdx >= 0) return exactIdx;

  const dateStr = toLocalDateString(startOfDay(date));
  const stringIdx = days.findIndex((day) => toLocalDateString(startOfDay(day)) === dateStr);
  if (stringIdx >= 0) return stringIdx;

  for (let i = days.length - 1; i >= 0; i--) {
    if (startOfDay(days[i]).getTime() <= exactDate) return i;
  }

  return -1;
}

function findVisibleMonthIndex(date: Date, days: Date[]) {
  const monthStart = startOfMonth(date).getTime();
  const exactIdx = days.findIndex((day) => startOfMonth(day).getTime() === monthStart);
  if (exactIdx >= 0) return exactIdx;

  for (let i = days.length - 1; i >= 0; i--) {
    if (startOfMonth(days[i]).getTime() <= monthStart) return i;
  }

  return -1;
}

function findVisibleWeekIndex(date: Date, days: Date[]) {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const exactIdx = days.findIndex((day) => startOfDay(day).getTime() === weekStart.getTime());
  if (exactIdx >= 0) return exactIdx;

  for (let i = days.length - 1; i >= 0; i--) {
    if (startOfDay(days[i]).getTime() <= weekStart.getTime()) return i;
  }

  return -1;
}

export function getAssignmentVisibleIndex({
  date,
  days,
  isWeekView,
  isMonthRangeView,
}: {
  date: Date;
  days: Date[];
  isWeekView: boolean;
  isMonthRangeView: boolean;
}) {
  if (days.length === 0) return -1;
  if (isWeekView) return findVisibleWeekIndex(startOfWeek(date, { weekStartsOn: 1 }), days);
  if (isMonthRangeView) return findVisibleMonthIndex(date, days);
  return findVisibleDayIndex(date, days);
}

export function getAssignmentBlockPosition({
  startDate,
  endDate,
  days,
  isWeekView,
  isMonthRangeView,
}: AssignmentBlockPositionInput): AssignmentBlockPosition | null {
  if (days.length === 0) return null;

  let startVisibleIdx = -1;
  let endVisibleIdx = -1;

  if (isWeekView) {
    const assignmentStartWeek = startOfWeek(startDate, { weekStartsOn: 1 });
    const assignmentEndWeek = startOfWeek(endDate, { weekStartsOn: 1 });

    startVisibleIdx = findVisibleWeekIndex(assignmentStartWeek, days);
    endVisibleIdx = findVisibleWeekIndex(assignmentEndWeek, days);
  } else if (isMonthRangeView) {
    startVisibleIdx = findVisibleMonthIndex(startDate, days);
    endVisibleIdx = findVisibleMonthIndex(endDate, days);
  } else {
    startVisibleIdx = findVisibleDayIndex(startDate, days);
    endVisibleIdx = findVisibleDayIndex(endDate, days);
  }

  if (startVisibleIdx === -1) startVisibleIdx = 0;
  if (endVisibleIdx === -1) endVisibleIdx = days.length - 1;

  startVisibleIdx = Math.max(0, Math.min(days.length - 1, startVisibleIdx));
  endVisibleIdx = Math.max(0, Math.min(days.length - 1, endVisibleIdx));

  return {
    startVisibleIdx,
    endVisibleIdx,
    visibleDuration: endVisibleIdx - startVisibleIdx + 1,
  };
}
