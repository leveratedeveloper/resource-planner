"use client";

import React, { useCallback, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { Conflict, ConflictSeverity, ConflictType } from "@/lib/analysis/types";
import { ConflictAlert } from "./ConflictAlert";
import { useDeleteAssignment } from "@/lib/query/hooks/useAssignments";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

interface ConflictsTabProps {
  conflicts: Conflict[];
  isLoading: boolean;
}

type FilterSeverity = "all" | ConflictSeverity;
type FilterType = "all" | ConflictType;

/**
 * Generate a stable key for a conflict based on its semantic content.
 * This allows tracking dismissed conflicts even when their IDs change on re-analysis.
 */
function getConflictStableKey(conflict: Conflict): string {
  return `${conflict.type}|${conflict.resourceId}|${conflict.date}|${conflict.affectedAssignments.slice().sort().join(",")}`;
}

export const ConflictsTab: React.FC<ConflictsTabProps> = ({
  conflicts,
  isLoading,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<FilterSeverity>("all");
  const [filterType, setFilterType] = useState<FilterType>("all");

  // Track dismissed conflicts by stable key (session-only state)
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());

  // Delete assignment mutation
  const deleteAssignment = useDeleteAssignment();

  const filteredConflicts = useMemo(() => {
    let result = [...conflicts];

    // Filter out dismissed conflicts first
    result = result.filter((c) => !dismissedKeys.has(getConflictStableKey(c)));

    if (filterSeverity !== "all") {
      result = result.filter((c) => c.severity === filterSeverity);
    }

    if (filterType !== "all") {
      result = result.filter((c) => c.type === filterType);
    }

    return result;
  }, [conflicts, filterSeverity, filterType, dismissedKeys]);

  const activeConflicts = useMemo(
    () => conflicts.filter((c) => !dismissedKeys.has(getConflictStableKey(c))),
    [conflicts, dismissedKeys]
  );
  const criticalCount = activeConflicts.filter((c) => c.severity === "critical").length;
  const warningCount = activeConflicts.filter((c) => c.severity === "warning").length;

  // Handler: Dismiss a conflict
  const handleDismiss = useCallback((conflict: Conflict) => {
    const key = getConflictStableKey(conflict);
    setDismissedKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  // Handler: Remove an assignment (resolves conflict at the source)
  const handleRemoveAssignment = useCallback((assignmentId: string) => {
    deleteAssignment.mutate(assignmentId);
    // The optimistic update from useDeleteAssignment will remove it from the cache,
    // which triggers re-analysis via the useCapacityAnalysis hook's dependency on assignments.
  }, [deleteAssignment]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 border rounded-lg p-4 space-y-3">
            <div className="flex gap-3">
               <Skeleton className="h-5 w-5 rounded-full" />
               <div className="flex-1 space-y-2">
                 <Skeleton className="h-4 w-1/2" />
                 <Skeleton className="h-3 w-3/4" />
               </div>
            </div>
            <div className="pt-2 flex justify-end">
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
          </div>
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
          <SelectTrigger
            className="w-[120px] h-8 text-xs"
            aria-label="Filter conflicts by severity"
          >
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
          <SelectTrigger
            className="w-[150px] h-8 text-xs"
            aria-label="Filter conflicts by type"
          >
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
          {filteredConflicts.length} of {activeConflicts.length} conflicts
          {dismissedKeys.size > 0 && (
            <button
              onClick={() => setDismissedKeys(new Set())}
              className="ml-2 text-primary hover:underline"
            >
              ({dismissedKeys.size} dismissed - click to restore)
            </button>
          )}
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
              onDismiss={() => handleDismiss(conflict)}
              onRemoveAssignment={handleRemoveAssignment}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default ConflictsTab;
