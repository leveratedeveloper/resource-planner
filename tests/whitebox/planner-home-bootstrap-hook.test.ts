import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("planner home bootstrap hook", () => {
  it("fetches the compact home bootstrap endpoint with a single windowed query", () => {
    const hookSource = readFileSync("lib/query/hooks/usePlannerHomeBootstrap.ts", "utf8");
    const indexSource = readFileSync("lib/query/hooks/index.ts", "utf8");

    expect(hookSource).toContain("/api/planner/home-bootstrap");
    expect(hookSource).toContain("usePlannerHomeBootstrapWindow");
    expect(hookSource).toContain("useQuery");
    expect(hookSource).toContain("queryKeys.plannerHomeBootstrap");
    expect(hookSource).toContain("keepPreviousData");
    expect(hookSource).toContain("initialData");
    expect(hookSource).toContain("initialDataUpdatedAt");
    expect(indexSource).toContain("usePlannerHomeBootstrap");
  });
});
