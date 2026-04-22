import { startOfDay } from "date-fns";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";

/**
 * Calculate total planned hours (plan + adjustment) for a specific project-month.
 * Iterates working days, sums hoursPerDay from matching assignments.
 */
export function calculatePlannedHoursForMonth(
  assignments: Assignment[],
  projectId: string,
  monthStart: Date,
  monthEnd: Date
): number {
  const monthAssignments = assignments.filter(
    (a) => !a.isTimeOff && a.projectId === projectId
  );

  if (monthAssignments.length === 0) return 0;

  let total = 0;
  let currentDay = new Date(monthStart);

  while (currentDay <= monthEnd) {
    const dayOfWeek = currentDay.getDay();

    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      for (const a of monthAssignments) {
        const aStart = startOfDay(new Date(a.startDate));
        const aEnd = startOfDay(new Date(a.endDate));
        const hours = parseFloat(a.hoursPerDay) || 0;

        if (currentDay >= aStart && currentDay <= aEnd) {
          total += hours;
        }
      }
    }

    currentDay = new Date(currentDay);
    currentDay.setDate(currentDay.getDate() + 1);
  }

  return Math.round(total * 10) / 10;
}

/**
 * Calculate total actual hours for a specific project-month.
 * Optionally excludes assignments by UUID (for edit mode, to avoid double-counting).
 */
export function calculateActualHoursForMonth(
  actualAssignments: ActualAssignment[],
  projectId: string,
  monthStart: Date,
  monthEnd: Date,
  excludeUuids?: string[]
): number {
  const excludeSet = excludeUuids?.length ? new Set(excludeUuids) : null;
  const matchingActuals = actualAssignments.filter((a) => {
    if (a.isTimeOff) return false;
    if (a.projectUuid !== projectId) return false;
    if (excludeSet && excludeSet.has(a.uuid)) return false;
    // Check if the actual assignment overlaps with the month
    const aStart = new Date(a.startDate);
    const aEnd = new Date(a.endDate);
    if (aStart > monthEnd) return false;
    if (aEnd < monthStart) return false;
    return true;
  });

  let total = 0;

  for (const a of matchingActuals) {
    const aStart = startOfDay(new Date(a.startDate));
    const aEnd = startOfDay(new Date(a.endDate));
    const effectiveStart = aStart < monthStart ? monthStart : aStart;
    const effectiveEnd = aEnd > monthEnd ? monthEnd : aEnd;

    let currentDay = new Date(effectiveStart);
    while (currentDay <= effectiveEnd) {
      const dayOfWeek = currentDay.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        total += Number(a.hoursPerDay) || 0;
      }
      currentDay = new Date(currentDay);
      currentDay.setDate(currentDay.getDate() + 1);
    }
  }

  return Math.round(total * 10) / 10;
}

/**
 * Validate whether proposed actual hours are within the planned limit.
 */
export function validateActualHoursLimit(
  plannedTotal: number,
  currentActual: number,
  proposedHours: number
): { isValid: boolean; remaining: number; overBy: number } {
  const safePlanned = Number(plannedTotal) || 0;
  const safeActual = Number(currentActual) || 0;
  const safeProposed = Number(proposedHours) || 0;
  const remaining = Math.round((safePlanned - safeActual) * 10) / 10;
  const overBy = Math.round((safeProposed - remaining) * 10) / 10;
  return {
    isValid: safeProposed <= remaining,
    remaining,
    overBy: Math.max(0, overBy),
  };
}
