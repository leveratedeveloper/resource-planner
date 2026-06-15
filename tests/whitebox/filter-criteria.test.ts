import { describe, expect, it } from "vitest";
import { hasBrandCriteria, hasProjectCriteria } from "@/lib/query/filterCriteria";

describe("hasBrandCriteria", () => {
  it("is false for empty / whitespace-only search", () => {
    expect(hasBrandCriteria("")).toBe(false);
    expect(hasBrandCriteria("   ")).toBe(false);
  });
  it("is true once there is non-whitespace search text", () => {
    expect(hasBrandCriteria("ni")).toBe(true);
  });
});

describe("hasProjectCriteria", () => {
  const empty = { search: "", brandId: null, status: null, sourceType: null } as const;

  it("is false with no search and no scope", () => {
    expect(hasProjectCriteria(empty)).toBe(false);
    expect(hasProjectCriteria({ ...empty, search: "   " })).toBe(false);
  });

  // This is the regression guard for the original id-vs-name bug:
  // a scoped brand (by id) must count as criteria with no typing.
  it("is true when only a brand is scoped by id", () => {
    expect(hasProjectCriteria({ ...empty, brandId: "42" })).toBe(true);
  });

  it("is true when only a status chip is set", () => {
    expect(hasProjectCriteria({ ...empty, status: "active" })).toBe(true);
  });

  it("is true when only a source type chip is set", () => {
    expect(hasProjectCriteria({ ...empty, sourceType: "campaign" })).toBe(true);
  });

  it("is true when there is search text", () => {
    expect(hasProjectCriteria({ ...empty, search: "redesign" })).toBe(true);
  });
});
