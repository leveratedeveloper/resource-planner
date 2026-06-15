import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/projects/route";
import { getSession } from "@/lib/auth/session";
import { plannerDirectoryRepository } from "@/lib/planner-directory/repository";

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/planner-directory/repository", () => ({
  plannerDirectoryRepository: {
    listProjectsPage: vi.fn(),
  },
}));

describe("projects route submit dates", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns pitch submitDate from the planner directory row", async () => {
    vi.mocked(getSession).mockResolvedValue({ access_token: "token" } as never);
    vi.mocked(plannerDirectoryRepository.listProjectsPage).mockResolvedValue({
      data: [
        {
          projectKey: "pitch:pitch-1",
          sourceProjectId: "pitch-1",
          sourceType: "pitch",
          name: "Pitch Work",
          brandId: "brand-1",
          color: "#64748b",
          status: "planning",
          startDate: null,
          endDate: null,
          submitDate: "2026-06-12",
          sourceUpdatedAt: "2026-06-05T00:00:00Z",
          sourceHash: "hash-1",
          syncedAt: "2026-06-05T00:00:00Z",
          lastSeenAt: "2026-06-05T00:00:00Z",
          archivedAt: null,
        },
      ],
      total: 1,
      hasMore: false,
    });

    const response = await GET(new Request("http://localhost:3000/api/projects"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data[0]).toMatchObject({
      id: "pitch-1",
      projectType: "pitch",
      submitDate: "2026-06-12",
      startDate: null,
      endDate: null,
    });
  });
});
