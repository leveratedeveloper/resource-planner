import { startOfDay, startOfMonth } from "date-fns";
import { WORK_DAYS_PER_WEEK } from "@/lib/constants";
import type { EmployeeDayMap } from "@/lib/timeline-v2/allocation-day-map";
import type { TimelineV2ViewMode } from "@/lib/timeline-v2/types";
import { toLocalDateString } from "@/lib/utils";

// Legacy per-cell model, kept until the timeline rework removes its callers.
export {
  getAllocationCellModel as getTimelineV2AllocationModel,
  type AllocationCellModel as TimelineV2AllocationModel,
} from "@/lib/timeline/allocation-cell-model";

export type AllocationCellModel =
  | { kind: "empty" }
  | {
      kind: "allocation";
      planPct: number;
      actualPct: number;
      planLabel: string;
      actualLabel: string;
    };

export type AllocationCellModelInput = {
  dayMap: EmployeeDayMap | undefined;
  day: Date;
  viewMode: TimelineV2ViewMode;
  capacity: number;
};

function getMonthDays(day: Date): Date[] {
  const monthStart = startOfMonth(day);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  const days: Date[] = [];
  const current = new Date(monthStart);

  while (current <= monthEnd) {
    days.push(startOfDay(current));
    current.setDate(current.getDate() + 1);
  }

  return days;
}

export function getAllocationCellModel({
  dayMap,
  day,
  viewMode,
  capacity,
}: AllocationCellModelInput): AllocationCellModel {
  const isWeekView = viewMode === "week";
  const isMonthRangeView =
    viewMode === "quarter" || viewMode === "halfYear" || viewMode === "year";
  // Month-resolution views aggregate the full calendar month containing the column day;
  // callers guarantee the day map covers full month bounds for those views.
  const daysToCheck = isMonthRangeView ? getMonthDays(day) : [startOfDay(day)];
  const dailyCapacity = capacity / WORK_DAYS_PER_WEEK;
  // Legacy hardcodes a 40h weekly capacity for week view regardless of employee capacity.
  const weeklyCapacity = 40;
  let totalPlanHours = 0;
  let totalActualHours = 0;
  let daysWithScheduleCount = 0;

  for (const currentDay of daysToCheck) {
    const dayOfWeek = currentDay.getDay();
    const allocation = dayMap?.get(toLocalDateString(currentDay));
    const dayPlanHours = allocation?.planHours ?? 0;
    const dayActualHours = allocation?.actualHours ?? 0;

    // A day counts toward capacity when it has hours or is a weekday.
    if (dayPlanHours > 0 || dayActualHours > 0 || (dayOfWeek !== 0 && dayOfWeek !== 6)) {
      daysWithScheduleCount += 1;
      totalPlanHours += dayPlanHours;
      totalActualHours += dayActualHours;
    }
  }

  const planPct = isMonthRangeView
    ? daysWithScheduleCount > 0
      ? totalPlanHours / (daysWithScheduleCount * dailyCapacity)
      : 0
    : isWeekView
      ? weeklyCapacity > 0
        ? totalPlanHours / weeklyCapacity
        : 0
      : dailyCapacity > 0 && daysWithScheduleCount > 0
        ? totalPlanHours / daysWithScheduleCount / dailyCapacity
        : 0;
  const actualPct = isMonthRangeView
    ? daysWithScheduleCount > 0
      ? totalActualHours / (daysWithScheduleCount * dailyCapacity)
      : 0
    : isWeekView
      ? weeklyCapacity > 0
        ? totalActualHours / weeklyCapacity
        : 0
      : dailyCapacity > 0 && daysWithScheduleCount > 0
        ? totalActualHours / daysWithScheduleCount / dailyCapacity
        : 0;

  if (planPct <= 0 && actualPct <= 0) return { kind: "empty" };

  return {
    kind: "allocation",
    planPct,
    actualPct,
    planLabel: `${Math.round(planPct * 100)}%`,
    actualLabel: `${Math.round(actualPct * 100)}%`,
  };
}
