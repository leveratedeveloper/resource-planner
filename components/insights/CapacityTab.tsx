"use client";

import React, { useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { ResourceCapacityAnalysis } from "@/lib/analysis/types";
import { CapacityCard } from "./CapacityCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

interface CapacityTabProps {
  capacityAnalysis: ResourceCapacityAnalysis[];
  isLoading: boolean;
}

type FilterStatus = "all" | "overallocated" | "underutilized" | "optimal";
type SortBy = "name" | "utilization" | "status";

export const CapacityTab: React.FC<CapacityTabProps> = ({
  capacityAnalysis,
  isLoading,
}) => {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [sortBy, setSortBy] = useState<SortBy>("status");

  const filteredAndSorted = useMemo(() => {
    let result = [...capacityAnalysis];

    // Filter
    if (filterStatus !== "all") {
      result = result.filter((r) => r.status === filterStatus);
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.resourceName.localeCompare(b.resourceName);
        case "utilization":
          return b.averageUtilization - a.averageUtilization;
        case "status":
          const statusOrder = { overallocated: 0, underutilized: 1, optimal: 2 };
          return statusOrder[a.status] - statusOrder[b.status];
        default:
          return 0;
      }
    });

    return result;
  }, [capacityAnalysis, filterStatus, sortBy]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 border rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-2 w-full rounded-full" />
              <div className="flex justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (capacityAnalysis.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Icon icon="lucide:users" className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="font-medium">No capacity data available</p>
        <p className="text-sm">Add assignments to see capacity analysis</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
      <div className="flex items-center gap-2 p-4 border-b">
        <Select
          value={filterStatus}
          onValueChange={(val) => setFilterStatus(val as FilterStatus)}
        >
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="overallocated">Overallocated</SelectItem>
            <SelectItem value="underutilized">Underutilized</SelectItem>
            <SelectItem value="optimal">Optimal</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(val) => setSortBy(val as SortBy)}>
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="status">By Status</SelectItem>
            <SelectItem value="utilization">By Utilization</SelectItem>
            <SelectItem value="name">By Name</SelectItem>
          </SelectContent>
        </Select>

        <span className="ml-auto text-xs text-muted-foreground">
          {filteredAndSorted.length} of {capacityAnalysis.length} resources
        </span>
      </div>

      {/* Resource List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredAndSorted.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <Icon icon="lucide:filter-x" className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No resources match the filter</p>
          </div>
        ) : (
          filteredAndSorted.map((analysis) => (
            <CapacityCard
              key={analysis.resourceId}
              analysis={analysis}
              onViewDetails={() => {
                // TODO: Open resource details or scroll to resource in timeline
                console.log("View details for:", analysis.resourceName);
              }}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default CapacityTab;
