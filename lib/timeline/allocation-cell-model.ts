import { startOfDay, startOfMonth } from "date-fns";
import { WORK_DAYS_PER_WEEK } from "@/lib/constants";
import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import { parseHoursSafe } from "@/lib/timeline/resource-row-model";
import type { Resource } from "@/types";

export type AllocationCellModel =
  | { kind: "empty" }
  | { kind: "time-off" }
  | {
      kind: "allocation";
      planPct: number;
      actualPct: number;
      planLabel: string;
      actualLabel: string;
    };

export type AllocationCellModelInput = {
  day: Date;
  resource: Resource;
  assignments: Assignment[];
  actualAssignments: ActualAssignment[];
  isWeekView: boolean;
  isMonthRangeView: boolean;
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

function getDaysToCheck(
  day: Date,
  isWeekView: boolean,
  isMonthRangeView: boolean
): Date[] {
  if (isMonthRangeView) return getMonthDays(day);
  if (!isWeekView) return [startOfDay(day)];
  return [startOfDay(day)];
}

function isDateInRange(date: Date, startDate: string, endDate: string): boolean {
  const start = startOfDay(new Date(startDate));
  const end = startOfDay(new Date(endDate));
  return date >= start && date <= end;
}

export function getAllocationCellModel({
  day,
  resource,
  assignments,
  actualAssignments,
  isWeekView,
  isMonthRangeView,
}: AllocationCellModelInput): AllocationCellModel {
  const daysToCheck = getDaysToCheck(day, isWeekView, isMonthRangeView);
  const dailyCapacity = resource.capacity / WORK_DAYS_PER_WEEK;
  const weeklyCapacity = 40;
  let totalPlanHours = 0;
  let totalActualHours = 0;
  let daysWithScheduleCount = 0;

  const hasTimeOff =
    !isMonthRangeView &&
    daysToCheck.some((currentDay) =>
      assignments.some(
        (assignment) =>
          assignment.employeeId === resource.id &&
          assignment.isTimeOff &&
          isDateInRange(currentDay, assignment.startDate, assignment.endDate)
      )
    );

  if (hasTimeOff) return { kind: "time-off" };

  for (const currentDay of daysToCheck) {
    const dayOfWeek = currentDay.getDay();
    const dayPlanHours = assignments.reduce((total, assignment) => {
      if (
        assignment.employeeId !== resource.id ||
        assignment.isTimeOff ||
        !isDateInRange(currentDay, assignment.startDate, assignment.endDate)
      ) {
        return total;
      }

      return total + parseHoursSafe(assignment.hoursPerDay);
    }, 0);
    const dayActualHours = actualAssignments.reduce((total, assignment) => {
      if (
        assignment.isTimeOff ||
        (assignment.employeeUuid && assignment.employeeUuid !== resource.id) ||
        !isDateInRange(currentDay, assignment.startDate, assignment.endDate)
      ) {
        return total;
      }

      return total + parseHoursSafe(assignment.hoursPerDay);
    }, 0);

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
