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
    expect(brandHookSource).toContain("useInfiniteQuery");
    expect(brandHookSource).toContain("getNextPageParam");
    expect(brandHookSource).toContain("initialPageParam");
    // No keepPreviousData: a search/scope change clears to "Searching…" rather
    // than holding the previous term's stale results in a search-first dropdown.
    expect(brandHookSource).not.toContain("keepPreviousData");
    expect(brandHookSource).toContain("staleTime: 5 * 60 * 1000");

    expect(projectHookSource).toContain("/api/planner/filter-options/projects");
    expect(projectHookSource).toContain("usePlannerFilterProjects");
    expect(projectHookSource).toContain("useInfiniteQuery");
    expect(projectHookSource).toContain("getNextPageParam");
    expect(projectHookSource).toContain("brandId");
    expect(projectHookSource).toContain("sourceType");
    expect(projectHookSource).not.toContain("keepPreviousData");

    expect(indexSource).toContain('export * from "./usePlannerFilterBrands"');
    expect(indexSource).toContain('export * from "./usePlannerFilterProjects"');
    expect(queryKeysSource).toContain("plannerFilterBrandsInfinite");
    expect(queryKeysSource).toContain("plannerFilterProjectsInfinite");

    // The criteria predicate now lives in lib/query/filterCriteria.ts; the hooks
    // gate `enabled` through it rather than re-deriving the rule inline.
    expect(brandHookSource).toContain("hasBrandCriteria");
    expect(brandHookSource).toContain("enabled:");

    expect(projectHookSource).toContain("hasProjectCriteria");
    expect(projectHookSource).toContain("enabled:");
  });
});
