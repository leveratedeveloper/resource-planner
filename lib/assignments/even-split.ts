/**
 * Even vs customized predicate for monthly plan distributions.
 *
 * "Even" is tolerance-based, NOT exact equality against splitTotalAcrossMonths:
 * the migration wrote a uniform per-month value (33.33/33.33/33.33) while
 * splitTotalAcrossMonths puts rounding drift on the last month (…/33.34). Both
 * must read as even. A real customization shifts >= 1h between months.
 */
const EVEN_TOLERANCE_HOURS = 1;

export function isEvenSplit(hours: number[], tolerance: number = EVEN_TOLERANCE_HOURS): boolean {
  if (hours.length <= 1) return true;
  const max = Math.max(...hours);
  const min = Math.min(...hours);
  return max - min <= tolerance;
}

/** Map equality with a sub-1h float tolerance per month (storage is decimal). */
export function monthlyMapsEqual(
  a: Record<string, number> | null | undefined,
  b: Record<string, number> | null | undefined,
): boolean {
  const left = a ?? {};
  const right = b ?? {};
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    const lv = left[key];
    const rv = right[key];
    if (lv === undefined || rv === undefined) return false;
    if (Math.abs(lv - rv) > 0.5) return false;
  }
  return true;
}
