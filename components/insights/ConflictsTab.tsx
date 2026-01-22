"use client";

import React, { useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { Conflict, ConflictSeverity, ConflictType } from "@/lib/analysis/types";
import { ConflictAlert } from "./ConflictAlert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ConflictsTabProps {
  conflicts: Conflict[];
  isLoading: boolean;
}

type FilterSeverity = "all" | ConflictSeverity;
type FilterType = "all" | ConflictType;

export const ConflictsTab: React.FC<ConflictsTabProps> = ({
  conflicts,
  isLoading,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<FilterSeverity>("all");
  const [filterType, setFilterType] = useState<FilterType>("all");

  const filteredConflicts = useMemo(() => {
    let result = [...conflicts];

    if (filterSeverity !== "all") {
      result = result.filter((c) => c.severity === filterSeverity);
    }

    if (filterType !== "all") {
      result = result.filter((c) => c.type === filterType);
    }

    return result;
  }, [conflicts, filterSeverity, filterType]);

  const criticalCount = conflicts.filter((c) => c.severity === "critical").length;
  const warningCount = conflicts.filter((c) => c.severity === "warning").length;

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 bg-muted/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (conflicts.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
          <Icon icon="lucide:check-circle" className="w-8 h-8 text-green-500" />
        </div>
        <p className="font-medium text-green-600">No Conflicts Detected</p>
        <p className="text-sm text-muted-foreground mt-1">
          All assignments are properly scheduled
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Summary Bar */}
      {(criticalCount > 0 || warningCount > 0) && (
        <div className="flex items-center gap-4 p-3 mx-4 mt-4 rounded-lg bg-muted/50 border">
          {criticalCount > 0 && (
            <div className="flex items-center gap-1 text-sm">
              <Icon icon="lucide:alert-octagon" className="w-4 h-4 text-red-500" />
              <span className="font-medium text-red-500">{criticalCount}</span>
              <span className="text-muted-foreground">critical</span>
            </div>
          )}
          {warningCount > 0 && (
            <div className="flex items-center gap-1 text-sm">
              <Icon icon="lucide:alert-triangle" className="w-4 h-4 text-amber-500" />
              <span className="font-medium text-amber-500">{warningCount}</span>
              <span className="text-muted-foreground">warnings</span>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 p-4 border-b">
        <Select
          value={filterSeverity}
          onValueChange={(val) => setFilterSeverity(val as FilterSeverity)}
        >
          <SelectTrigger className="w-[120px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severity</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterType} onValueChange={(val) => setFilterType(val as FilterType)}>
          <SelectTrigger className="w-[150px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="overallocation">Overallocation</SelectItem>
            <SelectItem value="time_off_deadline">Time-Off/Deadline</SelectItem>
            <SelectItem value="resource_unavailable">Unavailable</SelectItem>
            <SelectItem value="billable_target">Billable Target</SelectItem>
          </SelectContent>
        </Select>

        <span className="ml-auto text-xs text-muted-foreground">
          {filteredConflicts.length} of {conflicts.length} conflicts
        </span>
      </div>

      {/* Conflicts List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredConflicts.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <Icon icon="lucide:filter-x" className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No conflicts match the filter</p>
          </div>
        ) : (
          filteredConflicts.map((conflict) => (
            <ConflictAlert
              key={conflict.id}
              conflict={conflict}
              onResolve={() => {
                // TODO: Handle conflict resolution
                console.log("Resolve conflict:", conflict.id);
              }}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default ConflictsTab;
