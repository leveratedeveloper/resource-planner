import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("home filter options source", () => {
  it("uses dedicated brand and project catalog hooks instead of bootstrap metadata for filter catalogs", () => {
    const source = readFileSync("app/HomeClient.tsx", "utf8");

    expect(source).toContain("usePlannerFilterBrands");
    expect(source).toContain("usePlannerFilterProjects");
    expect(source).toContain("useDebounce(brandSearch");
    expect(source).toContain("useDebounce(projectSearch");
    expect(source).toContain("setDraftBrands");
    expect(source).toContain("setDraftProjects");
    expect(source).toContain("brandIds: projectSearchActive ? [] : draftBrandIds");
    expect(source).toContain("search: debouncedProjectSearch");
    expect(source).toContain(".pages.flatMap");
    expect(source).toContain("brandFeed");
    expect(source).toContain("projectFeed");
    expect(source).toContain("brandTotal");
    expect(source).toContain("projectTotal");
    expect(source).toContain("brandSearchPending");
    expect(source).toContain("projectSearchPending");
    expect(source).toContain("brandSearch.trim() !== debouncedBrandSearch.trim()");
    expect(source).toContain("useDepartments");
    expect(source).not.toContain("allProjects.find((project) => project.id === filterProjectId) ?? null");
    expect(source).not.toContain("Object.values(bootstrapData?.brandsById ?? {}).map(toBrandOption)");
  });
});
