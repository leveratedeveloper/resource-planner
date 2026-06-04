import { addDays, startOfDay } from "date-fns";
import type { Assignment } from "@/lib/query/hooks/useAssignments";

export function isTimelineV2Weekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function countTimelineV2Workdays(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  const normalizedEnd = startOfDay(end);

  while (startOfDay(current) <= normalizedEnd) {
    if (!isTimelineV2Weekend(current)) count += 1;
    current.setDate(current.getDate() + 1);
  }

  return Math.max(1, count);
}

export function hasTimelineV2TimeOffInRange(
  assignments: Assignment[],
  start: Date,
  end: Date,
  ignoredAssignmentId?: string
): boolean {
  const rangeStart = startOfDay(start);
  const rangeEnd = startOfDay(end);

  return assignments.some((assignment) => {
    if (!assignment.isTimeOff) return false;
    if (ignoredAssignmentId && assignment.id === ignoredAssignmentId) return false;

    const assignmentStart = startOfDay(new Date(assignment.startDate));
    const assignmentEnd = startOfDay(new Date(assignment.endDate));
    return rangeStart <= assignmentEnd && rangeEnd >= assignmentStart;
  });
}

export function getTimelineV2DragRange(startIndex: number, endIndex: number) {
  const start = Math.min(startIndex, endIndex);
  const end = Math.max(startIndex, endIndex);

  return { start, end, length: end - start + 1 };
}

export function offsetTimelineV2Date(date: Date, days: number) {
  return addDays(date, days);
}
