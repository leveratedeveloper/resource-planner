"use client";

import React from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";

type ResourceIdentityCellV2Props = {
  name: string;
  role: string;
  department: string;
  resourceColumnWidth: number;
  height: number;
  expanded: boolean;
  onToggleExpanded: () => void;
  testId?: string;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ResourceIdentityCellV2({
  name,
  role,
  department,
  resourceColumnWidth,
  height,
  expanded,
  onToggleExpanded,
  testId = "resource-row-v2-identity",
}: ResourceIdentityCellV2Props) {
  return (
    <div
      className="sticky left-0 z-20 flex shrink-0 items-center gap-3 border-r bg-background p-2"
      style={{ width: resourceColumnWidth, height }}
      data-testid={testId}
    >
      <button
        onClick={onToggleExpanded}
        className={cn("text-muted-foreground transition-colors hover:text-foreground")}
        aria-label={expanded ? "Collapse resource row" : "Expand resource row"}
        data-testid={expanded ? "resource-row-v2-collapse" : "resource-row-v2-expand"}
      >
        <Icon icon={expanded ? "lucide:chevron-down" : "lucide:chevron-right"} className="h-4 w-4" />
      </button>
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-medium">
        {getInitials(name)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium leading-4">{name}</div>
        <div className="truncate text-xs leading-3 text-muted-foreground">
          {role} | {department}
        </div>
      </div>
    </div>
  );
}
