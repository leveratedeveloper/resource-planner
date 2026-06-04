import { describe, expect, it, vi } from "vitest";
import { fetchProjectSummaries } from "@/lib/projects/project-summary-fetcher";

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

describe("project summary fetcher", () => {
  it("paginates campaigns and pitches independently for brand summaries", async () => {
    const getCampaigns = vi
      .fn()
      .mockResolvedValueOnce(pageResponse({
        currentPage: 1,
        lastPage: 3,
        total: 3,
        data: [
          {
            uuid: "campaign-1",
            campaign_name: "Campaign 1",
            brand_id: 206,
            flag: "active",
          },
        ],
      }))
      .mockResolvedValueOnce(pageResponse({
        currentPage: 2,
        lastPage: 3,
        total: 3,
        data: [
          {
            uuid: "campaign-2",
            campaign_name: "Campaign 2",
            brand_id: 206,
            flag: "active",
          },
        ],
      }))
      .mockResolvedValueOnce(pageResponse({
        currentPage: 3,
        lastPage: 3,
        total: 3,
        data: [
          {
            uuid: "campaign-3",
            campaign_name: "Campaign 3",
            brand_id: 206,
            flag: "active",
          },
        ],
      }));

    const getPitches = vi
      .fn()
      .mockResolvedValueOnce(pageResponse({
        currentPage: 1,
        lastPage: 1,
        total: 1,
        data: [
          {
            uuid: "pitch-1",
            pitch_name: "Pitch 1",
            brand_id: 206,
            status: "win",
          },
        ],
      }));

    const result = await fetchProjectSummaries({
      client: { getCampaigns, getPitches },
      brandId: "206",
    });

    expect(getCampaigns).toHaveBeenCalledTimes(3);
    expect(getPitches).toHaveBeenCalledTimes(1);
    expect(getCampaigns).toHaveBeenNthCalledWith(1, {
      page: 1,
      per_page: 100,
      brand_id: "206",
      search: undefined,
    });
    expect(getPitches).toHaveBeenNthCalledWith(1, {
      page: 1,
      per_page: 100,
      brand_id: "206",
      search: undefined,
    });
    expect(result.data.map((project) => project.id)).toEqual([
      "campaign-1",
      "campaign-2",
      "campaign-3",
      "pitch-1",
    ]);
    expect(result.hasMore).toBe(false);
    expect(result.truncated).toBe(false);
  });

  it("stops a source when the API returns an empty page even if metadata claims more pages", async () => {
    const getCampaigns = vi.fn().mockResolvedValue(pageResponse({
      currentPage: 1,
      lastPage: 10,
      total: 1000,
      data: [],
    }));
    const getPitches = vi.fn().mockResolvedValue(pageResponse({
      currentPage: 1,
      lastPage: 1,
      total: 0,
      data: [],
    }));

    await fetchProjectSummaries({
      client: { getCampaigns, getPitches },
      brandId: "206",
    });

    expect(getCampaigns).toHaveBeenCalledTimes(1);
    expect(getPitches).toHaveBeenCalledTimes(1);
  });

  it("honors a hard page cap for defensive termination", async () => {
    const getCampaigns = vi.fn().mockResolvedValue(pageResponse({
      currentPage: 1,
      lastPage: 999,
      total: 99900,
      data: [
        {
          uuid: "campaign-loop",
          campaign_name: "Loop Campaign",
          brand_id: 206,
          flag: "active",
        },
      ],
    }));
    const getPitches = vi.fn().mockResolvedValue(pageResponse({
      currentPage: 1,
      lastPage: 999,
      total: 99900,
      data: [
        {
          uuid: "pitch-loop",
          pitch_name: "Loop Pitch",
          brand_id: 206,
          status: "win",
        },
      ],
    }));

    await fetchProjectSummaries({
      client: { getCampaigns, getPitches },
      brandId: "206",
      maxPagesPerSource: 2,
    });

    expect(getCampaigns).toHaveBeenCalledTimes(2);
    expect(getPitches).toHaveBeenCalledTimes(2);
  });

  it("reports when source pagination is truncated by the defensive page cap", async () => {
    const getCampaigns = vi.fn().mockResolvedValue(pageResponse({
      currentPage: 1,
      lastPage: 999,
      total: 99900,
      data: [
        {
          uuid: "campaign-loop",
          campaign_name: "Loop Campaign",
          brand_id: 206,
          flag: "active",
        },
      ],
    }));
    const getPitches = vi.fn().mockResolvedValue(pageResponse({
      currentPage: 1,
      lastPage: 1,
      total: 0,
      data: [],
    }));

    const result = await fetchProjectSummaries({
      client: { getCampaigns, getPitches },
      brandId: "206",
      maxPagesPerSource: 2,
    });

    expect(result.data.map((project) => project.id)).toEqual([
      "campaign-loop",
      "campaign-loop",
    ]);
    expect(result.hasMore).toBe(true);
    expect(result.truncated).toBe(true);
  });
});
