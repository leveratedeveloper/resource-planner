import { startOfDay } from "date-fns";
import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import { parseHoursSafe } from "@/lib/timeline-v2/hours";
import { toLocalDateString } from "@/lib/utils";

export type DayAllocation = { planHours: number; actualHours: number };

export type EmployeeDayMap = Map<string /* yyyy-MM-dd */, DayAllocation>;

export type BuildAllocationDayMapsInput = {
  assignments: Assignment[];
  actualAssignments: ActualAssignment[];
  rangeStart: Date;
  rangeEnd: Date;
};

export function buildAllocationDayMaps({
  assignments,
  actualAssignments,
  rangeStart,
  rangeEnd,
}: BuildAllocationDayMapsInput): Map<string /* employeeId */, EmployeeDayMap> {
  const result = new Map<string, EmployeeDayMap>();
  const clipStart = startOfDay(rangeStart);
  const clipEnd = startOfDay(rangeEnd);

  const accumulate = (
    employeeId: string,
    startDate: string,
    endDate: string,
    hours: number,
    field: keyof DayAllocation
  ) => {
    // The legacy cell model parses assignment dates via new Date(...) + startOfDay;
    // replicate exactly so per-day keys line up with its isDateInRange walk.
    const spanStart = startOfDay(new Date(startDate));
    const spanEnd = startOfDay(new Date(endDate));
    const from = spanStart > clipStart ? spanStart : clipStart;
    const to = spanEnd < clipEnd ? spanEnd : clipEnd;
    // Negated comparison also rejects Invalid Date (NaN) spans.
    if (!(from <= to)) return;

    let dayMap = result.get(employeeId);
    if (!dayMap) {
      dayMap = new Map();
      result.set(employeeId, dayMap);
    }

    const current = new Date(from);
    while (current <= to) {
      const key = toLocalDateString(current);
      let entry = dayMap.get(key);
      if (!entry) {
        entry = { planHours: 0, actualHours: 0 };
        dayMap.set(key, entry);
      }
      entry[field] += hours;
      current.setDate(current.getDate() + 1);
    }
  };

  for (const assignment of assignments) {
    if (assignment.isTimeOff) continue;
    accumulate(
      assignment.employeeId,
      assignment.startDate,
      assignment.endDate,
      parseHoursSafe(assignment.hoursPerDay),
      "planHours"
    );
  }

  for (const actual of actualAssignments) {
    if (actual.isTimeOff || actual.employeeUuid == null) continue;
    accumulate(
      actual.employeeUuid,
      actual.startDate,
      actual.endDate,
      parseHoursSafe(actual.hoursPerDay),
      "actualHours"
    );
  }

  return result;
}
