import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("planner startup prefetch retirement", () => {
  it("does not keep unused startup prefetch beside home bootstrap", () => {
    const startupSource = readFileSync("lib/query/server/planner-startup.ts", "utf8");
    const pageSource = readFileSync("app/page.tsx", "utf8");

    expect(pageSource).not.toContain("prefetchCriticalPlannerStartup");
    expect(startupSource).toContain("getInitialPlannerRequest");
    expect(startupSource).not.toContain("prefetchCriticalPlannerStartup");
    expect(startupSource).not.toContain("seedCriticalPlannerStartup");
  });
});
