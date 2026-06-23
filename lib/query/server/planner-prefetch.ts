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

export async function fetchPlannerAssignments(
  session: SessionData,
  dateRange: { startDate: string; endDate: string },
  _filters: PlannerTimelineRequest["filters"] = {},
  employeeUuids?: string[]
): Promise<Assignment[]> {
  const ownUuid = !session.access.can_view_all ? session.employee?.uuid : undefined;

  const { engagements, allocations } = await getEngagements({
    employee_uuid: ownUuid,
    employee_uuids: session.access.can_view_all ? employeeUuids : undefined,
    rangeStart: dateRange.startDate,
    rangeEnd: dateRange.endDate,
  });

  return stitchEngagements(engagements, allocations);
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
