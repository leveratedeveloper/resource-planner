import { describe, it, expect } from "vitest";
import { isEvenSplit, monthlyMapsEqual } from "./even-split";

describe("isEvenSplit", () => {
  it("treats a uniform split as even (migration: 33.33/33.33/33.33)", () => {
    expect(isEvenSplit([33.33, 33.33, 33.33])).toBe(true);
  });
  it("treats a largest-remainder split as even (33.33/33.33/33.34)", () => {
    expect(isEvenSplit([33.33, 33.33, 33.34])).toBe(true);
  });
  it("treats whole even splits as even", () => {
    expect(isEvenSplit([20, 20, 20])).toBe(true);
  });
  it("flags an uneven split as customized", () => {
    expect(isEvenSplit([50, 10, 30])).toBe(false);
  });
  it("flags a 1h+ shift as customized", () => {
    expect(isEvenSplit([34, 33, 31])).toBe(false);
  });
  it("treats a single month as even", () => {
    expect(isEvenSplit([42])).toBe(true);
  });
  it("treats an empty distribution as even", () => {
    expect(isEvenSplit([])).toBe(true);
  });
});

describe("monthlyMapsEqual", () => {
  it("is true for equal maps", () => {
    expect(monthlyMapsEqual({ "2026-04-01": 10 }, { "2026-04-01": 10 })).toBe(true);
  });
  it("treats null/undefined/empty as equal", () => {
    expect(monthlyMapsEqual(null, {})).toBe(true);
    expect(monthlyMapsEqual(undefined, null)).toBe(true);
  });
  it("is false when a month value differs", () => {
    expect(monthlyMapsEqual({ "2026-04-01": 10 }, { "2026-04-01": 11 })).toBe(false);
  });
  it("is false when a month is added or removed", () => {
    expect(monthlyMapsEqual({ "2026-04-01": 10 }, { "2026-04-01": 10, "2026-05-01": 5 })).toBe(false);
  });
  it("tolerates sub-1h float drift within a month value", () => {
    expect(monthlyMapsEqual({ "2026-04-01": 33.33 }, { "2026-04-01": 33.34 })).toBe(true);
  });
});
