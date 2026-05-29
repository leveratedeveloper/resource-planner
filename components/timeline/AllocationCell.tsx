"use client";

import React from "react";
import type { Resource } from "@/types";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import type { ActualAssignment } from "@/lib/query/hooks/useActualAssignments";
import { cn } from "@/lib/utils";
import {
  getAllocationCellModel,
  type AllocationCellModel,
} from "@/lib/timeline/allocation-cell-model";

type AllocationCellProps = {
  day: Date;
  resource: Resource;
  assignments: Assignment[];
  actualAssignments: ActualAssignment[];
  cellWidth: number;
  isWeekView?: boolean;
  isMonthRangeView?: boolean;
};

function getAllocationStyle(
  pct: number,
  type: "plan" | "actual"
): { text: string; border: string; bgColor: string } {
  if (pct <= 0) return { text: "text-transparent", border: "", bgColor: "" };

  const opacity = Math.min(Math.max(pct, 0.3), 1);
  const border = pct > 1 ? "border-t-2 border-red-500" : "";

  if (type === "plan") {
    if (pct > 1.25) return { text: "text-white", border, bgColor: "rgba(30, 58, 138, 1)" };
    if (pct > 1.1) return { text: "text-white", border, bgColor: "rgba(30, 64, 175, 1)" };
    if (pct >= 1) return { text: "text-white", border, bgColor: "rgba(37, 99, 235, 1)" };
    return { text: "text-white", border, bgColor: `rgba(37, 99, 235, ${opacity})` };
  }

  if (pct > 1.25) return { text: "text-white", border, bgColor: "rgba(20, 83, 45, 1)" };
  if (pct > 1.1) return { text: "text-white", border, bgColor: "rgba(22, 101, 52, 1)" };
  if (pct >= 1) return { text: "text-white", border, bgColor: "rgba(22, 163, 74, 1)" };
  return { text: "text-white", border, bgColor: `rgba(22, 163, 74, ${opacity})` };
}

function renderAllocationCell(model: AllocationCellModel, cellWidth: number) {
  if (model.kind === "time-off") {
    return (
      <div
        className="shrink-0 h-[60px] border-r border-white/20 bg-gray-600 flex items-center justify-center text-xs font-bold text-white"
        style={{ width: `${cellWidth}px` }}
      >
        Time Off
      </div>
    );
  }

  if (model.kind === "empty") {
    return (
      <div
        className="shrink-0 h-[60px] border-r border-dashed"
        style={{ width: `${cellWidth}px` }}
      />
    );
  }

  const planStyles = getAllocationStyle(model.planPct, "plan");

  return (
    <div
      className="shrink-0 h-[30px] border-r border-white/20 flex flex-col overflow-hidden"
      style={{ width: `${cellWidth}px` }}
    >
      <div
        className={cn(
          "flex-1 flex items-center justify-center text-[11px] font-bold transition-all",
          planStyles.text,
          planStyles.border
        )}
        style={{ backgroundColor: planStyles.bgColor }}
      >
        {model.planLabel}
      </div>
    </div>
  );
}

export const AllocationCell = React.memo<AllocationCellProps>(function AllocationCell({
  day,
  resource,
  assignments,
  actualAssignments,
  cellWidth,
  isWeekView = false,
  isMonthRangeView = false,
}) {
  const model = getAllocationCellModel({
    day,
    resource,
    assignments,
    actualAssignments,
    isWeekView,
    isMonthRangeView,
  });

  return renderAllocationCell(model, cellWidth);
});
