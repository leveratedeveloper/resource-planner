import { addMonths, differenceInCalendarMonths, format, startOfMonth } from "date-fns";

export const CUSTOM_RANGE_MAX_MONTHS = 12;

export type MonthOption = { value: string; label: string };

/** Serialize a date to the `yyyy-MM` value used by the month selects. */
export function formatMonthValue(date: Date): string {
  return format(startOfMonth(date), "yyyy-MM");
}

/** Parse a `yyyy-MM` value back to a first-of-month Date. */
export function parseMonthValue(value: string): Date {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

/** Options for the "From" select: Jan (anchorYear-1) … Dec (anchorYear+2). */
export function buildFromMonthOptions(anchorYear: number): MonthOption[] {
  const options: MonthOption[] = [];
  for (let year = anchorYear - 1; year <= anchorYear + 2; year++) {
    for (let month = 0; month < 12; month++) {
      const date = new Date(year, month, 1);
      options.push({ value: formatMonthValue(date), label: format(date, "MMM yyyy") });
    }
  }
  return options;
}

/**
 * Options for the "To" select: exactly `maxMonths` months starting at `from`.
 * This is what enforces the window cap, the From<=To ordering, and cross-year
 * spans — the user simply can't pick a To outside the allowed window.
 */
export function buildToMonthOptions(fromValue: string, maxMonths = CUSTOM_RANGE_MAX_MONTHS): MonthOption[] {
  const start = parseMonthValue(fromValue);
  const options: MonthOption[] = [];
  for (let i = 0; i < maxMonths; i++) {
    const date = addMonths(start, i);
    options.push({ value: formatMonthValue(date), label: format(date, "MMM yyyy") });
  }
  return options;
}

/** Snap to first-of-month and clamp end into [start, start+maxMonths-1]. */
export function clampRange(
  start: Date,
  end: Date,
  maxMonths = CUSTOM_RANGE_MAX_MONTHS,
): { start: Date; end: Date } {
  const s = startOfMonth(start);
  let e = startOfMonth(end);
  if (e < s) e = s;
  if (differenceInCalendarMonths(e, s) > maxMonths - 1) e = addMonths(s, maxMonths - 1);
  return { start: s, end: e };
}

/** Inclusive count of months between start and end. */
export function monthsInRange(start: Date, end: Date): number {
  return differenceInCalendarMonths(startOfMonth(end), startOfMonth(start)) + 1;
}
