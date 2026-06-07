import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("TimelineV2 bootstrap integration", () => {
  it("uses bootstrap as the first employee page instead of the final roster", () => {
    const source = readFileSync("components/timeline-v2/TimelineV2.tsx", "utf8");

    expect(source).toContain("usePlannerHomeBootstrap");
    expect(source).toContain("NEXT_PUBLIC_PLANNER_HOME_BOOTSTRAP");
    expect(source).toContain("bootstrapEmployeePage");
    expect(source).toContain("initialPage: bootstrapEmployeePage");
    expect(source).toContain("getLoadedTimelineEmployees(incrementalEmployeePages?.pages)");
    expect(source).toContain("bootstrapPlannerTimeline");
    expect(source).not.toContain("const employees = bootstrapEmployees ?? (");
    expect(source).not.toContain("shouldUseHomeBootstrap || !!plannerHomeBootstrap");
    expect(source).not.toContain("useProjectsByBrand(brandId ?? \"\")");
    expect(source).not.toContain("useBrands()");
    expect(source).not.toContain("useProjectOptions()");
  });
});
