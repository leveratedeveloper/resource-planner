/**
 * Unit tests for date-utils.ts
 * Tests local-timezone date key generation and parsing
 */

import { describe, it, expect } from "vitest";
import { toLocalDateKey, parseLocalDateKey } from "../date-utils";

describe("toLocalDateKey", () => {
  it("formats a normal date to YYYY-MM-DD", () => {
    const date = new Date(2026, 1, 4); // Feb 4, 2026 local
    expect(toLocalDateKey(date)).toBe("2026-02-04");
  });

  it("handles single-digit month and day with zero-padding", () => {
    const date = new Date(2026, 0, 3); // Jan 3, 2026
    expect(toLocalDateKey(date)).toBe("2026-01-03");
  });

  it("handles end-of-year dates", () => {
    const date = new Date(2026, 11, 31); // Dec 31, 2026
    expect(toLocalDateKey(date)).toBe("2026-12-31");
  });

  it("handles midnight exactly", () => {
    const date = new Date(2026, 1, 4, 0, 0, 0, 0);
    expect(toLocalDateKey(date)).toBe("2026-02-04");
  });

  it("handles late-night times (23:59) without shifting to next day", () => {
    const date = new Date(2026, 1, 4, 23, 59, 59, 999);
    expect(toLocalDateKey(date)).toBe("2026-02-04");
  });
});

describe("parseLocalDateKey", () => {
  it("parses YYYY-MM-DD to a Date at local midnight", () => {
    const date = parseLocalDateKey("2026-02-04");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(1); // 0-indexed
    expect(date.getDate()).toBe(4);
    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
  });

  it("round-trips with toLocalDateKey", () => {
    const original = "2026-03-15";
    const parsed = parseLocalDateKey(original);
    const roundTripped = toLocalDateKey(parsed);
    expect(roundTripped).toBe(original);
  });

  it("round-trips a date object through both functions", () => {
    const original = new Date(2026, 5, 20); // Jun 20, 2026
    const key = toLocalDateKey(original);
    const parsed = parseLocalDateKey(key);
    expect(parsed.getFullYear()).toBe(original.getFullYear());
    expect(parsed.getMonth()).toBe(original.getMonth());
    expect(parsed.getDate()).toBe(original.getDate());
  });

  it("handles January 1st correctly", () => {
    const date = parseLocalDateKey("2026-01-01");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(0);
    expect(date.getDate()).toBe(1);
  });

  it("handles December 31st correctly", () => {
    const date = parseLocalDateKey("2026-12-31");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(11);
    expect(date.getDate()).toBe(31);
  });
});
