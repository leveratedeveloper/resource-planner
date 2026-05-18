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
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAuth } from "@/context/AuthContext";
import { useCapacityAnalysis } from "@/hooks/useCapacityAnalysis";
import { canAccessDashboard } from "@/lib/auth/client-access";
import { parseLocalDateKey, toLocalDateKey } from "@/lib/analysis/date-utils";
import {
  type DashboardDateRange,
  type DashboardTimePreset,
  getDashboardDateRange,
  getDashboardScopeLabel,
  isValidCustomDateRange,
} from "@/lib/dashboard/filter-ranges";
import {
  filterAssignmentsByResourceIds,
  filterEmployeesByDepartment,
} from "@/lib/dashboard/dashboard-scope";
import { getIncrementalWindow } from "@/lib/dashboard/incremental-list";
import { useAssignments } from "@/lib/query/hooks/useAssignments";
import { useBrands } from "@/lib/query/hooks/useBrands";
import { useDepartments } from "@/lib/query/hooks/useDepartments";
import { type Employee, useEmployees } from "@/lib/query/hooks/useEmployees";
import { useProjects } from "@/lib/query/hooks/useProjects";
import { generateForecast } from "@/lib/analysis/forecasting-engine";
import {
  type DashboardComparisonMode,
  getPreviousPeriodRange,
} from "@/lib/dashboard/comparison";
import { getForecastDateRange } from "@/lib/dashboard/forecast-range";
import {
  buildUtilizationSignals,
  getUtilizationComparisonDisplay,
  type UtilizationComparisonDisplay,
  type UtilizationSignal,
} from "@/lib/dashboard/utilization-signals";
import { cn } from "@/lib/utils";
import type {
  AnalysisAssignment,
  Conflict,
  ForecastResult,
  ResourceCapacityAnalysis,
  WeeklyForecast,
} from "@/lib/analysis/types";

type DashboardTab = "capacity" | "conflicts" | "forecast";
const DEFAULT_TIME_PRESET: DashboardTimePreset = "monthly";
const DEFAULT_COMPARISON_MODE: DashboardComparisonMode = "none";

function mapEmployeeToResource(employee: Employee) {
  return {
    id: employee.id,
    name: employee.fullName,
    role: employee.position,
    department: employee.department?.name || "Unassigned",
    capacity: employee.weeklyCapacity,
  };
}

export function InsightsDashboard() {
  const router = useRouter();
  const { session, isLoading: isSessionLoading } = useAuth();
  const initialRange = useMemo(
    () => getDashboardDateRange(DEFAULT_TIME_PRESET),
    []
  );
  const [timePreset, setTimePreset] = useState<DashboardTimePreset>(DEFAULT_TIME_PRESET);
  const [customStartDate, setCustomStartDate] = useState<Date>(() =>
    parseLocalDateKey(initialRange.startDate)
  );
  const [customEndDate, setCustomEndDate] = useState<Date>(() =>
    parseLocalDateKey(initialRange.endDate)
  );
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [comparisonMode, setComparisonMode] =
    useState<DashboardComparisonMode>(DEFAULT_COMPARISON_MODE);
  const [appliedRange, setAppliedRange] = useState<DashboardDateRange>(initialRange);
  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);
  const customRangeValid = isValidCustomDateRange({
    startDate: customStartDate,
    endDate: customEndDate,
    today,
  });
  const { data: departments = [] } = useDepartments();
  const { data: employees = [], isLoading: employeesLoading } = useEmployees();
  const { data: projects = [] } = useProjects();
  const { data: brands = [] } = useBrands();
  const { data: assignments = [], isLoading: assignmentsLoading } = useAssignments(appliedRange);
  const comparisonRange = useMemo(() => getPreviousPeriodRange(appliedRange), [appliedRange]);
  const comparisonEnabled = comparisonMode === "previous-period";
  const {
    data: comparisonAssignments,
    isError: comparisonAssignmentsError,
    isLoading: comparisonAssignmentsLoading,
    isSuccess: comparisonAssignmentsSuccess,
  } =
    useAssignments(comparisonRange, { enabled: comparisonEnabled });
  const [activeTab, setActiveTab] = useState<DashboardTab>("capacity");
  const [visitedTabs, setVisitedTabs] = useState<Set<DashboardTab>>(() => new Set(["capacity"]));
  const forecastRange = useMemo(() => getForecastDateRange(), []);
  const { data: forecastAssignments = [], isLoading: forecastAssignmentsLoading } =
    useAssignments(forecastRange);

  const handleTimePresetChange = useCallback(
    (preset: DashboardTimePreset) => {
      setTimePreset(preset);

      const nextRange = getDashboardDateRange(preset, {
        customStartDate,
        customEndDate,
      });

      if (
        preset !== "custom" ||
        isValidCustomDateRange({
          startDate: customStartDate,
          endDate: customEndDate,
          today,
        })
      ) {
        setAppliedRange(nextRange);
      }
    },
    [customEndDate, customStartDate, today]
  );

  const handleCustomStartDateChange = useCallback(
    (date: Date) => {
      setCustomStartDate(date);
      if (isValidCustomDateRange({ startDate: date, endDate: customEndDate, today })) {
        setAppliedRange(
          getDashboardDateRange("custom", {
            customStartDate: date,
            customEndDate,
            today,
          })
        );
      }
    },
    [customEndDate, today]
  );

  const handleCustomEndDateChange = useCallback(
    (date: Date) => {
      setCustomEndDate(date);
      if (isValidCustomDateRange({ startDate: customStartDate, endDate: date, today })) {
        setAppliedRange(
          getDashboardDateRange("custom", {
            customStartDate,
            customEndDate: date,
            today,
          })
        );
      }
    },
    [customStartDate, today]
  );

  const scopedEmployees = useMemo(
    () => filterEmployeesByDepartment(employees, selectedDepartmentId),
    [employees, selectedDepartmentId]
  );

  const scopedEmployeeIds = useMemo(
    () => new Set(scopedEmployees.map((employee) => employee.id)),
    [scopedEmployees]
  );

  const scopedAssignments = useMemo(
    () => filterAssignmentsByResourceIds(assignments, scopedEmployeeIds),
    [assignments, scopedEmployeeIds]
  );

  const scopedComparisonAssignments = useMemo(
    () => filterAssignmentsByResourceIds(comparisonAssignments ?? [], scopedEmployeeIds),
    [comparisonAssignments, scopedEmployeeIds]
  );

  const scopedForecastAssignments = useMemo(
    () => filterAssignmentsByResourceIds(forecastAssignments, scopedEmployeeIds),
    [forecastAssignments, scopedEmployeeIds]
  );

  const resources = useMemo(
    () => scopedEmployees.map(mapEmployeeToResource),
    [scopedEmployees]
  );

  const mappedAssignments = useMemo<AnalysisAssignment[]>(
    () => mapAssignmentsForAnalysis(scopedAssignments),
    [scopedAssignments]
  );

  const mappedComparisonAssignments = useMemo<AnalysisAssignment[]>(
    () => mapAssignmentsForAnalysis(scopedComparisonAssignments),
    [scopedComparisonAssignments]
  );

  const mappedForecastAssignments = useMemo<AnalysisAssignment[]>(
    () => mapAssignmentsForAnalysis(scopedForecastAssignments),
    [scopedForecastAssignments]
  );

  const assignmentsByProject = useMemo(
    () => indexResourceIdsByProject(scopedAssignments),
    [scopedAssignments]
  );

  const comparisonAssignmentsByProject = useMemo(
    () => indexResourceIdsByProject(scopedComparisonAssignments),
    [scopedComparisonAssignments]
  );

  const analysisProjects = useMemo(
    () =>
      projects.map((project) => ({
        id: project.id,
        name: project.name,
        brandId: project.brandId,
        color: project.color || "#6366f1",
        resourceIds: [...(assignmentsByProject.get(project.id) ?? [])],
      })),
    [projects, assignmentsByProject]
  );

  const comparisonAnalysisProjects = useMemo(
    () =>
      projects.map((project) => ({
        id: project.id,
        name: project.name,
        brandId: project.brandId,
        color: project.color || "#6366f1",
        resourceIds: [...(comparisonAssignmentsByProject.get(project.id) ?? [])],
      })),
    [projects, comparisonAssignmentsByProject]
  );

  const analysisBrands = useMemo(
    () =>
      brands.map((brand) => {
        const resourceSet = new Set<string>();
        for (const project of projects) {
          if (project.brandId === brand.id) {
            for (const id of assignmentsByProject.get(project.id) ?? []) {
              resourceSet.add(id);
            }
          }
        }

        return {
          id: brand.id,
          name: brand.name,
          color: brand.color || "#6366f1",
          resourceIds: [...resourceSet],
        };
      }),
    [brands, projects, assignmentsByProject]
  );

  const comparisonAnalysisBrands = useMemo(
    () =>
      brands.map((brand) => {
        const resourceSet = new Set<string>();
        for (const project of projects) {
          if (project.brandId === brand.id) {
            for (const id of comparisonAssignmentsByProject.get(project.id) ?? []) {
              resourceSet.add(id);
            }
          }
        }

        return {
          id: brand.id,
          name: brand.name,
          color: brand.color || "#6366f1",
          resourceIds: [...resourceSet],
        };
      }),
    [brands, projects, comparisonAssignmentsByProject]
  );

  const {
    result: analysisResult,
    isAnalyzing,
    refresh: refreshAnalysis,
  } = useCapacityAnalysis(
    resources,
    mappedAssignments,
    analysisProjects,
    analysisBrands,
    {
      start: parseLocalDateKey(appliedRange.startDate),
      end: parseLocalDateKey(appliedRange.endDate),
    },
    { enabled: resources.length > 0, debounceMs: 500, cacheKey: "dashboard-current" }
  );

  const {
    result: comparisonAnalysisResult,
    isResultFresh: isComparisonAnalysisFresh,
    isAnalyzing: isComparisonAnalyzing,
    refresh: refreshComparisonAnalysis,
  } = useCapacityAnalysis(
    resources,
    mappedComparisonAssignments,
    comparisonAnalysisProjects,
    comparisonAnalysisBrands,
    {
      start: parseLocalDateKey(comparisonRange.startDate),
      end: parseLocalDateKey(comparisonRange.endDate),
    },
    {
      enabled: comparisonEnabled && comparisonAssignmentsSuccess && resources.length > 0,
      debounceMs: 500,
      cacheKey: "dashboard-comparison",
    }
  );

  const forecast = useMemo(() => {
    if (resources.length === 0 || mappedForecastAssignments.length === 0) return null;
    return generateForecast(
      resources,
      mappedForecastAssignments,
      4,
      parseLocalDateKey(forecastRange.startDate)
    );
  }, [forecastRange.startDate, resources, mappedForecastAssignments]);

  const isLoading = isSessionLoading || employeesLoading || assignmentsLoading || (isAnalyzing && !analysisResult);
  const hasDashboardAccess = canAccessDashboard(session);
  const resetKey = String(analysisResult?.timestamp ?? "pending");
  const lastUpdated = analysisResult?.timestamp
    ? new Date(analysisResult.timestamp).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : "Pending analysis";

  const utilizationSignals = useMemo(
    () =>
      buildUtilizationSignals({
        current: analysisResult?.capacityAnalysis ?? [],
        previous:
          comparisonEnabled && comparisonAssignmentsSuccess && isComparisonAnalysisFresh
            ? comparisonAnalysisResult?.capacityAnalysis ?? []
            : null,
      }),
    [
      analysisResult?.capacityAnalysis,
      comparisonAnalysisResult,
      comparisonAssignmentsSuccess,
      comparisonEnabled,
      isComparisonAnalysisFresh,
    ]
  );
  const utilizationComparisonUnavailable = comparisonEnabled && comparisonAssignmentsError;
  const utilizationComparisonLoading =
    comparisonEnabled &&
    resources.length > 0 &&
    !utilizationComparisonUnavailable &&
    (!comparisonAssignmentsSuccess || comparisonAssignmentsLoading || isComparisonAnalyzing || !isComparisonAnalysisFresh);
  const topConflicts = analysisResult?.conflicts.slice(0, 3) ?? [];
  const topCapacityRisks =
    analysisResult?.capacityAnalysis
      .filter((resource) => resource.status !== "optimal")
      .sort((a, b) => b.peakUtilization - a.peakUtilization)
      .slice(0, 4) ?? [];
  const selectedDepartmentName =
    departments.find((department) => department.id === selectedDepartmentId)?.name ?? null;
  const scopeLabel = getDashboardScopeLabel({
    preset: timePreset,
    range: appliedRange,
    departmentName: selectedDepartmentName,
  });

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
            <Button
              onClick={() => {
                refreshAnalysis();
                if (comparisonEnabled) refreshComparisonAnalysis();
              }}
              disabled={isAnalyzing || (comparisonEnabled && isComparisonAnalyzing)}
            >
              <Icon
                icon="lucide:refresh-cw"
                data-icon="inline-start"
                className={
                  isAnalyzing || (comparisonEnabled && isComparisonAnalyzing)
                    ? "animate-spin"
                    : undefined
                }
              />
              Refresh insights
            </Button>
          </div>
        </header>

        <InsightsDashboardFilters
          timePreset={timePreset}
          onTimePresetChange={handleTimePresetChange}
          customStartDate={customStartDate}
          customEndDate={customEndDate}
          onCustomStartDateChange={handleCustomStartDateChange}
          onCustomEndDateChange={handleCustomEndDateChange}
          isCustomRangeValid={customRangeValid}
          selectedDepartmentId={selectedDepartmentId}
          onDepartmentChange={setSelectedDepartmentId}
          comparisonMode={comparisonMode}
          onComparisonModeChange={setComparisonMode}
          departments={departments}
          scopeLabel={scopeLabel}
          today={today}
        />

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Executive Signal</CardTitle>
            <CardDescription>
              Employee utilization mix for {scopeLabel}.
              {comparisonEnabled && (
                <span className="mt-1 block">
                  Previous-period metrics use historical assignments from {comparisonRange.startDate} to{" "}
                  {comparisonRange.endDate} mapped onto the current scoped roster, current capacity,
                  and current department structure.
                </span>
              )}
            </CardDescription>
            <CardAction>
              <div className="flex flex-col items-end gap-1.5">
                <Badge variant="secondary">
                  {resources.length} {resources.length === 1 ? "person" : "people"}
                </Badge>
              </div>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {utilizationSignals.map((signal) => (
                <UtilizationSignalTile
                  key={signal.id}
                  signal={signal}
                  isLoading={isLoading}
                  comparisonEnabled={comparisonEnabled}
                  comparisonLoading={utilizationComparisonLoading}
                  comparisonUnavailable={utilizationComparisonUnavailable}
                />
              ))}
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
                    isLoading={isLoading || forecastAssignmentsLoading}
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

function InsightsDashboardFilters({
  timePreset,
  onTimePresetChange,
  customStartDate,
  customEndDate,
  onCustomStartDateChange,
  onCustomEndDateChange,
  isCustomRangeValid,
  selectedDepartmentId,
  onDepartmentChange,
  comparisonMode,
  onComparisonModeChange,
  departments,
  scopeLabel,
  today,
}: {
  timePreset: DashboardTimePreset;
  onTimePresetChange: (preset: DashboardTimePreset) => void;
  customStartDate: Date;
  customEndDate: Date;
  onCustomStartDateChange: (date: Date) => void;
  onCustomEndDateChange: (date: Date) => void;
  isCustomRangeValid: boolean;
  selectedDepartmentId: string | null;
  onDepartmentChange: (departmentId: string | null) => void;
  comparisonMode: DashboardComparisonMode;
  onComparisonModeChange: (mode: DashboardComparisonMode) => void;
  departments: Array<{ id: string; name: string; color?: string }>;
  scopeLabel: string;
  today: Date;
}) {
  return (
    <section className="rounded-xl border bg-card p-3 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex items-center gap-2">
            <Icon icon="lucide:filter" className="text-muted-foreground" />
            <span className="text-sm font-medium">Filters</span>
          </div>
          <ToggleGroup
            type="single"
            value={timePreset}
            onValueChange={(value) => {
              if (value) onTimePresetChange(value as DashboardTimePreset);
            }}
            variant="outline"
            size="sm"
            className="w-full sm:w-fit"
            aria-label="Filter insights by time range"
          >
            <ToggleGroupItem value="weekly" aria-label="Show last 7 days">
              Weekly
            </ToggleGroupItem>
            <ToggleGroupItem value="monthly" aria-label="Show last 1 month">
              Monthly
            </ToggleGroupItem>
            <ToggleGroupItem value="annual" aria-label="Show last 1 year">
              Annual
            </ToggleGroupItem>
            <ToggleGroupItem value="custom" aria-label="Show custom date range">
              Custom
            </ToggleGroupItem>
          </ToggleGroup>
          <Select
            value={selectedDepartmentId || "all"}
            onValueChange={(value) => onDepartmentChange(value === "all" ? null : value)}
          >
            <SelectTrigger
              size="sm"
              className="w-full sm:w-[220px]"
              aria-label="Filter insights by department"
            >
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((department) => (
                  <SelectItem key={department.id} value={department.id}>
                    {department.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select
            value={comparisonMode}
            onValueChange={(value) => onComparisonModeChange(value as DashboardComparisonMode)}
          >
            <SelectTrigger
              size="sm"
              className="w-full sm:w-[240px]"
              aria-label="Compare dashboard metrics"
            >
              <SelectValue placeholder="No comparison" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="none">No comparison</SelectItem>
                <SelectItem value="previous-period">Compare with previous period</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <Badge variant="secondary" className="w-fit">
          {scopeLabel}
        </Badge>
      </div>
      {timePreset === "custom" && (
        <div className="mt-3 flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-start">
          <DashboardDatePicker
            id="dashboard-start-date"
            label="Start date"
            date={customStartDate}
            onDateChange={onCustomStartDateChange}
            invalid={!isCustomRangeValid}
          />
          <DashboardDatePicker
            id="dashboard-end-date"
            label="End date"
            date={customEndDate}
            onDateChange={onCustomEndDateChange}
            invalid={!isCustomRangeValid}
            maxDate={today}
          />
          {!isCustomRangeValid && (
            <p className="text-xs text-destructive sm:pt-7" role="alert">
              End date must be on or after the start date and cannot be after today.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function DashboardDatePicker({
  id,
  label,
  date,
  onDateChange,
  invalid,
  maxDate,
}: {
  id: string;
  label: string;
  date: Date;
  onDateChange: (date: Date) => void;
  invalid: boolean;
  maxDate?: Date;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            size="sm"
            aria-invalid={invalid}
            className="w-full justify-start font-normal sm:w-[160px]"
          >
            <Icon icon="lucide:calendar" data-icon="inline-start" />
            {toLocalDateKey(date)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            disabled={maxDate ? { after: maxDate } : undefined}
            onSelect={(selected) => {
              if (selected) onDateChange(selected);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function mapAssignmentsForAnalysis(
  assignments: Array<{
    id: string;
    employeeId: string;
    projectId: string | null;
    startDate: string;
    endDate: string;
    hoursPerDay: string;
    isTimeOff: boolean;
    category: string | null;
    isBillable: boolean;
    note: string | null;
  }>
): AnalysisAssignment[] {
  return assignments.map((assignment) => ({
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
  }));
}

function indexResourceIdsByProject(
  assignments: Array<{ employeeId: string; projectId: string | null }>
) {
  const index = new Map<string, Set<string>>();

  for (const assignment of assignments) {
    if (!assignment.projectId) continue;
    const resourceIds = index.get(assignment.projectId) ?? new Set<string>();
    resourceIds.add(assignment.employeeId);
    index.set(assignment.projectId, resourceIds);
  }

  return index;
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

function UtilizationSignalTile({
  signal,
  isLoading,
  comparisonEnabled,
  comparisonLoading,
  comparisonUnavailable,
}: {
  signal: UtilizationSignal;
  isLoading: boolean;
  comparisonEnabled: boolean;
  comparisonLoading: boolean;
  comparisonUnavailable: boolean;
}) {
  const comparison = getUtilizationComparisonDisplay(signal, {
    comparisonEnabled,
    comparisonLoading,
    comparisonUnavailable,
  });

  return (
    <div
      className={cn(
        "rounded-xl border border-l-4 p-4 shadow-sm",
        signal.surfaceClassName,
        signal.accentClassName
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{signal.label}</p>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg border border-border/60 outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  signal.iconSurfaceClassName
                )}
                aria-label={`${signal.label}: ${signal.description}`}
              >
                <Icon icon={signal.icon} className={signal.colorClassName} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-56 text-xs leading-5">
              <div className="font-medium text-foreground">{signal.label}</div>
              <div className="text-muted-foreground">{signal.description}</div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      {isLoading ? (
        <Skeleton className="mt-4 h-9 w-20" />
      ) : (
        <div className={cn("mt-4 text-3xl font-semibold tabular-nums", signal.colorClassName)}>
          {signal.percentage}%
        </div>
      )}
      <p className="mt-1 text-xs text-muted-foreground">
        {signal.count} of {signal.totalCount} {signal.totalCount === 1 ? "person" : "people"}
      </p>
      <ComparisonIndicator comparison={comparison} className="mt-3" />
    </div>
  );
}

function ComparisonIndicator({
  comparison,
  className,
}: {
  comparison?: UtilizationComparisonDisplay | null;
  className?: string;
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
        "inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium tabular-nums",
        toneClassName,
        className
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
