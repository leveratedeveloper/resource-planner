"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { TimelineAllocationCell } from "@/lib/timeline-v2/types";

type CapacityStripProps = {
  cells: TimelineAllocationCell[];
};

// Utilization ramp (DESIGN.md §3.2): blue intensity scales with plan load,
// opacity fades below 100%, red top border marks overbooked days. Light cells
// (low opacity over white) switch to dark text — white fails contrast there.
function getAllocationStyle(pct: number): { text: string; border: string; bgColor: string } {
  if (pct <= 0) return { text: "text-transparent", border: "", bgColor: "" };

  const opacity = Math.min(Math.max(pct, 0.3), 1);
  const border = pct > 1 ? "border-t-2 border-red-500" : "";

  if (pct > 1.25) return { text: "text-white", border, bgColor: "rgba(30, 58, 138, 1)" };
  if (pct > 1.1) return { text: "text-white", border, bgColor: "rgba(30, 64, 175, 1)" };
  if (pct >= 1) return { text: "text-white", border, bgColor: "rgba(37, 99, 235, 1)" };
  return {
    text: opacity >= 0.55 ? "text-white" : "text-blue-900",
    border,
    bgColor: `rgba(37, 99, 235, ${opacity})`,
  };
}

// One memoized strip per row replaces the old per-cell component fleet: a
// continuous heatmap with no per-cell chrome (approved visual delta, §4).
export const CapacityStrip = React.memo(function CapacityStrip({ cells }: CapacityStripProps) {
  return (
    <div className="timeline-grid h-timeline-row flex-1" data-testid="timeline-v2-capacity-strip">
      {cells.map((cell) => {
        if (cell.model.kind === "empty") {
          return <div key={cell.id} className="h-full" />;
        }

        const styles = getAllocationStyle(cell.model.planPct);

        return (
          <div
            key={cell.id}
            className={cn(
              "flex h-full flex-col items-center justify-center overflow-hidden leading-none",
              styles.text,
              styles.border
            )}
            style={{ backgroundColor: styles.bgColor }}
            data-date={cell.date}
          >
            <span className="text-[11px] font-bold">{cell.model.planHoursLabel}</span>
            <span className="text-[9px] font-medium opacity-80">{cell.model.planLabel}</span>
          </div>
        );
      })}
    </div>
  );
});
