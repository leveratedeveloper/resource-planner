import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("planner directory read path", () => {
  it("uses the local directory repository in the main planner metadata routes", () => {
    const employeeRoute = readFileSync("app/api/employees/route.ts", "utf8");
    const brandsRoute = readFileSync("app/api/brands/route.ts", "utf8");
    const projectsRoute = readFileSync("app/api/projects/route.ts", "utf8");
    const summaryRoute = readFileSync("app/api/projects/summary/route.ts", "utf8");

    expect(employeeRoute).not.toContain("getMySqlApiClient");
    expect(brandsRoute).toContain("plannerDirectoryRepository");
    expect(projectsRoute).toContain("plannerDirectoryRepository");
    expect(summaryRoute).not.toContain("getMySqlApiClient");
  });
});
