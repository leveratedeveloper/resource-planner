import { startOfDay, startOfMonth, endOfMonth } from "date-fns";
import {
  monthPct,
  weekPct,
  dayPct,
} from "@/lib/assignments/allocation";
import type { EmployeeDayMap } from "@/lib/timeline-v2/allocation-day-map";
import type { TimelineViewMode } from "@/lib/timeline-v2/types";
import { getTimelineResolution } from "@/lib/timeline-v2/date-range";
import { toLocalDateString } from "@/lib/utils";
import { formatAssignmentDisplayHours } from "@/lib/timeline-v2/assignment-display-hours";

export type AllocationCellModel =
  | { kind: "empty" }
  | {
      kind: "allocation";
      planPct: number;
      planHours: number;
      planLabel: string;
      planHoursLabel: string;
    };

export type AllocationCellModelInput = {
  dayMap: EmployeeDayMap | undefined;
  day: Date;
  viewMode: TimelineViewMode;
};

function getMonthDays(day: Date): Date[] {
  const monthStart = startOfMonth(day);
  const monthEnd = endOfMonth(day);
  const days: Date[] = [];
  const current = new Date(monthStart);

  while (current <= monthEnd) {
    days.push(startOfDay(new Date(current)));
    current.setDate(current.getDate() + 1);
  }

  return days;
}

export function getAllocationCellModel({
  dayMap,
  day,
  viewMode,
}: AllocationCellModelInput): AllocationCellModel {
  const isWeekView = viewMode === "week";
  const isMonthRangeView = getTimelineResolution(viewMode) === "month";

  let totalPlanHours = 0;

  if (isMonthRangeView) {
    // Aggregate all days in the calendar month from the day map.
    for (const d of getMonthDays(day)) {
      const key = toLocalDateString(d);
      totalPlanHours += dayMap?.get(key)?.planHours ?? 0;
    }
  } else if (isWeekView) {
    // The "day" arg for week view is the Monday of that week; walk 5 weekdays.
    const current = startOfDay(new Date(day));
    for (let i = 0; i < 7; i++) {
      const d = new Date(current);
      d.setDate(d.getDate() + i);
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) {
        totalPlanHours += dayMap?.get(toLocalDateString(d))?.planHours ?? 0;
      }
    }
  } else {
    // Day view — single cell.
    totalPlanHours = dayMap?.get(toLocalDateString(startOfDay(day)))?.planHours ?? 0;
  }

  const planPct = isMonthRangeView
    ? monthPct(totalPlanHours)
    : isWeekView
      ? weekPct(totalPlanHours)
      : dayPct(totalPlanHours);

  if (planPct <= 0) return { kind: "empty" };

  const roundHours = (hours: number) => Math.round(hours * 10) / 10;

  return {
    kind: "allocation",
    planPct,
    planHours: roundHours(totalPlanHours),
    planLabel: `${Math.round(planPct * 100)}%`,
    planHoursLabel: formatAssignmentDisplayHours(totalPlanHours),
  };
}
