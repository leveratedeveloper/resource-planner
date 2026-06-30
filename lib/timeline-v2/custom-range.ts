import { addMonths, differenceInCalendarMonths, startOfMonth } from "date-fns";

export const CUSTOM_RANGE_MAX_MONTHS = 12;

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

export type MonthCellState = "start" | "end" | "in-range" | "disabled" | "default";

/**
 * Classify one month cell in the range-picker grid.
 *
 * - `capAnchor` is set only while the user is picking the END month: any month
 *   more than `maxMonths-1` after it is `disabled`, which enforces the window
 *   cap directly in the grid rather than silently clamping after the fact.
 * - `rangeStart`/`rangeEnd` describe the span to highlight — the committed range
 *   when idle, or start→hovered-month while previewing an end selection.
 */
export function getMonthCellState(args: {
  month: Date;
  rangeStart: Date | null;
  rangeEnd: Date | null;
  capAnchor: Date | null;
  maxMonths?: number;
}): MonthCellState {
  const max = args.maxMonths ?? CUSTOM_RANGE_MAX_MONTHS;
  const m = startOfMonth(args.month).getTime();

  if (args.capAnchor) {
    const capEnd = addMonths(startOfMonth(args.capAnchor), max - 1).getTime();
    if (m > capEnd) return "disabled";
  }

  const s = args.rangeStart ? startOfMonth(args.rangeStart).getTime() : null;
  const e = args.rangeEnd ? startOfMonth(args.rangeEnd).getTime() : null;

  if (s !== null && m === s) return "start";
  if (e !== null && m === e) return "end";
  if (s !== null && e !== null && m > s && m < e) return "in-range";
  return "default";
}
