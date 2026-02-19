import { describe, it, expect } from "vitest";
import { toLocalDateKey, parseLocalDateKey } from "@/lib/analysis/date-utils";

describe("toLocalDateKey", () => {
  it("formats a date as YYYY-MM-DD", () => {
    const date = new Date(2026, 1, 4); // Feb 4, 2026
    expect(toLocalDateKey(date)).toBe("2026-02-04");
  });

  it("pads single-digit months and days", () => {
    const date = new Date(2026, 0, 9); // Jan 9
    expect(toLocalDateKey(date)).toBe("2026-01-09");
  });

  it("handles December correctly", () => {
    const date = new Date(2026, 11, 25); // Dec 25
    expect(toLocalDateKey(date)).toBe("2026-12-25");
  });
});

describe("parseLocalDateKey", () => {
  it("parses YYYY-MM-DD into a local midnight Date", () => {
    const date = parseLocalDateKey("2026-02-04");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(1); // 0-indexed
    expect(date.getDate()).toBe(4);
    expect(date.getHours()).toBe(0);
  });

  it("roundtrips with toLocalDateKey", () => {
    const original = new Date(2026, 5, 15); // Jun 15
    const key = toLocalDateKey(original);
    const parsed = parseLocalDateKey(key);
    expect(toLocalDateKey(parsed)).toBe(key);
  });
});
