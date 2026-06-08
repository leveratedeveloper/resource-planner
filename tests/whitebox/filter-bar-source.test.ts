import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("filter bar source", () => {
  it("accepts filter metadata props instead of owning metadata fetches", () => {
    const source = readFileSync("components/filters/FilterBar.tsx", "utf8");
    const brandSelectSource = readFileSync("components/filters/BrandFilterCombobox.tsx", "utf8");
    const projectSelectSource = readFileSync("components/filters/ProjectFilterCombobox.tsx", "utf8");

    expect(source).toContain("brands");
    expect(source).toContain("selectedBrand");
    expect(source).toContain("departments");
    expect(source).toContain("projects");
    expect(source).toContain("BrandFilterCombobox");
    expect(source).toContain("ProjectFilterCombobox");
    expect(source).not.toContain("useBrands()");
    expect(source).not.toContain("useDepartments()");
    expect(source).not.toContain("useProjectOptions()");
    expect(brandSelectSource).toContain("brandSearch");
    expect(brandSelectSource).toContain("onBrandSearchChange");
    expect(brandSelectSource).toContain("brandHasMore");
    expect(brandSelectSource).toContain("onLoadMoreBrands");
    expect(projectSelectSource).toContain("projectSearch");
    expect(projectSelectSource).toContain("onProjectSearchChange");
    expect(projectSelectSource).toContain("projectHasMore");
    expect(projectSelectSource).toContain("onLoadMoreProjects");
    expect(projectSelectSource).toContain("selectedStatus");
    expect(projectSelectSource).toContain("selectedSourceType");
  });
});
