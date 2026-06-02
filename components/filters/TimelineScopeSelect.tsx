"use client";

import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type TimelineScopeSelectOption = {
  id: string;
  name: string;
  color?: string | null;
};

type TimelineScopeSelectProps = {
  value: string | null;
  allLabel: string;
  placeholder: string;
  ariaLabel: string;
  testId: string;
  options: TimelineScopeSelectOption[];
  onChange: (value: string | null) => void;
  isLoading?: boolean;
};

export function TimelineScopeSelect({
  value,
  allLabel,
  placeholder,
  ariaLabel,
  testId,
  options,
  onChange,
  isLoading = false,
}: TimelineScopeSelectProps) {
  return (
    <Select
      value={value || "all"}
      onValueChange={(nextValue) => onChange(nextValue === "all" ? null : nextValue)}
      disabled={isLoading}
    >
      <SelectTrigger
        className="h-9 w-full min-w-[140px] max-w-[220px] sm:w-auto"
        data-testid={testId}
        aria-label={ariaLabel}
      >
        <SelectValue placeholder={isLoading ? "Loading..." : placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            <span className="flex min-w-0 items-center gap-2">
              {option.color ? (
                <span
                  aria-hidden="true"
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: option.color }}
                />
              ) : null}
              <span className="truncate">{option.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
