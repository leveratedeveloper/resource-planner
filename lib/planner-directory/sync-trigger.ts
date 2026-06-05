import type { SessionData } from "@/lib/auth/session";
import { createPlannerDirectoryLeaseManager } from "@/lib/planner-directory/sync-lease";
import { plannerDirectoryRepository } from "@/lib/planner-directory/repository";
import type { PlannerFreshnessState, PlannerSyncMode } from "@/lib/planner-directory/types";

type TriggerInput = {
  session: SessionData;
  freshnessState: PlannerFreshnessState;
  syncMode?: PlannerSyncMode;
  triggerSource?: string;
  triggeredBy?: string | null;
};

type TriggerResult = {
  action: "queued" | "skipped" | "already_running";
  waitedForSync: false;
  syncRunId: string | null;
  freshnessState: PlannerFreshnessState;
};

type TriggerDependencies = {
  repository?: typeof plannerDirectoryRepository;
  leaseManager?: ReturnType<typeof createPlannerDirectoryLeaseManager>;
};

export async function requestPlannerDirectorySyncIfStale(
  input: TriggerInput,
  dependencies: TriggerDependencies = {}
): Promise<TriggerResult> {
  const repository = dependencies.repository ?? plannerDirectoryRepository;
  const leaseManager = dependencies.leaseManager ?? createPlannerDirectoryLeaseManager();

  if (input.freshnessState === "healthy") {
    return {
      action: "skipped",
      waitedForSync: false,
      syncRunId: null,
      freshnessState: input.freshnessState,
    };
  }

  const lease = await leaseManager.acquire(`planner-sync:${input.triggerSource ?? "login"}`);
  if (!lease.acquired) {
    return {
      action: "already_running",
      waitedForSync: false,
      syncRunId: null,
      freshnessState: input.freshnessState,
    };
  }

  try {
    const inFlight = await repository.getLatestInFlightSync();
    if (inFlight) {
      return {
        action: "already_running",
        waitedForSync: false,
        syncRunId: inFlight.syncRunId,
        freshnessState: input.freshnessState,
      };
    }

    const run = await repository.createSyncRun({
      syncMode: input.syncMode ?? "incremental_refresh",
      triggerSource: input.triggerSource ?? "login",
      triggeredBy: input.triggeredBy ?? input.session.employee.uuid ?? null,
      metadata: {
        freshnessState: input.freshnessState,
      },
    });

    return {
      action: "queued",
      waitedForSync: false,
      syncRunId: run.syncRunId,
      freshnessState: input.freshnessState,
    };
  } finally {
    await lease.release();
  }
}
