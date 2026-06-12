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

// Implementation moved to lib/timeline-v2/hours.ts; re-exported here until the
// lib/timeline directory is retired.
export { parseHoursSafe } from "@/lib/timeline-v2/hours";
