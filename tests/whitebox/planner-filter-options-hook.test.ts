import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("planner filter options hook", () => {
  it("fetches brands and projects from dedicated split routes with stable caching", () => {
    const brandHookSource = readFileSync("lib/query/hooks/usePlannerFilterBrands.ts", "utf8");
    const projectHookSource = readFileSync("lib/query/hooks/usePlannerFilterProjects.ts", "utf8");
    const indexSource = readFileSync("lib/query/hooks/index.ts", "utf8");
    const queryKeysSource = readFileSync("lib/query/queryKeys.ts", "utf8");

    expect(brandHookSource).toContain("/api/planner/filter-options/brands");
    expect(brandHookSource).toContain("usePlannerFilterBrands");
    expect(brandHookSource).toContain("useQuery");
    expect(brandHookSource).not.toContain("useInfiniteQuery");
    expect(brandHookSource).not.toContain("getNextPageParam");
    expect(brandHookSource).toContain("staleTime: 5 * 60 * 1000");
    expect(brandHookSource).not.toContain("placeholderData: keepPreviousData");

    expect(projectHookSource).toContain("/api/planner/filter-options/projects");
    expect(projectHookSource).toContain("usePlannerFilterProjects");
    expect(projectHookSource).toContain("useQuery");
    expect(projectHookSource).not.toContain("useInfiniteQuery");
    expect(projectHookSource).not.toContain("getNextPageParam");
    expect(projectHookSource).toContain("staleTime: 5 * 60 * 1000");
    expect(projectHookSource).not.toContain("placeholderData: keepPreviousData");

    expect(indexSource).toContain('export * from "./usePlannerFilterBrands"');
    expect(indexSource).toContain('export * from "./usePlannerFilterProjects"');
    expect(queryKeysSource).toContain("plannerFilterBrands");
    expect(queryKeysSource).toContain("plannerFilterProjects");
  });
});
