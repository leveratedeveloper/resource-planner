import { describe, expect, it, vi } from "vitest";
import { createPlannerDirectoryLeaseManager } from "@/lib/planner-directory/sync-lease";

describe("planner directory lease", () => {
  it("prevents a second sync from starting while the first lease is active", async () => {
    const firstConnection = {
      query: vi.fn(async () => [[{ acquired: 1 }]]),
      release: vi.fn(async () => undefined),
    };
    const secondConnection = {
      query: vi.fn(async () => [[{ acquired: 0 }]]),
      release: vi.fn(async () => undefined),
    };
    const db = {
      getConnection: vi
        .fn()
        .mockResolvedValueOnce(firstConnection)
        .mockResolvedValueOnce(secondConnection),
    };

    const leaseManager = createPlannerDirectoryLeaseManager(db as never, "planner-directory-sync");
    const first = await leaseManager.acquire("manual");
    const second = await leaseManager.acquire("login");

    expect(first.acquired).toBe(true);
    expect(second.acquired).toBe(false);
    await first.release();
    expect(firstConnection.query).toHaveBeenCalled();
  });
});
