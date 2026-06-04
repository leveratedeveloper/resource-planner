import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("project hooks source contract", () => {
  it("loads project filter options from the bounded project summary endpoint", () => {
    const source = readFileSync("lib/query/hooks/useProjects.ts", "utf8");

    expect(source).toContain('fetch("/api/projects/summary")');
    expect(source).toContain("`/api/projects/summary?brandId=${encodeURIComponent(brandId)}`");
  });

  it("does not use a manual hasMore loop for brand project filter metadata", () => {
    const source = readFileSync("lib/query/hooks/useProjects.ts", "utf8");
    const brandFetchStart = source.indexOf("async function fetchProjectsByBrand");
    const brandFetchEnd = source.indexOf("// Hooks");
    const brandFetchSource = source.slice(brandFetchStart, brandFetchEnd);

    expect(brandFetchSource).not.toContain("while (hasMore)");
    expect(brandFetchSource).not.toContain("offset += limit");
    expect(brandFetchSource).not.toContain("Boolean(data.hasMore)");
  });
});
