import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getInitialPlannerRequest } from "@/lib/query/server/planner-startup";

describe("planner startup", () => {
  it("builds the default initial planner request", () => {
    expect(getInitialPlannerRequest("2026-05-21")).toEqual({
      viewMode: "quarter",
      resolution: "month",
      startDate: "2026-04-01",
      endDate: "2026-06-30",
      filters: {
        category: null,
        status: null,
      },
    });
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
