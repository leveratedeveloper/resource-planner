"use client";

import React from "react";
import { cn } from "@/lib/utils";

type DataStatusProps = {
  tone: "warning" | "syncing";
  message: string;
};

export function DataStatus({ tone, message }: DataStatusProps) {
  return (
    <div
      className={cn(
        "border-b px-4 py-2 text-sm",
        tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-blue-200 bg-blue-50 text-blue-900"
      )}
      data-testid="timeline-v2-data-status"
    >
      {message}
    </div>
  );
}
