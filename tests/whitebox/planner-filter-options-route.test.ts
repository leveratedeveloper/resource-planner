import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("planner filter options route", () => {
  it("uses dedicated local directory filter catalog contracts for brands and projects", () => {
    const brandRouteSource = readFileSync("app/api/planner/filter-options/brands/route.ts", "utf8");
    const projectRouteSource = readFileSync("app/api/planner/filter-options/projects/route.ts", "utf8");
    const brandServerSource = readFileSync("lib/query/server/planner-filter-brands.ts", "utf8");
    const projectServerSource = readFileSync("lib/query/server/planner-filter-projects.ts", "utf8");

    expect(brandRouteSource).toContain("fetchPlannerFilterBrands");
    expect(brandRouteSource).toContain("NextRequest");
    expect(brandRouteSource).toContain("boundedInteger");
    expect(brandRouteSource).toContain('searchParams.get("limit")');
    expect(brandRouteSource).toContain('searchParams.get("offset")');
    expect(brandRouteSource).toContain('searchParams.get("search")');

    expect(projectRouteSource).toContain("fetchPlannerFilterProjects");
    expect(projectRouteSource).toContain('searchParams.get("status")');
    expect(projectRouteSource).toContain('searchParams.get("sourceType")');
    expect(projectRouteSource).toContain('searchParams.get("offset")');
    expect(projectRouteSource).toContain('searchParams.get("limit")');
    expect(projectRouteSource).toContain('searchParams.get("search")');
    expect(projectRouteSource).toContain("brandIds");

    expect(brandServerSource).toContain("plannerDirectoryRepository.listBrandsForFilterOptions");
    expect(brandServerSource).not.toContain("plannerDirectoryRepository.listBrandsByIds");
    expect(brandServerSource).toContain("export type PlannerFilterBrandsRequest");
    expect(brandServerSource).toContain("export type PlannerFilterBrandsResponse");
    expect(brandServerSource).toContain("request.limit");
    expect(brandServerSource).toContain("request.offset");
    expect(brandServerSource).toContain("request.search");

    expect(projectServerSource).toContain("plannerDirectoryRepository.listProjectsForFilterOptions");
    expect(projectServerSource).not.toContain("plannerDirectoryRepository.getProjectForFilterOption");
    expect(projectServerSource).toContain("export type PlannerFilterProjectsRequest");
    expect(projectServerSource).toContain("export type PlannerFilterProjectsResponse");
    expect(projectServerSource).toContain("request.brandIds");
    expect(projectServerSource).toContain("request.status");
    expect(projectServerSource).toContain("request.sourceType");
    expect(projectServerSource).toContain("request.search");
  });
});
