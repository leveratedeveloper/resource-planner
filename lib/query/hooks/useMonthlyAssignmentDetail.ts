import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { Assignment } from "@/lib/query/hooks/useAssignments";
import { fetchMonthlyAssignmentDetail } from "@/lib/timeline-v2/assignment-write-service";
import { queryKeys } from "@/lib/query/queryKeys";
import { toLocalDateString } from "@/lib/utils";

export type MonthlyAssignmentDetailRequest = {
  resourceId: string;
  projectId: string;
  monthStart: Date;
  monthEnd: Date;
} | null;

function getMonthlyAssignmentDetailQueryKey(request: NonNullable<MonthlyAssignmentDetailRequest>) {
  return [
    ...queryKeys.plannerTimeline,
    "monthly-assignment-detail",
    request.resourceId,
    request.projectId,
    toLocalDateString(request.monthStart),
    toLocalDateString(request.monthEnd),
  ] as const;
}

export function useMonthlyAssignmentDetail(
  request: MonthlyAssignmentDetailRequest
): UseQueryResult<Assignment[]> {
  return useQuery({
    queryKey: request
      ? getMonthlyAssignmentDetailQueryKey(request)
      : [...queryKeys.plannerTimeline, "monthly-assignment-detail", "disabled"],
    queryFn: ({ signal }) => fetchMonthlyAssignmentDetail({ ...request!, signal }),
    enabled: request != null,
    staleTime: 30_000,
  });
}
