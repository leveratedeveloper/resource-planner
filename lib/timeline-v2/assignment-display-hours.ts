import { startOfDay } from "date-fns";

type AssignmentDisplayHoursInput = {
  startDate: string | Date;
  endDate: string | Date;
  hoursPerDay: string | number | null | undefined;
};

type DisplayRange = {
  startDate: Date;
  endDate: Date;
};

function parseLocalDate(value: string | Date): Date {
  if (value instanceof Date) {
    return startOfDay(value);
  }

  const [year, month, day] = value.split("-").map(Number);
  return startOfDay(new Date(year, month - 1, day));
}

function countWeekdays(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = startOfDay(startDate);
  const end = startOfDay(endDate);

  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
      count += 1;
    }
    current.setDate(current.getDate() + 1);
  }

  return Math.max(0, count);
}

function roundHours(hours: number): number {
  return Math.round(hours * 10) / 10;
}

function parseHoursPerDay(value: AssignmentDisplayHoursInput["hoursPerDay"]): number {
  const parsed = Number.parseFloat(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateAssignmentDisplayTotalHours(
  assignment: AssignmentDisplayHoursInput,
  range?: DisplayRange
): number {
  const assignmentStart = parseLocalDate(assignment.startDate);
  const assignmentEnd = parseLocalDate(assignment.endDate);
  const rangeStart = range ? startOfDay(range.startDate) : assignmentStart;
  const rangeEnd = range ? startOfDay(range.endDate) : assignmentEnd;
  const overlapStart = assignmentStart > rangeStart ? assignmentStart : rangeStart;
  const overlapEnd = assignmentEnd < rangeEnd ? assignmentEnd : rangeEnd;

  if (overlapStart > overlapEnd) {
    return 0;
  }

  return roundHours(parseHoursPerDay(assignment.hoursPerDay) * countWeekdays(overlapStart, overlapEnd));
}

export function formatAssignmentDisplayHours(hours: number): string {
  const rounded = roundHours(Number.isFinite(hours) ? hours : 0);
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}h`;
}
