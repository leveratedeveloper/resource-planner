import { toLocalDateKey } from "@/lib/analysis/date-utils";
import type { DashboardDateRange } from "@/lib/dashboard/filter-ranges";

const DEFAULT_FORECAST_WEEKS = 4;
const DAYS_PER_WEEK = 7;

function getWeekStart(date: Date): Date {
  const start = new Date(date);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function getForecastDateRange(
  startDate: Date = new Date(),
  weeksAhead: number = DEFAULT_FORECAST_WEEKS
): DashboardDateRange {
  const start = getWeekStart(startDate);
  const end = new Date(start);
  end.setDate(end.getDate() + weeksAhead * DAYS_PER_WEEK - 1);

  return {
    startDate: toLocalDateKey(start),
    endDate: toLocalDateKey(end),
  };
}
