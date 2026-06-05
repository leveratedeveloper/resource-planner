import type {
  PlannerDirectoryFreshness,
  PlannerFreshnessState,
} from "@/lib/planner-directory/types";

const DEFAULT_STALE_AFTER_MS = 15 * 60 * 1000;

type FreshnessInput = {
  lastSuccessfulSyncAt?: string | null;
  latestSyncAt?: string | null;
  isSyncing?: boolean;
  issueCount?: number;
  now?: string | Date;
  staleAfterMs?: number;
};

function toTime(value: string | Date | undefined): number {
  if (!value) return Number.NaN;
  const date = typeof value === "string" ? new Date(value) : value;
  return date.getTime();
}

export function classifyPlannerDirectoryFreshness(input: FreshnessInput): PlannerDirectoryFreshness {
  const nowTime = toTime(input.now ?? new Date());
  const staleAfterMs = input.staleAfterMs ?? DEFAULT_STALE_AFTER_MS;
  const latestSyncAt = input.latestSyncAt ?? null;
  const lastSuccessfulSyncAt = input.lastSuccessfulSyncAt ?? null;

  let state: PlannerFreshnessState = "unavailable";
  let stale = false;

  if (input.isSyncing) {
    state = "syncing";
  } else if (lastSuccessfulSyncAt) {
    const lastSuccessTime = toTime(lastSuccessfulSyncAt);
    stale = Number.isFinite(nowTime) && Number.isFinite(lastSuccessTime)
      ? nowTime - lastSuccessTime > staleAfterMs
      : true;
    state = stale ? "stale" : "healthy";
  } else if (latestSyncAt) {
    state = "stale";
    stale = true;
  }

  return {
    state,
    lastSuccessfulSyncAt,
    latestSyncAt,
    stale,
    issueCount: input.issueCount ?? 0,
  };
}
