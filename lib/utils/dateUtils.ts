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
