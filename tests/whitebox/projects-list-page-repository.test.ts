import { describe, expect, it, vi } from "vitest";
import { createPlannerDirectoryRepository } from "@/lib/planner-directory/repository";

function makeRow() {
  return {
    project_key: "campaign:c-1",
    source_project_id: "c-1",
    source_type: "campaign",
    name: "ALO",
    brand_id: "9",
    brand_name: "ALO Indonesia",
    brand_company_name: "PT ALO",
    color: "#111111",
    status: "active",
    start_date: "2026-04-01",
    end_date: "2026-04-30",
    submit_date: null,
    source_updated_at: "2026-03-15T00:00:00Z",
    source_hash: "h",
    synced_at: "2026-03-15T00:00:00Z",
    last_seen_at: "2026-03-15T00:00:00Z",
    archived_at: null,
    total_count: 1,
  };
}

describe("listProjectsPage", () => {
  it("paginates in SQL, does NOT filter archived, and threads brandId/search/limit/offset", async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const db = {
      query: vi.fn(async (sql: string, params: unknown[]) => {
        calls.push({ sql, params });
        return [[makeRow()]];
      }),
    };
    const repository = createPlannerDirectoryRepository({ db });

    const result = await repository.listProjectsPage({
      brandId: "9",
      search: "alo",
      limit: 100,
      offset: 0,
    });

    const { sql, params } = calls[0];
    expect(sql).not.toContain("archived_at");
    expect(sql).toContain("LIMIT");
    expect(sql).toContain("OFFSET");
    expect(sql).toContain("COUNT(*) OVER()");
    expect(params).toContain("9");
    expect(params).toContain(100);
    expect(params).toContain(0);

    expect(result.data).toHaveLength(1);
    expect(result.data[0].sourceProjectId).toBe("c-1");
    expect(result.total).toBe(1);
    expect(result.hasMore).toBe(false);
  });

  it("orders by a unique tiebreaker so offset pages cannot duplicate or skip name-tied rows", async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const db = {
      query: vi.fn(async (sql: string, params: unknown[]) => {
        calls.push({ sql, params });
        return [[makeRow()]];
      }),
    };
    const repository = createPlannerDirectoryRepository({ db });

    await repository.listProjectsPage({ limit: 100, offset: 0 });

    const { sql } = calls[0];
    expect(sql).toContain("ORDER BY p.name ASC, p.project_key ASC");
  });
});
