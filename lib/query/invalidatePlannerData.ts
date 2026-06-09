import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/queryKeys";

type PlannerDataInvalidationOptions = {
  refetchType?: "active" | "inactive" | "all" | "none";
};

export async function invalidatePlannerData(
  queryClient: QueryClient,
  options: PlannerDataInvalidationOptions = {}
) {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: queryKeys.plannerHomeBootstrap,
      refetchType: options.refetchType,
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.plannerTimeline,
      refetchType: options.refetchType,
    }),
  ]);
}
