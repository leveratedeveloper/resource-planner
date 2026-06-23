import {
  getEngagements,
  type AllocationRow,
  type EngagementRow,
} from "@/lib/assignments/assignment-reads";
import type { SessionData } from "@/lib/auth/session";
import type { Assignment, MonthlyAllocation } from "@/lib/query/hooks/useAssignments";
import type {
  PlannerTimelineRequest,
  PlannerTimelineResponse,
} from "@/lib/planner/planner-loading";

type PlannerTiming = {
  phase: (phase: string, context?: Record<string, unknown>) => void;
};

// ---------------------------------------------------------------------------
// Stitch helpers — mirrors the client-side stitchAssignments in useAssignments
// ---------------------------------------------------------------------------

function stitchEngagements(
  engagements: EngagementRow[],
  allocations: AllocationRow[]
): Assignment[] {
  const allocationsByUuid = new Map<string, MonthlyAllocation[]>();
  for (const alloc of allocations) {
    const list = allocationsByUuid.get(alloc.assignment_uuid) ?? [];
    list.push({
      month: alloc.month,
      // planned_hours comes back as a string from the DB driver
      plannedHours: Number(alloc.planned_hours),
      kind: alloc.kind as "plan" | "adjustment",
    });
    allocationsByUuid.set(alloc.assignment_uuid, list);
  }

  return engagements.map((eng): Assignment => ({
    id: eng.assignment_uuid,
    employeeId: eng.employee_uuid,
    projectKey: eng.project_key,
    startDate: eng.start_date,
    endDate: eng.end_date,
    status: eng.status === "draft" ? "draft" : "confirmed",
    note: eng.note,
    allocations: allocationsByUuid.get(eng.assignment_uuid) ?? [],
    createdBy: eng.created_by,
    updatedBy: eng.updated_by,
  }));
}

// ---------------------------------------------------------------------------
// Public fetch — sources plan assignments from getEngagements.
//
// PERF NOTE: getEngagements does not accept employee_uuids (a set); when the
// caller supplies a set, we fetch unscoped (all engagements) and filter in JS.
// For large orgs this is a table-scan. A future optimisation is to add an
// employee_uuids IN-clause to getEngagements — tracked in assignment-reads.
// ---------------------------------------------------------------------------

export async function fetchPlannerAssignments(
  session: SessionData,
  _dateRange: { startDate: string; endDate: string },
  _filters: PlannerTimelineRequest["filters"] = {},
  employeeUuids?: string[]
): Promise<Assignment[]> {
  // Restricted users are always scoped to their own employee uuid.
  const ownUuid = !session.access.can_view_all ? session.employee?.uuid : undefined;

  const { engagements, allocations } = await getEngagements(
    ownUuid ? { employee_uuid: ownUuid } : {}
  );

  let assignments = stitchEngagements(engagements, allocations);

  // If the caller supplied an explicit set of employee uuids (view-all only),
  // narrow the stitched results in JS.
  if (session.access.can_view_all && employeeUuids && employeeUuids.length > 0) {
    const set = new Set(employeeUuids);
    assignments = assignments.filter((a) => set.has(a.employeeId));
  }

  return assignments;
}

export async function fetchPlannerTimeline(
  session: SessionData,
  request: PlannerTimelineRequest,
  options: { timing?: PlannerTiming; employeeUuids?: string[] } = {}
): Promise<PlannerTimelineResponse> {
  const timing: PlannerTiming = options.timing ?? { phase: () => undefined };

  const assignments = await fetchPlannerAssignments(
    session,
    { startDate: request.startDate, endDate: request.endDate },
    request.filters,
    options.employeeUuids
  );

  timing.phase("planned_assignments_query", { count: assignments.length });

  return { request, assignments };
}
