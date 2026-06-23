import { describe, expect, it } from "vitest";
import { hasBrandCriteria, hasProjectCriteria, type ProjectCriteria } from "@/lib/query/filterCriteria";

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
  const empty: ProjectCriteria = { search: "", brandIds: [], status: null, sourceType: null };

  it("is false with no search and no scope", () => {
    expect(hasProjectCriteria(empty)).toBe(false);
    expect(hasProjectCriteria({ ...empty, search: "   " })).toBe(false);
  });

  // This is the regression guard for the original id-vs-name bug:
  // a scoped brand (by id) must count as criteria with no typing.
  it("is true when only a brand is scoped by id", () => {
    expect(hasProjectCriteria({ ...empty, brandIds: ["42"] })).toBe(true);
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

  it("is true when one or more brands are scoped, with no search", () => {
    expect(hasProjectCriteria({ search: "", brandIds: ["b1"], status: null, sourceType: null })).toBe(true);
    expect(hasProjectCriteria({ search: "", brandIds: ["b1", "b2"], status: null, sourceType: null })).toBe(true);
  });
  it("is false with empty brandIds and no other criteria", () => {
    expect(hasProjectCriteria({ search: "", brandIds: [], status: null, sourceType: null })).toBe(false);
  });
});
