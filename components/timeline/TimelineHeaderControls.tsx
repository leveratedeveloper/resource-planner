"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@iconify/react";
import { format, addWeeks, subWeeks, addMonths, subMonths, addQuarters, subQuarters, addYears, subYears } from "date-fns";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ViewMode = "week" | "month" | "quarter" | "halfYear" | "year";
export type ResourceView = "employee" | "department" | "brand";

const RESOURCE_VIEW_OPTIONS: { value: ResourceView; label: string; icon: string }[] = [
  { value: "employee", label: "By Employee", icon: "lucide:user" },
  { value: "department", label: "By Department", icon: "lucide:building-2" },
  { value: "brand", label: "By Brand", icon: "lucide:bookmark" },
];

interface TimelineHeaderControlsProps {
  currentDate: Date;
  viewMode: ViewMode;
  showWeekends: boolean;
  resourceView: ResourceView;
  onViewModeChange: (mode: ViewMode) => void;
  onDateChange: (date: Date) => void;
  onToggleWeekends: () => void;
  onToday: () => void;
  onResourceViewChange: (view: ResourceView) => void;
}

export const TimelineHeaderControls: React.FC<TimelineHeaderControlsProps> = ({
  currentDate,
  viewMode,
  showWeekends,
  resourceView,
  onViewModeChange,
  onDateChange,
  onToggleWeekends,
  onToday,
  onResourceViewChange,
}) => {
  const selectedResourceView =
    RESOURCE_VIEW_OPTIONS.find((option) => option.value === resourceView) ?? RESOURCE_VIEW_OPTIONS[0];

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
    <div className="border-b bg-background" data-testid="timeline-header-controls">
      {/* Main Controls Row */}
      <div className="flex items-center justify-between px-4 py-2">
        {/* Left: Navigation */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5"
                data-testid="timeline-resource-view-dropdown"
              >
                <Icon icon={selectedResourceView.icon} className="h-3.5 w-3.5" />
                {selectedResourceView.label}
                <Icon icon="lucide:chevron-down" className="h-3 w-3 ml-0.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {RESOURCE_VIEW_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => onResourceViewChange(option.value)}
                  className={cn("gap-2 cursor-pointer", resourceView === option.value && "font-semibold")}
                >
                  <Icon icon={option.icon} className="h-4 w-4" />
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="text-border" aria-hidden="true">
            |
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={onToday}
            className="text-xs"
            data-testid="timeline-today-button"
          >
            Today
          </Button>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrev}
              className="h-8 w-8"
              data-testid="timeline-prev-button"
              aria-label="Previous timeline period"
            >
              <Icon icon="lucide:chevron-left" className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              className="h-8 w-8"
              data-testid="timeline-next-button"
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
            data-testid="timeline-view-week"
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
            data-testid="timeline-view-month"
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
            data-testid="timeline-view-quarter"
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
            data-testid="timeline-view-half-year"
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
            data-testid="timeline-view-year"
          >
            Year
          </Button>
        </div>

        {/* Right: Weekend Toggle (for week and month views) */}
        {viewMode === "week" || viewMode === "month" ? (
          <div className="flex items-center gap-2">
            <Button
              variant={showWeekends ? "default" : "outline"}
              size="sm"
              onClick={onToggleWeekends}
              className="text-xs gap-1"
              data-testid="timeline-weekend-toggle"
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
    </div>
  );
};
