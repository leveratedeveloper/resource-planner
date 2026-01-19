"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@iconify/react";
import { format, addWeeks, subWeeks, addMonths, subMonths, addQuarters, subQuarters, addYears, subYears, startOfWeek } from "date-fns";
import { cn } from "@/lib/utils";

export type ViewMode = "week" | "month" | "quarter" | "halfYear" | "year";

interface TimelineHeaderControlsProps {
  currentDate: Date;
  viewMode: ViewMode;
  showWeekends: boolean;
  onViewModeChange: (mode: ViewMode) => void;
  onDateChange: (date: Date) => void;
  onToggleWeekends: () => void;
  onToday: () => void;
}

export const TimelineHeaderControls: React.FC<TimelineHeaderControlsProps> = ({
  currentDate,
  viewMode,
  showWeekends,
  onViewModeChange,
  onDateChange,
  onToggleWeekends,
  onToday,
}) => {
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
    <div className="flex items-center justify-between px-4 py-2 border-b bg-background">
      {/* Left: Navigation */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onToday}
          className="text-xs"
        >
          Today
        </Button>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={handlePrev} className="h-8 w-8">
            <Icon icon="lucide:chevron-left" className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleNext} className="h-8 w-8">
            <Icon icon="lucide:chevron-right" className="h-4 w-4" />
          </Button>
        </div>
        <span className="font-medium text-sm min-w-[140px]">
          {viewMode === "year" ? format(currentDate, "yyyy") : format(currentDate, "MMMM yyyy")}
        </span>
      </div>

      {/* Center: View Mode Toggle */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
        <Button
          variant={viewMode === "week" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onViewModeChange("week")}
          className={cn(
            "text-xs h-7 px-3",
            viewMode === "week" && "bg-background shadow-sm"
          )}
        >
          Week
        </Button>
        <Button
          variant={viewMode === "month" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onViewModeChange("month")}
          className={cn(
            "text-xs h-7 px-3",
            viewMode === "month" && "bg-background shadow-sm"
          )}
        >
          Month
        </Button>
        <Button
          variant={viewMode === "quarter" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onViewModeChange("quarter")}
          className={cn(
            "text-xs h-7 px-3",
            viewMode === "quarter" && "bg-background shadow-sm"
          )}
        >
          Quarter
        </Button>
        <Button
          variant={viewMode === "halfYear" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onViewModeChange("halfYear")}
          className={cn(
            "text-xs h-7 px-3",
            viewMode === "halfYear" && "bg-background shadow-sm"
          )}
        >
          Half Year
        </Button>
        <Button
          variant={viewMode === "year" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onViewModeChange("year")}
          className={cn(
            "text-xs h-7 px-3",
            viewMode === "year" && "bg-background shadow-sm"
          )}
        >
          Year
        </Button>
      </div>

      {/* Right: Weekend Toggle (only for week and month views) */}
      {(viewMode === "week" || viewMode === "month") ? (
        <div className="flex items-center gap-2">
          <Button
            variant={showWeekends ? "default" : "outline"}
            size="sm"
            onClick={onToggleWeekends}
            className="text-xs gap-1"
          >
            <Icon
              icon={showWeekends ? "lucide:calendar" : "lucide:calendar-off"}
              className="h-3.5 w-3.5"
            />
            {showWeekends ? "Hide Weekends" : "Show Weekends"}
          </Button>
        </div>
      ) : (
        /* Placeholder to maintain centered layout */
        <div className="w-[140px]" />
      )}
    </div>
  );
};
