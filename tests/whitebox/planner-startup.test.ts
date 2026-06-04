import { readFileSync } from "node:fs";
import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getInitialPlannerRequest,
  prefetchCriticalPlannerStartup,
  seedCriticalPlannerStartup,
} from "@/lib/query/server/planner-startup";
import { getPlannerTimelineQueryKey } from "@/lib/timeline/planner-loading";

const mocks = vi.hoisted(() => ({
  fetchInitialEmployeePage: vi.fn(),
  fetchPlannerTimeline: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSession: mocks.getSession,
}));

vi.mock("@/lib/query/server/planner-prefetch", () => ({
  fetchInitialEmployeePage: mocks.fetchInitialEmployeePage,
  fetchPlannerTimeline: mocks.fetchPlannerTimeline,
}));

describe("critical planner startup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hydrates the initial timeline under the client query key", () => {
    const queryClient = new QueryClient();
    const plannerRequest = getInitialPlannerRequest("2026-05-21");
    const plannerTimeline = {
      request: plannerRequest,
      assignments: [],
      actualAssignments: [],
    };

    seedCriticalPlannerStartup(queryClient, {
      plannerTimeline,
    });

    expect(
      queryClient.getQueryData(getPlannerTimelineQueryKey(plannerRequest))
    ).toEqual(plannerTimeline);
  });

  it("keeps employee directory loading out of the critical startup prefetch", async () => {
    const queryClient = new QueryClient();
    const session = {
      access_token: "token",
      user: { id: 1, email: "full@example.com" },
      employee: { uuid: "employee-a" },
      access: { can_view_all: true },
    };
    const plannerRequest = getInitialPlannerRequest("2026-05-21");
    const plannerTimeline = {
      request: plannerRequest,
      assignments: [],
      actualAssignments: [],
    };

    mocks.getSession.mockResolvedValue(session);
    mocks.fetchPlannerTimeline.mockResolvedValue(plannerTimeline);

    await prefetchCriticalPlannerStartup(queryClient, "2026-05-21");

    expect(mocks.fetchInitialEmployeePage).not.toHaveBeenCalled();
    expect(mocks.fetchPlannerTimeline).toHaveBeenCalledWith(session, plannerRequest);
  });

  it("renders the home planner timeline without blocking on server prefetch", () => {
    const pageSource = readFileSync("app/page.tsx", "utf8");

    expect(pageSource.match(/<HomeClient/g)).toHaveLength(1);
    expect(pageSource).toContain("<HomePlannerTimeline");
    expect(pageSource).not.toContain("prefetchCriticalPlannerStartup");
    expect(pageSource).not.toContain("<Suspense");
  });

  it("keeps resource scope filters out of the initial planner request", () => {
    const request = getInitialPlannerRequest("2026-05-21");

    expect(request.filters).toEqual({
      category: null,
      status: null,
    });
    expect(JSON.stringify(request)).not.toContain("projectId");
    expect(JSON.stringify(request)).not.toContain("brandId");
  });
});
