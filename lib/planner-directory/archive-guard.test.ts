import { describe, it, expect } from "vitest";
import { shouldSkipArchive } from "./archive-guard";

describe("shouldSkipArchive", () => {
  it("skips when no ids were seen (an empty sync must not archive everything)", () => {
    expect(shouldSkipArchive([])).toBe(true);
  });
  it("proceeds when at least one id was seen", () => {
    expect(shouldSkipArchive(["a"])).toBe(false);
    expect(shouldSkipArchive(["a", "b"])).toBe(false);
  });
});
