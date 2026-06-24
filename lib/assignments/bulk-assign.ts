import type { ProjectOption } from "@/lib/query/hooks/useProjects";

export type AssignSpan = { startDate: string; endDate: string };

/** Derive a date span from a project.
 *  - campaign: use startDate + endDate when BOTH are present, else null.
 *  - pitch: ProjectOption carries no submitDate, so use startDate as a single-day
 *    span when present, else null. */
export function deriveProjectSpan(
  p: Pick<ProjectOption, "projectType" | "startDate" | "endDate">,
): AssignSpan | null {
  if (p.projectType === "campaign") {
    if (p.startDate && p.endDate) return { startDate: p.startDate, endDate: p.endDate };
    return null;
  }
  if (p.startDate) return { startDate: p.startDate, endDate: p.startDate };
  return null;
}
