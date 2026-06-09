import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("TimelineV2 bootstrap integration", () => {
  it("uses the home bootstrap hook as the active timeline data source", () => {
    const source = readFileSync("components/timeline-v2/TimelineV2.tsx", "utf8");

    expect(source).toContain("usePlannerHomeBootstrap");
    expect(source).toContain("const plannerTimeline = bootstrapPlannerTimeline");
    expect(source).toContain("const bootstrapEmployeePage");
    expect(source).not.toContain("usePlannerTimeline(");
  });

  it("enables client bootstrap from a valid bootstrap request without requiring server initial data", () => {
    const source = readFileSync("components/timeline-v2/TimelineV2.tsx", "utf8");

    expect(source).toContain("enabled: !!bootstrapRequest");
    expect(source).not.toContain("enabled: shouldUseHomeBootstrap && !!bootstrapRequest");
    expect(source).not.toContain("process.env.NEXT_PUBLIC_PLANNER_HOME_BOOTSTRAP");
  });

  it("keeps optional initial bootstrap support only as query seed data", () => {
    const source = readFileSync("components/timeline-v2/TimelineV2.tsx", "utf8");

    expect(source).toContain("initialBootstrap?: PlannerHomeBootstrapResponse | null");
    expect(source).toContain("initialData: initialBootstrap ?? undefined");
    expect(source).toContain("initialDataUpdatedAt: initialBootstrap");
  });
});
