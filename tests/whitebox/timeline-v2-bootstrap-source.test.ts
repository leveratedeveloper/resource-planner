import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Timeline bootstrap integration", () => {
  it("uses the paged bootstrap hook as the only timeline data source", () => {
    const source = readFileSync("components/timeline-v2/Timeline.tsx", "utf8");

    expect(source).toContain("useTimelineEmployees({");
    expect(source).toContain("request: bootstrapRequest");
    expect(source).not.toContain("usePlannerTimeline(");
    expect(source).not.toContain("usePlannerHomeBootstrap(");
    expect(source).not.toContain("useInfiniteEmployees");
    expect(source).not.toContain("useCompleteEmployeeList");
  });

  it("fetches the bootstrap in a single windowed query with keepPreviousData", () => {
    const hookSource = readFileSync("lib/query/hooks/usePlannerHomeBootstrap.ts", "utf8");

    expect(hookSource).toContain("useQuery");
    expect(hookSource).toContain("usePlannerHomeBootstrapWindow");
    expect(hookSource).toContain("keepPreviousData");
    expect(hookSource).toContain("/api/planner/home-bootstrap");
  });

  it("merges loaded pages and seeds page 0 from the server bootstrap", () => {
    const employeesHookSource = readFileSync("lib/timeline-v2/use-timeline-employees.ts", "utf8");
    const timelineSource = readFileSync("components/timeline-v2/Timeline.tsx", "utf8");

    expect(employeesHookSource).toContain("mergeBootstrapPages");
    expect(employeesHookSource).toContain("initialData: initialBootstrap ?? undefined");
    expect(employeesHookSource).toContain("initialDataUpdatedAt: initialBootstrap");
    expect(timelineSource).toContain("initialBootstrap?: PlannerHomeBootstrapResponse | null");
    expect(timelineSource).toContain("initialBootstrap,");
  });
});
