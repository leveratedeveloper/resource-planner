import { format, parseISO } from "date-fns";

export const MONTH_CAPACITY_HOURS = 160;
export const WEEK_CAPACITY_HOURS = 40;
export const DAY_CAPACITY_HOURS = 8;
export const CRITICAL_THRESHOLD = 0.9;

export type MonthHoursEntry = { month: string /* yyyy-MM-01 */; hours: number };
export type CriticalMonth = { month: string; monthLabel: string; percentage: number };

export const monthPct = (hours: number) => hours / MONTH_CAPACITY_HOURS;
export const weekPct = (hours: number) => hours / WEEK_CAPACITY_HOURS;
export const dayPct = (hours: number) => hours / DAY_CAPACITY_HOURS;

/** Sum hours per month across an employee's allocation entries. */
export function sumByMonth(entries: MonthHoursEntry[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of entries) m.set(e.month, (m.get(e.month) ?? 0) + e.hours);
  return m;
}

/** Months over the critical threshold (for the modal's red indicator). */
export function criticalMonths(entries: MonthHoursEntry[], threshold = CRITICAL_THRESHOLD): CriticalMonth[] {
  return [...sumByMonth(entries).entries()]
    .map(([month, hours]) => ({ month, pct: monthPct(hours) }))
    .filter((x) => x.pct > threshold)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(({ month, pct }) => ({ month, monthLabel: format(parseISO(month), "MMM yyyy"), percentage: Math.round(pct * 100) }));
}
