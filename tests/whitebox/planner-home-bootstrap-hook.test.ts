import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("planner home bootstrap hook", () => {
  it("pages the compact home bootstrap endpoint by employee offset", () => {
    const hookSource = readFileSync("lib/query/hooks/usePlannerHomeBootstrap.ts", "utf8");
    const indexSource = readFileSync("lib/query/hooks/index.ts", "utf8");

    expect(hookSource).toContain("/api/planner/home-bootstrap");
    expect(hookSource).toContain("usePlannerHomeBootstrapPages");
    expect(hookSource).toContain("useInfiniteQuery");
    expect(hookSource).toContain("queryKeys.plannerHomeBootstrap");
    expect(hookSource).toContain("getNextPageParam");
    expect(hookSource).toContain("keepPreviousData");
    expect(hookSource).toContain("initialData");
    expect(hookSource).toContain("initialDataUpdatedAt");
    expect(indexSource).toContain("usePlannerHomeBootstrap");
  });
});
