import { describe, expect, it, vi } from "vitest";
import { createPlannerDirectoryRepository } from "@/lib/planner-directory/repository";

function createMockDb() {
  const query = vi.fn(async (sql: string) => {
    if (sql.startsWith("SELECT * FROM planner_directory_sync_runs WHERE status")) {
      return [
        [
          {
            sync_run_id: "run-2",
            sync_mode: "incremental_refresh",
            status: "succeeded",
            started_at: "2026-06-05T00:00:00.000Z",
            finished_at: "2026-06-05T00:01:00.000Z",
            employees_seen: 2,
            employees_upserted: 2,
            departments_seen: 1,
            departments_upserted: 1,
            brands_seen: 3,
            brands_upserted: 3,
            projects_seen: 4,
            projects_upserted: 4,
            records_archived: 0,
            issue_count: 0,
            error_message: null,
            metadata: JSON.stringify({ source: "schedule" }),
          },
        ],
      ];
    }

    if (sql.startsWith("SELECT * FROM planner_directory_sync_runs WHERE sync_run_id")) {
      return [
        [
          {
            sync_run_id: "run-1",
            sync_mode: "full_backfill",
            status: "queued",
            started_at: "2026-06-05T00:00:00.000Z",
            finished_at: null,
            employees_seen: 0,
            employees_upserted: 0,
            departments_seen: 0,
            departments_upserted: 0,
            brands_seen: 0,
            brands_upserted: 0,
            projects_seen: 0,
            projects_upserted: 0,
            records_archived: 0,
            issue_count: 0,
            error_message: null,
            metadata: null,
          },
        ],
      ];
    }

    return [[]];
  });

  return { query };
}

describe("planner directory repository", () => {
  it("creates queued sync runs and reads the latest success record", async () => {
    const db = createMockDb();
    const repository = createPlannerDirectoryRepository({
      db,
      now: () => "2026-06-05T00:00:00.000Z",
      syncRunIdFactory: () => "run-1",
      issueIdFactory: () => "issue-1",
    });

    const created = await repository.createSyncRun({
      syncMode: "full_backfill",
      triggerSource: "manual",
      triggeredBy: "employee-1",
      metadata: { source: "manual" },
    });

    expect(created.syncRunId).toBe("run-1");
    expect(created.status).toBe("queued");
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO planner_directory_sync_runs"),
      expect.arrayContaining(["run-1", "full_backfill", "queued"])
    );

    const latest = await repository.getLatestSuccessfulSync();
    expect(latest?.syncRunId).toBe("run-2");
    expect(latest?.status).toBe("succeeded");
  });

  it("upserts directory rows instead of duplicating them", async () => {
    const db = createMockDb();
    const repository = createPlannerDirectoryRepository({
      db,
      now: () => "2026-06-05T00:00:00.000Z",
      syncRunIdFactory: () => "run-1",
      issueIdFactory: () => "issue-1",
    });

    await repository.upsertEmployees([
      {
        employeeUuid: "emp-1",
        sourceEmployeeId: "1001",
        employeeNumber: "1001",
        nik: "1001",
        fullName: "Ada Lovelace",
        nickname: "Ada",
        email: null,
        photo: null,
        position: "Planner",
        departmentId: "7",
        weeklyCapacity: 40,
        employmentStatus: "active",
        visibility: "active",
        workStartDate: "2026-01-01",
        sourceUpdatedAt: "2026-01-02T00:00:00Z",
        sourceHash: "hash-1",
        syncedAt: "2026-06-05T00:00:00.000Z",
        lastSeenAt: "2026-06-05T00:00:00.000Z",
        archivedAt: null,
      },
    ]);

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO planner_employees"),
      expect.arrayContaining(["emp-1", "Ada Lovelace"])
    );
    expect(String(db.query.mock.calls[0]?.[0])).toMatch(/ON (CONFLICT|DUPLICATE KEY UPDATE)/);
  });

  it("builds archive and issue queries without deleting missing rows", async () => {
    const db = createMockDb();
    const repository = createPlannerDirectoryRepository({
      db,
      now: () => "2026-06-05T00:00:00.000Z",
      syncRunIdFactory: () => "run-1",
      issueIdFactory: () => "issue-1",
    });

    await repository.markMissingAsArchived({
      entity: "employee",
      seenIds: ["emp-1", "emp-2"],
      archivedAt: "2026-06-05T00:00:00.000Z",
    });

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE planner_employees SET archived_at"),
      expect.arrayContaining(["2026-06-05T00:00:00.000Z", "emp-1", "emp-2"])
    );

    await repository.addSyncIssue({
      syncRunId: "run-1",
      entityType: "employee",
      sourceId: "emp-1",
      severity: "warning",
      message: "Missing source row",
      payload: { source: "repair" },
    });

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO planner_directory_sync_issues"),
      expect.arrayContaining(["issue-1", "run-1", "employee", "emp-1", "warning", "Missing source row"])
    );
  });

  it("splits large project upserts into multiple queries", async () => {
    const db = createMockDb();
    const repository = createPlannerDirectoryRepository({
      db,
      now: () => "2026-06-05T00:00:00.000Z",
      syncRunIdFactory: () => "run-1",
      issueIdFactory: () => "issue-1",
    });

    const rows = Array.from({ length: 600 }, (_, index) => ({
      projectKey: `campaign:${index + 1}`,
      sourceProjectId: String(index + 1),
      sourceType: "campaign" as const,
      name: `Campaign ${index + 1}`,
      brandId: "9",
      color: null,
      status: "active",
      startDate: null,
      endDate: null,
      sourceUpdatedAt: "2026-06-05T00:00:00Z",
      sourceHash: `hash-${index + 1}`,
      syncedAt: "2026-06-05T00:00:00Z",
      lastSeenAt: "2026-06-05T00:00:00Z",
      archivedAt: null,
    }));

    await repository.upsertProjects(rows);

    const insertCalls = db.query.mock.calls.filter(([sql]) =>
      String(sql).includes("INSERT INTO planner_projects")
    );

    expect(insertCalls.length).toBeGreaterThan(1);
    expect(insertCalls[0]?.[1]).toBeInstanceOf(Array);
    expect((insertCalls[0]?.[1] as unknown[]).length).toBeGreaterThan(0);
  });

  it("queries a paginated employee bootstrap slice from the local directory", async () => {
    const db = createMockDb();
    const repository = createPlannerDirectoryRepository({ db });

    await repository.listEmployeesForBootstrap({
      offset: 0,
      limit: 24,
      search: "ada",
    });

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("FROM planner_employees"),
      expect.arrayContaining(["%ada%", 24, 0])
    );
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("LEFT JOIN planner_departments"),
      expect.any(Array)
    );
  });

  it("queries local projects and brands for bootstrap without touching Timetrack", async () => {
    const db = createMockDb();
    const repository = createPlannerDirectoryRepository({ db });

    await repository.listProjectsForBootstrap({
      brandId: "brand-9",
      search: "launch",
      referencedProjectIds: ["campaign-1", "pitch-2"],
    });

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("FROM planner_projects"),
      expect.arrayContaining(["brand-9", "%launch%", "campaign-1", "pitch-2"])
    );

    await repository.listBrandsByIds(["brand-9", "brand-10"]);

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("FROM planner_brands"),
      expect.arrayContaining(["brand-9", "brand-10"])
    );
  });
});
