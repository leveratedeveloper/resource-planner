"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import dynamic from "next/dynamic";
import { useAuth } from "@/context/AuthContext";
import type { Brand } from "@/lib/query/hooks/useBrands";
import type { ProjectOption } from "@/lib/query/hooks/useProjects";
import { getResourceRowLoadingState } from "@/lib/timeline-v2/resource-row-loading";
import { getTimelineRowStateResetKey } from "@/lib/timeline-v2/row-state";
import { shouldEnableTimelineAssignments, type TimelineAssignmentDateRange } from "@/lib/planner/initial-load";
import { getTimelineColumns, getTimelineResolution } from "@/lib/timeline-v2/date-range";
import { buildEmployeeRowModels } from "@/lib/timeline-v2/row-model";
import { getVisibleEmployeeIds } from "@/lib/timeline-v2/visible-rows";
import { useTimelineEmployees } from "@/lib/timeline-v2/use-timeline-employees";
import { useTimelineExpansionStore } from "@/lib/timeline-v2/expansion-store";
import { useTimelineViewStore } from "@/lib/timeline-v2/view-store";
import {
  TIMELINE_DIMENSIONS,
  getTimelineEstimatedRowHeight,
  getTimelineVisibleWidth,
} from "@/lib/timeline-v2/layout";
import { useAssignmentEditorStore } from "@/lib/timeline-v2/editor-store";
import { TimelineToolbar } from "@/components/timeline-v2/TimelineToolbar";
import { DataStatus } from "@/components/timeline-v2/DataStatus";
import { TimelineHeader } from "@/components/timeline-v2/TimelineHeader";
import { TimelineBody } from "@/components/timeline-v2/TimelineBody";
import { TimelineInitialSkeleton, TimelineEmptyState } from "@/components/timeline-v2/LoadingStates";
import type { PlannerHomeBootstrapResponse } from "@/lib/query/server/planner-home-bootstrap";

// The single editing surface is never needed for first paint — load it on
// demand so it stays out of the initial bundle.
const AssignmentEditor = dynamic(
  () => import("@/components/timeline-v2/editor/AssignmentEditor").then((mod) => mod.AssignmentEditor),
  { ssr: false }
);

type TimelineProps = {
  initialTimelineAnchor: string;
  initialBootstrap?: PlannerHomeBootstrapResponse | null;
  brandId: string | null;
  department: string | null;
  searchQuery?: string;
  projectId: string | null;
};

function getInitialDate(anchor: string) {
  return new Date(`${anchor}T00:00:00`);
}

function toBrandOption(brand: PlannerHomeBootstrapResponse["brandsById"][string]): Brand {
  return {
    id: brand.brandId,
    businessUnitId: null,
    name: brand.name,
    companyName: brand.companyName,
    brandAddress: null,
    clientCode: null,
    color: brand.color ?? "#64748b",
    logo: null,
    website: null,
    contactName: null,
    contactTitle: null,
    contactEmail: null,
    contactPhone: null,
    picFinanceName: null,
    picFinancePhone: null,
    industryCategory: null,
    description: null,
    status:
      brand.status === "active"
        ? "active"
        : brand.status === "inactive"
          ? "inactive"
          : "prospect",
    createdAt: brand.sourceUpdatedAt ?? brand.syncedAt,
    updatedAt: brand.sourceUpdatedAt ?? brand.syncedAt,
  };
}

function toProjectOption(project: PlannerHomeBootstrapResponse["projectsById"][string]): ProjectOption {
  return {
    id: project.sourceProjectId,
    name: project.name,
    color: project.color ?? "#64748b",
    status:
      project.status === "completed" ||
      project.status === "cancelled" ||
      project.status === "active" ||
      project.status === "planning" ||
      project.status === "on_hold"
        ? project.status
        : "planning",
    projectType: project.sourceType,
    brandId: project.brandId,
    startDate: project.startDate,
    endDate: project.endDate,
  };
}

export function Timeline({
  initialTimelineAnchor,
  initialBootstrap,
  brandId,
  department,
  searchQuery,
  projectId,
}: TimelineProps) {
  const { session } = useAuth();
  const timelineRootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const hasLoggedTimelineFirstVisibleRef = useRef(false);

  // View state (mode, anchor, weekends, column width) lives in the view store;
  // toggling any of it never rebuilds the row models below.
  const viewMode = useTimelineViewStore((state) => state.viewMode);
  const anchorDate = useTimelineViewStore((state) => state.anchorDate);
  const showWeekends = useTimelineViewStore((state) => state.showWeekends);
  const hasHydratedWeekendPreference = useTimelineViewStore((state) => state.hasHydratedWeekendPreference);
  const resourceColumnWidth = useTimelineViewStore((state) => state.resourceColumnWidth);
  const hydrateWeekendPreference = useTimelineViewStore((state) => state.hydrateWeekendPreference);

  const currentDate = anchorDate ?? getInitialDate(initialTimelineAnchor);

  useEffect(() => {
    hydrateWeekendPreference();
  }, [hydrateWeekendPreference]);

  // Preload the lazy editor chunk once the browser is idle. Keeps it out of
  // the initial bundle but ensures the first click opens the editor instantly.
  useEffect(() => {
    const preloadEditors = () => {
      void import("@/components/timeline-v2/editor/AssignmentEditor");
    };

    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(preloadEditors);
      return () => window.cancelIdleCallback(idleId);
    }

    preloadEditors();
  }, []);

  useEffect(() => {
    const rootContainer = timelineRootRef.current;
    if (!rootContainer) return;

    let frame = 0;
    const updateWidth = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!rootContainer) return;
        const rootWidth = rootContainer.clientWidth;
        setContainerWidth(getTimelineVisibleWidth(rootWidth, resourceColumnWidth));
      });
    };

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(rootContainer);
    updateWidth();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [resourceColumnWidth]);

  const columns = useMemo(
    () => getTimelineColumns({
      anchorDate: currentDate,
      viewMode,
      showWeekends,
    }),
    [currentDate, showWeekends, viewMode]
  );

  const isLayoutReady = hasHydratedWeekendPreference && containerWidth !== null;
  const assignmentDateRange = useMemo<TimelineAssignmentDateRange | undefined>(() => {
    if (!columns.startDate || !columns.endDate) return undefined;
    return {
      startDate: columns.startDate,
      endDate: columns.endDate,
    };
  }, [columns.endDate, columns.startDate]);

  const bootstrapRequest = useMemo(() => {
    if (!assignmentDateRange || !shouldEnableTimelineAssignments(assignmentDateRange)) {
      return undefined;
    }

    return {
      viewMode,
      resolution: getTimelineResolution(viewMode),
      startDate: assignmentDateRange.startDate,
      endDate: assignmentDateRange.endDate,
      filters: {
        category: null,
        status: null,
      },
      // One bootstrap page fills the viewport with headroom; the route clamps
      // to 100. Small pages made first load crawl the directory request by
      // request, rebuilding row models on every arrival. The offset is the
      // infinite-query page param, not part of the request.
      employeeLimit: 60,
      brandId,
      department,
      projectId,
      search: searchQuery?.trim() || null,
    };
  }, [assignmentDateRange, brandId, department, projectId, searchQuery, viewMode]);

  const timelineFilters = useMemo(
    () => ({ brandId, department, projectId, searchQuery }),
    [brandId, department, projectId, searchQuery]
  );
  // ONE data source: infinite bootstrap pages. Each page carries an employee
  // slice with its own assignments; the hook returns the merged unions.
  const {
    employees,
    assignments: dateFilteredAssignments,
    actualAssignments: visibleActualAssignments,
    brandsById,
    projectsById,
    metadataFreshness,
    hasBootstrapData,
    isLoadingBootstrap,
    isFetchingBootstrap,
    isShowingPreviousBootstrap,
    isBootstrapRefetchError,
    hasNextEmployeePage,
    isFetchingNextEmployeePage,
    fetchNextEmployeePage,
  } = useTimelineEmployees({
    request: bootstrapRequest,
    initialBootstrap,
  });
  const timelineBrands = useMemo(() => Object.values(brandsById).map(toBrandOption), [brandsById]);
  const timelineProjects = useMemo(() => Object.values(projectsById).map(toProjectOption), [projectsById]);
  const selectedBrandProjectIds = useMemo(
    () =>
      new Set(
        timelineProjects
          .filter((project) => !brandId || project.brandId === brandId)
          .map((project) => project.id)
      ),
    [brandId, timelineProjects]
  );
  const projectById = useMemo(() => new Map(timelineProjects.map((project) => [project.id, project])), [timelineProjects]);
  const brandById = useMemo(() => new Map(timelineBrands.map((brand) => [brand.id, brand])), [timelineBrands]);

  const days = useMemo(() => columns.columns.map((column) => column.date), [columns.columns]);

  // Row models depend on data + days + viewMode ONLY. Expanding rows, typing in
  // search, or switching filters never rebuilds them.
  const rowModels = useMemo(
    () =>
      buildEmployeeRowModels({
        employees,
        assignments: dateFilteredAssignments,
        actualAssignments: visibleActualAssignments,
        projects: timelineProjects,
        brandById,
        days,
        viewMode,
      }),
    [brandById, dateFilteredAssignments, days, employees, timelineProjects, viewMode, visibleActualAssignments]
  );

  // Filters only decide WHICH rows are visible — an ordered id list, not a rebuild.
  const visibleIds = useMemo(
    () =>
      getVisibleEmployeeIds({
        employees,
        assignments: dateFilteredAssignments,
        actualAssignments: visibleActualAssignments,
        projectById,
        selectedBrandProjectIds,
        filters: timelineFilters,
      }),
    [dateFilteredAssignments, employees, projectById, selectedBrandProjectIds, timelineFilters, visibleActualAssignments]
  );

  const rowStateResetKey = useMemo(
    () =>
      getTimelineRowStateResetKey({
        brandId,
        department,
        projectId,
        searchQuery,
      }),
    [brandId, department, projectId, searchQuery]
  );
  const previousRowStateResetKeyRef = useRef(rowStateResetKey);

  const rowVirtualizer = useVirtualizer({
    count: visibleIds.length,
    getScrollElement: () => scrollRef.current,
    // Measurements follow the employee, not the list slot, across filter changes.
    getItemKey: (index) => visibleIds[index] ?? index,
    // The sticky header occupies the top of the scroll container.
    scrollMargin: TIMELINE_DIMENSIONS.header,
    estimateSize: (index) => {
      const id = visibleIds[index];
      const model = id ? rowModels.get(id) : undefined;
      // Expansion is read non-reactively; measureElement corrects real heights
      // and the expansion subscription below re-measures on toggle.
      const isExpanded = !!id && useTimelineExpansionStore.getState().expandedIds.has(id);
      return getTimelineEstimatedRowHeight({
        isExpanded,
        laneCount: model?.projectLanes.length ?? 0,
      });
    },
    overscan: 10,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

  // Safety valve for virtualizer height estimates when a row expands/collapses.
  useEffect(
    () =>
      useTimelineExpansionStore.subscribe(() => {
        rowVirtualizer.measure();
      }),
    [rowVirtualizer]
  );

  useEffect(() => {
    if (previousRowStateResetKeyRef.current === rowStateResetKey) return;
    previousRowStateResetKeyRef.current = rowStateResetKey;
    useTimelineExpansionStore.getState().collapseAll();
    rowVirtualizer.scrollToOffset(0);
  }, [rowStateResetKey, rowVirtualizer]);

  // Skeletons (and the edit lock) engage only while OLD-request data is shown
  // for a NEW request (filter/date change). Same-key background refetches —
  // e.g. the invalidation after every save/drag — keep rendering current data.
  const isApplyingNewRequest = isShowingPreviousBootstrap && isFetchingBootstrap;

  useEffect(() => {
    // While a new request is applying, placeholder rows are the OLD key's —
    // fetching "next" here cancels and restarts the new key's page-0 fetch.
    if (isApplyingNewRequest || !hasNextEmployeePage || isFetchingNextEmployeePage) return;
    const lastVirtualRow = virtualRows[virtualRows.length - 1];
    const shouldPrefetchInitialRows = !isLoadingBootstrap && visibleIds.length < 20;
    const shouldPrefetchNearEnd = !!lastVirtualRow && lastVirtualRow.index >= visibleIds.length - 10;

    if (shouldPrefetchInitialRows || shouldPrefetchNearEnd) {
      // Dedupe onto any in-flight fetch instead of cancel-restarting it.
      fetchNextEmployeePage({ cancelRefetch: false });
    }
  }, [
    fetchNextEmployeePage,
    hasNextEmployeePage,
    isApplyingNewRequest,
    isFetchingNextEmployeePage,
    isLoadingBootstrap,
    virtualRows,
    visibleIds.length,
  ]);

  const rowLoadingState = getResourceRowLoadingState({
    hasPlannerData: hasBootstrapData,
    isPlannerApplyingFilters: isApplyingNewRequest,
    isPlannerRefreshing: hasBootstrapData && isApplyingNewRequest,
    hasPlannerRefreshError: hasBootstrapData && isBootstrapRefetchError,
  });
  const isInitialTimelineLoading =
    !isLayoutReady ||
    isLoadingBootstrap ||
    (!hasBootstrapData && rowLoadingState.showInitialSkeleton);

  useEffect(() => {
    if (isInitialTimelineLoading || hasLoggedTimelineFirstVisibleRef.current) return;

    hasLoggedTimelineFirstVisibleRef.current = true;
    console.info("[Timing]", {
      flow: "planner_startup",
      phase: "timeline_first_visible",
      durationMs: Math.round(performance.now()),
      rowCount: visibleIds.length,
      columnCount: columns.columns.length,
    });
  }, [columns.columns.length, isInitialTimelineLoading, visibleIds.length]);

  const plannerFreshnessState = useMemo(() => {
    if (metadataFreshness) {
      if (metadataFreshness.state === "syncing") {
        return { tone: "syncing" as const, message: "Refreshing planner directory..." };
      }
      if (metadataFreshness.state === "stale") {
        return { tone: "warning" as const, message: "Showing saved planner data. Directory sync is stale." };
      }
      if (metadataFreshness.state === "unavailable") {
        return { tone: "warning" as const, message: "Showing saved planner data. Directory sync is unavailable." };
      }
    }

    if (isBootstrapRefetchError) {
      return { tone: "warning" as const, message: "Showing saved planner data. Refresh failed." };
    }

    if (hasBootstrapData && isFetchingBootstrap) {
      return { tone: "syncing" as const, message: "Updating planner..." };
    }

    return null;
  }, [hasBootstrapData, isBootstrapRefetchError, isFetchingBootstrap, metadataFreshness]);

  const canEditAssignments = rowLoadingState.canEditAssignments && !!session?.access?.can_view_all;
  const hasEditorTarget = useAssignmentEditorStore((state) => state.target !== null);

  return (
    <div
      ref={timelineRootRef}
      className="flex h-full flex-col"
      style={{
        "--timeline-cols": columns.columns.length,
        "--timeline-resource-col": `${resourceColumnWidth}px`,
      } as React.CSSProperties}
      data-testid="timeline-v2-root"
    >
      <TimelineToolbar currentDate={currentDate} />
      {plannerFreshnessState ? (
        <DataStatus tone={plannerFreshnessState.tone} message={plannerFreshnessState.message} />
      ) : null}

      {isInitialTimelineLoading ? (
        <div className="flex-1 overflow-auto">
          {isLayoutReady ? <TimelineHeader columns={columns.columns} /> : null}
          <TimelineInitialSkeleton />
        </div>
      ) : visibleIds.length === 0 ? (
        <div className="flex-1 overflow-auto">
          <TimelineHeader columns={columns.columns} />
          <TimelineEmptyState />
        </div>
      ) : (
        // Single scroll container: sticky header + virtualized rows. No manual
        // header/body scroll sync.
        <div ref={scrollRef} className="flex-1 overflow-auto">
          <TimelineHeader columns={columns.columns} />
          <TimelineBody
            rowVirtualizer={rowVirtualizer}
            virtualRows={virtualRows}
            visibleIds={visibleIds}
            rowModels={rowModels}
            columns={columns.columns}
            viewMode={viewMode}
            showTimelineLoading={rowLoadingState.showTimelineLoading}
            showExpandedLoading={rowLoadingState.showExpandedLoading}
            canEditAssignments={canEditAssignments}
            brandId={brandId}
            projectId={projectId}
            isFetchingNextEmployeePage={isFetchingNextEmployeePage}
          />
        </div>
      )}

      {hasEditorTarget ? (
        <AssignmentEditor
          canEditAssignments={canEditAssignments}
          createdByUuid={session?.employee?.uuid ?? null}
          isFullAccess={!!session?.access?.can_view_all}
        />
      ) : null}
    </div>
  );
}
