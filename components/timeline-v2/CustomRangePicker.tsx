"use client";

import React, { useState } from "react";
import { addMonths, format, isBefore, startOfMonth } from "date-fns";
import { Icon } from "@iconify/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CUSTOM_RANGE_MAX_MONTHS,
  clampRange,
  getMonthCellState,
  monthsInRange,
} from "@/lib/timeline-v2/custom-range";

type Range = { start: Date; end: Date };

type CustomRangePickerProps = {
  value: Range | null;
  onApply: (range: Range) => void;
  children: React.ReactNode;
};

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function defaultRange(): Range {
  const start = startOfMonth(new Date());
  return { start, end: addMonths(start, 5) };
}

export function CustomRangePicker({ value, onApply, children }: CustomRangePickerProps) {
  const [open, setOpen] = useState(false);
  const seed = value ?? defaultRange();
  const [start, setStart] = useState<Date>(seed.start);
  const [end, setEnd] = useState<Date | null>(seed.end);
  const [picking, setPicking] = useState(false);
  const [hover, setHover] = useState<Date | null>(null);
  const [year, setYear] = useState(seed.start.getFullYear());

  const handleOpenChange = (next: boolean) => {
    if (next) {
      // Re-seed the grid from the applied range each time the picker opens.
      const s = value ?? defaultRange();
      setStart(s.start);
      setEnd(s.end);
      setPicking(false);
      setHover(null);
      setYear(s.start.getFullYear());
    }
    setOpen(next);
  };

  const handleMonthClick = (month: Date) => {
    if (!picking) {
      // First click begins a fresh selection.
      setStart(month);
      setEnd(null);
      setPicking(true);
      setHover(null);
      return;
    }
    if (isBefore(month, start)) {
      // Second click lands before the start — restart from the earlier month.
      setStart(month);
      setEnd(null);
      return;
    }
    // Second valid click commits the range (clamp defends the 12-month cap).
    const range = clampRange(start, month);
    setStart(range.start);
    setEnd(range.end);
    setPicking(false);
    setHover(null);
  };

  // While picking, preview the span up to the hovered month; otherwise show the
  // committed range. capAnchor is set only while picking so the grid disables
  // any month beyond the 12-month window.
  const previewEnd = picking ? (hover && !isBefore(hover, start) ? hover : start) : end;
  const capAnchor = picking ? start : null;
  const count = monthsInRange(start, previewEnd ?? start);
  const canApply = !picking && end !== null;

  const footerText = picking
    ? hover && !isBefore(hover, start)
      ? `${count} month${count !== 1 ? "s" : ""}`
      : "Select an end month"
    : `${count} month${count !== 1 ? "s" : ""} · max ${CUSTOM_RANGE_MAX_MONTHS}`;

  const handleApply = () => {
    if (!end) return;
    onApply(clampRange(start, end));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Custom range</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" onClick={() => setYear((y) => y - 1)} aria-label="Previous year">
                <Icon icon="lucide:chevron-left" className="h-4 w-4" />
              </Button>
              <span className="text-sm tabular-nums w-10 text-center">{year}</span>
              <Button variant="ghost" size="icon-sm" onClick={() => setYear((y) => y + 1)} aria-label="Next year">
                <Icon icon="lucide:chevron-right" className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1" onMouseLeave={() => setHover(null)}>
            {MONTH_LABELS.map((label, monthIndex) => {
              const month = new Date(year, monthIndex, 1);
              const state = getMonthCellState({ month, rangeStart: start, rangeEnd: previewEnd, capAnchor });
              const isDisabled = state === "disabled";
              return (
                <button
                  key={label}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleMonthClick(month)}
                  onMouseEnter={() => {
                    if (picking && !isDisabled) setHover(month);
                  }}
                  aria-label={format(month, "MMMM yyyy")}
                  className={cn(
                    "h-9 rounded-md text-xs transition-colors",
                    state === "start" || state === "end"
                      ? "bg-primary text-primary-foreground font-medium"
                      : state === "in-range"
                        ? "bg-primary/15 text-foreground"
                        : isDisabled
                          ? "text-muted-foreground/40 cursor-not-allowed"
                          : "text-foreground hover:bg-accent",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-xs text-muted-foreground">{footerText}</span>
            <Button size="sm" onClick={handleApply} disabled={!canApply}>
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
