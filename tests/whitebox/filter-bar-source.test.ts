import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("filter bar source contract", () => {
  it("renders brand and project filters through the same compact scope select component", () => {
    const source = readFileSync("components/filters/FilterBar.tsx", "utf8");

    expect(source).toContain("<TimelineScopeSelect");
    expect(source.match(/<TimelineScopeSelect/g)?.length).toBe(2);
    expect(source).toContain('testId="filter-brand-trigger"');
    expect(source).toContain('testId="filter-project-trigger"');
  });

  it("does not keep hidden assignment filter dropdown code in the planner filter bar", () => {
    const source = readFileSync("components/filters/FilterBar.tsx", "utf8");

    expect(source).not.toContain("ASSIGNMENT_CATEGORIES");
    expect(source).not.toContain("ASSIGNMENT_STATUSES");
    expect(source).not.toContain("More Dropdown with Category, Status");
    expect(source).not.toContain("filter-clear-all");
  });
});
