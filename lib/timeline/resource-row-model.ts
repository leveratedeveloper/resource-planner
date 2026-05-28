import { toLocalDateString } from "@/lib/utils";

export function extractDeliverables(note: string | null): string[] {
  if (!note) return [];
  const match = note.match(/Deliverable[s]?:\s*([^.\n]+)/);
  if (!match) return [];
  return match[1].split(",").map((value) => value.trim()).filter(Boolean);
}

export function getMonthlyDetailKey(
  resourceId: string,
  projectId: string,
  monthStart: Date,
  monthEnd: Date
): string {
  return [
    resourceId,
    projectId,
    toLocalDateString(monthStart),
    toLocalDateString(monthEnd),
  ].join(":");
}

export function parseHoursSafe(hours?: string | number | null): number {
  if (hours === null || hours === undefined) return 0;
  const normalized = String(hours).replace(",", ".");
  const parsed = parseFloat(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
}
