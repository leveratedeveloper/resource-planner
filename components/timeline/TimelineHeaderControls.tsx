"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@iconify/react";
import { format, addWeeks, subWeeks, addMonths, subMonths, startOfWeek } from "date-fns";
import { cn } from "@/lib/utils";

export type ViewMode = "day" | "week" | "month";

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
    if (viewMode === "month") {
      onDateChange(subMonths(currentDate, 1));
    } else {
      onDateChange(subWeeks(currentDate, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === "month") {
      onDateChange(addMonths(currentDate, 1));
    } else {
      onDateChange(addWeeks(currentDate, 1));
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
          {format(currentDate, "MMMM yyyy")}
        </span>
      </div>

      {/* Center: View Mode Toggle */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
        <Button
          variant={viewMode === "day" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onViewModeChange("day")}
          className={cn(
            "text-xs h-7 px-3",
            viewMode === "day" && "bg-background shadow-sm"
          )}
        >
          Day
        </Button>
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
      </div>

      {/* Right: Weekend Toggle */}
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
    </div>
  );
};
