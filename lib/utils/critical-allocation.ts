import { endOfMonth, format, startOfDay, startOfMonth } from "date-fns";
import { countWeekdays, isWeekend } from "@/lib/utils/dateUtils";

const CRITICAL_ALLOCATION_THRESHOLD = 90;
const HOURS_PER_WORKDAY = 8;

export interface AllocationAssignment {
  startDate: string | Date;
  endDate: string | Date;
  hoursPerDay: string | number | null | undefined;
  isTimeOff?: boolean;
}

export interface CriticalAllocationDateRange {
  from?: Date;
  to?: Date;
}

export interface CriticalMonthlyAllocation {
  monthKey: string;
  monthLabel: string;
  percentage: number;
}

export function getCriticalMonthlyAllocations(
  assignments: AllocationAssignment[],
  dateRange?: CriticalAllocationDateRange
): CriticalMonthlyAllocation[] {
  const monthlyHours = new Map<string, { date: Date; totalHours: number }>();

  for (const assignment of assignments) {
    if (assignment.isTimeOff) continue;

    const assignStart = startOfDay(new Date(assignment.startDate));
    const assignEnd = startOfDay(new Date(assignment.endDate));
    const hoursPerDay = Number.parseFloat(String(assignment.hoursPerDay ?? 0)) || 0;

    let currentDay = new Date(assignStart);
    while (currentDay <= assignEnd) {
      if (isWeekday(currentDay)) {
        const monthStart = startOfMonth(currentDay);
        const monthKey = format(monthStart, "yyyy-MM");
        const current = monthlyHours.get(monthKey) ?? {
          date: monthStart,
          totalHours: 0,
        };

        current.totalHours += hoursPerDay;
        monthlyHours.set(monthKey, current);
      }

      currentDay = new Date(currentDay);
      currentDay.setDate(currentDay.getDate() + 1);
    }
  }

  return Array.from(monthlyHours.values())
    .filter(({ date }) => isMonthInRange(date, dateRange))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map(({ date, totalHours }) => {
      const maxHours = countWeekdaysInMonth(date) * HOURS_PER_WORKDAY;
      const percentage = maxHours > 0 ? Math.round((totalHours / maxHours) * 100) : 0;

      return {
        monthKey: format(date, "yyyy-MM"),
        monthLabel: format(date, "MMM yyyy"),
        percentage,
      };
    })
    .filter(({ percentage }) => percentage > CRITICAL_ALLOCATION_THRESHOLD);
}

function isMonthInRange(monthDate: Date, dateRange?: CriticalAllocationDateRange) {
  if (!dateRange?.from || !dateRange?.to) return true;

  const monthStart = startOfMonth(monthDate);
  const rangeStart = startOfMonth(dateRange.from);
  const rangeEnd = startOfMonth(dateRange.to);

  return monthStart >= rangeStart && monthStart <= rangeEnd;
}

function countWeekdaysInMonth(monthDate: Date) {
  return countWeekdays(startOfMonth(monthDate), endOfMonth(monthDate));
}

function isWeekday(date: Date) {
  return !isWeekend(date);
}
