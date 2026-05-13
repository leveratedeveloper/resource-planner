import { parseLocalDateKey, toLocalDateKey } from "@/lib/analysis/date-utils";
import type { DashboardDateRange } from "@/lib/dashboard/filter-ranges";

export type DashboardComparisonMode = "none" | "previous-period";
export type ComparisonTone = "positive" | "negative" | "neutral";
export type ComparisonDirection = "higher-is-better" | "lower-is-better";
export type ComparisonUnit = "percentage-point" | "count";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const UTILIZATION_TARGET = 80;

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

export function getPreviousForecastRange(range: DashboardDateRange): DashboardDateRange {
  return getPreviousEquivalentRange(range);
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
