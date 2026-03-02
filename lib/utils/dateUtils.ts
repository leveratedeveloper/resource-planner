import { addDays, startOfDay } from 'date-fns';

/**
 * Moves a date to the nearest weekday if it falls on a weekend.
 * @param date - The date to adjust
 * @param direction - Direction to move: 'forward' moves to Monday, 'backward' moves to Friday
 */
export function skipWeekend(date: Date, direction: 'forward' | 'backward'): Date {
  const result = new Date(date);
  const day = result.getDay();

  if (day === 0) { // Sunday
    return addDays(result, direction === 'forward' ? 1 : -2);
  }
  if (day === 6) { // Saturday
    return addDays(result, direction === 'forward' ? 2 : -1);
  }

  return result;
}

/**
 * Calculates the target workday by adding workdays while skipping weekends.
 * The start day counts as day 1 (1-indexed counting).
 *
 * @param startDate - The starting date (counts as day 1)
 * @param workDays - Number of workdays to count (start day counts)
 * @returns The target date after counting the specified workdays
 *
 * @example
 * // Wednesday + 4 workdays = Monday (start day counts as day 1)
 * // Day 1: Wed, Day 2: Thu, Day 3: Fri, Skip: Sat/Sun, Day 4: Mon
 * calculateTargetWorkday(wednesday, 4) // → Monday
 */
export function calculateTargetWorkday(startDate: Date, workDays: number): Date {
  let targetDate = new Date(startDate);
  let countedDays = 1; // Start day counts as day 1

  // Count the start day if it's a weekday
  const startDayOfWeek = targetDate.getDay();
  if (startDayOfWeek === 0 || startDayOfWeek === 6) {
    // If starting on weekend, don't count it - start from Monday
    countedDays = 0;
  }

  while (countedDays < workDays) {
    targetDate.setDate(targetDate.getDate() + 1);
    // Only count weekdays (Monday=1 through Friday=5)
    const dayOfWeek = targetDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      countedDays++;
    }
  }

  return targetDate;
}

/**
 * Checks if a date falls on a weekend (Saturday or Sunday).
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Generates a Set of date strings (YYYY-MM-DD) for all dates in the given date ranges.
 * Useful for O(1) date containment checks.
 */
export function createDateSet(dateRanges: Array<{ startDate: string | Date; endDate: string | Date }>): Set<string> {
  const set = new Set<string>();
  
  for (const range of dateRanges) {
    let current = startOfDay(new Date(range.startDate));
    const end = startOfDay(new Date(range.endDate));
    
    while (current <= end) {
      set.add(current.toISOString().split('T')[0]);
      current = addDays(current, 1);
    }
  }
  
  return set;
}

/**
 * Checks if a date falls within any of the given date ranges.
 * Optimized version that uses a pre-computed Set.
 */
export function isDateInSet(date: Date, dateSet: Set<string>): boolean {
  const dateStr = startOfDay(date).toISOString().split('T')[0];
  return dateSet.has(dateStr);
}

/**
 * Counts the number of weekdays (Monday-Friday) between two dates, inclusive.
 *
 * @param startDate - The start date
 * @param endDate - The end date
 * @returns The count of weekdays between the two dates (inclusive)
 *
 * @example
 * // Friday to Monday = 2 days (Fri, Mon)
 * countWeekdays(friday, monday) // → 2
 */
export function countWeekdays(startDate: Date, endDate: Date): number {
  let count = 0;
  let current = startOfDay(new Date(startDate));
  const end = startOfDay(new Date(endDate));

  while (current <= end) {
    if (!isWeekend(current)) {
      count++;
    }
    current = addDays(current, 1);
  }

  return count;
}
