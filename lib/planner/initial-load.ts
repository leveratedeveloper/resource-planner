import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { toLocalDateString } from "@/lib/utils";
import type { TimelineViewMode } from "@/lib/planner/planner-loading";

export type TimelineAssignmentDateRange = {
  startDate: string;
  endDate: string;
};

export const DEFAULT_TIMELINE_VIEW: TimelineViewMode = "quarter";

export function getInitialTimelineAnchor(date: Date = new Date()): string {
  return toLocalDateString(date);
}

export function getInitialWeekStart(date: Date = new Date()): string {
  return toLocalDateString(startOfWeek(date, { weekStartsOn: 1 }));
}

export function getInitialTimelineDays(initialWeekStart: string): Date[] {
  const weekStart = new Date(`${initialWeekStart}T00:00:00`);
  const weekEnd = addDays(weekStart, 6);

  return eachDayOfInterval({ start: weekStart, end: weekEnd }).filter((day) => {
    const dayOfWeek = day.getDay();
    return dayOfWeek !== 0 && dayOfWeek !== 6;
  });
}

export function getInitialTimelineDateRange(
  initialAnchor: string,
  viewMode: TimelineViewMode = "week"
): TimelineAssignmentDateRange {
  const anchor = new Date(`${initialAnchor}T00:00:00`);

  if (viewMode === "month") {
    return {
      startDate: toLocalDateString(startOfMonth(anchor)),
      endDate: toLocalDateString(endOfMonth(anchor)),
    };
  }

  if (viewMode === "quarter") {
    const quarterStart = new Date(anchor.getFullYear(), Math.floor(anchor.getMonth() / 3) * 3, 1);
    return {
      startDate: toLocalDateString(quarterStart),
      endDate: toLocalDateString(endOfMonth(addMonths(quarterStart, 2))),
    };
  }

  if (viewMode === "halfYear") {
    const halfYearStart = new Date(anchor.getFullYear(), anchor.getMonth() < 6 ? 0 : 6, 1);
    return {
      startDate: toLocalDateString(halfYearStart),
      endDate: toLocalDateString(endOfMonth(addMonths(halfYearStart, 5))),
    };
  }

  if (viewMode === "year") {
    return {
      startDate: toLocalDateString(new Date(anchor.getFullYear(), 0, 1)),
      endDate: toLocalDateString(new Date(anchor.getFullYear(), 11, 31)),
    };
  }

  // No "custom" branch by design: this runs only for the initial/SSR render,
  // which always uses DEFAULT_TIMELINE_VIEW. viewMode (and customRange) aren't
  // persisted, so "custom" can never be the initial mode — it's chosen at
  // runtime via the toolbar, which drives the window off the store's customRange.
  const days = getInitialTimelineDays(getInitialWeekStart(anchor));

  return {
    startDate: toLocalDateString(days[0]),
    endDate: toLocalDateString(days[days.length - 1]),
  };
}

export function shouldEnableTimelineAssignments(
  dateRange?: TimelineAssignmentDateRange
): boolean {
  return !!dateRange?.startDate && !!dateRange?.endDate;
}
