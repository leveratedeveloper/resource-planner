import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import { toLocalDateString } from "@/lib/utils";

export type TimelineActualQueryParams = {
  start_date: string;
  end_date: string;
};

export function groupActualAssignmentsByEmployee(
  actuals: ActualAssignment[]
): Map<string, ActualAssignment[]> {
  const grouped = new Map<string, ActualAssignment[]>();

  for (const actual of actuals) {
    const employeeActuals = grouped.get(actual.employeeUuid);
    if (employeeActuals) {
      employeeActuals.push(actual);
    } else {
      grouped.set(actual.employeeUuid, [actual]);
    }
  }

  return grouped;
}

export function getActualAssignmentsForEmployee(
  groupedActuals: Map<string, ActualAssignment[]>,
  employeeUuid: string
): ActualAssignment[] {
  return groupedActuals.get(employeeUuid) ?? [];
}

export function getTimelineActualQueryParams(
  days: Date[]
): TimelineActualQueryParams | undefined {
  if (days.length === 0) {
    return undefined;
  }

  return {
    start_date: toLocalDateString(days[0]),
    end_date: toLocalDateString(days[days.length - 1]),
  };
}
