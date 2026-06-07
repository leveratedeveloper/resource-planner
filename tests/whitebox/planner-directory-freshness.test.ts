import { describe, expect, it } from "vitest";
import { classifyPlannerDirectoryFreshness } from "@/lib/planner-directory/freshness";

describe("planner directory freshness", () => {
  it("marks a recent successful sync as healthy", () => {
    const freshness = classifyPlannerDirectoryFreshness({
      lastSuccessfulSyncAt: "2026-06-05T00:00:00.000Z",
      latestSyncAt: "2026-06-05T00:00:00.000Z",
      now: "2026-06-05T00:10:00.000Z",
    });

    expect(freshness.state).toBe("healthy");
    expect(freshness.stale).toBe(false);
  });

  it("marks a running sync as syncing and a missing sync as unavailable", () => {
    expect(
      classifyPlannerDirectoryFreshness({
        isSyncing: true,
        syncMode: "incremental_refresh",
        latestSyncAt: "2026-06-05T00:19:00.000Z",
        now: "2026-06-05T00:20:00.000Z",
      }).state
    ).toBe("syncing");

    expect(
      classifyPlannerDirectoryFreshness({
        now: "2026-06-05T00:20:00.000Z",
      }).state
    ).toBe("unavailable");
  });

  it("marks an old successful sync as stale", () => {
    const freshness = classifyPlannerDirectoryFreshness({
      lastSuccessfulSyncAt: "2026-06-05T00:00:00.000Z",
      latestSyncAt: "2026-06-05T00:00:00.000Z",
      now: "2026-06-05T00:30:00.000Z",
    });

    expect(freshness.state).toBe("stale");
    expect(freshness.stale).toBe(true);
  });

  it("does not show targeted repair as active directory syncing", () => {
    const freshness = classifyPlannerDirectoryFreshness({
      isSyncing: true,
      syncMode: "targeted_repair",
      latestSyncAt: "2026-06-05T00:15:00.000Z",
      lastSuccessfulSyncAt: "2026-06-05T00:10:00.000Z",
      now: "2026-06-05T00:20:00.000Z",
    });

    expect(freshness.state).toBe("healthy");
    expect(freshness.stale).toBe(false);
  });

  it("does not keep stale in-flight sync rows in syncing state forever", () => {
    const freshness = classifyPlannerDirectoryFreshness({
      isSyncing: true,
      syncMode: "full_backfill",
      latestSyncAt: "2026-06-05T00:00:00.000Z",
      lastSuccessfulSyncAt: "2026-06-05T00:10:00.000Z",
      now: "2026-06-05T00:45:00.000Z",
      syncingStaleAfterMs: 30 * 60 * 1000,
    });

    expect(freshness.state).toBe("stale");
    expect(freshness.stale).toBe(true);
  });
});
