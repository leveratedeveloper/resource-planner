import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import type { UpsertBody } from "@/lib/query/hooks/useAssignmentCommands";
import { parseManHoursInput, splitTotalAcrossMonths, toDateInputValue } from "./split";

export type AssignSpan = { startDate: string; endDate: string };

/** Derive a date span from a project.
 *  - campaign: use startDate + endDate when BOTH are present, else null.
 *  - pitch: ProjectOption carries no submitDate, so use startDate as a single-day
 *    span when present, else null.
 *
 *  Both dates are coerced through toDateInputValue so verbose driver strings
 *  ("Wed Jun 18 2025 00:00:00 GMT+0700 (...)") become strict "yyyy-MM-dd". The
 *  downstream splitTotalAcrossMonths parses with `new Date(`${date}T00:00:00`)`,
 *  which yields Invalid Date — and therefore zero allocations — on the verbose
 *  form. The single-assign path coerces the same way; the bulk path must too. */
export function deriveProjectSpan(
  p: Pick<ProjectOption, "projectType" | "startDate" | "endDate">,
): AssignSpan | null {
  if (p.projectType === "campaign") {
    const startDate = toDateInputValue(p.startDate);
    const endDate = toDateInputValue(p.endDate);
    if (startDate && endDate) return { startDate, endDate };
    return null;
  }
  const startDate = toDateInputValue(p.startDate);
  if (startDate) return { startDate, endDate: startDate };
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

/** One-shot fill: produce a hours-by-member record assigning `value` to every id.
 *  The caller merges this into existing state, so rows stay individually editable after. */
export function applyHoursToAll(memberIds: string[], value: string): Record<string, string> {
  return Object.fromEntries(memberIds.map((id) => [id, value]));
}

/** Project shape the operation builder needs — structural subset of ProjectOption. */
export type BulkAssignProject = Pick<
  ProjectOption,
  "projectKey" | "projectType" | "startDate" | "endDate"
>;

/** Member shape the operation builder needs. */
export type BulkAssignMember = { id: string };

/** Build the draft upsert payloads for a member×project selection.
 *  A member's hours number is applied IN FULL to each assignable project (split across
 *  that project's own month span); projects with no usable dates are skipped. */
export function buildBulkAssignOperations(input: {
  members: BulkAssignMember[];
  projects: BulkAssignProject[];
  hoursByMember: Record<string, string>;
}): UpsertBody[] {
  const ops: UpsertBody[] = [];
  for (const m of input.members) {
    const total = parseManHoursInput(input.hoursByMember[m.id]) ?? 0;
    for (const p of input.projects) {
      const span = deriveProjectSpan(p);
      if (!span) continue;
      const monthlyHours = Object.fromEntries(
        splitTotalAcrossMonths(total, span.startDate, span.endDate).map((x) => [x.month, x.plannedHours]),
      );
      ops.push({
        employeeUuid: m.id,
        projectKey: p.projectKey,
        span,
        monthlyHours,
        status: "draft",
        mode: "merge",
      });
    }
  }
  return ops;
}
