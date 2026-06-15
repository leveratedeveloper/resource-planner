/**
 * Forecasting Engine
 * Trend analysis and predictions for capacity planning
 * Pure function - can run in Web Worker
 */

import { Resource } from "@/types";
import {
  ResourceCapacityAnalysis,
  WeeklyForecast,
  ForecastResult,
  AnalysisAssignment,
} from "./types";
import { getDateRange, getDailyCapacity, isDateStrInAssignment } from "./capacity-analyzer";
import { toLocalDateKey, parseLocalDateKey } from "./date-utils";

/**
 * Get the Monday of a given week
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the Sunday of a given week
 */
function getWeekEnd(date: Date): Date {
  const weekStart = getWeekStart(date);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  return weekEnd;
}

/**
 * Calculate utilization for a specific week
 */
function calculateWeekUtilization(
  resources: Resource[],
  assignments: AnalysisAssignment[],
  weekStart: Date,
  weekEnd: Date
): { average: number; peak: number; atRiskResources: string[] } {
  const dateRange = getDateRange(
    toLocalDateKey(weekStart),
    toLocalDateKey(weekEnd)
  );

  // Only include weekdays (Mon-Fri)
  const weekdays = dateRange.filter((d) => {
    const date = parseLocalDateKey(d);
    const day = date.getDay();
    return day !== 0 && day !== 6;
  });

  if (weekdays.length === 0) {
    return { average: 0, peak: 0, atRiskResources: [] };
  }

  // Guard: if no resources, return safe defaults
  if (resources.length === 0) {
    return { average: 0, peak: 0, atRiskResources: [] };
  }

  const resourceUtilizations: { resourceId: string; avg: number; peak: number }[] = [];

  for (const resource of resources) {
    const dailyCapacity = getDailyCapacity(resource.capacity);
    const resourceAssignments = assignments.filter(
      (a) => a.resourceId === resource.id
    );

    let totalUtilization = 0;
    let peakUtilization = 0;

    for (const day of weekdays) {
      const dayAssignments = resourceAssignments.filter((a) =>
        isDateStrInAssignment(day, a)
      );

      const hoursAllocated = dayAssignments
        .filter((a) => !a.isTimeOff)
        .reduce((sum, a) => sum + a.hoursPerDay, 0);

      const utilization = dailyCapacity > 0 ? (hoursAllocated / dailyCapacity) * 100 : 0;
      totalUtilization += utilization;
      peakUtilization = Math.max(peakUtilization, utilization);
    }

    const avgUtilization = totalUtilization / weekdays.length;
    resourceUtilizations.push({
      resourceId: resource.id,
      avg: avgUtilization,
      peak: peakUtilization,
    });
  }

  const overallAvg =
    resourceUtilizations.reduce((sum, r) => sum + r.avg, 0) / resourceUtilizations.length;
  const overallPeak = Math.max(...resourceUtilizations.map((r) => r.peak));
  const atRiskResources = resourceUtilizations
    .filter((r) => r.avg > 90 || r.peak > 100)
    .map((r) => r.resourceId);

  return {
    average: overallAvg,
    peak: overallPeak,
    atRiskResources,
  };
}

/**
 * Determine risk level based on utilization
 */
function determineRiskLevel(
  avgUtilization: number,
  atRiskCount: number,
  totalResources: number
): "low" | "medium" | "high" {
  const atRiskRatio = totalResources > 0 ? atRiskCount / totalResources : 0;

  if (avgUtilization > 95 || atRiskRatio > 0.5) {
    return "high";
  }
  if (avgUtilization > 85 || atRiskRatio > 0.25) {
    return "medium";
  }
  return "low";
}

/**
 * Calculate trend based on utilization changes
 */
function calculateTrend(
  currentUtilization: number,
  previousUtilization: number
): "improving" | "stable" | "declining" {
  const delta = currentUtilization - previousUtilization;

  if (delta < -5) return "improving"; // Utilization going down = improving
  if (delta > 5) return "declining"; // Utilization going up = declining
  return "stable";
}

/**
 * Generate weekly forecasts for the next N weeks
 */
export function generateForecast(
  resources: Resource[],
  assignments: AnalysisAssignment[],
  weeksAhead: number = 4,
  startDate: Date = new Date()
): ForecastResult {
  const forecasts: WeeklyForecast[] = [];
  let previousAvg = 0;

  // Start from the current week by default, or from a supplied comparison period.
  const currentWeekStart = getWeekStart(startDate);

  for (let i = 0; i < weeksAhead; i++) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(weekStart.getDate() + i * 7);
    const weekEnd = getWeekEnd(weekStart);

    const { average, peak, atRiskResources } = calculateWeekUtilization(
      resources,
      assignments,
      weekStart,
      weekEnd
    );

    const trend =
      i === 0 ? "stable" : calculateTrend(average, previousAvg);
    const riskLevel = determineRiskLevel(
      average,
      atRiskResources.length,
      resources.length
    );

    forecasts.push({
      weekStart: toLocalDateKey(weekStart),
      weekEnd: toLocalDateKey(weekEnd),
      averageUtilization: average,
      peakUtilization: peak,
      resourcesAtRisk: atRiskResources,
      riskLevel,
      trend,
    });

    previousAvg = average;
  }

  // Calculate overall trend
  const firstWeekAvg = forecasts[0]?.averageUtilization || 0;
  const lastWeekAvg = forecasts[forecasts.length - 1]?.averageUtilization || 0;
  const overallTrend = calculateTrend(lastWeekAvg, firstWeekAvg);

  // Identify bottleneck dates (highest risk weeks)
  const bottleneckDates = forecasts
    .filter((f) => f.riskLevel === "high")
    .map((f) => f.weekStart);

  // Generate recommendations
  const recommendations: string[] = [];

  const highRiskWeeks = forecasts.filter((f) => f.riskLevel === "high").length;
  if (highRiskWeeks > 0) {
    recommendations.push(
      `${highRiskWeeks} week(s) predicted to be at high capacity risk. Consider redistributing workload.`
    );
  }

  const decliningWeeks = forecasts.filter((f) => f.trend === "declining").length;
  if (decliningWeeks >= 2) {
    recommendations.push(
      "Utilization is trending up. Review upcoming assignments to prevent overallocation."
    );
  }

  const maxAtRiskResources = Math.max(...forecasts.map((f) => f.resourcesAtRisk.length));
  if (maxAtRiskResources >= 2) {
    recommendations.push(
      `Up to ${maxAtRiskResources} team members may be at risk of overallocation. Consider load balancing.`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push("Capacity looks healthy for the forecast period.");
  }

  return {
    weeks: forecasts,
    overallTrend,
    bottleneckDates,
    recommendations,
  };
}

/**
 * Calculate moving average utilization
 */
export function calculateMovingAverage(
  capacityAnalysis: ResourceCapacityAnalysis[],
  windowDays: number = 7
): number[] {
  if (capacityAnalysis.length === 0) return [];

  // Get all daily utilizations
  const allDays = capacityAnalysis.flatMap((r) => r.dailyUtilization);
  
  // Group by date
  const byDate = new Map<string, number[]>();
  for (const day of allDays) {
    if (!byDate.has(day.date)) {
      byDate.set(day.date, []);
    }
    byDate.get(day.date)!.push(day.utilizationPercent);
  }

  // Calculate daily team average
  const sortedDates = Array.from(byDate.keys()).sort();
  const dailyAverages = sortedDates.map((date) => {
    const values = byDate.get(date)!;
    return values.reduce((a, b) => a + b, 0) / values.length;
  });

  // Calculate moving average
  const movingAverages: number[] = [];
  for (let i = 0; i < dailyAverages.length; i++) {
    const start = Math.max(0, i - windowDays + 1);
    const window = dailyAverages.slice(start, i + 1);
    const avg = window.reduce((a, b) => a + b, 0) / window.length;
    movingAverages.push(avg);
  }

  return movingAverages;
}
