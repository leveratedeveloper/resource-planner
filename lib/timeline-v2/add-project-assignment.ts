import { addMonths, format, startOfDay } from "date-fns";
import {
  calculateDerivedHoursPerDay,
  countWeekdaysInclusive,
  parseDateLike,
  type ProjectAssignmentDates,
} from "@/lib/setup/project-assignment-save";
import type { NewAssignment } from "@/lib/query/hooks/useAssignments";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";

// Coerce a stored date value — which may arrive as "yyyy-MM-dd", an ISO
// datetime ("2026-04-01T00:00:00.000Z"), a "yyyy-MM-dd HH:mm:ss" string, or a
// verbose Date.toString() — into the strict "yyyy-MM-dd" that <input type="date">
// requires. Returns "" when it can't be parsed. Prefers a regex slice (no
// timezone math) and only falls back to Date parsing for verbose forms.
export function toDateInputValue(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = String(raw).trim();
  const leading = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (leading) return `${leading[1]}-${leading[2]}-${leading[3]}`;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Default span for enrolling someone on a project: the project's own
// start/end when BOTH are known (covers the real, possibly multi-month
// duration — mirrors Setup's Assign Member), otherwise today through one
// month out.
export function getDefaultAssignmentRange(
  project: Pick<ProjectOption, "startDate" | "endDate">,
  today: Date = new Date()
): ProjectAssignmentDates {
  const startDate = toDateInputValue(project.startDate);
  const endDate = toDateInputValue(project.endDate);
  if (startDate && endDate) {
    return { startDate, endDate };
  }
  const start = startOfDay(today);
  return {
    startDate: format(start, "yyyy-MM-dd"),
    endDate: format(addMonths(start, 1), "yyyy-MM-dd"),
  };
}

// Number of working (Mon–Fri) days in the range — used for helper text and to
// mirror the hours-per-day math Setup uses.
export function countAssignmentWorkingDays(range: ProjectAssignmentDates): number {
  return countWeekdaysInclusive(parseDateLike(range.startDate), parseDateLike(range.endDate));
}

// One assignment row spanning the whole range, hours spread evenly across
// working days — identical shape to Setup's project-assignment payload.
export function buildNewProjectAssignment(params: {
  resourceId: string;
  project: Pick<ProjectOption, "id">;
  range: ProjectAssignmentDates;
  totalHours: number;
  createdByUuid: string | null;
}): NewAssignment {
  const { resourceId, project, range, totalHours, createdByUuid } = params;
  return {
    employeeId: resourceId,
    projectId: project.id,
    taskId: null,
    startDate: range.startDate,
    endDate: range.endDate,
    hoursPerDay: calculateDerivedHoursPerDay(totalHours, range),
    allocationPercentage: null,
    isTimeOff: false,
    timeOffTypeId: null,
    category: null,
    isBillable: true,
    status: "draft",
    note: "Assigned to project from timeline",
    createdById: createdByUuid,
  };
}
