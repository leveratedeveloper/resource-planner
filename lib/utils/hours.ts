// Helper function to safely parse hours - returns 0 for invalid values
// Handles string | number | null | undefined inputs
// Supports both dot (.) and comma (,) as decimal separator
export const parseHoursSafe = (hours?: string | number | null): number => {
  if (hours === null || hours === undefined) return 0;
  // Normalize comma to dot for parseFloat (supports both "0.5" and "0,5" formats)
  const normalized = String(hours).replace(',', '.');
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
};
