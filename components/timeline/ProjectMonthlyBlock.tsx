"use client";

import React, { useMemo } from "react";
import { startOfDay, startOfMonth, endOfMonth, differenceInDays, isWithinInterval, format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { Project } from "@/lib/query/hooks/useProjects";

interface ProjectMonthlyBlockProps {
  project: Project;
  planAssignments: Assignment[];
  days: Date[];
  cellWidth: number;
  dayIndex: number; // Which month column this block is for
  onClick?: (monthStart: Date, monthEnd: Date, e: React.MouseEvent) => void;
}

/**
 * Component to display a single month block showing aggregated total hours
 * for a project in quarter/half-year/year view
 * Replaces multiple assignment blocks with one aggregated block per month
 */
export const ProjectMonthlyBlock: React.FC<ProjectMonthlyBlockProps> = ({
  project,
  planAssignments,
  days,
  cellWidth,
  dayIndex,
  onClick,
}) => {
  // Calculate total hours for this project in this month
  const monthlyData = useMemo(() => {
    const monthStart = startOfMonth(days[dayIndex]);
    const monthEnd = endOfMonth(monthStart);

    // Filter assignments for this project that fall within this month
    const monthAssignments = planAssignments.filter((assignment) => {
      if (assignment.projectId !== project.id) return false;

      const assignStart = startOfDay(new Date(assignment.startDate));
      const assignEnd = startOfDay(new Date(assignment.endDate));

      // Check if assignment overlaps with this month
      return assignEnd >= monthStart && assignStart <= monthEnd;
    });

    // Calculate total hours for this month (proportional)
    let totalHours = 0;
    let totalWorkingDays = 0;

    monthAssignments.forEach((assignment) => {
      if (!assignment.totalHours) return;

      const assignStart = startOfDay(new Date(assignment.startDate));
      const assignEnd = startOfDay(new Date(assignment.endDate));

      // Calculate overlap
      const overlapStart = assignStart > monthStart ? assignStart : monthStart;
      const overlapEnd = assignEnd < monthEnd ? assignEnd : monthEnd;

      if (overlapStart <= overlapEnd) {
        const totalDays = Math.max(1, differenceInDays(assignEnd, assignStart) + 1);
        const overlapDays = Math.max(1, differenceInDays(overlapEnd, overlapStart) + 1);
        const proportion = overlapDays / totalDays;

        // Calculate working days in overlap period
        let workingDays = 0;
        let checkDate = overlapStart;
        while (checkDate <= overlapEnd) {
          const day = checkDate.getDay();
          if (day !== 0 && day !== 6) workingDays++;
          checkDate.setDate(checkDate.getDate() + 1);
        }

        totalHours += assignment.totalHours * proportion;
        totalWorkingDays += workingDays * proportion;
      }
    });

    return {
      totalHours: Math.round(totalHours * 10) / 10,
      totalWorkingDays: Math.round(totalWorkingDays * 10) / 10,
      monthName: format(monthStart, "MMM yyyy"),
      assignmentCount: monthAssignments.length,
    };
  }, [planAssignments, project.id, days, dayIndex]);

  if (monthlyData.totalHours === 0) return null;

  const cellPercentage = 100 / days.length;
  const leftOffset = dayIndex * cellPercentage;
  const width = cellPercentage;

  return (
    <div
      className="absolute rounded-md shadow-sm border text-xs text-white overflow-hidden flex flex-col items-center justify-center bg-blue-600 hover:bg-blue-700 cursor-pointer"
      style={{
        left: `${leftOffset}%`,
        width: `${width}%`,
        top: 4,
        height: 36,
        zIndex: 10,
      }}
      title={`${project.name}: ${monthlyData.totalHours}h (${monthlyData.assignmentCount} assignments, ${monthlyData.totalWorkingDays} working days)`}
      onClick={(e) => {
        const monthStart = startOfMonth(days[dayIndex]);
        const monthEnd = endOfMonth(monthStart);
        onClick(monthStart, monthEnd, e);
      }}
    >
      <div className="flex-1 px-2 py-1 min-w-0 pointer-events-none text-center">
        <div className="font-bold text-sm">
          {monthlyData.totalHours}h
        </div>
        <div className="text-xs opacity-80 truncate">
          {project.name}
        </div>
      </div>
    </div>
  );
};
