"use client";

import React from "react";
import { Icon } from "@iconify/react";
import { ResourceCapacityAnalysis } from "@/lib/analysis/types";
import { Badge } from "@/components/ui/badge";

interface CapacityCardProps {
  analysis: ResourceCapacityAnalysis;
  onViewDetails?: () => void;
}

export const CapacityCard: React.FC<CapacityCardProps> = ({
  analysis,
  onViewDetails,
}) => {
  const getStatusConfig = () => {
    switch (analysis.status) {
      case "overallocated":
        return {
          icon: "lucide:alert-triangle",
          color: "text-red-500",
          bgColor: "bg-red-500/10",
          borderColor: "border-red-500/30",
          label: "Overallocated",
          badgeVariant: "destructive" as const,
        };
      case "underutilized":
        return {
          icon: "lucide:trending-down",
          color: "text-amber-500",
          bgColor: "bg-amber-500/10",
          borderColor: "border-amber-500/30",
          label: "Underutilized",
          badgeVariant: "secondary" as const,
        };
      default:
        return {
          icon: "lucide:check-circle",
          color: "text-green-500",
          bgColor: "bg-green-500/10",
          borderColor: "border-green-500/30",
          label: "Optimal",
          badgeVariant: "default" as const,
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div
      className={`p-4 rounded-lg border ${config.borderColor} ${config.bgColor} transition-all hover:shadow-md cursor-pointer`}
      onClick={onViewDetails}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-sm font-semibold text-primary">
              {analysis.resourceName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h4 className="font-semibold">{analysis.resourceName}</h4>
            <p className="text-xs text-muted-foreground">
              {analysis.role} • {analysis.department}
            </p>
          </div>
        </div>
        <Badge variant={config.badgeVariant} className="text-xs">
          <Icon icon={config.icon} className="w-3 h-3 mr-1" />
          {config.label}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className={`rounded p-2 ${analysis.averageUtilization > 100 ? 'bg-red-500/10' : 'bg-muted/50'}`}>
          <div className={`text-lg font-bold ${analysis.averageUtilization > 100 ? 'text-red-500' : ''}`}>
            {Math.round(analysis.averageUtilization)}%
          </div>
          <div className="text-xs text-muted-foreground">Avg Util.</div>
        </div>
        <div className={`rounded p-2 ${analysis.peakUtilization > 150 ? 'bg-red-500/10' : 'bg-muted/50'}`}>
          <div className={`text-lg font-bold ${analysis.peakUtilization > 150 ? 'text-red-500' : ''}`}>
            {Math.round(analysis.peakUtilization)}%
          </div>
          <div className="text-xs text-muted-foreground">Peak</div>
        </div>
        <div className={`rounded p-2 ${analysis.billablePercent < 80 ? 'bg-amber-500/10' : 'bg-muted/50'}`}>
          <div className={`text-lg font-bold ${analysis.billablePercent < 80 ? 'text-amber-500' : ''}`}>
            {Math.round(analysis.billablePercent)}%
          </div>
          <div className="text-xs text-muted-foreground">Billable</div>
        </div>
      </div>

      {(analysis.overallocatedDays > 0 || analysis.underutilizedDays > 0) && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          {analysis.overallocatedDays > 0 && (
            <span className="flex items-center gap-1 text-red-500">
              <Icon icon="lucide:calendar-x" className="w-3 h-3" />
              {analysis.overallocatedDays} days over
            </span>
          )}
          {analysis.underutilizedDays > 0 && (
            <span className="flex items-center gap-1 text-amber-500">
              <Icon icon="lucide:calendar-minus" className="w-3 h-3" />
              {analysis.underutilizedDays} days under
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default CapacityCard;
