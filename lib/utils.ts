import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a Date object to a date-only string (YYYY-MM-DD) without timezone conversion.
 * This prevents the timezone offset issue where toISOString() shifts dates in non-UTC timezones.
 * 
 * Example: In UTC+7, Feb 4 00:00:00 local → toISOString() = "2026-02-03T17:00:00.000Z" (wrong!)
 *          But toLocalDateString() → "2026-02-04" (correct!)
 */
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
