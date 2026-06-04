import { getActualAssignments, getAssignments } from "@/lib/mysql-assignments/queries";
import { toLocalDateString } from "@/lib/utils";
import type { SessionData } from "@/lib/auth/session";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import {
  summarizeMonthlyActualAssignments,
  summarizeMonthlyAssignments,
  type PlannerTimelineRequest,
  type PlannerTimelineResponse,
} from "@/lib/timeline/planner-loading";

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
  dateRange: { startDate: string; endDate: string }
): Promise<Assignment[]> {
  const employeeUuid = !session.access.can_view_all ? session.employee?.uuid : undefined;
  const assignments = (await getAssignments({
    employee_uuid: employeeUuid,
    start_date: dateRange.startDate,
    end_date: dateRange.endDate,
  })) as ApiRecord[];

  return assignments.map(transformAssignment);
}

export async function fetchPlannerActualAssignments(
  session: SessionData,
  dateRange: { startDate: string; endDate: string }
): Promise<ActualAssignment[]> {
  const employeeUuid = !session.access.can_view_all ? session.employee?.uuid : undefined;
  const actuals = (await getActualAssignments({
    employee_uuid: employeeUuid,
    start_date: dateRange.startDate,
    end_date: dateRange.endDate,
  })) as ApiRecord[];

  return actuals.map(transformActual);
}

function filterPlannerAssignments(
  assignments: Assignment[],
  request: PlannerTimelineRequest
): Assignment[] {
  return assignments.filter((assignment) => {
    if (request.filters?.category && assignment.category !== request.filters.category) {
      return false;
    }
    if (request.filters?.status && assignment.status !== request.filters.status) {
      return false;
    }
    return true;
  });
}

function filterPlannerActualAssignments(
  actualAssignments: ActualAssignment[],
  request: PlannerTimelineRequest
): ActualAssignment[] {
  return actualAssignments.filter((assignment) => {
    if (request.filters?.category && assignment.category !== request.filters.category) {
      return false;
    }
    if (request.filters?.status && assignment.status !== request.filters.status) {
      return false;
    }
    return true;
  });
}

export async function fetchPlannerTimeline(
  session: SessionData,
  request: PlannerTimelineRequest,
  options: { timing?: PlannerTiming } = {}
): Promise<PlannerTimelineResponse> {
  const timing: PlannerTiming = options.timing ?? {
    phase: () => undefined,
  };
  const dateRange = {
    startDate: request.startDate,
    endDate: request.endDate,
  };
  const plannedPromise = fetchPlannerAssignments(session, dateRange).then((assignments) => {
    timing.phase("planned_assignments_query", { count: assignments.length });
    return assignments;
  });
  const actualPromise = fetchPlannerActualAssignments(session, dateRange).then((actualAssignments) => {
    timing.phase("actual_assignments_query", { count: actualAssignments.length });
    return actualAssignments;
  });

  const [assignments, actualAssignments] = await Promise.all([plannedPromise, actualPromise]);
  const filteredAssignments = filterPlannerAssignments(assignments, request);
  const filteredActualAssignments = filterPlannerActualAssignments(actualAssignments, request);

  if (request.resolution === "month") {
    const summarizedAssignments = summarizeMonthlyAssignments(filteredAssignments, dateRange);
    const summarizedActualAssignments = summarizeMonthlyActualAssignments(
      filteredActualAssignments,
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
    assignmentCount: filteredAssignments.length,
    actualAssignmentCount: filteredActualAssignments.length,
    skipped: true,
  });

  return {
    request,
    assignments: filteredAssignments,
    actualAssignments: filteredActualAssignments,
  };
}
