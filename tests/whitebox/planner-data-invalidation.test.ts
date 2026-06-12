import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("planner data invalidation", () => {
  it("defines a shared planner home bootstrap query key and invalidation helper", () => {
    const queryKeysSource = readFileSync("lib/query/queryKeys.ts", "utf8");
    const invalidationSource = readFileSync("lib/query/invalidatePlannerData.ts", "utf8");

    expect(queryKeysSource).toContain('plannerHomeBootstrap: ["planner-home-bootstrap"] as const');
    expect(invalidationSource).toContain("invalidatePlannerData");
    expect(invalidationSource).toContain("queryKeys.plannerHomeBootstrap");
    expect(invalidationSource).toContain("queryKeys.plannerTimeline");
  });

  it("planned assignment mutations refresh planner home bootstrap data", () => {
    const source = readFileSync("lib/query/hooks/useAssignments.ts", "utf8");

    expect(source).toContain("invalidatePlannerData");
    expect(source).not.toContain("queryClient.invalidateQueries({ queryKey: queryKeys.plannerTimeline");
  });

  it("actual assignment mutations refresh planner home bootstrap data", () => {
    const source = readFileSync("lib/query/hooks/useActualAssignments.ts", "utf8");

    expect(source).toContain("invalidatePlannerData");
    expect(source).not.toContain("queryClient.invalidateQueries({ queryKey: queryKeys.plannerTimeline");
  });

  it("Timeline V2 monthly flows refresh planner home bootstrap data", () => {
    const source = readFileSync("components/timeline-v2/useTimelineEditor.ts", "utf8");

    expect(source).toContain("invalidatePlannerData");
    expect(source).not.toContain("queryClient.invalidateQueries({ queryKey: queryKeys.plannerTimeline");
  });
});
