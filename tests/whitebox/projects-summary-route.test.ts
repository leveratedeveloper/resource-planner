import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/projects/summary/route";
import { getSession } from "@/lib/auth/session";
import { getMySqlApiClient } from "@/lib/mysql/api-client";
import { fetchProjectSummaries } from "@/lib/projects/project-summary-fetcher";

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/mysql/api-client", () => ({
  getMySqlApiClient: vi.fn(),
}));

vi.mock("@/lib/projects/project-summary-fetcher", () => ({
  fetchProjectSummaries: vi.fn(),
}));

describe("projects summary route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when no session exists", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const response = await GET(new Request("http://localhost:3000/api/projects/summary"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Not authenticated" });
  });

  it("returns complete compact project summaries for filters", async () => {
    const client = {
      getCampaigns: vi.fn(),
      getPitches: vi.fn(),
    };

    vi.mocked(getSession).mockResolvedValue({ access_token: "token" } as never);
    vi.mocked(getMySqlApiClient).mockReturnValue(client as never);
    vi.mocked(fetchProjectSummaries).mockResolvedValue({
      data: [
        {
          id: "campaign-1",
          name: "Campaign 1",
          color: "#2563eb",
          status: "active",
          projectType: "campaign",
          brandId: "206",
        },
      ],
      hasMore: false,
      truncated: false,
    });

    const response = await GET(
      new Request("http://localhost:3000/api/projects/summary?brandId=206&search=Campaign")
    );

    expect(response.status).toBe(200);
    expect(fetchProjectSummaries).toHaveBeenCalledWith({
      client,
      brandId: "206",
      search: "Campaign",
    });
    expect(await response.json()).toEqual({
      success: true,
      data: [
        {
          id: "campaign-1",
          name: "Campaign 1",
          color: "#2563eb",
          status: "active",
          projectType: "campaign",
          brandId: "206",
        },
      ],
      total: 1,
      hasMore: false,
      truncated: false,
    });
  });
});
