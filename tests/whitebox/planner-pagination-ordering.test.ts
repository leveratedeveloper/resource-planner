import { describe, expect, it, vi } from "vitest";
import { createPlannerDirectoryRepository } from "@/lib/planner-directory/repository";

function mockDb() {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const db = {
    query: vi.fn(async (sql: string, params: unknown[]) => {
      calls.push({ sql, params });
      return [[]];
    }),
  };
  return { db, calls };
}

describe("offset-paginated list queries use a unique tiebreaker", () => {
  it("listProjectsForFilterOptions orders by p.name then p.project_key", async () => {
    const { db, calls } = mockDb();
    const repository = createPlannerDirectoryRepository({ db });

    await repository.listProjectsForFilterOptions({ limit: 50, offset: 0 });

    expect(calls[0].sql).toContain("ORDER BY p.name ASC, p.project_key ASC");
  });

  it("listBrandsForFilterOptions orders by name then brand_id", async () => {
    const { db, calls } = mockDb();
    const repository = createPlannerDirectoryRepository({ db });

    await repository.listBrandsForFilterOptions({ limit: 50, offset: 0 });

    expect(calls[0].sql).toContain("ORDER BY name ASC, brand_id ASC");
  });

  it("listEmployeesForBootstrap orders by e.full_name then e.employee_uuid", async () => {
    const { db, calls } = mockDb();
    const repository = createPlannerDirectoryRepository({ db });

    await repository.listEmployeesForBootstrap({ limit: 50, offset: 0 });

    expect(calls[0].sql).toContain("ORDER BY e.full_name ASC, e.employee_uuid ASC");
  });
});
