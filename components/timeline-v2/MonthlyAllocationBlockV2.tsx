"use client";

import React from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";

type MonthlyAllocationBlockV2Props = {
  leftPct: number;
  widthPct: number;
  height: number;
  title: string;
  monthlyTotal: number;
  adjustmentTotal?: number;
  isHighlighted?: boolean;
  isLoading?: boolean;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
};

export function MonthlyAllocationBlockV2({
  leftPct,
  widthPct,
  height,
  title,
  monthlyTotal,
  adjustmentTotal = 0,
  isHighlighted = false,
  isLoading = false,
  onClick,
}: MonthlyAllocationBlockV2Props) {
  return (
    <div
      className={cn(
        "absolute flex cursor-pointer overflow-hidden rounded border bg-blue-600 text-[10px] text-white shadow-sm",
        isHighlighted && "ring-2 ring-amber-400 border-amber-200 shadow-md"
      )}
      style={{ left: `${leftPct}%`, width: `${widthPct}%`, top: 2, height: height - 4 }}
      onClick={onClick}
      aria-busy={isLoading}
    >
      {adjustmentTotal > 0 ? (
        <div
          className="absolute right-0 top-0 h-full rounded-r"
          style={{ width: `${Math.min(100, (adjustmentTotal / Math.max(monthlyTotal, 1)) * 100)}%`, backgroundColor: "rgba(147, 197, 253, 0.4)" }}
        />
      ) : null}
      {isLoading ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-blue-950/35">
          <Icon icon="lucide:loader-2" className="h-3.5 w-3.5 animate-spin" />
        </div>
      ) : null}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center px-1.5 py-0.5 pointer-events-none">
        <div className="font-bold truncate">{title}</div>
        <div className="truncate opacity-90">{monthlyTotal}h</div>
      </div>
    </div>
  );
}
