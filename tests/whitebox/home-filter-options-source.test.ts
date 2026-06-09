import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("home filter options source", () => {
  it("uses dedicated brand and project catalog hooks instead of bootstrap metadata for filter catalogs", () => {
    const source = readFileSync("app/HomeClient.tsx", "utf8");

    expect(source).toContain("usePlannerFilterBrands");
    expect(source).not.toContain("useInfinitePlannerFilterBrands");
    expect(source).toContain("usePlannerFilterProjects");
    expect(source).not.toContain("useInfinitePlannerFilterProjects");
    expect(source).toContain("selectedBrand");
    expect(source).toContain("brands.find((brand) => brand.id === selectedBrandId) ?? null");
    expect(source).toContain("selectedProject");
    expect(source).toContain("allProjects.find((project) => project.id === filterProjectId) ?? null");
    expect(source).toContain("brandSearch");
    expect(source).toContain("projectSearch");
    expect(source).toContain("brandOptions?.brands.map");
    expect(source).toContain("projectOptions?.projects.map");
    expect(source).toContain("brandTotal");
    expect(source).toContain("projectTotal");
    expect(source).not.toContain("onLoadMoreProjects");
    expect(source).not.toContain("onLoadMoreBrands");
    expect(source).toContain("useDepartments");
    expect(source).not.toContain("Object.values(bootstrapData?.brandsById ?? {}).map(toBrandOption)");
    expect(source).not.toContain("Object.values(bootstrapData?.projectsById ?? {}).map(toProjectOption)");
  });
});
