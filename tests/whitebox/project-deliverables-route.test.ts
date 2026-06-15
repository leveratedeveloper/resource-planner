import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/projects/[type]/[id]/deliverables/route";
import { getSession } from "@/lib/auth/session";
import { getMySqlApiClient } from "@/lib/mysql/api-client";

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/mysql/api-client", () => ({
  getMySqlApiClient: vi.fn(),
}));

describe("project deliverables route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when no session exists", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ type: "campaigns", id: "project-1" }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Not authenticated" });
  });

  it("returns 400 for unsupported project types", async () => {
    vi.mocked(getSession).mockResolvedValue({ access_token: "token" } as never);

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ type: "tasks", id: "project-1" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      error: "Unsupported project type",
      data: [],
    });
  });

  it("maps deliverables from typed API response", async () => {
    vi.mocked(getSession).mockResolvedValue({ access_token: "token" } as never);
    vi.mocked(getMySqlApiClient).mockReturnValue({
      getProjectDeliverables: vi.fn().mockResolvedValue({
        status: 200,
        success: true,
        message: "ok",
        data: {
          data: [
            {
              id: 1,
              channel_id: 2,
              deliverable_name: "A",
              deliverable_name_new: "B",
              flag: "active",
              channel: {
                id: 3,
                channel_name: "Legacy",
                channel_name_new: "Modern",
              },
            },
          ],
        },
      }),
    } as never);

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ type: "campaigns", id: "project-1" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: [
        {
          id: "1",
          channelId: "2",
          deliverableName: "A",
          deliverableNameNew: "B",
          flag: "active",
          channel: {
            id: "3",
            channelName: "Modern",
          },
        },
      ],
    });
  });
});
