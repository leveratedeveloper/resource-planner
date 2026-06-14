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
  filters?: PlannerTimelineFilters;
};

export type MonthlyTimelineAssignment = Assignment & {
  // Number of underlying per-day rows. The IDs themselves never ship — the
  // month editor fetches detail on demand (payload-diet spec 2026-06-12).
  detailCount: number;
  resolution: "month";
};

export type MonthlyTimelineActualAssignment = ActualAssignment & {
  detailCount: number;
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

function getPlannerTimelineRequestIdentity(request: PlannerTimelineRequest) {
  return {
    viewMode: request.viewMode,
    resolution: request.resolution,
    startDate: request.startDate,
    endDate: request.endDate,
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

  return (
    left.viewMode === right.viewMode &&
    left.resolution === right.resolution &&
    left.startDate === right.startDate &&
    left.endDate === right.endDate &&
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
        assignment.projectId ?? "unassigned",
        toLocalDateString(startOfMonth(month.start)),
        assignment.note ?? "",
        assignment.category ?? "",
        assignment.status,
        assignment.isBillable ? "billable" : "non-billable",
        assignment.isAdjustment ? "adjustment" : "plan",
        "work",
      ].join(":");
      const monthStart = startOfMonth(month.start);
      const monthEnd = endOfMonth(month.start);
      const existing = summaries.get(key);

      if (existing) {
        existing.totalHours = roundHours((existing.totalHours ?? 0) + monthTotalHours);
        existing.detailCount += 1;
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
        detailCount: 1,
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
        actual.projectUuid ?? "unassigned",
        toLocalDateString(monthStart),
        actual.note ?? "",
        actual.category ?? "",
        actual.status,
        actual.isBillable ? "billable" : "non-billable",
        "work",
      ].join(":");
      const existing = summaries.get(key);

      if (existing) {
        const nextTotal = existing.hoursPerDay * countWeekdays(monthStart, monthEnd) + monthHours;
        existing.hoursPerDay = roundHours(nextTotal / countWeekdays(monthStart, monthEnd));
        existing.detailCount += 1;
        continue;
      }

      summaries.set(key, {
        ...actual,
        uuid: `planner-month:${key}`,
        startDate: toLocalDateString(monthStart),
        endDate: toLocalDateString(monthEnd),
        hoursPerDay: roundHours(monthHours / countWeekdays(monthStart, monthEnd)),
        detailCount: 1,
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

// ---------------------------------------------------------------------------
// Month aggregation (Phase 8): the SQL path groups day-level rows in the DB
// (lib/mysql-assignments/queries.ts) and these builders shape the grouped rows
// into the SAME blocks summarizeMonthly* produce — same `planner-month:` key
// scheme, same hoursPerDay derivation. One deliberate difference: totals are
// rounded ONCE on the SQL-summed value, while the TS path rounds at every
// accumulation step, so block totals may differ by ≤0.1h (the SQL value is
// the more correct one; accepted in the Phase 8 spec).
//
// SQL groups by RAW status, but transformAssignment normalizes unknown
// statuses to "confirmed" — so two raw statuses can collapse to one key here.
// The builders merge such collisions instead of dropping them.

export type MonthlyAggregateAssignmentRow = {
  employeeUuid: string;
  projectUuid: string | null;
  monthStart: string; // yyyy-MM-01
  note: string | null;
  category: string | null;
  status: string;
  isBillable: boolean;
  isAdjustment: boolean;
  totalHours: number;
  detailCount: number;
  createdAt: string;
  updatedAt: string;
};

export type MonthlyAggregateActualRow = {
  employeeUuid: string;
  projectUuid: string | null;
  monthStart: string;
  note: string | null;
  category: string | null;
  status: string;
  isBillable: boolean;
  monthHours: number;
  detailCount: number;
  createdAt: string;
  updatedAt: string;
};

function normalizeAssignmentStatus(status: string): Assignment["status"] {
  return status === "draft" || status === "confirmed" || status === "completed"
    ? status
    : "confirmed";
}

export function buildMonthlyAssignmentBlocksFromAggregates(
  rows: MonthlyAggregateAssignmentRow[]
): MonthlyTimelineAssignment[] {
  const summaries = new Map<string, MonthlyTimelineAssignment>();

  for (const row of rows) {
    const status = normalizeAssignmentStatus(row.status);
    const key = [
      row.employeeUuid,
      row.projectUuid ?? "unassigned",
      row.monthStart,
      row.note ?? "",
      row.category ?? "",
      status,
      row.isBillable ? "billable" : "non-billable",
      row.isAdjustment ? "adjustment" : "plan",
      "work",
    ].join(":");
    const monthStart = startOfDay(new Date(`${row.monthStart}T00:00:00`));
    const monthEnd = endOfMonth(monthStart);
    const monthWeekdays = countWeekdays(monthStart, monthEnd);
    const existing = summaries.get(key);

    if (existing) {
      existing.totalHours = roundHours((existing.totalHours ?? 0) + row.totalHours);
      existing.detailCount += row.detailCount;
      existing.hoursPerDay = String(roundHours((existing.totalHours ?? 0) / monthWeekdays));
      continue;
    }

    summaries.set(key, {
      id: `planner-month:${key}`,
      employeeId: row.employeeUuid,
      projectId: row.projectUuid,
      taskId: null,
      startDate: toLocalDateString(monthStart),
      endDate: toLocalDateString(monthEnd),
      hoursPerDay: String(roundHours(row.totalHours / monthWeekdays)),
      totalHours: roundHours(row.totalHours),
      allocationPercentage: null,
      isTimeOff: false,
      timeOffTypeId: null,
      category: row.category,
      isBillable: row.isBillable,
      isAdjustment: row.isAdjustment,
      status,
      note: row.note,
      createdById: null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      detailCount: row.detailCount,
      resolution: "month",
    });
  }

  return Array.from(summaries.values());
}

export function buildMonthlyActualBlocksFromAggregates(
  rows: MonthlyAggregateActualRow[]
): MonthlyTimelineActualAssignment[] {
  const summaries = new Map<string, MonthlyTimelineActualAssignment>();

  for (const row of rows) {
    const key = [
      row.employeeUuid,
      row.projectUuid ?? "unassigned",
      row.monthStart,
      row.note ?? "",
      row.category ?? "",
      row.status,
      row.isBillable ? "billable" : "non-billable",
      "work",
    ].join(":");
    const monthStart = startOfDay(new Date(`${row.monthStart}T00:00:00`));
    const monthEnd = endOfMonth(monthStart);
    const monthWeekdays = countWeekdays(monthStart, monthEnd);
    const existing = summaries.get(key);

    if (existing) {
      const nextTotal = existing.hoursPerDay * monthWeekdays + row.monthHours;
      existing.hoursPerDay = roundHours(nextTotal / monthWeekdays);
      existing.detailCount += row.detailCount;
      continue;
    }

    summaries.set(key, {
      uuid: `planner-month:${key}`,
      employeeUuid: row.employeeUuid,
      projectUuid: row.projectUuid,
      taskUuid: null,
      startDate: toLocalDateString(monthStart),
      endDate: toLocalDateString(monthEnd),
      hoursPerDay: roundHours(row.monthHours / monthWeekdays),
      allocationPercentage: null,
      isTimeOff: false,
      timeOffTypeUuid: null,
      category: row.category,
      isBillable: row.isBillable,
      status: row.status,
      note: row.note,
      createdByUuid: null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      detailCount: row.detailCount,
      resolution: "month",
    });
  }

  return Array.from(summaries.values());
}
