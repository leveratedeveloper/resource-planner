import { useEffect, useMemo, useRef } from "react";
import type { Employee } from "@/lib/query/hooks/useEmployees";
import { usePlannerHomeBootstrapPages } from "@/lib/query/hooks";
import type { PlannerHomeBootstrapPageRequest } from "@/lib/query/hooks/usePlannerHomeBootstrap";
import type { PlannerHomeBootstrapResponse } from "@/lib/query/server/planner-home-bootstrap";
import {
  getBootstrapFilterIdentity,
  mergeBootstrapPages,
  resolveDepthRefill,
} from "@/lib/timeline-v2/bootstrap-pages";

type UseTimelineEmployeesInput = {
  request: PlannerHomeBootstrapPageRequest | undefined;
  initialBootstrap?: PlannerHomeBootstrapResponse | null;
};

// ONE data source for the timeline: infinite bootstrap pages, each carrying an
// employee slice with its own assignments and reference maps (payload-diet
// spec 2026-06-12). Scrolling past the loaded rows fetches the next page; the
// old /api/employees crawl and complete-list mode are gone from the timeline.
export function useTimelineEmployees({ request, initialBootstrap }: UseTimelineEmployeesInput) {
  const query = usePlannerHomeBootstrapPages(request, {
    enabled: !!request,
    initialData: initialBootstrap ?? undefined,
    initialDataUpdatedAt: initialBootstrap
      ? Date.parse(initialBootstrap.freshness.directoryFetchedAt)
      : undefined,
  });

  const pages = query.data?.pages;
  const merged = useMemo(() => mergeBootstrapPages(pages ?? []), [pages]);

  // Date/view navigation changes the query key but not the filter identity.
  // Remember how deep each identity was loaded and refill the new key to that
  // depth — otherwise panning a quarter collapses the list to one page and
  // clamps the user's scroll position.
  const loadedDepthRef = useRef(new Map<string, number>());
  const { isPlaceholderData, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = query;
  useEffect(() => {
    if (!request) return;
    const identity = getBootstrapFilterIdentity(request);
    const decision = resolveDepthRefill({
      pageCount: pages?.length ?? 0,
      rememberedDepth: loadedDepthRef.current.get(identity) ?? 0,
      isPlaceholderData,
      hasNextPage,
      isFetchingNextPage,
      hasFetchFailure: isFetchNextPageError,
    });

    if (decision === "remember") {
      loadedDepthRef.current.set(identity, pages?.length ?? 0);
    } else if (decision === "fetch-next") {
      // cancelRefetch: false — if a fetch is already in flight (the viewport
      // effect, an invalidation refetch), dedupe onto it instead of cancelling
      // and restarting. The fetcher has no abort-free cancellation: a restart
      // would cost the server a full extra query.
      void fetchNextPage({ cancelRefetch: false });
    }
  }, [fetchNextPage, hasNextPage, isFetchNextPageError, isFetchingNextPage, isPlaceholderData, pages, request]);

  return {
    // Bootstrap rows are MinimalTimelineEmployee; the timeline only reads the
    // shared subset, so the cast mirrors the previous looseness.
    employees: merged.employees as Employee[],
    assignments: merged.assignments,
    actualAssignments: merged.actualAssignments,
    brandsById: merged.brandsById,
    projectsById: merged.projectsById,
    metadataFreshness: merged.metadataFreshness,
    hasBootstrapData: !!pages && pages.length > 0,
    isLoadingBootstrap: query.isLoading,
    isFetchingBootstrap: query.isFetching,
    isShowingPreviousBootstrap: query.isPlaceholderData,
    isBootstrapRefetchError: query.isRefetchError,
    hasNextEmployeePage: query.hasNextPage,
    isFetchingNextEmployeePage: query.isFetchingNextPage,
    fetchNextEmployeePage: query.fetchNextPage,
  };
}
