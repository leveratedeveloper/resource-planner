/**
 * Local Date Utilities
 * Timezone-safe date key generation and parsing for analysis modules.
 * These avoid the UTC shift caused by toISOString().split("T")[0].
 *
 * Example (UTC+7):
 *   new Date("2026-02-04") → toISOString() = "2026-02-03T17:00:00.000Z" → split = "2026-02-03" ❌
 *   toLocalDateKey(new Date(2026, 1, 4)) → "2026-02-04" ✅
 */

/**
 * Format a Date to a "YYYY-MM-DD" string using local timezone components.
 */
export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Parse a "YYYY-MM-DD" string into a Date at local midnight.
 * Avoids the UTC-midnight interpretation that `new Date("2026-02-04")` uses.
 */
export function parseLocalDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}
