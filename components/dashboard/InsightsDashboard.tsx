"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { canAccessDashboard } from "@/lib/auth/client-access";
import { getIncrementalWindow } from "@/lib/dashboard/incremental-list";
import { useAssignments } from "@/lib/query/hooks/useAssignments";
import { useEmployees } from "@/lib/query/hooks/useEmployees";
import { InsightsSummary } from "@/components/insights/InsightsSummary";
import { generateForecast } from "@/lib/analysis/forecasting-engine";
import type {
  AnalysisAssignment,
  Conflict,
  ForecastResult,
  ResourceCapacityAnalysis,
  WeeklyForecast,
} from "@/lib/analysis/types";

type DashboardTab = "capacity" | "conflicts" | "forecast";

export function InsightsDashboard() {
  const router = useRouter();
  const { session, isLoading: isSessionLoading } = useAuth();
  const { analysisResult, isAnalyzing, refreshAnalysis } = useApp();
  const { data: employees = [], isLoading: employeesLoading } = useEmployees();
  const { data: assignments = [], isLoading: assignmentsLoading } = useAssignments();
  const [activeTab, setActiveTab] = useState<DashboardTab>("capacity");
  const [visitedTabs, setVisitedTabs] = useState<Set<DashboardTab>>(() => new Set(["capacity"]));

  const resources = useMemo(
    () =>
      employees.map((employee) => ({
        id: employee.id,
        name: employee.fullName,
        role: employee.position,
        department: employee.department?.name || "Unassigned",
        capacity: employee.weeklyCapacity,
      })),
    [employees]
  );

  const mappedAssignments = useMemo<AnalysisAssignment[]>(
    () =>
      assignments.map((assignment) => ({
        id: assignment.id,
        resourceId: assignment.employeeId,
        projectId: assignment.projectId || "",
        startDate: new Date(assignment.startDate),
        endDate: new Date(assignment.endDate),
        hoursPerDay: parseFloat(String(assignment.hoursPerDay)),
        isTimeOff: assignment.isTimeOff,
        category: assignment.category || "Other",
        isBillable: assignment.isBillable,
        note: assignment.note,
      })),
    [assignments]
  );

  const forecast = useMemo(() => {
    if (resources.length === 0 || mappedAssignments.length === 0) return null;
    return generateForecast(resources, mappedAssignments, 4);
  }, [resources, mappedAssignments]);

  const isLoading = isSessionLoading || employeesLoading || assignmentsLoading || (isAnalyzing && !analysisResult);
  const hasDashboardAccess = canAccessDashboard(session);
  const resetKey = String(analysisResult?.timestamp ?? "pending");
  const lastUpdated = analysisResult?.timestamp
    ? new Date(analysisResult.timestamp).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : "Pending analysis";

  const summary = analysisResult?.summary;
  const totalResources = summary?.totalResources ?? resources.length;
  const stableResources = summary ? summary.optimalCount : 0;
  const attentionCount = summary
    ? summary.overallocatedCount + summary.underutilizedCount + summary.criticalConflicts
    : 0;
  const optimalRate = totalResources > 0 ? Math.round((stableResources / totalResources) * 100) : 0;
  const averageUtilization = analysisResult?.capacityAnalysis.length
    ? Math.round(
        analysisResult.capacityAnalysis.reduce(
          (total, resource) => total + resource.averageUtilization,
          0
        ) / analysisResult.capacityAnalysis.length
      )
    : 0;
  const highRiskWeeks = forecast?.weeks.filter((week) => week.riskLevel === "high").length ?? 0;
  const topConflicts = analysisResult?.conflicts.slice(0, 3) ?? [];
  const topCapacityRisks =
    analysisResult?.capacityAnalysis
      .filter((resource) => resource.status !== "optimal")
      .sort((a, b) => b.peakUtilization - a.peakUtilization)
      .slice(0, 4) ?? [];

  useEffect(() => {
    if (!isSessionLoading && !hasDashboardAccess) {
      router.replace("/");
    }
  }, [hasDashboardAccess, isSessionLoading, router]);

  const handleTabChange = (value: string) => {
    const nextTab = value as DashboardTab;
    setActiveTab(nextTab);
    setVisitedTabs((previous) => {
      const next = new Set(previous);
      next.add(nextTab);
      return next;
    });
  };

  if (isSessionLoading) {
    return <DashboardSkeleton />;
  }

  if (!hasDashboardAccess) {
    return null;
  }

  return (
    <main className="min-h-dvh bg-muted/30">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="w-fit">
                AI operations cockpit
              </Badge>
              <span className="text-sm text-muted-foreground">Updated {lastUpdated}</span>
            </div>
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                AI Insights Dashboard
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                Clean capacity, conflict, and delivery-risk signals for authorized planning teams.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/">
                <Icon icon="lucide:calendar-days" data-icon="inline-start" />
                Main planner
              </Link>
            </Button>
            <Button onClick={refreshAnalysis} disabled={isAnalyzing}>
              <Icon
                icon="lucide:refresh-cw"
                data-icon="inline-start"
                className={isAnalyzing ? "animate-spin" : undefined}
              />
              Refresh insights
            </Button>
          </div>
        </header>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Executive Signal</CardTitle>
            <CardDescription>
              A planner-ready view of team capacity, workload balance, and delivery risk.
            </CardDescription>
            <CardAction>
              <Badge variant={attentionCount > 0 ? "destructive" : "secondary"}>
                {attentionCount > 0 ? `${attentionCount} need review` : "Stable"}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricTile
                label="Optimal resources"
                value={`${optimalRate}%`}
                detail={`${stableResources} of ${totalResources} people are balanced`}
                icon="lucide:target"
              />
              <MetricTile
                label="Avg utilization"
                value={`${averageUtilization}%`}
                detail="Current workload across the team"
                icon="lucide:activity"
              />
              <MetricTile
                label="High-risk weeks"
                value={highRiskWeeks}
                detail="Weeks that may need staffing action"
                icon="lucide:calendar-alert"
              />
            </div>
            <Separator />
            <div className="rounded-xl border bg-muted/40">
              <InsightsSummary result={analysisResult} isLoading={isLoading} />
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-4 lg:grid-cols-2">
          <RiskQueueCard
            title="Top Capacity Risks"
            description="People most likely to be overloaded or sitting below useful capacity."
            emptyLabel="No capacity risk detected"
          >
            {topCapacityRisks.map((resource) => (
              <CompactCapacityRisk key={resource.resourceId} resource={resource} />
            ))}
          </RiskQueueCard>

          <RiskQueueCard
            title="Conflict Watchlist"
            description="Scheduling issues that could block delivery, billing, or time-off coverage."
            emptyLabel="No active conflicts detected"
          >
            {topConflicts.map((conflict) => (
              <CompactConflictRisk key={conflict.id} conflict={conflict} />
            ))}
          </RiskQueueCard>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Insight Workspace</CardTitle>
            <CardDescription>
              Drill into capacity, conflicts, and forecast signals to decide where work should move next.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="gap-0">
              <div className="px-6 pb-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="capacity">
                    <Icon icon="lucide:users" />
                    Capacity
                  </TabsTrigger>
                  <TabsTrigger value="conflicts">
                    <Icon icon="lucide:alert-triangle" />
                    Conflicts
                  </TabsTrigger>
                  <TabsTrigger value="forecast">
                    <Icon icon="lucide:calendar-range" />
                    Forecast
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="capacity" className="border-t">
                {visitedTabs.has("capacity") && (
                  <DashboardCapacityPanel
                    key={`capacity-${resetKey}`}
                    capacityAnalysis={analysisResult?.capacityAnalysis || []}
                    isLoading={isLoading}
                  />
                )}
              </TabsContent>
              <TabsContent value="conflicts" className="border-t">
                {visitedTabs.has("conflicts") && (
                  <DashboardConflictsPanel
                    key={`conflicts-${resetKey}`}
                    conflicts={analysisResult?.conflicts || []}
                    isLoading={isLoading}
                  />
                )}
              </TabsContent>
              <TabsContent value="forecast" className="border-t">
                {visitedTabs.has("forecast") && (
                  <DashboardForecastPanel
                    key={`forecast-${resetKey}`}
                    forecast={forecast}
                    totalResources={resources.length}
                    isLoading={isLoading}
                  />
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function useIncrementalList<T>(items: readonly T[], pageSize: number) {
  const [pageCount, setPageCount] = useState(1);
  const [isRevealing, setIsRevealing] = useState(false);
  const [sentinelNode, setSentinelNode] = useState<HTMLDivElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const window = useMemo(
    () => getIncrementalWindow(items, pageSize, pageCount),
    [items, pageCount, pageSize]
  );

  const loadMore = useCallback(() => {
    if (!window.hasMore || isRevealing) return;

    setIsRevealing(true);
    timeoutRef.current = setTimeout(() => {
      setPageCount((current) => current + 1);
      setIsRevealing(false);
    }, 120);
  }, [isRevealing, window.hasMore]);

  useEffect(() => {
    if (!sentinelNode || !window.hasMore) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMore();
        }
      },
      { rootMargin: "160px" }
    );

    observer.observe(sentinelNode);

    return () => observer.disconnect();
  }, [loadMore, sentinelNode, window.hasMore]);

  useEffect(
    () => () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    },
    []
  );

  return { ...window, isRevealing, loadMore, setSentinelNode };
}

function DashboardCapacityPanel({
  capacityAnalysis,
  isLoading,
}: {
  capacityAnalysis: ResourceCapacityAnalysis[];
  isLoading: boolean;
}) {
  const sortedCapacity = useMemo(
    () =>
      [...capacityAnalysis].sort((a, b) => {
        const statusOrder = { overallocated: 0, underutilized: 1, optimal: 2 };
        return statusOrder[a.status] - statusOrder[b.status] || b.averageUtilization - a.averageUtilization;
      }),
    [capacityAnalysis]
  );
  const incremental = useIncrementalList(sortedCapacity, 8);

  if (isLoading) {
    return <PanelSkeleton rows={4} />;
  }

  if (capacityAnalysis.length === 0) {
    return <EmptyPanel icon="lucide:users" title="No capacity data available" description="Add assignments to reveal who is overloaded, balanced, or available for more work." />;
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <PanelCountLabel
        label="resources"
        visibleCount={incremental.visibleCount}
        totalCount={incremental.totalCount}
      />
      <div className="grid gap-3 lg:grid-cols-2">
        {incremental.visibleItems.map((resource) => (
          <CapacityInsightRow key={resource.resourceId} resource={resource} />
        ))}
      </div>
      <IncrementalFooter
        label="resources"
        hasMore={incremental.hasMore}
        isRevealing={incremental.isRevealing}
        loadMore={incremental.loadMore}
        setSentinelNode={incremental.setSentinelNode}
      />
    </div>
  );
}

function DashboardConflictsPanel({
  conflicts,
  isLoading,
}: {
  conflicts: Conflict[];
  isLoading: boolean;
}) {
  const sortedConflicts = useMemo(
    () =>
      [...conflicts].sort((a, b) => {
        const severityOrder = { critical: 0, warning: 1, info: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity] || a.resourceName.localeCompare(b.resourceName);
      }),
    [conflicts]
  );
  const incremental = useIncrementalList(sortedConflicts, 6);

  if (isLoading) {
    return <PanelSkeleton rows={4} />;
  }

  if (conflicts.length === 0) {
    return <EmptyPanel icon="lucide:check-circle" title="No conflicts detected" description="Current assignments are clear of overload, time-off, and scheduling conflicts." />;
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <PanelCountLabel
        label="conflicts"
        visibleCount={incremental.visibleCount}
        totalCount={incremental.totalCount}
      />
      <div className="grid gap-3 lg:grid-cols-2">
        {incremental.visibleItems.map((conflict) => (
          <ConflictInsightRow key={conflict.id} conflict={conflict} />
        ))}
      </div>
      <IncrementalFooter
        label="conflicts"
        hasMore={incremental.hasMore}
        isRevealing={incremental.isRevealing}
        loadMore={incremental.loadMore}
        setSentinelNode={incremental.setSentinelNode}
      />
    </div>
  );
}

function DashboardForecastPanel({
  forecast,
  totalResources,
  isLoading,
}: {
  forecast: ForecastResult | null;
  totalResources: number;
  isLoading: boolean;
}) {
  const weeks = forecast?.weeks ?? [];
  const incremental = useIncrementalList(weeks, 4);

  if (isLoading) {
    return <PanelSkeleton rows={4} />;
  }

  if (!forecast) {
    return <EmptyPanel icon="lucide:calendar-range" title="No forecast data available" description="Add assignments to project capacity pressure across the next 4 weeks." />;
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="rounded-xl border bg-muted/40 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <TrendIndicator trend={forecast.overallTrend} />
            <div>
              <p className="text-sm font-medium">4-Week Outlook</p>
              <p className="text-xs text-muted-foreground">{getTrendCopy(forecast.overallTrend)}</p>
            </div>
          </div>
          {forecast.bottleneckDates.length > 0 && (
            <Badge variant="destructive" className="w-fit">
              {forecast.bottleneckDates.length} high-risk week(s)
            </Badge>
          )}
        </div>
        {forecast.recommendations.length > 0 && (
          <div className="mt-4 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
            {forecast.recommendations.slice(0, 4).map((recommendation) => (
              <div key={recommendation} className="rounded-lg border bg-background p-3">
                {recommendation}
              </div>
            ))}
          </div>
        )}
      </div>
      <PanelCountLabel
        label="weeks"
        visibleCount={incremental.visibleCount}
        totalCount={incremental.totalCount}
      />
      <div className="grid gap-3 lg:grid-cols-2">
        {incremental.visibleItems.map((week, index) => (
          <ForecastInsightRow
            key={week.weekStart}
            week={week}
            weekNumber={index + 1}
            totalResources={totalResources}
          />
        ))}
      </div>
      <IncrementalFooter
        label="weeks"
        hasMore={incremental.hasMore}
        isRevealing={incremental.isRevealing}
        loadMore={incremental.loadMore}
        setSentinelNode={incremental.setSentinelNode}
      />
    </div>
  );
}

function MetricTile({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: string;
}) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
          <Icon icon={icon} />
        </div>
      </div>
      <div className="mt-4 text-3xl font-semibold tabular-nums">{value}</div>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function RiskQueueCard({
  title,
  description,
  emptyLabel,
  children,
}: {
  title: string;
  description: string;
  emptyLabel: string;
  children: React.ReactNode[];
}) {
  const hasItems = children.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {hasItems ? (
          children
        ) : (
          <div className="rounded-xl border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
            <Icon icon="lucide:circle-check" className="mx-auto mb-2" />
            {emptyLabel}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CompactCapacityRisk({ resource }: { resource: ResourceCapacityAnalysis }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{resource.resourceName}</p>
          <p className="text-xs text-muted-foreground">
            {resource.department || "Unassigned"} · {resource.role}
          </p>
        </div>
        <Badge variant={resource.status === "overallocated" ? "destructive" : "secondary"}>
          {resource.status}
        </Badge>
      </div>
      <UtilizationBar value={resource.averageUtilization} />
    </div>
  );
}

function CompactConflictRisk({ conflict }: { conflict: Conflict }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{conflict.resourceName}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {conflict.description}
          </p>
        </div>
        <Badge variant={conflict.severity === "critical" ? "destructive" : "secondary"}>
          {conflict.severity}
        </Badge>
      </div>
    </div>
  );
}

function CapacityInsightRow({ resource }: { resource: ResourceCapacityAnalysis }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{resource.resourceName}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {resource.department || "Unassigned"} · {resource.role}
          </p>
        </div>
        <Badge variant={resource.status === "overallocated" ? "destructive" : "secondary"}>
          {resource.status}
        </Badge>
      </div>
      <UtilizationBar value={resource.averageUtilization} />
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <StatCell label="Peak" value={`${Math.round(resource.peakUtilization)}%`} />
        <StatCell label="Over days" value={resource.overallocatedDays} />
        <StatCell label="Billable" value={`${Math.round(resource.billablePercent)}%`} />
      </div>
    </div>
  );
}

function ConflictInsightRow({ conflict }: { conflict: Conflict }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{conflict.resourceName}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDate(conflict.date)} · {formatConflictType(conflict.type)}
          </p>
        </div>
        <Badge variant={conflict.severity === "critical" ? "destructive" : "secondary"}>
          {conflict.severity}
        </Badge>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{conflict.description}</p>
      {conflict.suggestedResolution && (
        <div className="mt-3 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
          {conflict.suggestedResolution}
        </div>
      )}
    </div>
  );
}

function ForecastInsightRow({
  week,
  weekNumber,
  totalResources,
}: {
  week: WeeklyForecast;
  weekNumber: number;
  totalResources: number;
}) {
  const riskVariant = week.riskLevel === "high" ? "destructive" : week.riskLevel === "medium" ? "secondary" : "outline";

  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Week {weekNumber}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDate(week.weekStart)} - {formatDate(week.weekEnd)}
          </p>
        </div>
        <Badge variant={riskVariant}>{week.riskLevel} risk</Badge>
      </div>
      <UtilizationBar value={week.averageUtilization} />
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <StatCell label="Average" value={`${Math.round(week.averageUtilization)}%`} />
        <StatCell label="Peak" value={`${Math.round(week.peakUtilization)}%`} />
        <StatCell label="At risk" value={`${week.resourcesAtRisk.length}/${totalResources}`} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{getTrendCopy(week.trend)}</p>
    </div>
  );
}

function UtilizationBar({ value }: { value: number }) {
  return (
    <div className="mt-3 flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums">{Math.round(value)}%</span>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-2">
      <div className="font-semibold tabular-nums">{value}</div>
      <div className="text-muted-foreground">{label}</div>
    </div>
  );
}

function PanelCountLabel({
  label,
  visibleCount,
  totalCount,
}: {
  label: string;
  visibleCount: number;
  totalCount: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
      <span>
        Loaded {visibleCount} of {totalCount} {label}
      </span>
      <span>Scroll down to load more</span>
    </div>
  );
}

function IncrementalFooter({
  label,
  hasMore,
  isRevealing,
  loadMore,
  setSentinelNode,
}: {
  label: string;
  hasMore: boolean;
  isRevealing: boolean;
  loadMore: () => void;
  setSentinelNode: (node: HTMLDivElement | null) => void;
}) {
  return (
    <div ref={setSentinelNode} className="flex min-h-16 flex-col items-center justify-center gap-3 py-2">
      {isRevealing && (
        <div className="grid w-full gap-3 lg:grid-cols-2" aria-live="polite">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      )}
      {hasMore ? (
        <Button variant="outline" size="sm" onClick={loadMore} disabled={isRevealing}>
          Load more {label}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">All {label} loaded</p>
      )}
    </div>
  );
}

function EmptyPanel({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="p-8 text-center text-muted-foreground">
      <Icon icon={icon} className="mx-auto mb-3 size-12 opacity-50" />
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm">{description}</p>
    </div>
  );
}

function PanelSkeleton({ rows }: { rows: number }) {
  return (
    <div className="grid gap-3 p-4 lg:grid-cols-2">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-32 rounded-xl" />
      ))}
    </div>
  );
}

function TrendIndicator({ trend }: { trend: "improving" | "stable" | "declining" }) {
  const icon = trend === "improving" ? "lucide:trending-down" : trend === "declining" ? "lucide:trending-up" : "lucide:minus";

  return (
    <div className="flex size-10 items-center justify-center rounded-lg bg-background">
      <Icon icon={icon} />
    </div>
  );
}

function getTrendCopy(trend: "improving" | "stable" | "declining") {
  if (trend === "improving") return "Upcoming workload is easing and may create room for new assignments.";
  if (trend === "declining") return "Upcoming workload is tightening and may require staffing changes.";
  return "Upcoming workload is steady with no major capacity shift.";
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatConflictType(type: Conflict["type"]) {
  return type.replaceAll("_", " ");
}

function DashboardSkeleton() {
  return (
    <main className="min-h-dvh bg-muted/30 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-[620px] rounded-xl" />
      </div>
    </main>
  );
}
