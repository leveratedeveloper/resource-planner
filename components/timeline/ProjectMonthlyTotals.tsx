"use client";

import React, { useMemo } from "react";
import { startOfDay, startOfMonth, endOfMonth, isWithinInterval, differenceInDays } from "date-fns";
import type { Assignment } from "@/lib/query/hooks/useAssignments";

interface ProjectMonthlyTotalsProps {
  project: {
    id: string;
    name: string;
    color: string;
  };
  planAssignments: Assignment[];
  days: Date[];
  cellWidth: number;
  isMonthRangeView: boolean;
}

/**
 * Component to display monthly total hours for a project in quarter/half-year/year view
 * Shows aggregated total_hours per month above the PLAN row
 */
export const ProjectMonthlyTotals: React.FC<ProjectMonthlyTotalsProps> = ({
  project,
  planAssignments,
  days,
  cellWidth,
  isMonthRangeView,
}) => {
  // Calculate total hours for each month column
  const monthlyTotals = useMemo(() => {
    if (!isMonthRangeView) return [];

    const totals: Array<{ monthIndex: number; totalHours: number }> = [];

    for (let i = 0; i < days.length; i++) {
      const day = startOfDay(days[i]);
      const monthStart = startOfDay(day);
      const monthEnd = startOfDay(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0));

      // Filter assignments for this project that fall within this month
      const monthAssignments = planAssignments.filter((assignment) => {
        if (assignment.projectId !== project.id) return false;
        if (!assignment.totalHours) return 0;

        const assignStart = startOfDay(new Date(assignment.startDate));
        const assignEnd = startOfDay(new Date(assignment.endDate));

        // Check if assignment overlaps with this month
        const overlaps = !(assignEnd < monthStart || assignStart > monthEnd);

        return overlaps;
      });

      // Calculate total hours for this month
      const totalHours = monthAssignments.reduce((sum, assignment) => {
        const assignStart = startOfDay(new Date(assignment.startDate));
        const assignEnd = startOfDay(new Date(assignment.endDate));
        const monthStart = startOfDay(day);
        const monthEnd = endOfMonth(day);

        // Calculate overlap days
        const overlapStart = assignStart > monthStart ? assignStart : monthStart;
        const overlapEnd = assignEnd < monthEnd ? assignEnd : monthEnd;

        if (overlapStart > overlapEnd) return sum;

        const overlapDays = Math.max(0, differenceInDays(overlapEnd, overlapStart) + 1);

        // Calculate proportion of total_hours that falls in this month
        const totalDays = differenceInDays(assignEnd, assignStart) + 1;
        const proportion = overlapDays / totalDays;
        const hoursInMonth = (assignment.totalHours || 0) * proportion;

        return sum + hoursInMonth;
      }, 0);

      totals.push({
        monthIndex: i,
        totalHours: Math.round(totalHours * 10) / 10, // Round to 1 decimal
      });
    }

    return totals;
  }, [planAssignments, project.id, days, isMonthRangeView]);

  if (!isMonthRangeView || monthlyTotals.length === 0) return null;

  return (
    <div className="flex items-center" style={{ width: `${days.length * cellWidth}px`, height: 20 }}>
      {monthlyTotals.map(({ monthIndex, totalHours }) => (
        <div
          key={monthIndex}
          className="shrink-0 h-[20px] border-r border-blue-200 flex items-center justify-center text-xs font-semibold text-blue-700 bg-blue-50/50"
          style={{ width: `${cellWidth}px` }}
          title={`${project.name}: ${totalHours}h this month`}
        >
          {totalHours > 0 ? `${totalHours}h` : ''}
        </div>
      ))}
    </div>
  );
};
