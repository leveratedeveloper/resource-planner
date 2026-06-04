import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("TimelineV2 bootstrap integration", () => {
  it("can use the planner home bootstrap endpoint for initial data", () => {
    const source = readFileSync("components/timeline-v2/TimelineV2.tsx", "utf8");

    expect(source).toContain("usePlannerHomeBootstrap");
    expect(source).toContain("NEXT_PUBLIC_PLANNER_HOME_BOOTSTRAP");
    expect(source).toContain("bootstrapEmployees");
    expect(source).toContain("bootstrapPlannerTimeline");
  });
});
