import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("filter bar source", () => {
  it("accepts bootstrap metadata props instead of owning the first-load fetch", () => {
    const source = readFileSync("components/filters/FilterBar.tsx", "utf8");

    expect(source).toContain("brands");
    expect(source).toContain("departments");
    expect(source).toContain("projects");
    expect(source).not.toContain("useBrands()");
    expect(source).not.toContain("useDepartments()");
    expect(source).not.toContain("useProjectOptions()");
  });
});
