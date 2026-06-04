import { eachMonthOfInterval, endOfMonth, format, isSameMonth, startOfDay, startOfMonth } from "date-fns";
import { type DateRange } from "react-day-picker";

type EmployeeRecord = {
  id: string;
  fullName: string;
  position: string;
  department?: { name: string } | null;
};

type AssignmentRecord = {
  employeeId: string;
  startDate: string;
  endDate: string;
  hoursPerDay: string;
  isTimeOff: boolean;
};

type ProjectAssignmentRecord = {
  employeeId: string;
};

type PendingAssignmentRecord = {
  employeeId: string;
};

type EmployeeSummary = {
  fullName: string;
  position: string;
  department: { name: string } | null;
  allAssignments: AssignmentRecord[];
};

export type TeamMemberDisplay = {
  id: string;
  fullName: string;
  position: string;
  department: { name: string } | null;
  allocationPercentage: string[] | string;
};

export function buildEmployeeAssignmentMap(
  employees: EmployeeRecord[],
  allAssignments: AssignmentRecord[],
): Map<string, EmployeeSummary> {
  const map = new Map<string, EmployeeSummary>();
  for (const employee of employees) {
    map.set(employee.id, {
      fullName: employee.fullName,
      position: employee.position,
      department: employee.department ?? null,
      allAssignments: [],
    });
  }

  for (const assignment of allAssignments) {
    const employee = map.get(assignment.employeeId);
    if (employee) {
      employee.allAssignments.push(assignment);
    }
  }

  return map;
}

export function buildProjectTeamMembers({
  employeeMap,
  projectAssignments,
  pendingAssignments,
  dateRange,
}: {
  employeeMap: Map<string, EmployeeSummary>;
  projectAssignments: ProjectAssignmentRecord[];
  pendingAssignments: PendingAssignmentRecord[];
  dateRange: DateRange | undefined;
}): TeamMemberDisplay[] {
  const employeeIdsInProject = new Set<string>();

  for (const assignment of projectAssignments) {
    if (assignment.employeeId) employeeIdsInProject.add(assignment.employeeId);
  }

  for (const pending of pendingAssignments) {
    if (pending.employeeId) employeeIdsInProject.add(pending.employeeId);
  }

  return Array.from(employeeIdsInProject).map((employeeId) => {
    const employee = employeeMap.get(employeeId);
    const monthlyHours = sumMonthlyHours(employee?.allAssignments ?? []);
    const monthlyPercentages = formatMonthlyPercentages(monthlyHours, dateRange);

    return {
      id: employeeId,
      fullName: employee?.fullName ?? "Unknown",
      position: employee?.position ?? "",
      department: employee?.department ?? null,
      allocationPercentage: monthlyPercentages.length > 0 ? monthlyPercentages : "-",
    };
  });
}

function sumMonthlyHours(assignments: AssignmentRecord[]): Record<string, number> {
  const monthlyHours: Record<string, number> = {};
  for (const assignment of assignments) {
    if (assignment.isTimeOff) continue;

    const assignStart = startOfDay(new Date(assignment.startDate));
    const assignEnd = startOfDay(new Date(assignment.endDate));
    const hoursPerDay = Number.parseFloat(assignment.hoursPerDay) || 0;

    const currentDay = new Date(assignStart);
    while (currentDay <= assignEnd) {
      const dayOfWeek = currentDay.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const monthKey = format(currentDay, "MMM yyyy");
        monthlyHours[monthKey] = (monthlyHours[monthKey] ?? 0) + hoursPerDay;
      }
      currentDay.setDate(currentDay.getDate() + 1);
    }
  }
  return monthlyHours;
}

function formatMonthlyPercentages(
  monthlyHours: Record<string, number>,
  dateRange: DateRange | undefined,
): string[] {
  const rangeFrom = dateRange?.from;
  const rangeTo = dateRange?.to;
  const hasDateRange = !!rangeFrom && !!rangeTo;
  const isSingleMonth = hasDateRange ? isSameMonth(rangeFrom, rangeTo) : false;

  const isInDateRange = (monthKey: string) => {
    if (!rangeFrom || !rangeTo) return true;
    const monthDate = startOfMonth(new Date(monthKey));
    const rangeStart = startOfMonth(rangeFrom);
    const rangeEnd = startOfMonth(rangeTo);
    return monthDate >= rangeStart && monthDate <= rangeEnd;
  };

  const monthlyPercentages = Object.entries(monthlyHours)
    .filter(([monthKey]) => isInDateRange(monthKey))
    .map(([monthKey, totalHours]) => {
      const monthDate = new Date(monthKey);
      const mStart = startOfMonth(monthDate);
      const mEnd = endOfMonth(mStart);
      let workDays = 0;

      const currentDay = new Date(mStart);
      while (currentDay <= mEnd) {
        const dayOfWeek = currentDay.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) workDays += 1;
        currentDay.setDate(currentDay.getDate() + 1);
      }

      const maxHours = workDays * 8;
      const pct = maxHours > 0 ? (totalHours / maxHours) * 100 : 0;
      const prefix = isSingleMonth ? "" : `${format(monthDate, "MMM")}: `;
      return `${prefix}${Math.round(pct)}%`;
    });

  if (monthlyPercentages.length > 0) {
    return monthlyPercentages;
  }

  if (rangeFrom && rangeTo) {
    const monthsInRange = eachMonthOfInterval({
      start: startOfMonth(rangeFrom),
      end: startOfMonth(rangeTo),
    });
    return monthsInRange.map((month) => {
      const prefix = isSingleMonth ? "" : `${format(month, "MMM")}: `;
      return `${prefix}0%`;
    });
  }

  return [];
}
