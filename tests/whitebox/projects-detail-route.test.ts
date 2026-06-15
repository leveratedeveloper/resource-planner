import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(async () => ({ access_token: "tok" })),
}));

const fetchCampaign = vi.fn();
const fetchPitch = vi.fn();
vi.mock("@/lib/planner-directory/timetrack-source", () => ({
  fetchTimetrackCampaignByUuid: (...args: unknown[]) => fetchCampaign(...args),
  fetchTimetrackPitchByUuid: (...args: unknown[]) => fetchPitch(...args),
}));

import { GET } from "@/app/api/projects/[type]/[id]/route";

function makeRequest() {
  return new Request("http://localhost/api/projects/campaigns/c-1");
}

describe("GET /api/projects/[type]/[id]", () => {
  beforeEach(() => {
    fetchCampaign.mockReset();
    fetchPitch.mockReset();
  });

  it("rejects an unsupported project type", async () => {
    const res = await GET(makeRequest(), {
      params: Promise.resolve({ type: "widgets", id: "x" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns the mapped campaign on success", async () => {
    fetchCampaign.mockResolvedValue({
      uuid: "c-1",
      io_number: "IO-1",
      campaign_name: "ALO",
      brand_id: 9,
      company_id: 3,
      currency: "IDR",
      budget: 100,
      asf: 5,
      grand_total: 105,
      start_date: "2026-04-01",
      end_date: "2026-04-30",
      notes: "n",
      io_file: "",
      state: "publish",
      flag: "active",
      quotation_reference: "Q-1",
      created_at: "2026-03-01T00:00:00Z",
      updated_at: "2026-03-15T00:00:00Z",
    });
    const res = await GET(makeRequest(), {
      params: Promise.resolve({ type: "campaigns", id: "c-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe("c-1");
    expect(body.data.budget).toBe("100");
    expect(body.data.projectNumber).toBe("IO-1");
  });

  it("returns 404 when Timetrack has no such record", async () => {
    fetchPitch.mockResolvedValue(null);
    const res = await GET(makeRequest(), {
      params: Promise.resolve({ type: "pitches", id: "missing" }),
    });
    expect(res.status).toBe(404);
  });
});
