"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Assignment } from "@/lib/query/hooks/useAssignments";
import { startOfDay, endOfMonth } from "date-fns";
import { parseHoursSafe } from "@/lib/utils/hours";
import { Icon } from "@iconify/react";

interface AggregatedRowProps {
  name: string;
  color?: string;
  days: Date[];
  cellWidth: number;
  assignments: Assignment[];
  viewMode: 'week' | 'month' | 'quarter' | 'halfYear' | 'year';
}

const getTotalHoursForRange = (
  assignments: Assignment[],
  rangeStart: Date,
  rangeEnd: Date
): number => {
  let totalHours = 0;
  for (const assignment of assignments) {
    if (assignment.isTimeOff) continue;
    const assignStart = startOfDay(new Date(assignment.startDate));
    const assignEnd = startOfDay(new Date(assignment.endDate));

    // Check for overlap between assignment and the current range
    const overlapStart = assignStart > rangeStart ? assignStart : rangeStart;
    const overlapEnd = assignEnd < rangeEnd ? assignEnd : rangeEnd;

    if (overlapStart <= overlapEnd) {
      const overlapDays = Math.max(
        1,
        Math.round((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
      );
      const assignmentHours = parseHoursSafe(assignment.hoursPerDay);
      totalHours += overlapDays * assignmentHours;
    }
  }
  return totalHours;
};

export const AggregatedRow: React.FC<AggregatedRowProps> = ({
  name,
  color = "#6b7280",
  days,
  cellWidth,
  assignments,
  viewMode,
}) => {
  const isMonthRangeView = viewMode === "quarter" || viewMode === "halfYear" || viewMode === "year";

  const cellHours = useMemo(() => {
    const hoursPerCell: number[] = [];

    for (let i = 0; i < days.length; i++) {
      let rangeStart: Date;
      let rangeEnd: Date;

      if (isMonthRangeView) {
        rangeStart = startOfDay(days[i]);
        rangeEnd = endOfMonth(rangeStart);
      } else {
        rangeStart = startOfDay(days[i]);
        rangeEnd = startOfDay(days[i]);
      }

      const totalHours = getTotalHoursForRange(assignments, rangeStart, rangeEnd);
      hoursPerCell.push(totalHours);
    }
    return hoursPerCell;
  }, [days, assignments, isMonthRangeView]);

  const maxHours = Math.max(...cellHours, 0);
  const totalHours = cellHours.reduce((total, hours) => total + hours, 0);
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const renderCell = (hours: number, index: number) => {
    const hasHours = hours > 0;
    const intensity = maxHours > 0 ? Math.min(Math.max(hours / maxHours, 0.32), 1) : 0;
    const backgroundColor = hasHours ? `rgba(37, 99, 235, ${intensity})` : undefined;

    return (
      <div
        key={index}
        className={cn(
          "shrink-0 h-[60px] flex items-center justify-center text-xs font-bold border-r",
          hasHours ? "text-white border-white/20" : "border-dashed"
        )}
        style={{
          width: `${cellWidth}px`,
          backgroundColor,
        }}
        data-hours={hours}
      >
        {hours > 0 ? `${Math.round(hours)}h` : ""}
      </div>
    );
  };

  return (
    <div className="flex border-b hover:bg-accent/5 transition-colors group" data-testid="aggregated-row">
      <div className="w-[250px] shrink-0 p-4 border-r sticky left-0 bg-background z-20 flex items-center gap-3">
        <div className="text-muted-foreground opacity-40" aria-hidden="true">
          <Icon icon="lucide:minus" className="h-4 w-4" />
        </div>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-white"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{name}</div>
          <div className="text-xs text-muted-foreground truncate">
            {Math.round(totalHours)}h total assignment
          </div>
        </div>
      </div>

      <div
        className="flex relative"
        style={{ width: `${days.length * cellWidth}px` }}
      >
        {cellHours.map((hours, index) => renderCell(hours, index))}
      </div>
    </div>
  );
};
