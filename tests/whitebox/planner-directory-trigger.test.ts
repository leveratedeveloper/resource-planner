import { describe, expect, it, vi } from "vitest";
import { requestPlannerDirectorySyncIfStale } from "@/lib/planner-directory/sync-trigger";

describe("planner directory trigger", () => {
  it("queues a sync request without running the engine inline", async () => {
    const repository = {
      getLatestInFlightSync: vi.fn(async () => null),
      createSyncRun: vi.fn(async () => ({
        syncRunId: "sync-1",
        syncMode: "incremental_refresh",
        status: "queued",
        startedAt: "2026-06-05T00:00:00.000Z",
        finishedAt: null,
        triggeredBy: "emp-1",
        triggerSource: "login",
        employeesSeen: 0,
        employeesUpserted: 0,
        departmentsSeen: 0,
        departmentsUpserted: 0,
        brandsSeen: 0,
        brandsUpserted: 0,
        projectsSeen: 0,
        projectsUpserted: 0,
        recordsArchived: 0,
        issueCount: 0,
        errorMessage: null,
        metadata: null,
      })),
    };
    const leaseManager = {
      acquire: vi.fn(async () => ({
        acquired: true,
        owner: "planner-sync:login",
        leaseKey: "planner-directory-sync",
        release: vi.fn(async () => undefined),
      })),
    };

    const result = await requestPlannerDirectorySyncIfStale({
      session: {
        access_token: "token",
        user: { id: 1, email: "a@example.com" },
        employee: {
          id: 1,
          uuid: "emp-1",
          nik: "1001",
          full_name: "Ada Lovelace",
          nickname: "Ada",
          position: "Planner",
          dept_id: 1,
          department_name: "Creative",
          photo: "",
        },
        access: {
          level: "full",
          can_view_all: true,
          can_view_own_only: false,
        },
      },
      freshnessState: "stale",
      triggerSource: "login",
    }, {
      repository: repository as never,
      leaseManager: leaseManager as never,
    });

    expect(result.action).toBe("queued");
    expect(result.waitedForSync).toBe(false);
  });
});
