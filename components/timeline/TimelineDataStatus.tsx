"use client";

import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";

type TimelineDataStatusProps = {
  tone: "syncing" | "warning";
  message: string;
};

export function TimelineDataStatus({ tone, message }: TimelineDataStatusProps) {
  const isWarning = tone === "warning";

  return (
    <div
      className={cn(
        "flex min-h-9 items-center gap-2 border-b px-4 py-2 text-xs transition-colors duration-150",
        isWarning
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-border bg-muted/40 text-muted-foreground"
      )}
      role={isWarning ? "alert" : "status"}
      aria-live={isWarning ? "assertive" : "polite"}
    >
      <Icon
        icon={isWarning ? "lucide:triangle-alert" : "lucide:loader-2"}
        className={cn("h-3.5 w-3.5 shrink-0", !isWarning && "animate-spin")}
        aria-hidden="true"
      />
      <span className="truncate">{message}</span>
    </div>
  );
}
