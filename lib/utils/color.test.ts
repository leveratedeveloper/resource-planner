import { describe, it, expect } from "vitest";
import { randomColor } from "./color";

describe("randomColor", () => {
  it("returns a 6-digit hex color for a seed", () => {
    expect(randomColor("abc")).toMatch(/^#[0-9a-f]{6}$/);
  });
  it("is deterministic for the same seed", () => {
    expect(randomColor("brand-42")).toBe(randomColor("brand-42"));
  });
  it("differs for different seeds", () => {
    expect(randomColor("a")).not.toBe(randomColor("b"));
  });
});
