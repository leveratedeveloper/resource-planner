import { eachMonthOfInterval, format, startOfMonth } from "date-fns";

export type MonthHours = { month: string /* yyyy-MM-01 */; plannedHours: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Equal split of `total` across every calendar month touched by [startDate, endDate]. */
export function splitTotalAcrossMonths(total: number, startDate: string, endDate: string): MonthHours[] {
  const start = startOfMonth(new Date(`${startDate}T00:00:00`));
  const end = startOfMonth(new Date(`${endDate}T00:00:00`));
  if (end < start) return [];
  const months = eachMonthOfInterval({ start, end });
  if (months.length === 0) return [];
  const per = round2(total / months.length);
  return months.map((m) => ({ month: format(m, "yyyy-MM-01"), plannedHours: per }));
}
