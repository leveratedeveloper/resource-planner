import { format, startOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";

export interface PendingProjectAssignment {
  employeeId: string;
}

export interface ProjectDeliverableOption {
  id: string | number;
  deliverableName?: string | null;
  deliverableNameNew?: string | null;
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

export function buildPendingAssignmentPayloads(params: {
  projectId: string;
  pendingAssignments: PendingProjectAssignment[];
  selectedDeliverablesByEmployee: Record<string, string[]>;
  allDeliverables: ProjectDeliverableOption[];
  assignmentDates: ProjectAssignmentDates;
}): ProjectAssignmentPayload[] {
  const {
    projectId,
    pendingAssignments,
    selectedDeliverablesByEmployee,
    allDeliverables,
    assignmentDates,
  } = params;

  return pendingAssignments.map((pending) => {
    const deliverableIds = selectedDeliverablesByEmployee[pending.employeeId] || [];
    const deliverables = allDeliverables.filter((deliverable) =>
      deliverableIds.includes(String(deliverable.id))
    );
    const deliverableNames = deliverables
      .map((deliverable) => deliverable.deliverableNameNew || deliverable.deliverableName)
      .filter(Boolean)
      .join(", ");

    return {
      employeeId: pending.employeeId,
      projectId,
      taskId: null,
      startDate: assignmentDates.startDate,
      endDate: assignmentDates.endDate,
      hoursPerDay: "0",
      allocationPercentage: null,
      isTimeOff: false,
      timeOffTypeId: null,
      category: null,
      isBillable: true,
      status: "draft",
      note: deliverableNames
        ? `Assigned to project - Deliverables: ${deliverableNames}. Set dates and hours as needed.`
        : "Assigned to project - set dates and hours as needed.",
      createdById: null,
    };
  });
}

function parseDateLike(value: string | Date) {
  if (value instanceof Date) return value;

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return new Date(value);

  return new Date(year, month - 1, day);
}
