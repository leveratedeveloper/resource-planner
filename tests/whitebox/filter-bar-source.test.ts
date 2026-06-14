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
    expect(brandSelectSource).not.toContain("filteredBrands");
    expect(brandSelectSource).toContain("renderedBrands");
    expect(brandSelectSource).toContain("brand.companyName");
    expect(brandSelectSource).toContain("hasMore");
    expect(brandSelectSource).toContain("onLoadMore");
    expect(brandSelectSource).toContain("isFetchingNextPage");
    expect(brandSelectSource).toContain('addEventListener("scroll"');
    expect(brandSelectSource).toContain("data-radix-scroll-area-viewport");
    expect(brandSelectSource).toContain("filter-brand-loading-more");
    expect(projectSelectSource).toContain("projectSearch");
    expect(projectSelectSource).toContain("onProjectSearchChange");
    expect(projectSelectSource).not.toContain("filteredProjects");
    expect(projectSelectSource).toContain("renderedProjects");
    expect(projectSelectSource).toContain("hasMore");
    expect(projectSelectSource).toContain("onLoadMore");
    expect(projectSelectSource).toContain('addEventListener("scroll"');
    expect(projectSelectSource).toContain("filter-project-loading-more");
    expect(projectSelectSource).toContain("selectedStatus");
    expect(projectSelectSource).toContain("selectedSourceType");
    expect(projectSelectSource).toContain("Status");
    expect(projectSelectSource).toContain("Project Type");
    expect(projectSelectSource).toContain("formatFilterLabel");
    expect(projectSelectSource).toContain("grid grid-cols-3 gap-1");
  });
});
