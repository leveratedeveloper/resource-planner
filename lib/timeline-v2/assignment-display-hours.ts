import { endOfMonth, startOfDay } from "date-fns";

type MonthlyAllocationLike = { month: string; plannedHours: number };

type AssignmentDisplayHoursInput = {
  allocations?: MonthlyAllocationLike[];
};

type DisplayRange = {
  startDate: Date;
  endDate: Date;
};

// Allocation month is stored as 'yyyy-MM-01'.
function parseMonth(value: string): Date {
  const [year, month] = value.split("-").map(Number);
  return startOfDay(new Date(year, (month || 1) - 1, 1));
}

function roundHours(hours: number): number {
  return Math.round(hours * 10) / 10;
}

/**
 * Total planned hours for an engagement within the visible range, summed from
 * its monthly allocations. A month counts when its calendar span overlaps the
 * range (monthly grain — no sub-month proration). With no range, sums all.
 */
export function calculateAssignmentDisplayTotalHours(
  assignment: AssignmentDisplayHoursInput,
  range?: DisplayRange
): number {
  const allocations = assignment.allocations ?? [];
  if (allocations.length === 0) return 0;

  const rangeStart = range ? startOfDay(range.startDate) : null;
  const rangeEnd = range ? startOfDay(range.endDate) : null;

  let total = 0;
  for (const allocation of allocations) {
    if (rangeStart && rangeEnd) {
      const monthStart = parseMonth(allocation.month);
      const monthEnd = endOfMonth(monthStart);
      // Skip months whose calendar span does not overlap the visible range.
      if (!(monthStart <= rangeEnd && monthEnd >= rangeStart)) continue;
    }
    total += Number(allocation.plannedHours) || 0;
  }
  return roundHours(total);
}

export function formatAssignmentDisplayHours(hours: number): string {
  const rounded = roundHours(Number.isFinite(hours) ? hours : 0);
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}h`;
}
