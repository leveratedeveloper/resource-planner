"use client";

import React from "react";
import { format, addWeeks, subWeeks, addMonths, subMonths, addQuarters, subQuarters, addYears, subYears } from "date-fns";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TimelineV2ViewMode } from "@/lib/timeline-v2/types";

export type TimelineToolbarV2Props = {
  currentDate: Date;
  viewMode: TimelineV2ViewMode;
  showWeekends: boolean;
  onViewModeChange: (mode: TimelineV2ViewMode) => void;
  onDateChange: (date: Date) => void;
  onToggleWeekends: () => void;
  onToday: () => void;
};

export function TimelineToolbarV2({
  currentDate,
  viewMode,
  showWeekends,
  onViewModeChange,
  onDateChange,
  onToggleWeekends,
  onToday,
}: TimelineToolbarV2Props) {
  const handlePrev = () => {
    switch (viewMode) {
      case "week":
        onDateChange(subWeeks(currentDate, 1));
        break;
      case "month":
        onDateChange(subMonths(currentDate, 1));
        break;
      case "quarter":
        onDateChange(subQuarters(currentDate, 1));
        break;
      case "halfYear":
        onDateChange(subMonths(currentDate, 6));
        break;
      case "year":
        onDateChange(subYears(currentDate, 1));
        break;
    }
  };

  const handleNext = () => {
    switch (viewMode) {
      case "week":
        onDateChange(addWeeks(currentDate, 1));
        break;
      case "month":
        onDateChange(addMonths(currentDate, 1));
        break;
      case "quarter":
        onDateChange(addQuarters(currentDate, 1));
        break;
      case "halfYear":
        onDateChange(addMonths(currentDate, 6));
        break;
      case "year":
        onDateChange(addYears(currentDate, 1));
        break;
    }
  };

  return (
    <div className="border-b bg-background" data-testid="timeline-v2-header-controls">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onToday}
            className="text-xs"
            data-testid="timeline-v2-today-button"
          >
            Today
          </Button>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrev}
              className="h-8 w-8"
              data-testid="timeline-v2-prev-button"
              aria-label="Previous timeline period"
            >
              <Icon icon="lucide:chevron-left" className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              className="h-8 w-8"
              data-testid="timeline-v2-next-button"
              aria-label="Next timeline period"
            >
              <Icon icon="lucide:chevron-right" className="h-4 w-4" />
            </Button>
          </div>
          <span className="font-medium text-sm min-w-[140px]">
            {viewMode === "year" || viewMode === "quarter" || viewMode === "halfYear"
              ? format(currentDate, "yyyy")
              : format(currentDate, "MMMM yyyy")}
          </span>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
          {(
            [
              ["week", "Week"],
              ["month", "Month"],
              ["quarter", "Quarter"],
              ["halfYear", "Half Year"],
              ["year", "Year"],
            ] as const
          ).map(([mode, label]) => (
            <Button
              key={mode}
              variant={viewMode === mode ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onViewModeChange(mode)}
              className={cn("h-7 px-3 text-xs", viewMode === mode && "bg-background shadow-sm")}
              data-testid={`timeline-v2-view-${mode === "halfYear" ? "half-year" : mode}`}
            >
              {label}
            </Button>
          ))}
        </div>

        {viewMode === "week" || viewMode === "month" ? (
          <div className="flex items-center gap-2">
            <Button
              variant={showWeekends ? "default" : "outline"}
              size="sm"
              onClick={onToggleWeekends}
              className="gap-1 text-xs"
              data-testid="timeline-v2-weekend-toggle"
            >
              <Icon
                icon={showWeekends ? "lucide:calendar" : "lucide:calendar-off"}
                className="h-3.5 w-3.5"
              />
              {showWeekends ? "Hide Weekends" : "Show Weekends"}
            </Button>
          </div>
        ) : (
          <div className="w-[140px]" />
        )}
      </div>
    </div>
  );
}
