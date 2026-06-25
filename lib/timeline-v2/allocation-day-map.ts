import { endOfMonth, startOfDay, startOfMonth } from "date-fns";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import { countWeekdays } from "@/lib/utils/dateUtils";
import { toLocalDateString } from "@/lib/utils";

export type DayAllocation = { planHours: number };

export type EmployeeDayMap = Map<string /* yyyy-MM-dd */, DayAllocation>;

export type BuildAllocationDayMapsInput = {
  assignments: Assignment[];
  rangeStart: Date;
  rangeEnd: Date;
};

/**
 * Spreads each monthly allocation across the weekdays of that month (within the
 * visible range). A month's plannedHours are divided by the month's total
 * weekday count so each weekday cell carries an equal share.
 */
export function buildAllocationDayMaps({
  assignments,
  rangeStart,
  rangeEnd,
}: BuildAllocationDayMapsInput): Map<string /* employeeId */, EmployeeDayMap> {
  const result = new Map<string, EmployeeDayMap>();
  const clipStart = startOfDay(rangeStart);
  const clipEnd = startOfDay(rangeEnd);

  for (const assignment of assignments) {
    if (!assignment.allocations || assignment.allocations.length === 0) continue;

    let dayMap = result.get(assignment.employeeId);
    if (!dayMap) {
      dayMap = new Map();
      result.set(assignment.employeeId, dayMap);
    }

    for (const alloc of assignment.allocations) {
      if (alloc.plannedHours <= 0) continue;

      // alloc.month is yyyy-MM-01
      const monthDate = startOfDay(new Date(`${alloc.month}T00:00:00`));
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      // Total weekdays in the month (used to compute per-day hours).
      const totalWeekdaysInMonth = countWeekdays(monthStart, monthEnd);
      if (totalWeekdaysInMonth === 0) continue;

      const hoursPerWeekday = alloc.plannedHours / totalWeekdaysInMonth;

      // Walk weekdays in the month that fall within the visible range.
      const from = monthStart > clipStart ? monthStart : clipStart;
      const to = monthEnd < clipEnd ? monthEnd : clipEnd;
      if (!(from <= to)) continue;

      const current = new Date(from);
      while (current <= to) {
        const dow = current.getDay();
        if (dow !== 0 && dow !== 6) {
          // weekday
          const key = toLocalDateString(current);
          const entry = dayMap.get(key);
          if (!entry) {
            dayMap.set(key, { planHours: hoursPerWeekday });
          } else {
            entry.planHours += hoursPerWeekday;
          }
        }
        current.setDate(current.getDate() + 1);
      }
    }
  }

  return result;
}
