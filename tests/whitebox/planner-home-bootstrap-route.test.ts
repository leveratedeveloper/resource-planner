import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("planner home bootstrap route", () => {
  it("validates request params and calls the bootstrap composer", () => {
    const source = readFileSync("app/api/planner/home-bootstrap/route.ts", "utf8");

    expect(source).toContain('createRequestTiming("planner_home_bootstrap_api")');
    expect(source).toContain("fetchPlannerHomeBootstrap");
    expect(source).toContain("Buffer.byteLength");
    expect(source).toContain("metadataPartial");
    expect(source).not.toContain("getMySqlApiClient");
  });
});
