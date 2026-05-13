"use client";

import React from "react";
import { Icon } from "@iconify/react";
import { AnalysisResult } from "@/lib/analysis/types";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type SummaryComparison = {
  label: string;
  tone: "positive" | "negative" | "neutral";
  icon: string;
};

type SummaryComparisons = {
  overallocated?: SummaryComparison | null;
  underutilized?: SummaryComparison | null;
  optimal?: SummaryComparison | null;
  conflicts?: SummaryComparison | null;
};

interface InsightsSummaryProps {
  result: AnalysisResult | null;
  isLoading: boolean;
  comparisons?: SummaryComparisons | null;
}

export const InsightsSummary: React.FC<InsightsSummaryProps> = ({
  result,
  isLoading,
  comparisons,
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
      comparison: comparisons?.overallocated,
    },
    {
      label: "Underutilized",
      value: summary.underutilizedCount,
      icon: "lucide:trending-down",
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      description: "People with room to absorb planned work",
      comparison: comparisons?.underutilized,
    },
    {
      label: "Optimal",
      value: summary.optimalCount,
      icon: "lucide:check-circle",
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      description: "People assigned within the healthy workload range",
      comparison: comparisons?.optimal,
    },
    {
      label: "Conflicts",
      value: summary.conflictCount,
      icon: "lucide:x-circle",
      color: summary.criticalConflicts > 0 ? "text-red-500" : "text-muted-foreground",
      bgColor: summary.criticalConflicts > 0 ? "bg-red-500/10" : "bg-muted/50",
      description: `${summary.criticalConflicts} require immediate planning attention`,
      comparison: comparisons?.conflicts,
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
          <SummaryComparisonIndicator comparison={card.comparison} />
          <div className="text-xs text-muted-foreground">{card.description}</div>
        </div>
      ))}
    </div>
  );
};

function SummaryComparisonIndicator({
  comparison,
}: {
  comparison?: SummaryComparison | null;
}) {
  if (!comparison) return null;

  const toneClassName =
    comparison.tone === "positive"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
      : comparison.tone === "negative"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border-border bg-muted/50 text-muted-foreground";

  return (
    <div
      className={cn(
        "my-2 inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium tabular-nums",
        toneClassName
      )}
    >
      <Icon
        icon={comparison.icon}
        className={cn("size-3.5", comparison.icon === "lucide:loader-circle" && "animate-spin")}
      />
      <span>{comparison.label}</span>
    </div>
  );
}

export default InsightsSummary;
