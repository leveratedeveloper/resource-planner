import {
  eachMonthOfInterval,
  endOfMonth,
  max,
  min,
  startOfDay,
  startOfMonth,
} from "date-fns";
import { queryKeys } from "@/lib/query/queryKeys";
import { toLocalDateString } from "@/lib/utils";
import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import type { Assignment } from "@/lib/query/hooks/useAssignments";

export type TimelineViewMode = "week" | "month" | "quarter" | "halfYear" | "year";
export type PlannerTimelineResolution = "day" | "month";

export type PlannerTimelineFilters = {
  category?: string | null;
  status?: string | null;
};

export type PlannerTimelineRequest = {
  viewMode: TimelineViewMode;
  resolution: PlannerTimelineResolution;
  startDate: string;
  endDate: string;
  employeeUuids?: string[];
  filters?: PlannerTimelineFilters;
};

export type MonthlyTimelineAssignment = Assignment & {
  detailIds: string[];
  resolution: "month";
};

export type MonthlyTimelineActualAssignment = ActualAssignment & {
  detailUuids: string[];
  resolution: "month";
};

export type PlannerTimelineResponse = {
  request: PlannerTimelineRequest;
  assignments: Assignment[];
  actualAssignments: ActualAssignment[];
};

export function getTimelineResolution(viewMode: TimelineViewMode): PlannerTimelineResolution {
  return viewMode === "week" || viewMode === "month" ? "day" : "month";
}

function normalizePlannerFilters(filters?: PlannerTimelineFilters): Required<PlannerTimelineFilters> {
  return {
    category: filters?.category ?? null,
    status: filters?.status ?? null,
  };
}

function normalizeEmployeeUuids(employeeUuids?: string[]) {
  return employeeUuids ? [...employeeUuids].sort() : undefined;
}

function getPlannerTimelineRequestIdentity(request: PlannerTimelineRequest) {
  const employeeUuids = normalizeEmployeeUuids(request.employeeUuids);

  return {
    viewMode: request.viewMode,
    resolution: request.resolution,
    startDate: request.startDate,
    endDate: request.endDate,
    ...(employeeUuids ? { employeeUuids } : {}),
    filters: normalizePlannerFilters(request.filters),
  };
}

export function getPlannerTimelineQueryKey(request: PlannerTimelineRequest) {
  return [...queryKeys.plannerTimeline, getPlannerTimelineRequestIdentity(request)] as const;
}

export function arePlannerTimelineRequestsEqual(
  left?: PlannerTimelineRequest,
  right?: PlannerTimelineRequest
): boolean {
  if (!left || !right) {
    return false;
  }

  const leftFilters = normalizePlannerFilters(left.filters);
  const rightFilters = normalizePlannerFilters(right.filters);
  const leftEmployeeUuids = normalizeEmployeeUuids(left.employeeUuids);
  const rightEmployeeUuids = normalizeEmployeeUuids(right.employeeUuids);

  return (
    left.viewMode === right.viewMode &&
    left.resolution === right.resolution &&
    left.startDate === right.startDate &&
    left.endDate === right.endDate &&
    JSON.stringify(leftEmployeeUuids) === JSON.stringify(rightEmployeeUuids) &&
    leftFilters.category === rightFilters.category &&
    leftFilters.status === rightFilters.status
  );
}

export function getCurrentPlannerTimelineData(
  response: PlannerTimelineResponse | undefined,
  activeRequest: PlannerTimelineRequest | undefined
): PlannerTimelineResponse | undefined {
  if (!response || !activeRequest) {
    return undefined;
  }

  return arePlannerTimelineRequestsEqual(response.request, activeRequest)
    ? response
    : undefined;
}

export function mergePlannerTimelineResponses(
  base: PlannerTimelineResponse | undefined,
  additions: Array<PlannerTimelineResponse | undefined>
): PlannerTimelineResponse | undefined {
  if (!base) {
    return undefined;
  }

  const assignmentsById = new Map(base.assignments.map((assignment) => [assignment.id, assignment]));
  const actualAssignmentsByUuid = new Map(
    base.actualAssignments.map((assignment) => [assignment.uuid, assignment])
  );

  for (const addition of additions) {
    if (!addition) continue;

    for (const assignment of addition.assignments) {
      if (!assignmentsById.has(assignment.id)) {
        assignmentsById.set(assignment.id, assignment);
      }
    }

    for (const assignment of addition.actualAssignments) {
      if (!actualAssignmentsByUuid.has(assignment.uuid)) {
        actualAssignmentsByUuid.set(assignment.uuid, assignment);
      }
    }
  }

  return {
    request: base.request,
    assignments: Array.from(assignmentsById.values()),
    actualAssignments: Array.from(actualAssignmentsByUuid.values()),
  };
}

function countWeekdays(startDate: Date, endDate: Date): number {
  let weekdays = 0;
  const current = startOfDay(startDate);
  const end = startOfDay(endDate);

  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
      weekdays++;
    }
    current.setDate(current.getDate() + 1);
  }

  return Math.max(weekdays, 1);
}

function roundHours(hours: number): number {
  return Math.round(hours * 10) / 10;
}

function getMonthSlices(range: { startDate: string; endDate: string }) {
  const rangeStart = startOfDay(new Date(`${range.startDate}T00:00:00`));
  const rangeEnd = startOfDay(new Date(`${range.endDate}T00:00:00`));

  return eachMonthOfInterval({ start: rangeStart, end: rangeEnd }).map((month) => ({
    start: max([startOfMonth(month), rangeStart]),
    end: min([endOfMonth(month), rangeEnd]),
  }));
}

export function summarizeMonthlyAssignments(
  assignments: Assignment[],
  range: { startDate: string; endDate: string }
): MonthlyTimelineAssignment[] {
  const summaries = new Map<string, MonthlyTimelineAssignment>();

  for (const assignment of assignments) {
    const assignmentStart = startOfDay(new Date(`${assignment.startDate}T00:00:00`));
    const assignmentEnd = startOfDay(new Date(`${assignment.endDate}T00:00:00`));
    const assignmentHoursPerDay =
      assignment.totalHours !== null && assignment.totalHours !== undefined
        ? assignment.totalHours / countWeekdays(assignmentStart, assignmentEnd)
        : Number.parseFloat(assignment.hoursPerDay || "0");

    for (const month of getMonthSlices(range)) {
      const overlapStart = max([assignmentStart, month.start]);
      const overlapEnd = min([assignmentEnd, month.end]);

      if (overlapStart > overlapEnd) {
        continue;
      }

      const monthTotalHours = assignmentHoursPerDay * countWeekdays(overlapStart, overlapEnd);
      const key = [
        assignment.employeeId,
        assignment.projectId ?? "time-off",
        toLocalDateString(startOfMonth(month.start)),
        assignment.note ?? "",
        assignment.category ?? "",
        assignment.status,
        assignment.isBillable ? "billable" : "non-billable",
        assignment.isAdjustment ? "adjustment" : "plan",
        assignment.isTimeOff ? "time-off" : "work",
      ].join(":");
      const monthStart = startOfMonth(month.start);
      const monthEnd = endOfMonth(month.start);
      const existing = summaries.get(key);

      if (existing) {
        existing.totalHours = roundHours((existing.totalHours ?? 0) + monthTotalHours);
        existing.detailIds.push(assignment.id);
        existing.hoursPerDay = String(roundHours((existing.totalHours ?? 0) / countWeekdays(monthStart, monthEnd)));
        continue;
      }

      summaries.set(key, {
        ...assignment,
        id: `planner-month:${key}`,
        startDate: toLocalDateString(monthStart),
        endDate: toLocalDateString(monthEnd),
        hoursPerDay: String(roundHours(monthTotalHours / countWeekdays(monthStart, monthEnd))),
        totalHours: roundHours(monthTotalHours),
        detailIds: [assignment.id],
        resolution: "month",
      });
    }
  }

  return Array.from(summaries.values());
}

export function summarizeMonthlyActualAssignments(
  actualAssignments: ActualAssignment[],
  range: { startDate: string; endDate: string }
): MonthlyTimelineActualAssignment[] {
  const summaries = new Map<string, MonthlyTimelineActualAssignment>();

  for (const actual of actualAssignments) {
    const assignmentStart = startOfDay(new Date(`${actual.startDate}T00:00:00`));
    const assignmentEnd = startOfDay(new Date(`${actual.endDate}T00:00:00`));

    for (const month of getMonthSlices(range)) {
      const overlapStart = max([assignmentStart, month.start]);
      const overlapEnd = min([assignmentEnd, month.end]);

      if (overlapStart > overlapEnd) {
        continue;
      }

      const monthStart = startOfMonth(month.start);
      const monthEnd = endOfMonth(month.start);
      const monthHours = actual.hoursPerDay * countWeekdays(overlapStart, overlapEnd);
      const key = [
        actual.employeeUuid,
        actual.projectUuid ?? "time-off",
        toLocalDateString(monthStart),
        actual.note ?? "",
        actual.category ?? "",
        actual.status,
        actual.isBillable ? "billable" : "non-billable",
        actual.isTimeOff ? "time-off" : "work",
      ].join(":");
      const existing = summaries.get(key);

      if (existing) {
        const nextTotal = existing.hoursPerDay * countWeekdays(monthStart, monthEnd) + monthHours;
        existing.hoursPerDay = roundHours(nextTotal / countWeekdays(monthStart, monthEnd));
        existing.detailUuids.push(actual.uuid);
        continue;
      }

      summaries.set(key, {
        ...actual,
        uuid: `planner-month:${key}`,
        startDate: toLocalDateString(monthStart),
        endDate: toLocalDateString(monthEnd),
        hoursPerDay: roundHours(monthHours / countWeekdays(monthStart, monthEnd)),
        detailUuids: [actual.uuid],
        resolution: "month",
      });
    }
  }

  return Array.from(summaries.values());
}

export function isMonthlyPlannerAssignment(
  assignment: Assignment
): assignment is MonthlyTimelineAssignment {
  return assignment.id.startsWith("planner-month:");
}

export function isMonthlyPlannerActualAssignment(
  assignment: ActualAssignment
): assignment is MonthlyTimelineActualAssignment {
  return assignment.uuid.startsWith("planner-month:");
}

export function shouldLoadPlannerAssignmentDetail(assignment?: Assignment): boolean {
  return !!assignment && isMonthlyPlannerAssignment(assignment);
}

export function shouldLoadPlannerActualDetail(assignment?: ActualAssignment): boolean {
  return !!assignment && isMonthlyPlannerActualAssignment(assignment);
}
