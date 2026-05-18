"use client";

import React from "react";
import { Icon } from "@iconify/react";
import { AnalysisResult } from "@/lib/analysis/types";
import { Skeleton } from "@/components/ui/skeleton";

interface InsightsSummaryProps {
  result: AnalysisResult | null;
  isLoading: boolean;
}

export const InsightsSummary: React.FC<InsightsSummaryProps> = ({
  result,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 p-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-20"
          >
            <Skeleton className="h-full w-full rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  if (!result) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <Icon icon="lucide:bar-chart-3" className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No analysis data available</p>
      </div>
    );
  }

  const { summary } = result;

  const cards = [
    {
      label: "Overallocated",
      value: summary.overallocatedCount,
      icon: "lucide:alert-triangle",
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      description: "People carrying more work than their capacity supports",
    },
    {
      label: "Underutilized",
      value: summary.underutilizedCount,
      icon: "lucide:trending-down",
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      description: "People with room to absorb planned work",
    },
    {
      label: "Optimal",
      value: summary.optimalCount,
      icon: "lucide:check-circle",
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      description: "People assigned within the healthy workload range",
    },
    {
      label: "Conflicts",
      value: summary.conflictCount,
      icon: "lucide:x-circle",
      color: summary.criticalConflicts > 0 ? "text-red-500" : "text-muted-foreground",
      bgColor: summary.criticalConflicts > 0 ? "bg-red-500/10" : "bg-muted/50",
      description: `${summary.criticalConflicts} require immediate planning attention`,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 p-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-lg p-3 ${card.bgColor} border border-border/50`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Icon icon={card.icon} className={`w-4 h-4 ${card.color}`} />
            <span className="text-sm font-medium">{card.label}</span>
          </div>
          <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
          <div className="text-xs text-muted-foreground">{card.description}</div>
        </div>
      ))}
    </div>
  );
};

export default InsightsSummary;
