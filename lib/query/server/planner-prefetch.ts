import {
  getTimelineActualAssignments,
  getTimelineAssignments,
  getTimelineMonthlyActualAggregates,
  getTimelineMonthlyAssignmentAggregates,
} from "@/lib/mysql-assignments/queries";
import { toLocalDateString } from "@/lib/utils";
import type { SessionData } from "@/lib/auth/session";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import {
  buildMonthlyActualBlocksFromAggregates,
  buildMonthlyAssignmentBlocksFromAggregates,
  summarizeMonthlyActualAssignments,
  summarizeMonthlyAssignments,
  type MonthlyAggregateActualRow,
  type MonthlyAggregateAssignmentRow,
  type PlannerTimelineRequest,
  type PlannerTimelineResponse,
} from "@/lib/planner/planner-loading";

type PlannerTiming = {
  phase: (phase: string, context?: Record<string, unknown>) => void;
};

type ApiRecord = Record<string, unknown>;

function text(value: unknown, fallback = ""): string {
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : fallback;
}

function stringValue(value: unknown, fallback = ""): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

function nullableText(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : null;
}

function dateValue(value: unknown): string {
  if (value instanceof Date) return toLocalDateString(value);
  if (typeof value === "string") return value.slice(0, 10);
  return "";
}

function numberValue(value: unknown, fallback = 0): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function booleanValue(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

function transformAssignment(mysqlAssignment: ApiRecord): Assignment {
  return {
    id: text(mysqlAssignment.uuid),
    employeeId: text(mysqlAssignment.employee_uuid),
    projectId: nullableText(mysqlAssignment.project_uuid),
    taskId: nullableText(mysqlAssignment.task_uuid),
    startDate: dateValue(mysqlAssignment.start_date),
    endDate: dateValue(mysqlAssignment.end_date),
    hoursPerDay: stringValue(mysqlAssignment.hours_per_day),
    totalHours:
      mysqlAssignment.total_hours === null || mysqlAssignment.total_hours === undefined
        ? null
        : numberValue(mysqlAssignment.total_hours),
    allocationPercentage:
      mysqlAssignment.allocation_percentage === null || mysqlAssignment.allocation_percentage === undefined
        ? null
        : stringValue(mysqlAssignment.allocation_percentage),
    isTimeOff: booleanValue(mysqlAssignment.is_time_off),
    timeOffTypeId: nullableText(mysqlAssignment.time_off_type_uuid),
    category: nullableText(mysqlAssignment.category),
    isBillable: booleanValue(mysqlAssignment.is_billable),
    isAdjustment: booleanValue(mysqlAssignment.is_adjustment),
    status:
      mysqlAssignment.status === "draft" ||
      mysqlAssignment.status === "confirmed" ||
      mysqlAssignment.status === "completed"
        ? mysqlAssignment.status
        : "confirmed",
    note: nullableText(mysqlAssignment.note),
    createdById: nullableText(mysqlAssignment.created_by_uuid),
    createdAt: text(mysqlAssignment.created_at),
    updatedAt: text(mysqlAssignment.updated_at),
  };
}

function transformActual(mysqlActual: ApiRecord): ActualAssignment {
  return {
    uuid: text(mysqlActual.uuid),
    employeeUuid: text(mysqlActual.employee_uuid),
    projectUuid: nullableText(mysqlActual.project_uuid),
    taskUuid: nullableText(mysqlActual.task_uuid),
    startDate: dateValue(mysqlActual.start_date),
    endDate: dateValue(mysqlActual.end_date),
    hoursPerDay: numberValue(mysqlActual.hours_per_day),
    allocationPercentage:
      mysqlActual.allocation_percentage === null || mysqlActual.allocation_percentage === undefined
        ? null
        : numberValue(mysqlActual.allocation_percentage),
    isTimeOff: booleanValue(mysqlActual.is_time_off),
    timeOffTypeUuid: nullableText(mysqlActual.time_off_type_uuid),
    category: nullableText(mysqlActual.category),
    isBillable: booleanValue(mysqlActual.is_billable),
    status: text(mysqlActual.status),
    note: nullableText(mysqlActual.note),
    createdByUuid: nullableText(mysqlActual.created_by_uuid),
    createdAt: text(mysqlActual.created_at),
    updatedAt: text(mysqlActual.updated_at),
  };
}

export async function fetchPlannerAssignments(
  session: SessionData,
  dateRange: { startDate: string; endDate: string },
  filters: PlannerTimelineRequest["filters"] = {},
  employeeUuids?: string[]
): Promise<Assignment[]> {
  const employeeUuid = !session.access.can_view_all ? session.employee?.uuid : undefined;
  const assignments = (await getTimelineAssignments({
    employee_uuid: employeeUuid,
    // Query-layer invariant: restricted users stay scoped to their own uuid
    // even if a caller passes a uuid list (the list would supersede it).
    employee_uuids: session.access.can_view_all ? employeeUuids : undefined,
    start_date: dateRange.startDate,
    end_date: dateRange.endDate,
    status: filters?.status,
    category: filters?.category,
  })) as ApiRecord[];

  return assignments.map(transformAssignment);
}

export async function fetchPlannerActualAssignments(
  session: SessionData,
  dateRange: { startDate: string; endDate: string },
  filters: PlannerTimelineRequest["filters"] = {},
  employeeUuids?: string[]
): Promise<ActualAssignment[]> {
  const employeeUuid = !session.access.can_view_all ? session.employee?.uuid : undefined;
  const actuals = (await getTimelineActualAssignments({
    employee_uuid: employeeUuid,
    // Query-layer invariant: restricted users stay scoped to their own uuid
    // even if a caller passes a uuid list (the list would supersede it).
    employee_uuids: session.access.can_view_all ? employeeUuids : undefined,
    start_date: dateRange.startDate,
    end_date: dateRange.endDate,
    status: filters?.status,
    category: filters?.category,
  })) as ApiRecord[];

  return actuals.map(transformActual);
}

// Raw aggregate rows (snake_case, numerics possibly strings from pg) → typed
// shaping inputs. Coercion mirrors transformAssignment/transformActual.
function coerceMonthlyAssignmentAggregateRow(row: ApiRecord): MonthlyAggregateAssignmentRow {
  return {
    employeeUuid: text(row.employee_uuid),
    projectUuid: nullableText(row.project_uuid),
    monthStart: dateValue(row.month_start),
    note: nullableText(row.note),
    category: nullableText(row.category),
    status: text(row.status),
    isBillable: booleanValue(row.is_billable),
    isAdjustment: booleanValue(row.is_adjustment),
    totalHours: numberValue(row.total_hours),
    detailCount: numberValue(row.detail_count),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

function coerceMonthlyActualAggregateRow(row: ApiRecord): MonthlyAggregateActualRow {
  return {
    employeeUuid: text(row.employee_uuid),
    projectUuid: nullableText(row.project_uuid),
    monthStart: dateValue(row.month_start),
    note: nullableText(row.note),
    category: nullableText(row.category),
    status: text(row.status),
    isBillable: booleanValue(row.is_billable),
    monthHours: numberValue(row.month_hours),
    detailCount: numberValue(row.detail_count),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

// SQL-side month aggregation is the default; PLANNER_SQL_MONTH_AGG=0 falls
// back to the raw-row pull + TS summarize for one release (parity insurance —
// Phase 8 spec).
function shouldUseSqlMonthAggregation(): boolean {
  return process.env.PLANNER_SQL_MONTH_AGG !== "0";
}

async function fetchMonthlyTimelineAggregates(
  session: SessionData,
  request: PlannerTimelineRequest,
  employeeUuids: string[] | undefined,
  timing: PlannerTiming
): Promise<PlannerTimelineResponse> {
  // Same restricted-user gating as the raw fetchers: the session uuid is the
  // floor, caller-supplied lists only apply for can_view_all sessions.
  const filters = {
    employee_uuid: !session.access.can_view_all ? session.employee?.uuid : undefined,
    employee_uuids: session.access.can_view_all ? employeeUuids : undefined,
    start_date: request.startDate,
    end_date: request.endDate,
    status: request.filters?.status,
    category: request.filters?.category,
  };

  const [aggregateRows, actualAggregateRows] = await Promise.all([
    getTimelineMonthlyAssignmentAggregates(filters) as Promise<ApiRecord[]>,
    getTimelineMonthlyActualAggregates(filters) as Promise<ApiRecord[]>,
  ]);

  const assignments = buildMonthlyAssignmentBlocksFromAggregates(
    aggregateRows.map(coerceMonthlyAssignmentAggregateRow)
  );
  const actualAssignments = buildMonthlyActualBlocksFromAggregates(
    actualAggregateRows.map(coerceMonthlyActualAggregateRow)
  );
  timing.phase("monthly_summary", {
    assignmentCount: assignments.length,
    actualAssignmentCount: actualAssignments.length,
    sqlAggregated: true,
  });

  return { request, assignments, actualAssignments };
}

export async function fetchPlannerTimeline(
  session: SessionData,
  request: PlannerTimelineRequest,
  options: { timing?: PlannerTiming; employeeUuids?: string[] } = {}
): Promise<PlannerTimelineResponse> {
  const timing: PlannerTiming = options.timing ?? {
    phase: () => undefined,
  };

  if (request.resolution === "month" && shouldUseSqlMonthAggregation()) {
    return fetchMonthlyTimelineAggregates(session, request, options.employeeUuids, timing);
  }

  const dateRange = {
    startDate: request.startDate,
    endDate: request.endDate,
  };
  const plannedPromise = fetchPlannerAssignments(session, dateRange, request.filters, options.employeeUuids).then((assignments) => {
    timing.phase("planned_assignments_query", { count: assignments.length });
    return assignments;
  });
  const actualPromise = fetchPlannerActualAssignments(session, dateRange, request.filters, options.employeeUuids).then((actualAssignments) => {
    timing.phase("actual_assignments_query", { count: actualAssignments.length });
    return actualAssignments;
  });

  const [assignments, actualAssignments] = await Promise.all([plannedPromise, actualPromise]);

  if (request.resolution === "month") {
    const summarizedAssignments = summarizeMonthlyAssignments(assignments, dateRange);
    const summarizedActualAssignments = summarizeMonthlyActualAssignments(
      actualAssignments,
      dateRange
    );
    timing.phase("monthly_summary", {
      assignmentCount: summarizedAssignments.length,
      actualAssignmentCount: summarizedActualAssignments.length,
    });

    return {
      request,
      assignments: summarizedAssignments,
      actualAssignments: summarizedActualAssignments,
    };
  }

  timing.phase("monthly_summary", {
    assignmentCount: assignments.length,
    actualAssignmentCount: actualAssignments.length,
    skipped: true,
  });

  return {
    request,
    assignments,
    actualAssignments,
  };
}
