import { useMemo } from "react";
import type { Employee } from "@/lib/query/hooks/useEmployees";
import { useEmployees, useInfiniteEmployees } from "@/lib/query/hooks";
import type { PlannerHomeBootstrapResponse } from "@/lib/query/server/planner-home-bootstrap";
import { getLoadedTimelineEmployees, shouldUseCompleteEmployeeList } from "@/lib/timeline/employees";
import type { TimelineV2Filters } from "@/lib/timeline-v2/types";

type UseTimelineEmployeesInput = {
  filters: TimelineV2Filters;
  bootstrap: PlannerHomeBootstrapResponse | undefined;
};

type UseTimelineEmployeesResult = {
  employees: Employee[];
  isLoadingEmployees: boolean;
  useCompleteEmployeeList: boolean;
  hasNextEmployeePage: boolean;
  isFetchingNextEmployeePage: boolean;
  fetchNextEmployeePage: () => void;
};

export function useTimelineEmployees({
  filters,
  bootstrap,
}: UseTimelineEmployeesInput): UseTimelineEmployeesResult {
  const useCompleteEmployeeList = shouldUseCompleteEmployeeList({
    brandId: filters.brandId,
    department: filters.department,
    projectId: filters.projectId,
    searchQuery: filters.searchQuery,
  });

  const bootstrapEmployeePage = useMemo(
    () =>
      bootstrap
        ? {
            // Bootstrap rows are MinimalTimelineEmployee; the timeline only reads the
            // shared subset, so the cast mirrors TimelineV2's existing looseness.
            data: bootstrap.employees as Employee[],
            total: bootstrap.employeeTotal,
            hasMore: bootstrap.employeeHasMore,
          }
        : null,
    [bootstrap]
  );

  const { data: completeEmployees = [], isLoading: isLoadingCompleteEmployees } = useEmployees({
    enabled: useCompleteEmployeeList,
  });
  const {
    data: incrementalEmployeePages,
    isLoading: isLoadingIncrementalEmployees,
    hasNextPage: hasNextEmployeePage,
    isFetchingNextPage: isFetchingNextEmployeePage,
    fetchNextPage: fetchNextEmployeePage,
  } = useInfiniteEmployees(filters.searchQuery, {
    enabled: !useCompleteEmployeeList,
    initialPage: bootstrapEmployeePage,
    initialPageUpdatedAt: bootstrap
      ? Date.parse(bootstrap.freshness.directoryFetchedAt)
      : undefined,
  });

  const employees = useMemo(
    () =>
      useCompleteEmployeeList
        ? completeEmployees.length > 0
          ? completeEmployees
          : (bootstrap?.employees as Employee[] | undefined) ?? []
        : getLoadedTimelineEmployees(incrementalEmployeePages?.pages),
    [
      bootstrap?.employees,
      completeEmployees,
      incrementalEmployeePages?.pages,
      useCompleteEmployeeList,
    ]
  );

  const isLoadingEmployees = useCompleteEmployeeList
    ? isLoadingCompleteEmployees
    : isLoadingIncrementalEmployees;

  return {
    employees,
    isLoadingEmployees,
    useCompleteEmployeeList,
    hasNextEmployeePage,
    isFetchingNextEmployeePage,
    fetchNextEmployeePage,
  };
}
