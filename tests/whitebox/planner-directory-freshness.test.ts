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
        latestSyncAt: "2026-06-05T00:00:00.000Z",
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
});
