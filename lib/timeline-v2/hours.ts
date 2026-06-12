export function parseHoursSafe(hours?: string | number | null): number {
  if (hours === null || hours === undefined) return 0;
  const normalized = String(hours).replace(",", ".");
  const parsed = parseFloat(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
}
