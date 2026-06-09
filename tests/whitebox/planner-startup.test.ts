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

  it("renders the home shell without awaiting planner bootstrap on the server", () => {
    const pageSource = readFileSync("app/page.tsx", "utf8");

    expect(pageSource.match(/<HomeClient/g)).toHaveLength(1);
    expect(pageSource).toContain("<HomePlannerTimeline");
    expect(pageSource).not.toContain("fetchPlannerHomeBootstrap");
    expect(pageSource).not.toContain("await fetchPlannerHomeBootstrap");
    expect(pageSource).not.toContain("initialBootstrap={initialBootstrap");
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

  it("logs timeline first visible after the initial loading state clears", () => {
    const timelineSource = readFileSync("components/timeline-v2/TimelineV2.tsx", "utf8");

    expect(timelineSource).toContain('phase: "timeline_first_visible"');
    expect(timelineSource).toContain("hasLoggedTimelineFirstVisibleRef");
    expect(timelineSource).toContain("if (isInitialTimelineLoading || hasLoggedTimelineFirstVisibleRef.current) return;");
  });
});
