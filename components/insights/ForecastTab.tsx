"use client";

import React, { useMemo } from "react";
import { Icon } from "@iconify/react";
import { Resource, Assignment } from "@/types";
import { ForecastResult, WeeklyForecast } from "@/lib/analysis/types";
import { generateForecast } from "@/lib/analysis/forecasting-engine";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface ForecastTabProps {
  resources: Resource[];
  assignments: Assignment[];
  isLoading: boolean;
}

export const ForecastTab: React.FC<ForecastTabProps> = ({
  resources,
  assignments,
  isLoading,
}) => {
  const forecast = useMemo<ForecastResult | null>(() => {
    if (resources.length === 0 || assignments.length === 0) {
      return null;
    }
    return generateForecast(resources, assignments, 4);
  }, [resources, assignments]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 border rounded-lg p-4 space-y-4">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-8" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!forecast) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Icon icon="lucide:calendar-range" className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="font-medium">No forecast data available</p>
        <p className="text-sm">Add assignments to see capacity forecast</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Overall Trend */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
          <TrendIndicator trend={forecast.overallTrend} />
          <div>
            <div className="text-sm font-medium">4-Week Outlook</div>
            <div className="text-xs text-muted-foreground">
              {forecast.overallTrend === "improving" && "Capacity improving over time"}
              {forecast.overallTrend === "stable" && "Capacity remains stable"}
              {forecast.overallTrend === "declining" && "Capacity becoming constrained"}
            </div>
          </div>
          {forecast.bottleneckDates.length > 0 && (
            <Badge variant="destructive" className="ml-auto text-xs">
              {forecast.bottleneckDates.length} high-risk week(s)
            </Badge>
          )}
        </div>
      </div>

      {/* Recommendations */}
      {forecast.recommendations.length > 0 && (
        <div className="px-4 pb-3">
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-1 text-xs font-medium text-primary mb-2">
              <Icon icon="lucide:lightbulb" className="w-3 h-3" />
              AI Recommendations
            </div>
            <ul className="space-y-1">
              {forecast.recommendations.map((rec, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="text-primary">•</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Weekly Forecast Cards */}
      <div className="flex-1 overflow-y-auto p-4 pt-0 space-y-3">
        {forecast.weeks.map((week, index) => (
          <WeekForecastCard
            key={week.weekStart}
            week={week}
            weekNumber={index + 1}
            totalResources={resources.length}
          />
        ))}
      </div>
    </div>
  );
};

interface TrendIndicatorProps {
  trend: "improving" | "stable" | "declining";
}

const TrendIndicator: React.FC<TrendIndicatorProps> = ({ trend }) => {
  const config = {
    improving: {
      icon: "lucide:trending-down",
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    stable: {
      icon: "lucide:minus",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    declining: {
      icon: "lucide:trending-up",
      color: "text-red-500",
      bgColor: "bg-red-500/10",
    },
  }[trend];

  return (
    <div className={`p-2 rounded-lg ${config.bgColor}`}>
      <Icon icon={config.icon} className={`w-5 h-5 ${config.color}`} />
    </div>
  );
};

interface WeekForecastCardProps {
  week: WeeklyForecast;
  weekNumber: number;
  totalResources: number;
}

const WeekForecastCard: React.FC<WeekForecastCardProps> = ({
  week,
  weekNumber,
  totalResources,
}) => {
  const riskConfig = {
    low: {
      borderColor: "border-green-500/30",
      bgColor: "bg-green-500/5",
      badgeVariant: "outline" as const,
      label: "Low Risk",
    },
    medium: {
      borderColor: "border-amber-500/30",
      bgColor: "bg-amber-500/5",
      badgeVariant: "secondary" as const,
      label: "Medium Risk",
    },
    high: {
      borderColor: "border-red-500/30",
      bgColor: "bg-red-500/5",
      badgeVariant: "destructive" as const,
      label: "High Risk",
    },
  }[week.riskLevel];

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className={`p-4 rounded-lg border ${riskConfig.borderColor} ${riskConfig.bgColor}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-medium text-sm">Week {weekNumber}</div>
          <div className="text-xs text-muted-foreground">
            {formatDate(week.weekStart)} - {formatDate(week.weekEnd)}
          </div>
        </div>
        <Badge variant={riskConfig.badgeVariant} className="text-xs">
          {riskConfig.label}
        </Badge>
      </div>

      {/* Utilization Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-muted-foreground">Team Utilization</span>
          <span className={week.averageUtilization > 90 ? "text-red-500 font-medium" : ""}>
            {Math.round(week.averageUtilization)}%
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              week.averageUtilization > 100
                ? "bg-red-500"
                : week.averageUtilization > 85
                ? "bg-amber-500"
                : "bg-green-500"
            }`}
            style={{ width: `${Math.min(100, week.averageUtilization)}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2 rounded bg-background/50">
          <div className={`font-bold ${week.peakUtilization > 100 ? "text-red-500" : ""}`}>
            {Math.round(week.peakUtilization)}%
          </div>
          <div className="text-muted-foreground">Peak</div>
        </div>
        <div className="p-2 rounded bg-background/50">
          <div className={`font-bold ${week.resourcesAtRisk.length > 0 ? "text-amber-500" : ""}`}>
            {week.resourcesAtRisk.length}/{totalResources}
          </div>
          <div className="text-muted-foreground">At Risk</div>
        </div>
      </div>

      {/* Trend indicator */}
      <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
        <Icon
          icon={
            week.trend === "improving"
              ? "lucide:arrow-down"
              : week.trend === "declining"
              ? "lucide:arrow-up"
              : "lucide:minus"
          }
          className={`w-3 h-3 ${
            week.trend === "improving"
              ? "text-green-500"
              : week.trend === "declining"
              ? "text-red-500"
              : ""
          }`}
        />
        {week.trend === "improving" && "Utilization decreasing"}
        {week.trend === "stable" && "Utilization stable"}
        {week.trend === "declining" && "Utilization increasing"}
      </div>
    </div>
  );
};

export default ForecastTab;
