import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/projects/route";
import { getSession } from "@/lib/auth/session";
import { getMySqlApiClient } from "@/lib/mysql/api-client";

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/mysql/api-client", () => ({
  getMySqlApiClient: vi.fn(),
}));

function pageResponse({
  data,
  currentPage,
  lastPage,
  total,
}: {
  data: Array<Record<string, unknown>>;
  currentPage: number;
  lastPage: number;
  total: number;
}) {
  return {
    success: true,
    data: {
      data,
      meta: {
        total,
        per_page: 100,
        current_page: currentPage,
        last_page: lastPage,
      },
    },
  };
}

describe("projects route pagination", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns hasMore from the combined campaign and pitch metadata for infinite-scroll consumers", async () => {
    const getCampaigns = vi.fn().mockResolvedValue(pageResponse({
      currentPage: 2,
      lastPage: 5,
      total: 500,
      data: [
        {
          uuid: "campaign-1",
          campaign_name: "Campaign 1",
          brand_id: 206,
          flag: "active",
        },
      ],
    }));
    const getPitches = vi.fn().mockResolvedValue(pageResponse({
      currentPage: 2,
      lastPage: 2,
      total: 200,
      data: [],
    }));

    vi.mocked(getSession).mockResolvedValue({ access_token: "token" } as never);
    vi.mocked(getMySqlApiClient).mockReturnValue({ getCampaigns, getPitches } as never);

    const response = await GET(
      new Request("http://localhost:3000/api/projects?limit=100&offset=100")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getCampaigns).toHaveBeenCalledWith({
      page: 2,
      per_page: 100,
      brand_id: undefined,
      search: undefined,
      include: "channels",
    });
    expect(getPitches).toHaveBeenCalledWith({
      page: 2,
      per_page: 100,
      brand_id: undefined,
      search: undefined,
      include: "channels",
    });
    expect(body.hasMore).toBe(true);
    expect(body.data.map((project: { id: string }) => project.id)).toEqual(["campaign-1"]);
  });

  it("keeps summary-specific behavior out of the full projects route", () => {
    const source = readFileSync("app/api/projects/route.ts", "utf8");

    expect(source).not.toContain('searchParams.get("fields")');
    expect(source).not.toContain("mapCampaignToProjectSummary");
    expect(source).not.toContain("mapPitchToProjectSummary");
    expect(source).toContain("mapCampaignToProject(campaign)");
    expect(source).toContain("mapPitchToProject(pitch)");
  });
});
