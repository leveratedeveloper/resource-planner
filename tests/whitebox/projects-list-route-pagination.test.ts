import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(async () => ({ access_token: "tok" })),
}));

const listProjectsPage = vi.fn();
const listProjects = vi.fn();
vi.mock("@/lib/planner-directory/repository", () => ({
  plannerDirectoryRepository: {
    listProjectsPage: (...a: unknown[]) => listProjectsPage(...a),
    listProjects: (...a: unknown[]) => listProjects(...a),
  },
}));

import { GET } from "@/app/api/projects/route";

describe("GET /api/projects pagination", () => {
  beforeEach(() => {
    listProjectsPage.mockReset();
    listProjects.mockReset();
  });

  it("delegates pagination to SQL (limit/offset) and never loads all rows", async () => {
    listProjectsPage.mockResolvedValue({
      data: [
        {
          projectKey: "campaign:c-1",
          sourceProjectId: "c-1",
          sourceType: "campaign",
          name: "ALO",
          brandId: "9",
          color: "#111111",
          status: "active",
          startDate: "2026-04-01",
          endDate: "2026-04-30",
          submitDate: null,
          sourceUpdatedAt: "2026-03-15T00:00:00Z",
          sourceHash: "h",
          syncedAt: "2026-03-15T00:00:00Z",
          lastSeenAt: "2026-03-15T00:00:00Z",
          archivedAt: null,
        },
      ],
      total: 1,
      hasMore: false,
    });

    const req = new Request("http://localhost/api/projects?limit=100&offset=0&search=alo");
    const res = await GET(req);
    const body = await res.json();

    expect(listProjects).not.toHaveBeenCalled();
    expect(listProjectsPage).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100, offset: 0, search: "alo" })
    );
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("c-1");
    expect(body.total).toBe(1);
    expect(body.hasMore).toBe(false);
  });
});
