import { parseLocalDateKey, toLocalDateKey } from "@/lib/analysis/date-utils";
import type { DashboardDateRange } from "@/lib/dashboard/filter-ranges";

export type DashboardComparisonMode = "none" | "previous-period";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function getPreviousPeriodRange(range: DashboardDateRange): DashboardDateRange {
  const currentStart = parseLocalDateKey(range.startDate);
  const currentEnd = parseLocalDateKey(range.endDate);
  const durationDays = Math.round((currentEnd.getTime() - currentStart.getTime()) / DAY_IN_MS) + 1;

  const previousEnd = new Date(currentStart);
  previousEnd.setDate(previousEnd.getDate() - 1);

  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - durationDays + 1);

  return {
    startDate: toLocalDateKey(previousStart),
    endDate: toLocalDateKey(previousEnd),
  };
}
