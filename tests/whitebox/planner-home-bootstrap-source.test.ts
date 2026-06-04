import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("planner home bootstrap server composer", () => {
  it("defines a compact home bootstrap contract", () => {
    const source = readFileSync("lib/query/server/planner-home-bootstrap.ts", "utf8");

    expect(source).toContain("export type PlannerHomeBootstrapRequest");
    expect(source).toContain("export type PlannerHomeBootstrapResponse");
    expect(source).toContain("MinimalTimelineEmployee");
    expect(source).toContain("MinimalTimelineProject");
    expect(source).toContain("fetchPlannerHomeBootstrap");
    expect(source).toContain("fetchOrderedEmployeeSlice");
    expect(source).toContain("fetchPlannerTimeline");
  });
});
