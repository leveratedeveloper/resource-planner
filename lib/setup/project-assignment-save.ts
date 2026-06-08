import { format, isValid, startOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";

export interface PendingProjectAssignment {
  employeeId: string;
}

export interface ProjectAssignmentDates {
  startDate: string;
  endDate: string;
}

export interface ProjectAssignmentPayload {
  employeeId: string;
  projectId: string;
  taskId: null;
  startDate: string;
  endDate: string;
  hoursPerDay: string;
  totalHours: number;
  allocationPercentage: null;
  isTimeOff: false;
  timeOffTypeId: null;
  category: null;
  isBillable: true;
  status: "draft";
  note: string;
  createdById: null;
}

export function getAssignmentDateStrings(dateRange: DateRange | undefined, fallbackDate = new Date()): ProjectAssignmentDates {
  const start = dateRange?.from ?? fallbackDate;
  const end = dateRange?.to ?? start;

  return {
    startDate: format(startOfDay(start), "yyyy-MM-dd"),
    endDate: format(startOfDay(end), "yyyy-MM-dd"),
  };
}

export function getFallbackAssignmentDateRange(
  assignments: Array<{ startDate: string | Date; endDate: string | Date }>
): DateRange | undefined {
  const startDates = assignments
    .map((assignment) => parseDateLike(assignment.startDate).getTime())
    .filter(Number.isFinite);
  const endDates = assignments
    .map((assignment) => parseDateLike(assignment.endDate).getTime())
    .filter(Number.isFinite);

  if (startDates.length === 0 || endDates.length === 0) return undefined;

  return {
    from: startOfDay(new Date(Math.min(...startDates))),
    to: startOfDay(new Date(Math.max(...endDates))),
  };
}

export function getProjectAssignmentDateRange(project: {
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  submitDate?: string | Date | null;
}): DateRange | undefined {
  if (project.startDate && project.endDate) {
    return {
      from: startOfDay(parseDateLike(project.startDate)),
      to: startOfDay(parseDateLike(project.endDate)),
    };
  }

  if (project.submitDate) {
    const submitDate = startOfDay(parseDateLike(project.submitDate));
    return {
      from: submitDate,
      to: submitDate,
    };
  }

  return undefined;
}

export function formatProjectDateForDisplay(value: string | Date | null | undefined) {
  if (!value) return "";

  const parsedDate = parseDateLike(value);
  if (!isValid(parsedDate)) return "";

  return format(parsedDate, "MMM d, yyyy");
}

export function parseManHoursInput(value: string | number | null | undefined): number | null {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) return null;
  return Number(text);
}

export function calculateDerivedHoursPerDay(totalHours: number, assignmentDates: ProjectAssignmentDates): string {
  const start = parseDateLike(assignmentDates.startDate);
  const end = parseDateLike(assignmentDates.endDate);
  const workingDays = Math.max(countWeekdaysInclusive(start, end), 1);
  const hoursPerDay = totalHours / workingDays;
  return Number.isInteger(hoursPerDay) ? String(hoursPerDay) : hoursPerDay.toFixed(2);
}

export function buildPendingAssignmentPayloads(params: {
  projectId: string;
  pendingAssignments: PendingProjectAssignment[];
  manHoursByEmployee: Record<string, string>;
  assignmentDates: ProjectAssignmentDates;
}): ProjectAssignmentPayload[] {
  const {
    projectId,
    pendingAssignments,
    manHoursByEmployee,
    assignmentDates,
  } = params;

  return pendingAssignments.map((pending) => {
    const totalHours = parseManHoursInput(manHoursByEmployee[pending.employeeId]) ?? 0;

    return {
      employeeId: pending.employeeId,
      projectId,
      taskId: null,
      startDate: assignmentDates.startDate,
      endDate: assignmentDates.endDate,
      hoursPerDay: calculateDerivedHoursPerDay(totalHours, assignmentDates),
      totalHours,
      allocationPercentage: null,
      isTimeOff: false,
      timeOffTypeId: null,
      category: null,
      isBillable: true,
      status: "draft",
      note: "Assigned to project - set dates and hours as needed.",
      createdById: null,
    };
  });
}

function countWeekdaysInclusive(start: Date, end: Date) {
  let count = 0;
  const cursor = startOfDay(start);
  const final = startOfDay(end);

  while (cursor.getTime() <= final.getTime()) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

export function parseDateLike(value: string | Date) {
  if (value instanceof Date) return value;

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return new Date(value);

  return new Date(year, month - 1, day);
}
