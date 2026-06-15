"use client";

import React from "react";
import { Icon } from "@iconify/react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SetupSectionHeaderProps {
  title: string;
  description?: string;
  searchValue: string;
  searchPlaceholder: string;
  searchTestId: string;
  onSearchChange: (value: string) => void;
  actions?: React.ReactNode;
  className?: string;
}

export function SetupSectionHeader({
  title,
  description,
  searchValue,
  searchPlaceholder,
  searchTestId,
  onSearchChange,
  actions,
  className,
}: SetupSectionHeaderProps) {
  return (
    <div
      className={cn(
        "sticky top-0 z-20 -mx-6 mb-6 flex items-start justify-between gap-4 bg-background px-6 py-4 shadow-[0_1px_0_0_hsl(var(--border))]",
        className
      )}
    >
      <div className="min-w-0">
        <h2 className="text-lg font-semibold leading-7">{title}</h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="flex w-full max-w-sm shrink-0 items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Icon
            icon="lucide:search"
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            data-testid={searchTestId}
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            className="pl-9"
          />
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </div>
  );
}
