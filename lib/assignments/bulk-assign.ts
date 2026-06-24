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

export type BulkAssignSummary = {
  assignableProjectCount: number;
  skippedCount: number;
  totalAssignments: number;
};

/** Count how many draft assignments a member×project selection will create.
 *  A project counts only if deriveProjectSpan returns a span; the rest are skipped. */
export function summarizeBulkAssign(
  memberCount: number,
  projects: Array<Pick<ProjectOption, "projectType" | "startDate" | "endDate">>,
): BulkAssignSummary {
  const assignableProjectCount = projects.filter((p) => deriveProjectSpan(p) !== null).length;
  return {
    assignableProjectCount,
    skippedCount: projects.length - assignableProjectCount,
    totalAssignments: memberCount * assignableProjectCount,
  };
}
