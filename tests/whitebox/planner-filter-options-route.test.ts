import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("planner filter options route", () => {
  it("uses dedicated local directory filter catalog contracts for brands and projects", () => {
    const brandRouteSource = readFileSync("app/api/planner/filter-options/brands/route.ts", "utf8");
    const projectRouteSource = readFileSync("app/api/planner/filter-options/projects/route.ts", "utf8");
    const brandServerSource = readFileSync("lib/query/server/planner-filter-brands.ts", "utf8");
    const projectServerSource = readFileSync("lib/query/server/planner-filter-projects.ts", "utf8");

    expect(brandRouteSource).toContain("fetchPlannerFilterBrands");
    expect(brandRouteSource).not.toContain("selectedBrandId");
    expect(brandRouteSource).not.toContain("offset");
    expect(brandRouteSource).not.toContain("limit");

    expect(projectRouteSource).toContain("fetchPlannerFilterProjects");
    expect(projectRouteSource).toContain("selectedProjectId");
    expect(projectRouteSource).toContain("status");
    expect(projectRouteSource).toContain("sourceType");
    expect(projectRouteSource).toContain("offset");
    expect(projectRouteSource).toContain("limit");

    expect(brandServerSource).toContain("plannerDirectoryRepository.listBrandsForFilterOptions");
    expect(brandServerSource).not.toContain("plannerDirectoryRepository.listBrandsByIds");
    expect(brandServerSource).toContain("export type PlannerFilterBrandsRequest");
    expect(brandServerSource).toContain("export type PlannerFilterBrandsResponse");

    expect(projectServerSource).toContain("plannerDirectoryRepository.listProjectsForFilterOptions");
    expect(projectServerSource).toContain("plannerDirectoryRepository.getProjectForFilterOption");
    expect(projectServerSource).toContain("export type PlannerFilterProjectsRequest");
    expect(projectServerSource).toContain("export type PlannerFilterProjectsResponse");
    expect(projectServerSource).toContain("availableStatuses");
    expect(projectServerSource).toContain("availableTypes");
  });
});
