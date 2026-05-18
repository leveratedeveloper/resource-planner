import { parseLocalDateKey, toLocalDateKey } from "@/lib/analysis/date-utils";
import type { DashboardDateRange } from "@/lib/dashboard/filter-ranges";

/**
 * Dashboard comparisons are historically exact only for assignment-derived data.
 * Employee capacity, headcount, and department are current-state fields in this
 * data model, so capacity-derived metrics and department-scoped assignment
 * deltas must not show historical deltas until effective-dated employee
 * snapshots exist.
 */
export type DashboardComparisonMode = "none" | "previous-period";
export type ComparisonTone = "positive" | "negative" | "neutral";
export type ComparisonDirection = "higher-is-better" | "lower-is-better";
export type ComparisonUnit = "percentage-point" | "count" | "hours";
export type ComparisonMetricProvenance = "assignment-derived" | "capacity-derived";
export type ComparisonMetricId =
  | "assigned-hours"
  | "assignment-count"
  | "optimal-rate"
  | "average-utilization"
  | "high-risk-weeks"
  | "attention-count"
  | "overallocated-count"
  | "underutilized-count"
  | "optimal-count"
  | "conflict-count";

export type ComparisonAssignment = {
  id?: string;
  employeeId?: string;
  startDate: string | Date;
  endDate: string | Date;
  hoursPerDay: string | number;
  isTimeOff?: boolean;
};

export const COMPARISON_METRIC_PROVENANCE: Record<
  ComparisonMetricId,
  ComparisonMetricProvenance
> = {
  "assigned-hours": "assignment-derived",
  "assignment-count": "assignment-derived",
  "optimal-rate": "capacity-derived",
  "average-utilization": "capacity-derived",
  "high-risk-weeks": "capacity-derived",
  "attention-count": "capacity-derived",
  "overallocated-count": "capacity-derived",
  "underutilized-count": "capacity-derived",
  "optimal-count": "capacity-derived",
  "conflict-count": "capacity-derived",
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const UTILIZATION_TARGET = 80;
const DEFAULT_FORECAST_WEEKS = 4;
const DAYS_PER_WEEK = 7;

function coerceDateOnly(value: string | Date): Date {
  if (value instanceof Date) {
    return parseLocalDateKey(toLocalDateKey(value));
  }

  return parseLocalDateKey(value.slice(0, 10));
}

function getInclusiveDayCount(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / DAY_IN_MS) + 1;
}

export function getComparisonMetricProvenance(
  metricId: ComparisonMetricId
): ComparisonMetricProvenance {
  return COMPARISON_METRIC_PROVENANCE[metricId];
}

export function canShowComparisonDelta(metricId: ComparisonMetricId): boolean {
  return getComparisonMetricProvenance(metricId) === "assignment-derived";
}

export function canShowDashboardComparisonDelta(
  metricId: ComparisonMetricId,
  {
    selectedDepartmentId,
  }: {
    selectedDepartmentId: string | null;
  }
): boolean {
  return canShowComparisonDelta(metricId) && !selectedDepartmentId;
}

export function calculateAssignedHoursForRange(
  assignments: readonly ComparisonAssignment[],
  range: DashboardDateRange
): number {
  const rangeStart = parseLocalDateKey(range.startDate);
  const rangeEnd = parseLocalDateKey(range.endDate);

  return assignments.reduce((total, assignment) => {
    if (assignment.isTimeOff) return total;

    const assignmentStart = coerceDateOnly(assignment.startDate);
    const assignmentEnd = coerceDateOnly(assignment.endDate);
    const overlapStart = assignmentStart > rangeStart ? assignmentStart : rangeStart;
    const overlapEnd = assignmentEnd < rangeEnd ? assignmentEnd : rangeEnd;

    if (overlapStart > overlapEnd) return total;

    const hoursPerDay = Number.parseFloat(String(assignment.hoursPerDay));
    if (!Number.isFinite(hoursPerDay)) return total;

    return total + getInclusiveDayCount(overlapStart, overlapEnd) * hoursPerDay;
  }, 0);
}

function getPreviousEquivalentRange(range: DashboardDateRange): DashboardDateRange {
  const currentStart = parseLocalDateKey(range.startDate);
  const currentEnd = parseLocalDateKey(range.endDate);
  const durationDays = Math.round((currentEnd.getTime() - currentStart.getTime()) / DAY_IN_MS) + 1;

  const previousEnd = new Date(currentStart);
  previousEnd.setDate(previousEnd.getDate() - 1);

  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - durationDays + 1);

  return {
    startDate: toLocalDateKey(previousStart),
    endDate: toLocalDateKey(previousEnd),
  };
}

export function getPreviousPeriodRange(range: DashboardDateRange): DashboardDateRange {
  return getPreviousEquivalentRange(range);
}

function getWeekStart(date: Date): Date {
  const start = new Date(date);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function getForecastDateRange(
  startDate: Date = new Date(),
  weeksAhead: number = DEFAULT_FORECAST_WEEKS
): DashboardDateRange {
  const start = getWeekStart(startDate);
  const end = new Date(start);
  end.setDate(end.getDate() + weeksAhead * DAYS_PER_WEEK - 1);

  return {
    startDate: toLocalDateKey(start),
    endDate: toLocalDateKey(end),
  };
}

export function getPreviousForecastRange(
  range: DashboardDateRange,
  weeksAhead: number = DEFAULT_FORECAST_WEEKS
): DashboardDateRange {
  const currentStart = getWeekStart(parseLocalDateKey(range.startDate));
  const durationDays = weeksAhead * DAYS_PER_WEEK;

  const previousEnd = new Date(currentStart);
  previousEnd.setDate(previousEnd.getDate() - 1);

  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - durationDays + 1);

  return {
    startDate: toLocalDateKey(previousStart),
    endDate: toLocalDateKey(previousEnd),
  };
}

export function getComparisonDelta({
  current,
  previous,
  unit,
}: {
  current: number;
  previous: number;
  unit: ComparisonUnit;
}) {
  const rawDelta = Math.round(current - previous);

  if (rawDelta === 0) {
    return {
      rawDelta,
      label: "No change from previous",
    };
  }

  const absoluteDelta = Math.abs(rawDelta);

  if (unit === "percentage-point") {
    const pointLabel = absoluteDelta === 1 ? "point" : "points";
    const direction = rawDelta > 0 ? "higher" : "lower";

    return {
      rawDelta,
      label: `${absoluteDelta} ${pointLabel} ${direction} than previous`,
    };
  }

  if (unit === "hours") {
    return {
      rawDelta,
      label: `${absoluteDelta} ${rawDelta > 0 ? "more" : "fewer"} hours than previous`,
    };
  }

  return {
    rawDelta,
    label: `${absoluteDelta} ${rawDelta > 0 ? "more" : "fewer"} than previous`,
  };
}

export function getDirectionalTone(
  delta: number,
  direction: ComparisonDirection
): ComparisonTone {
  if (delta === 0) return "neutral";

  if (direction === "higher-is-better") {
    return delta > 0 ? "positive" : "negative";
  }

  return delta < 0 ? "positive" : "negative";
}

export function getUtilizationTone({
  current,
  previous,
}: {
  current: number;
  previous: number;
}): ComparisonTone {
  const currentDistance = Math.abs(current - UTILIZATION_TARGET);
  const previousDistance = Math.abs(previous - UTILIZATION_TARGET);

  if (currentDistance === previousDistance) return "neutral";

  return currentDistance < previousDistance ? "positive" : "negative";
}
