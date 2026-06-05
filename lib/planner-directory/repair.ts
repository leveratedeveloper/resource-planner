import type { SessionData } from "@/lib/auth/session";
import type { PlannerDirectorySyncRun } from "@/lib/planner-directory/types";
import { runPlannerDirectorySync } from "@/lib/planner-directory/sync-engine";

type RepairInput = {
  session: SessionData;
  entityType: "department" | "brand" | "project" | "employee";
  sourceId: string;
  projectKey?: string;
  triggerSource?: string;
  triggeredBy?: string | null;
};

export async function requestPlannerDirectoryRepair(
  input: RepairInput,
  dependencies?: Parameters<typeof runPlannerDirectorySync>[1]
): Promise<PlannerDirectorySyncRun & { issues: number }> {
  return runPlannerDirectorySync(
    {
      session: input.session,
      syncMode: "targeted_repair",
      triggerSource: input.triggerSource ?? "repair",
      triggeredBy: input.triggeredBy ?? null,
      scope: {
        entityType: input.entityType,
        sourceId: input.sourceId,
        projectKey: input.projectKey,
      },
    },
    dependencies
  );
}
