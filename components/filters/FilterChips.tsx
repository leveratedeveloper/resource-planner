"use client";

import React from "react";
import { Icon } from "@iconify/react";

export type FilterChip = { key: string; label: string; onRemove: () => void };

export function FilterChips({ chips }: { chips: FilterChip[] }) {
  if (chips.length === 0) return null;
  return (
    <div className="flex gap-1.5" data-testid="filter-chips">
      {chips.map((chip) => (
        <span key={chip.key} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs">
          <span className="max-w-[160px] truncate">{chip.label}</span>
          <button type="button" aria-label={`Remove ${chip.label}`} onClick={chip.onRemove} className="text-muted-foreground hover:text-foreground">
            <Icon icon="lucide:x" className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
