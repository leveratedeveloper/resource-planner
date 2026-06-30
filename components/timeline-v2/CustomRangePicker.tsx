"use client";

import React, { useState } from "react";
import { addMonths, startOfMonth } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  CUSTOM_RANGE_MAX_MONTHS,
  buildFromMonthOptions,
  buildToMonthOptions,
  clampRange,
  formatMonthValue,
  monthsInRange,
  parseMonthValue,
} from "@/lib/timeline-v2/custom-range";

type Range = { start: Date; end: Date };

type CustomRangePickerProps = {
  value: Range | null;
  onApply: (range: Range) => void;
  children: React.ReactNode;
};

function defaultRange(): Range {
  const start = startOfMonth(new Date());
  return { start, end: addMonths(start, 5) };
}

export function CustomRangePicker({ value, onApply, children }: CustomRangePickerProps) {
  const [open, setOpen] = useState(false);
  const seed = value ?? defaultRange();
  const [fromValue, setFromValue] = useState(() => formatMonthValue(seed.start));
  const [toValue, setToValue] = useState(() => formatMonthValue(seed.end));

  const handleOpenChange = (next: boolean) => {
    if (next) {
      const s = value ?? defaultRange();
      setFromValue(formatMonthValue(s.start));
      setToValue(formatMonthValue(s.end));
    }
    setOpen(next);
  };

  const fromOptions = buildFromMonthOptions(parseMonthValue(fromValue).getFullYear());
  const toOptions = buildToMonthOptions(fromValue);

  const handleFromChange = (next: string) => {
    setFromValue(next);
    const { end } = clampRange(parseMonthValue(next), parseMonthValue(toValue));
    setToValue(formatMonthValue(end));
  };

  const handleApply = () => {
    const range = clampRange(parseMonthValue(fromValue), parseMonthValue(toValue));
    onApply(range);
    setOpen(false);
  };

  const count = monthsInRange(parseMonthValue(fromValue), parseMonthValue(toValue));

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="space-y-3">
          <div className="text-sm font-medium">Custom range</div>
          <div className="flex items-center gap-2">
            <Select value={fromValue} onValueChange={handleFromChange}>
              <SelectTrigger className="flex-1" aria-label="From month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {fromOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-muted-foreground text-sm">to</span>
            <Select value={toValue} onValueChange={setToValue}>
              <SelectTrigger className="flex-1" aria-label="To month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {toOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-xs text-muted-foreground">
              {count} month{count !== 1 ? "s" : ""} · max {CUSTOM_RANGE_MAX_MONTHS}
            </span>
            <Button size="sm" onClick={handleApply}>
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
